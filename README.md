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

## Implemented features

- Three levels with unique tracks and forest, desert, and frozen settings
- An animated four-panel anime-comic origin story that begins after 15 seconds of menu inactivity, uses slow blur-to-focus transitions, and can be replayed with **Watch Story**
- Cat King and Orc King portrait messages for event warnings, taunts, anti-spell updates, and dangerous castle-health thresholds
- Illustrated victory and defeat scenes showing either the saved ramen or the Orc King escaping with it
- Nine map-exclusive towers: three different defences in every realm
- Nine map-exclusive enemies: three different attackers in every realm
- Easy uses the previous Normal balance (8 waves, 20 health) and has no random events
- Normal uses the previous Hard balance (10 waves, 15 health) and introduces the complete random-event system at a moderate cadence
- Hard secretly chooses 12-20 waves for each new game, keeps the total hidden until the result, strengthens enemies, and triggers events roughly twice as often
- Free-form tower placement with path, boundary, castle, and tower collision rules
- Single-target, splash, and slowing options tailored to each map
- Tower upgrades and selling
- A unique final boss for each map and phasing Ice Wraiths in Frostholm
- Giant birds that carry enemies much closer to the castle; towers can shoot the bird to drop and resume attacking its passenger
- Thief birds that steal a purchased tower and carry it off-screen
- Dense interactive steam covering most of the map until the player selects the centered **Remove Clouds** control and clears the view
- Temporary invisible enemies that continue progressing while towers cannot target them
- Timed battlefield inversion with matching pointer controls during event-enabled difficulties
- A separate slow 360-degree battlefield spin whose pointer controls follow the current rotation
- A possessed-castle event: the castle follows the road toward the wave, enemies stop to attack it, and it visibly retraces its route when the spell ends
- Manual-fire events that disable automatic targeting; each Spacebar press makes every tower fire one normal shot at its usual priority target
- Enemy speed-surge events and bounce-forward attacks that advance surviving targets along the path
- Wave progress HUD with exact enemies remaining
- Four animated castle-damage states: cracks at 75% health, one tower lost at 50%, both towers lost at 25%, and rubble at zero
- Castle repairs: spend 1000 gold to restore exactly 25% maximum health, capped at 100%; AI takeover can also make emergency repairs
- Gold, castle health, score, wave bonuses, and persistent high score
- Visible castle damage, cracks, impact shake, and defeat when health reaches zero
- In-game HUD, construction dock, pause menu, level select, restart-on-change difficulty selector, and results screen
- Optional in-game AI takeover that analyzes placement coverage, constructs, upgrades, launches waves, fires manual volleys, clears clouds, and can be disabled instantly
- Uniform full-screen scaling for the whole game stage
- Synthesized effects and adaptive music using the Web Audio API: the realm-sensitive main-menu ambience fades gradually when play begins; woodland, desert, and winter maps have different scales and instruments; and each difficulty has its own cue, pitch, layering, and tempo
- Fullscreen and sound controls
- A draggable battle-speed controller from 1× through 10×
- Unit tests for configuration, difficulty progression, map uniqueness, and placement geometry
- Automated headless-browser smoke tests for scaling, menus, difficulty, placement, and wave launch

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
