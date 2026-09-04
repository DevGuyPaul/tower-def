# Kingdom Under Siege

A full-screen fantasy ramen-defence game built with plain HTML, CSS, Canvas, and vanilla JavaScript. The Cat King protects the kingdom's last perfect ramen bowl from the Orc King and his raiders. It has no dependencies, package installation, asset downloads, or build step.

## Run the game

Open `index.html` in a modern desktop or mobile browser. The complete game stage scales uniformly and always fills the browser width, including its canvas, HUD, menus, controls, text, and hit targets. Ultrawide displays receive additional playable landscape instead of side bars, stretching, or cropped controls. The fullscreen button provides an immersive view.

## How to play

1. Choose Greenvale, Sunreach, or Frostholm. Each realm has its own track and visual setting.
2. Select Easy, Normal, or Hard and enter the realm.
3. Choose a tower and click any open ground. Towers can be placed freely but not on the track, on another tower, or at the castle gate.
4. Launch a wave. Click a built tower to upgrade or sell it.
5. Stop the orc raiders before they reach the Cat King's castle and steal the royal ramen. Enemies that finish the track remove health and visibly crack the castle.

Click a selected tower button again, click **Cancel**, click empty ground after inspecting a tower, or right-click/two-finger-click the battlefield to clear the current selection.

Keyboard shortcuts: `1`, `2`, and `3` select towers; `Space` launches a wave or fires a manual volley during that event; `Escape` clears a selection before opening the menu.

Fullscreen can be entered from either the main menu or the in-game HUD.

Click **AI OFF** in the top-right HUD at any time during play to enable an autonomous takeover. Click the resulting **AI ON** button to immediately return control to the player. The AI leaves the player's current tower selection intact.

## Hackathon feature checklist

### Required features — 8/8 complete

- [x] **Playable map with a defined enemy path:** three maps, each with a unique visible route.
- [x] **Enemy spawning and wave progression:** escalating waves, mixed enemy compositions, final bosses, and an enemies-remaining progress bar.
- [x] **At least three tower types with different behaviours:** every map has three exclusive towers using single-target, splash, slowing, or support behaviour.
- [x] **Tower placement and purchase mechanics:** towers can be purchased and freely placed on legal open ground, but not on the track, castle, boundary, or another tower.
- [x] **Currency or resource system:** enemies and wave completion award gold; construction, upgrades, and castle repairs spend it.
- [x] **Player health, base damage, or lives system:** enemies reaching the ramen castle cause damage and progressively crack or destroy it.
- [x] **Win and lose conditions:** completing the final wave wins; losing all castle health ends in defeat.
- [x] **Basic UI showing wave, currency, score, and health:** all four values remain visible in the gameplay HUD.

### Optional and bonus features — all categories complete

- [x] **Multiple enemy types:** nine map-exclusive enemies with different health, speed, size, abilities, and three unique final bosses.
- [x] **Tower upgrades:** every purchased tower can reach level three or be sold.
- [x] **Pause, restart, and level selection:** available from the in-game menu, with selection clearing and difficulty changes.
- [x] **Multiple maps and difficulty levels:** Greenvale, Sunreach, and Frostholm each have their own route, roster, theme, and music; Easy, Normal, and Hard alter waves, health, economy, enemy strength, and event frequency.
- [x] **Sound, music, animation, and visual polish:** synthesized sound effects, adaptive map/difficulty music, animated projectiles and particles, character dialogue, cutscenes, castle damage, and event animations.
- [x] **Score, high score, and post-game results:** score is tracked during play, the best result persists locally, and victory/defeat screens show score and completed waves.
- [x] **Creative theme, story, and art direction:** the Cat King defends the last perfect bowl of ramen from the Orc King, supported by an illustrated origin story and separate vertically panning victory and defeat scenes.

### Technical requirements — 3/3 complete

- [x] **Architecture description:** documented in the Architecture section below.
- [x] **Unit tests:** `tests.js` covers configuration, difficulty progression, map uniqueness, tower/enemy rosters, and placement geometry.
- [x] **Automated UI tests:** `ui-tests.mjs` runs the real game in headless Chrome or Edge and verifies initialization, responsive scaling, menus, story, difficulty, placement, waves, random events, AI takeover, repair, and both endings.

### Additional implemented features

- Animated four-panel anime-comic story after 15 seconds of menu inactivity, with slide-duration progress bars, slow blur-to-focus transitions, a **Watch Story** replay control, and a final cinematic fade directly into the selected battle
- Cat King and Orc King portraits for warnings, taunts, anti-spell updates, and dangerous castle-health thresholds
- Result artwork automatically pans from top to bottom and back while selecting only the appropriate victory or defeat illustration
- Easy mode with eight waves and no random events; Normal with ten waves and moderate events; Hard with a hidden 12–20 waves and roughly twice the event frequency
- Giant birds that carry enemies toward the castle and can be attacked to drop their passengers
- Thief birds that steal purchased towers and carry them off-screen
- Dense interactive steam that covers the battlefield until the player uses **Remove Clouds**
- Temporary invisible enemies, battlefield inversion, a slow 360-degree spin, enemy speed surges, and bounce-forward attacks
- A possessed-castle event that moves the castle toward enemies before visibly returning it home
- Manual-fire events where each Spacebar press makes every tower fire one normal priority shot
- Four animated castle-damage states and a 1000-gold repair that restores 25% maximum health without exceeding 100%
- Optional AI takeover that analyzes coverage, builds, upgrades, repairs, launches waves, fires manually, clears clouds, and can be disabled instantly
- Draggable 1×–10× battle-speed controller, fullscreen controls, free-form tower placement, keyboard shortcuts, and touchpad-compatible selection cancellation

## Architecture

- `data.js` contains data-driven level, difficulty, tower, and enemy definitions plus reusable geometry helpers.
- `game.js` owns state, enemy and bird movement, random-event scheduling, targeting, cloud clearing, projectiles, economy, repairs, story/dialogue timing, speed control, placement validation, sound synthesis, input, UI state, and Canvas rendering.
- `styles.css` treats the whole interface as one fixed 16:9 game stage and scales that stage to the browser viewport.
- `assets/` contains the generated anime-comic story, ending, and character portrait sheets used by the cutscene and dialogue UI.
- `tests.js` validates the pure gameplay data and collision rules with Node's built-in assertion library.

Run tests with:

```bash
node tests.js
node ui-tests.mjs
python ai-player.py --self-test
```

## AI player

`ai-player.py` is the dependency-free external automation mode for repeatable demos and testing. It opens the real game in Chrome or Edge, evaluates legal off-road build positions by path coverage and range, chooses among the map's tower types, compares construction with upgrade value, launches waves, fires manual volleys, clears clouds, and rebuilds after tower theft. For an AI that can be switched on and off during an existing game, use the HUD's **AI OFF / AI ON** button instead.

Run a visible AI game with:

```bash
python ai-player.py --map greenvale --difficulty normal
```

Add `--headless` for automated runs. Use `python ai-player.py --help` to see map, difficulty, time-limit, tick-rate, and tower-count options.

## Known limitations

Menu selections unlock the audio system and have distinct selection sounds; subsequent menu hovers also play a light sound. Very narrow portrait screens remain playable but retain vertical letterboxing because the game preserves its proportions.
