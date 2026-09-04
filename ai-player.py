"""Autonomous Kingdom Under Siege player using only Python's standard library.

The bot launches Chrome or Edge, connects through the browser's local DevTools
protocol, reads the live game state, and makes strategic build/upgrade decisions.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
from urllib.request import ProxyHandler, build_opener
from urllib.parse import urlparse


WORLD_WIDTH = 1280
WORLD_HEIGHT = 720
TRACK_CLEARANCE = 57
TOWER_CLEARANCE = 56


def find_browser() -> str:
    candidates = [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
    ]
    for executable in candidates:
        if executable.exists():
            return str(executable)
    for name in ("google-chrome", "chromium", "chromium-browser", "microsoft-edge"):
        executable = shutil.which(name)
        if executable:
            return executable
    raise RuntimeError("Chrome or Edge was not found")


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


class WebSocket:
    """Small RFC 6455 client sufficient for localhost Chrome DevTools traffic."""

    def __init__(self, url: str):
        parsed = urlparse(url)
        if parsed.scheme != "ws":
            raise RuntimeError(f"Unsupported DevTools URL: {url}")
        self.socket = socket.create_connection((parsed.hostname, parsed.port), timeout=10)
        self.buffer = b""
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        path = parsed.path + (f"?{parsed.query}" if parsed.query else "")
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {parsed.hostname}:{parsed.port}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n"
            "Origin: http://localhost\r\n\r\n"
        )
        self.socket.sendall(request.encode("ascii"))
        response = self._read_headers()
        if b" 101 " not in response.split(b"\r\n", 1)[0]:
            raise RuntimeError(f"DevTools WebSocket upgrade failed: {response[:160]!r}")
        expected = base64.b64encode(
            hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()
        )
        if expected.lower() not in response.lower():
            raise RuntimeError("DevTools WebSocket returned an invalid handshake")

    def _read_headers(self) -> bytes:
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = self.socket.recv(4096)
            if not chunk:
                raise RuntimeError("Browser closed during WebSocket handshake")
            data += chunk
        headers, self.buffer = data.split(b"\r\n\r\n", 1)
        return headers

    def _read_exact(self, size: int) -> bytes:
        while len(self.buffer) < size:
            chunk = self.socket.recv(max(4096, size - len(self.buffer)))
            if not chunk:
                raise RuntimeError("Browser closed the DevTools connection")
            self.buffer += chunk
        result, self.buffer = self.buffer[:size], self.buffer[size:]
        return result

    def _send_frame(self, opcode: int, payload: bytes = b"") -> None:
        mask = os.urandom(4)
        length = len(payload)
        header = bytes([0x80 | opcode])
        if length < 126:
            header += bytes([0x80 | length])
        elif length < 65536:
            header += bytes([0x80 | 126]) + struct.pack("!H", length)
        else:
            header += bytes([0x80 | 127]) + struct.pack("!Q", length)
        masked = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        self.socket.sendall(header + mask + masked)

    def send_text(self, text: str) -> None:
        self._send_frame(0x1, text.encode("utf-8"))

    def receive_text(self) -> str:
        fragments = bytearray()
        while True:
            first, second = self._read_exact(2)
            final = bool(first & 0x80)
            opcode = first & 0x0F
            length = second & 0x7F
            if length == 126:
                length = struct.unpack("!H", self._read_exact(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", self._read_exact(8))[0]
            mask = self._read_exact(4) if second & 0x80 else None
            payload = self._read_exact(length)
            if mask:
                payload = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
            if opcode == 0x8:
                raise RuntimeError("Browser closed the DevTools WebSocket")
            if opcode == 0x9:
                self._send_frame(0xA, payload)
                continue
            if opcode in (0x0, 0x1):
                fragments.extend(payload)
                if final:
                    return fragments.decode("utf-8")

    def close(self) -> None:
        try:
            self._send_frame(0x8)
            self.socket.close()
        except OSError:
            pass


class DevTools:
    def __init__(self, url: str):
        self.connection = WebSocket(url)
        self.command_id = 0

    def call(self, method: str, params: dict | None = None) -> dict:
        self.command_id += 1
        command_id = self.command_id
        self.connection.send_text(json.dumps({"id": command_id, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self.connection.receive_text())
            if message.get("id") != command_id:
                continue
            if "error" in message:
                raise RuntimeError(message["error"].get("message", str(message["error"])))
            return message.get("result", {})

    def evaluate(self, expression: str, user_gesture: bool = False):
        response = self.call("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True,
            "userGesture": user_gesture,
        })
        if "exceptionDetails" in response:
            raise RuntimeError(response["exceptionDetails"].get("text", "JavaScript evaluation failed"))
        result = response.get("result", {})
        if result.get("subtype") == "error":
            raise RuntimeError(result.get("description", "JavaScript evaluation failed"))
        return result.get("value")

    def close(self) -> None:
        self.connection.close()


def distance_to_segment(point: tuple[float, float], start: dict, end: dict) -> float:
    px, py = point
    dx, dy = end["x"] - start["x"], end["y"] - start["y"]
    length_squared = dx * dx + dy * dy
    amount = 0 if not length_squared else max(0, min(1, ((px - start["x"]) * dx + (py - start["y"]) * dy) / length_squared))
    return math.hypot(px - (start["x"] + amount * dx), py - (start["y"] + amount * dy))


def legal_position(point: tuple[float, float], snapshot: dict) -> bool:
    x, y = point
    offset = snapshot["worldOffsetX"]
    path = snapshot["path"]
    if x < -offset + 35 or x > WORLD_WIDTH + offset - 35 or y < 105 or y > WORLD_HEIGHT - 125:
        return False
    if min(distance_to_segment(point, path[index], path[index + 1]) for index in range(len(path) - 1)) < TRACK_CLEARANCE:
        return False
    if math.hypot(x - path[-1]["x"], y - path[-1]["y"]) < 105:
        return False
    return all(math.hypot(x - tower["x"], y - tower["y"]) >= TOWER_CLEARANCE for tower in snapshot["towers"])


def sample_path(path: list[dict]) -> list[tuple[float, float, float]]:
    samples = []
    segment_count = max(1, len(path) - 1)
    for index, (start, end) in enumerate(zip(path, path[1:])):
        length = math.hypot(end["x"] - start["x"], end["y"] - start["y"])
        pieces = max(1, math.ceil(length / 24))
        for piece in range(pieces + 1):
            amount = piece / pieces
            samples.append((
                start["x"] + (end["x"] - start["x"]) * amount,
                start["y"] + (end["y"] - start["y"]) * amount,
                0.75 + 0.5 * (index + amount) / segment_count,
            ))
    return samples


def position_score(point: tuple[float, float], tower_type: str, snapshot: dict) -> float:
    definition = snapshot["definitions"][tower_type]
    range_value = definition["range"]
    coverage = sum(weight for x, y, weight in sample_path(snapshot["path"]) if math.hypot(point[0] - x, point[1] - y) <= range_value)
    attack_bonus = {"single": 1.0, "splash": 1.22, "slow": 1.12}[definition["attack"]]
    dps = definition["damage"] * definition["rate"] * attack_bonus
    overlap_penalty = sum(
        max(0, (range_value * 0.72 - math.hypot(point[0] - tower["x"], point[1] - tower["y"])) / range_value)
        for tower in snapshot["towers"]
    )
    return coverage * dps / max(1, definition["cost"]) - overlap_penalty * 1.8


def best_build(snapshot: dict, max_towers: int):
    if len(snapshot["towers"]) >= max_towers:
        return None
    affordable = [tower_type for tower_type in snapshot["roster"] if snapshot["definitions"][tower_type]["cost"] <= snapshot["gold"]]
    if not affordable:
        return None
    existing_types = {tower["type"] for tower in snapshot["towers"]}
    missing = [tower_type for tower_type in affordable if tower_type not in existing_types]
    considered = missing or affordable
    offset = snapshot["worldOffsetX"]
    best = None
    for tower_type in considered:
        for y in range(125, 586, 38):
            start_x = int(-offset + 52)
            end_x = int(WORLD_WIDTH + offset - 52)
            for x in range(start_x, end_x + 1, 38):
                point = (float(x), float(y))
                if not legal_position(point, snapshot):
                    continue
                score = position_score(point, tower_type, snapshot)
                if best is None or score > best[0]:
                    best = (score, tower_type, point)
    return best


def best_upgrade(snapshot: dict):
    choices = []
    for tower in snapshot["towers"]:
        if tower["level"] >= 3:
            continue
        definition = snapshot["definitions"][tower["type"]]
        cost = round(definition["cost"] * (0.55 + tower["level"] * 0.3))
        if cost > snapshot["gold"]:
            continue
        coverage = position_score((tower["x"], tower["y"]), tower["type"], snapshot)
        value = coverage * (1.0 + (3 - tower["level"]) * 0.22) / max(1, cost)
        choices.append((value, tower["id"], cost))
    return max(choices, default=None)


SNAPSHOT_SCRIPT = """
(() => ({
  mode: state.mode,
  wave: state.wave,
  totalWaves: state.totalWaves,
  runningWave: state.runningWave,
  gold: state.gold,
  health: state.health,
  maxHealth: state.maxHealth,
  score: state.score,
  worldOffsetX,
  path: getActivePath().map(point => ({x: point.x, y: point.y})),
  roster: [...state.level.towers],
  towers: state.towers.map(tower => ({id:tower.id,type:tower.type,x:tower.x,y:tower.y,level:tower.level})),
  definitions: Object.fromEntries(state.level.towers.map(key => [key, {
    cost:towerTypes[key].cost, range:towerTypes[key].range, rate:towerTypes[key].rate,
    damage:towerTypes[key].damage, attack:towerTypes[key].attack
  }])),
  enemyCount: state.enemies.length,
  steam: state.steamClouds.map(cloud => ({x:cloud.x,y:cloud.y})),
  manualFire: state.manualFireTimer > 0,
  possessedCastle: state.possessedCastle.active
}))()
"""


def wait_for_target(port: int, page_name: str, timeout: float = 12.0) -> dict:
    deadline = time.monotonic() + timeout
    direct_http = build_opener(ProxyHandler({}))
    while time.monotonic() < deadline:
        try:
            with direct_http.open(f"http://127.0.0.1:{port}/json/list", timeout=0.5) as response:
                targets = json.load(response)
            target = next((item for item in targets if item.get("type") == "page" and page_name in item.get("url", "")), None)
            if target:
                return target
        except (OSError, ValueError):
            pass
        time.sleep(0.15)
    raise RuntimeError("Timed out while waiting for the game browser")


def clear_steam(devtools: DevTools, clouds: list[dict]) -> None:
    coordinates = json.dumps(clouds)
    devtools.evaluate(
        f"(() => {{ const points={coordinates}; points.forEach(point => {{ for(let pass=0;pass<4;pass+=1) wipeSteam(point); }}); return true; }})()"
    )


def spend_gold(devtools: DevTools, snapshot: dict, max_towers: int) -> str | None:
    build = best_build(snapshot, max_towers)
    upgrade = best_upgrade(snapshot)
    should_build = build and (len(snapshot["towers"]) < 5 or not upgrade or build[0] > upgrade[0] * 7)
    if should_build:
        _, tower_type, (x, y) = build
        placed = devtools.evaluate(
            f"(() => {{ const before=state.towers.length; selectBuild({json.dumps(tower_type)}); placeTower({{x:{x},y:{y}}}); return state.towers.length>before; }})()"
        )
        return f"built {tower_type} at ({x:.0f}, {y:.0f})" if placed else None
    if upgrade:
        _, tower_id, _ = upgrade
        upgraded = devtools.evaluate(
            f"(() => {{ const tower=state.towers.find(item=>item.id==={tower_id}); if(!tower)return false; const before=tower.level; state.selectedTower=tower; state.selectedBuild=null; upgradeSelectedTower(); return tower.level>before; }})()"
        )
        return f"upgraded tower #{tower_id}" if upgraded else None
    if build:
        _, tower_type, (x, y) = build
        placed = devtools.evaluate(
            f"(() => {{ const before=state.towers.length; selectBuild({json.dumps(tower_type)}); placeTower({{x:{x},y:{y}}}); return state.towers.length>before; }})()"
        )
        return f"built {tower_type} at ({x:.0f}, {y:.0f})" if placed else None
    return None


def run_bot(args: argparse.Namespace) -> int:
    browser_path = find_browser()
    port = free_port()
    profile = tempfile.mkdtemp(prefix="kingdom-ai-")
    page = Path(__file__).with_name("index.html").resolve().as_uri()
    command = [
        browser_path, "--disable-gpu", "--disable-gpu-compositing", "--disable-software-rasterizer",
        "--no-sandbox", "--no-first-run", "--no-default-browser-check",
        "--remote-allow-origins=*", f"--remote-debugging-port={port}",
        f"--user-data-dir={profile}", "--window-size=1280,720", page,
    ]
    if args.headless:
        command.insert(1, "--headless=new")
    browser = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    devtools = None
    try:
        target = wait_for_target(port, "index.html")
        devtools = DevTools(target["webSocketDebuggerUrl"])
        devtools.call("Runtime.enable")
        deadline = time.monotonic() + 10
        while devtools.evaluate("document.body.dataset.gameReady") != "true":
            if time.monotonic() > deadline:
                raise RuntimeError("The game did not initialize")
            time.sleep(0.1)
        devtools.evaluate(
            f"document.querySelector('[data-level={args.map}]').click();"
            f"document.querySelector('[data-difficulty={args.difficulty}]').click();"
            "document.getElementById('start-btn').click(); true",
            user_gesture=True,
        )
        print(f"AI started: {args.map} / {args.difficulty}")
        deadline = time.monotonic() + args.max_minutes * 60
        last_report = 0.0
        while time.monotonic() < deadline:
            snapshot = devtools.evaluate(SNAPSHOT_SCRIPT)
            if snapshot["mode"] in ("won", "lost"):
                print(f"AI finished: {snapshot['mode']} | score {snapshot['score']} | wave {snapshot['wave']}/{snapshot['totalWaves']}")
                time.sleep(args.linger)
                return 0 if snapshot["mode"] == "won" else 2
            if snapshot["mode"] != "playing":
                time.sleep(args.tick)
                continue
            if snapshot["steam"]:
                clear_steam(devtools, snapshot["steam"])
                print("AI cleared the steam")
            if snapshot["manualFire"] and snapshot["runningWave"]:
                devtools.evaluate("manualVolley(); true", user_gesture=True)

            if snapshot["gold"] >= 1000 and snapshot["health"] <= snapshot["maxHealth"] * 0.5:
                if devtools.evaluate("repairCastle()", user_gesture=True):
                    print("AI repaired 25% of the castle")
                    time.sleep(0.12)
                    continue

            action = spend_gold(devtools, snapshot, args.max_towers)
            if action:
                print(f"AI {action}")
                time.sleep(0.12)
                continue
            if not snapshot["runningWave"] and not snapshot["possessedCastle"]:
                devtools.evaluate("launchWave(); true", user_gesture=True)
                print(f"AI launched wave {snapshot['wave'] + 1}")

            now = time.monotonic()
            if now - last_report > 5:
                print(
                    f"wave {snapshot['wave']}/{snapshot['totalWaves']} | health {snapshot['health']}/{snapshot['maxHealth']} | "
                    f"gold {snapshot['gold']} | towers {len(snapshot['towers'])} | enemies {snapshot['enemyCount']}"
                )
                last_report = now
            time.sleep(args.tick)
        print("AI stopped after reaching the configured time limit")
        return 3
    finally:
        if devtools:
            devtools.close()
        browser.terminate()
        try:
            browser.wait(timeout=3)
        except subprocess.TimeoutExpired:
            browser.kill()
        shutil.rmtree(profile, ignore_errors=True)


def self_test() -> None:
    snapshot = {
        "worldOffsetX": 0,
        "path": [{"x": 0, "y": 200}, {"x": 500, "y": 200}, {"x": 500, "y": 500}, {"x": 1165, "y": 500}],
        "towers": [],
        "gold": 200,
        "roster": ["test"],
        "definitions": {"test": {"cost": 60, "range": 150, "rate": 2, "damage": 15, "attack": "single"}},
    }
    assert not legal_position((250, 200), snapshot)
    assert legal_position((380, 330), snapshot)
    assert position_score((380, 330), "test", snapshot) > position_score((100, 580), "test", snapshot)
    assert best_build(snapshot, 8) is not None
    print("Kingdom Under Siege AI strategy tests passed")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Autonomous AI player for Kingdom Under Siege")
    parser.add_argument("--map", choices=("greenvale", "sunreach", "frostholm"), default="greenvale")
    parser.add_argument("--difficulty", choices=("easy", "normal", "hard"), default="normal")
    parser.add_argument("--max-towers", type=int, default=10)
    parser.add_argument("--max-minutes", type=float, default=20)
    parser.add_argument("--tick", type=float, default=0.35)
    parser.add_argument("--linger", type=float, default=5)
    parser.add_argument("--headless", action="store_true", help="Run without displaying the browser")
    parser.add_argument("--self-test", action="store_true", help="Test the AI scoring logic without launching a browser")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    if arguments.self_test:
        self_test()
        raise SystemExit(0)
    try:
        raise SystemExit(run_bot(arguments))
    except KeyboardInterrupt:
        print("AI stopped by user")
        raise SystemExit(130)
    except Exception as error:
        print(f"AI error: {error}", file=sys.stderr)
        raise SystemExit(1)
