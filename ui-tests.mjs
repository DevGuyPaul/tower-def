import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const candidates = process.platform === 'win32'
  ? ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']
  : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
    : ['/usr/bin/google-chrome', '/usr/bin/microsoft-edge', '/usr/bin/chromium'];
const browserPath = candidates.find(existsSync);
assert.ok(browserPath, 'Chrome or Edge is required for the automated UI smoke test');

const port = 9334;
const profile = mkdtempSync(join(tmpdir(), 'kingdom-ui-'));
const pageUrl = pathToFileURL(resolve('index.html')).href;
const browser = spawn(browserPath, [
  '--headless=new', '--disable-gpu', '--disable-gpu-compositing', '--disable-software-rasterizer',
  '--no-sandbox', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1000,700', pageUrl
], { stdio: 'ignore' });

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function getPageTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = targets.find((target) => target.type === 'page' && target.url.includes('index.html'));
      if (page) return page;
    } catch { /* browser is still starting */ }
    await delay(125);
  }
  throw new Error('Timed out waiting for the browser');
}

try {
  const target = await getPageTarget();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', rejectOpen, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  const runtimeExceptions = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') runtimeExceptions.push(message.params.exceptionDetails.text);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolveCommand, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolveCommand(message.result);
  });

  const command = (method, params = {}) => new Promise((resolveCommand, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve: resolveCommand, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };

  await command('Runtime.enable');
  await delay(250);
  assert.equal(await evaluate("document.body.dataset.gameReady"), 'true', 'game initializes');
  assert.equal(await evaluate("!document.getElementById('entry-screen').hidden && document.getElementById('entry-btn').textContent==='START GAME' && sounds.context===null"), true, 'the initial entrance waits for a user gesture before creating audio');
  await evaluate("document.getElementById('entry-btn').click(); true");
  assert.equal(await evaluate("document.getElementById('entry-screen').classList.contains('leaving') && sounds.menuActive"), true, 'Start Game enables menu ambience and begins the fade-blur entrance');
  await delay(1100);
  assert.equal(await evaluate("document.getElementById('entry-screen').hidden && !document.getElementById('start-screen').hidden"), true, 'the entrance transition reveals the level and difficulty menu');
  assert.equal(await evaluate("(() => { sounds.nextMenuNote=98765; sounds.menuStep=3; sounds.startMenuMusic(); sounds.startMenuMusic(); return sounds.nextMenuNote===98765 && sounds.menuStep===3; })()"), true, 'menu clicks do not restart or alter an already-playing ambient sequence');
  assert.equal(await evaluate("document.querySelectorAll('.level-card').length"), 3, 'level selector renders');
  assert.equal(await evaluate("document.querySelectorAll('.difficulty-options button').length"), 3, 'difficulty selector renders');
  assert.equal(await evaluate("document.querySelector('[data-difficulty=easy] small').textContent"), '8 waves', 'Easy does not advertise its health in the selector');
  assert.equal(await evaluate("document.querySelector('[data-difficulty=hard] small').textContent.includes('chaos') && !document.querySelector('[data-difficulty=hard] small').textContent.includes('frequent events')"), true, 'Hard is labelled as chaos');
  assert.equal(await evaluate("Boolean(document.getElementById('main-fullscreen-btn'))"), true, 'fullscreen is available from the main menu');
  assert.equal(await evaluate("document.getElementById('start-btn').textContent === 'DEFEND THE RAMEN' && Boolean(document.getElementById('story-btn'))"), true, 'the menu establishes the ramen objective and exposes the story');
  assert.equal(await evaluate("Promise.all(['assets/story-comic.png','assets/ending-comic.png','assets/royal-portraits.png'].map(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=src;}))).then(results=>results.every(Boolean))"), true, 'all generated story artwork loads');
  assert.equal(await evaluate("(() => { clearTimeout(storyIdleTimer); const original=window.setTimeout; window.setTimeout=(callback,delay)=>{window.__storyDelay=delay;return 0;}; storyAutoPlayed=false; scheduleStoryCutscene(); window.setTimeout=original; return window.__storyDelay; })()"), 15000, 'the story is scheduled after fifteen idle seconds');
  await evaluate("showStoryCutscene(0); true");
  assert.equal(await evaluate("(() => { const active=document.querySelector('#story-dots i.active'); return !document.getElementById('story-screen').hidden && document.getElementById('story-title').textContent==='THE LAST PERFECT BOWL' && Number.parseFloat(getComputedStyle(document.getElementById('story-art')).animationDuration)>=7 && getComputedStyle(active,'::after').animationDuration==='7.8s'; })()"), true, 'the illustrated story opens with a slow transition and a duration-matched progress bar');
  await evaluate("nextStorySlide(); true");
  assert.equal(await evaluate("document.getElementById('story-title').textContent === \"THE ORC KING'S PLOT\" && document.getElementById('story-art').classList.contains('panel-2') && document.querySelectorAll('#story-dots i.complete').length===1"), true, 'the cutscene advances through illustrated story beats and preserves completed progress');
  await evaluate("closeStoryCutscene(); true");
  await delay(950);
  assert.equal(await evaluate("state.mode==='menu' && document.getElementById('story-screen').hidden"), true, 'skipping or automatically completing the story fades back to the main menu');
  await evaluate("showStoryCutscene(3); true");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#story-dots i.active'),'::after').animationDuration==='9.2s' && document.querySelectorAll('#story-dots i.complete').length===3"), true, 'the final progress bar matches the longer final slide');
  await evaluate("nextStorySlide(); true");
  assert.equal(await evaluate("state.mode==='playing' && !document.getElementById('story-screen').hidden && document.getElementById('story-screen').classList.contains('story-exit')"), true, 'the final story call-to-action starts battle beneath a cinematic transition');
  await delay(950);
  assert.equal(await evaluate("document.getElementById('story-screen').hidden && state.mode==='playing'"), true, 'the completed transition reveals the running game');
  await evaluate("returnToLevelSelect(); true");
  assert.equal(await evaluate("(() => { const r=document.getElementById('game-stage').getBoundingClientRect(); return Math.abs(r.left)<1 && Math.abs(r.top-(innerHeight-r.height)/2)<1 && Math.abs(r.width-innerWidth)<1 && r.height <= innerHeight && Math.abs(r.width/r.height-16/9)<0.01; })()"), true, 'the stage fills and centers in a standard viewport');
  await command('Emulation.setDeviceMetricsOverride', { width: 1896, height: 894, deviceScaleFactor: 1, mobile: false });
  await delay(100);
  assert.equal(await evaluate("(() => { const r=document.getElementById('game-stage').getBoundingClientRect(); return Math.abs(r.left)<1 && Math.abs(r.top)<1 && Math.abs(r.width-innerWidth)<1 && Math.abs(r.height-innerHeight)<1; })()"), true, 'an ultrawide viewport receives extra game area with no side bars');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(100);
  assert.equal(await evaluate("(() => { const r=document.getElementById('game-stage').getBoundingClientRect(); return Math.abs(r.left)<1 && Math.abs(r.top-(innerHeight-r.height)/2)<1 && Math.abs(r.width-innerWidth)<1 && r.height <= innerHeight+1 && Math.abs(r.width/r.height-16/9)<0.01; })()"), true, 'the complete stage fills and centers in a portrait mobile viewport');
  await command('Emulation.setDeviceMetricsOverride', { width: 796, height: 452, deviceScaleFactor: 1, mobile: false });
  await delay(100);
  assert.equal(await evaluate("(() => { const r=document.getElementById('game-stage').getBoundingClientRect(); return Math.abs(r.left)<1 && Math.abs(r.top-(innerHeight-r.height)/2)<1 && Math.abs(r.right-innerWidth)<1; })()"), true, 'the stage stays centered at the reported small-browser size');
  await command('Emulation.clearDeviceMetricsOverride');
  await delay(100);

  await evaluate("document.querySelector('[data-difficulty=hard]').click(); document.getElementById('start-btn').click(); true");
  await delay(120);
  assert.equal(await evaluate('state.mode'), 'playing', 'start button enters the game');
  assert.equal(await evaluate('state.maxHealth'), 12, 'Hard difficulty is applied');
  assert.equal(await evaluate("!document.getElementById('speed-control').hidden && document.getElementById('speed-slider').max === '10' && !document.getElementById('repair-btn').hidden && document.getElementById('repair-btn').disabled && !document.getElementById('dialogue-box').hidden && document.getElementById('dialogue-speaker').textContent.includes('CAT KING')"), true, 'gameplay shows speed, repair, and Cat King guidance');
  assert.equal(await evaluate("document.getElementById('ai-btn').textContent"), 'AI OFF', 'the in-game AI takeover starts disabled');
  assert.equal(await evaluate("state.totalWaves >= 12 && state.totalWaves <= 20 && document.getElementById('wave').textContent.endsWith('?')"), true, 'Hard chooses a hidden total between 12 and 20 waves');
  assert.equal(await evaluate("document.getElementById('build-dock').hidden"), false, 'build controls are visible');
  assert.equal(await evaluate("state.level.towers.length === 3 && state.level.enemies.length === 3"), true, 'the selected map loads its own tower and enemy roster');
  await evaluate("selectBuild('ranger'); true");
  assert.equal(await evaluate('state.selectedBuild'), null, 'clicking the selected build button clears it');
  await evaluate("selectBuild('ranger'); placeTower({x:320,y:310}); state.wave=3; state.spawnCount=2; spawnEnemy('goblin',{position:{x:350,y:310},pathIndex:1}); updateEnemyVisibility(state.enemies[0],1); true");
  assert.equal(await evaluate('state.enemies[0].invisible'), true, 'Hard random events can cloak an enemy');
  assert.equal(await evaluate('summonBird() && state.birds.length === 1 && state.enemies[0].carried'), true, 'a bird can kidnap a ground enemy');
  await evaluate('state.runningWave=true; startManualFireEvent(); updateUI(); manualVolley(); true');
  assert.equal(await evaluate('state.projectiles.length === 1'), true, 'manual Spacebar fire gives each tower one normal priority shot');
  assert.equal(await evaluate("document.getElementById('event-status').textContent.includes('HIT SPACEBAR TO FIRE') && document.getElementById('wave-btn').textContent === 'HIT SPACEBAR TO FIRE'"), true, 'manual fire displays an explicit Spacebar instruction');
  await evaluate('damageEnemy(state.birds[0],state.birds[0].health); summonTowerThief(); createSteam(); state.flipTimer=1000; setMapFlipped(true); startSpeedSurge(); startBounceEvent(); true');
  await delay(120);
  assert.equal(await evaluate("!state.enemies[0].carried && state.birds.some(b=>b.kind==='thief') && state.towers.length===0 && state.steamClouds.length===15 && !document.getElementById('mop-btn').hidden && document.getElementById('game').classList.contains('upside-down') && state.speedBoostTimer>0 && state.bounceTimer>0"), true, 'bird rescue, tower theft, full-map clouds, cloud removal, inversion, speed, and bounce events activate');
  assert.equal(await evaluate("document.getElementById('mop-btn').textContent.includes('REMOVE CLOUDS') && document.getElementById('mop-btn').getAttribute('aria-label') === 'Remove clouds'"), true, 'the cloud-removal control uses clear wording');
  await evaluate('setMapFlipped(false); startBattlefieldSpin(); updateBattlefieldSpin(state.spinDuration/2); true');
  assert.equal(await evaluate("state.spinTimer>0 && state.spinAngle>150 && state.spinAngle<210 && document.getElementById('game').classList.contains('spinning')"), true, 'the battlefield performs a slow controlled 360-degree spin');
  await evaluate("stopBattlefieldRotation(); state.steamClouds=[]; state.birds=[]; document.getElementById('mop-btn').hidden=true; startPossessedCastleEvent(); updatePossessedCastle(state.possessedCastle.outboundDuration+1); const castle=getCastlePosition(); const home=getCastleHome(); window.__castleTravel=Math.hypot(castle.x-home.x,castle.y-home.y); const enemy=state.enemies[0]; enemy.x=castle.x; enemy.y=castle.y; enemy.castleAttackTimer=1; const before=state.health; moveEnemy(enemy,16); window.__castleDamage=before-state.health; true");
  assert.equal(await evaluate("state.possessedCastle.phase==='holding' && window.__castleTravel>150 && window.__castleDamage>0"), true, 'the possessed castle travels down the path and waits while enemies attack it');
  await evaluate("updatePossessedCastle(state.possessedCastle.holdDuration+1); updatePossessedCastle(state.possessedCastle.returnDuration+1); true");
  assert.equal(await evaluate("!state.possessedCastle.active && Math.hypot(getCastlePosition().x-getCastleHome().x,getCastlePosition().y-getCastleHome().y)<1"), true, 'the castle slides back home when possession ends');
  await evaluate("document.getElementById('menu-btn').click(); document.getElementById('difficulty-menu-btn').click(); true");
  assert.equal(await evaluate("document.getElementById('menu-difficulty-panel').hidden"), false, 'the in-game difficulty selector opens');
  await evaluate("document.querySelector('[data-menu-difficulty=easy]').click(); true");
  assert.equal(await evaluate("state.mode === 'playing' && state.difficultyKey === 'easy' && state.maxHealth === 20 && state.wave === 0"), true, 'changing difficulty restarts the current level with its new rules');
  assert.equal(await evaluate("(() => { const slider=document.getElementById('speed-slider'); slider.value='7'; slider.dispatchEvent(new Event('input')); const accelerated=state.gameSpeed===7 && document.getElementById('speed-value').textContent==='7×'; setGameSpeed(1); return accelerated; })()"), true, 'the draggable controller changes battle speed up to ten times');
  assert.equal(await evaluate("(() => { state.health=state.maxHealth*.5; state.gold=999; updateUI(); const blocked=document.getElementById('repair-btn').disabled; state.gold=2000; const first=repairCastle() && state.health===state.maxHealth*.75; const second=repairCastle() && state.health===state.maxHealth; const capped=!repairCastle() && state.health===state.maxHealth && state.gold===0; state.gold=240; updateUI(); return blocked&&first&&second&&capped; })()"), true, 'repairs cost 1000 gold, restore 25 percent, disable when unaffordable, and cap at full health');
  assert.equal(await evaluate("placementStatus({x:185,y:300}).valid"), false, 'track placement is blocked');
  assert.equal(await evaluate("placementStatus({x:320,y:310}).valid"), true, 'open-ground placement is allowed');
  await evaluate('placeTower({x:320,y:310}); state.selectedTower=state.towers[0]; state.selectedBuild=null; state.gold=0; updateUI(); true');
  assert.equal(await evaluate('state.towers.length'), 1, 'tower can be freely placed');
  assert.equal(await evaluate("document.getElementById('upgrade-btn').disabled && document.getElementById('upgrade-btn').textContent.startsWith('NEED')"), true, 'upgrade is disabled when there is not enough gold');
  await evaluate('launchWave(); true');
  assert.equal(await evaluate('state.runningWave && state.wave === 1'), true, 'a wave can be launched');
  assert.equal(await evaluate("document.getElementById('enemy-count').textContent.includes('LEFT') && Number.parseFloat(document.getElementById('enemy-fill').style.width) === 0"), true, 'wave HUD shows enemies remaining and progress');
  assert.equal(await evaluate("typeof sounds.mapSelect === 'function' && typeof sounds.difficultySelect === 'function'"), true, 'map and difficulty sound cues are available');
  assert.equal(await evaluate("document.querySelector('link[rel=icon]').getAttribute('href')"), 'favicon.svg', 'the game exposes its castle favicon');
  await evaluate("state.runningWave=false; state.enemies=[]; state.birds=[]; state.projectiles=[]; state.steamClouds=[]; state.towers=[]; state.gold=240; state.wave=0; state.selectedBuild=state.level.towers[0]; state.selectedTower=null; document.getElementById('ai-btn').click(); runAiTurn(); true");
  assert.equal(await evaluate("state.aiEnabled && state.towers.length>=1 && state.selectedBuild===state.level.towers[0] && document.getElementById('ai-btn').classList.contains('active')"), true, 'AI takeover analyzes and builds without replacing the player selection');
  await evaluate("document.getElementById('ai-btn').click(); true");
  assert.equal(await evaluate("!state.aiEnabled && document.getElementById('ai-btn').textContent==='AI OFF'"), true, 'the player can turn AI takeover off during the game');
  await evaluate("finishGame(true); true");
  assert.equal(await evaluate("document.getElementById('result-title').textContent==='THE RAMEN IS SAFE' && document.getElementById('result-art').classList.contains('victory')"), true, 'victory displays the saved-ramen ending');
  assert.equal(await evaluate("(() => { const art=document.getElementById('result-art'); const box=art.getBoundingClientRect(); const style=getComputedStyle(art); const animation=art.getAnimations()[0]; return Math.abs(box.width-box.height)<1 && style.backgroundSize==='200% auto' && Number.parseFloat(style.backgroundPositionX)===0 && style.animationName==='result-art-scroll' && style.animationIterationCount==='infinite' && animation.currentTime<500; })()"), true, 'victory selects only its tall illustration and begins an infinite top-to-bottom pan');
  await evaluate("startGame(); true");
  assert.equal(await evaluate("getComputedStyle(document.getElementById('result-art')).animationName==='none'"), true, 'leaving results stops the artwork loop');
  await evaluate("finishGame(false); true");
  assert.equal(await evaluate("document.getElementById('result-title').textContent==='THE RAMEN WAS STOLEN' && document.getElementById('result-art').classList.contains('defeat')"), true, 'defeat displays the stolen-ramen ending');
  assert.equal(await evaluate("(() => { const art=document.getElementById('result-art'); const style=getComputedStyle(art); const animation=art.getAnimations()[0]; return Number.parseFloat(style.backgroundPositionX)>99 && style.animationName==='result-art-scroll' && animation.currentTime<500; })()"), true, 'defeat selects only its tall illustration and restarts the pan from the top');
  assert.deepEqual(runtimeExceptions, [], 'gameplay and Canvas rendering produce no browser exceptions');
  socket.close();
  console.log('Kingdom Under Siege browser UI tests passed');
} finally {
  browser.kill();
  await Promise.race([
    new Promise((resolveExit) => browser.once('exit', resolveExit)),
    delay(1200)
  ]);
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 }); }
  catch { /* Edge can briefly retain its disposable profile on Windows */ }
}
