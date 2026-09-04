/* Kingdom Under Siege — dependency-free canvas tower defence. */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('game-stage');
const byId = (id) => document.getElementById(id);

const ui = {
  wave: byId('wave'), money: byId('money'), lives: byId('lives'), score: byId('score'),
  healthFill: byId('health-fill'), enemyCount: byId('enemy-count'), enemyFill: byId('enemy-fill'),
  message: byId('message'), placementHint: byId('placement-hint'), eventStatus: byId('event-status'),
  buildDock: byId('build-dock'), towerButtons: byId('tower-buttons'), waveButton: byId('wave-btn'),
  towerInspector: byId('tower-inspector'), inspectorName: byId('inspector-name'),
  upgradeButton: byId('upgrade-btn'), sellButton: byId('sell-btn'), startScreen: byId('start-screen'),
  pauseScreen: byId('pause-screen'), resultScreen: byId('result-screen'), soundButton: byId('sound-btn'),
  menuSoundButton: byId('menu-sound-btn'), difficultyMenuButton: byId('difficulty-menu-btn'),
  menuDifficultyPanel: byId('menu-difficulty-panel'), mopButton: byId('mop-btn'),
  cancelSelectionButton: byId('cancel-selection-btn'), aiButton: byId('ai-btn'),
  dialogueBox: byId('dialogue-box'), dialoguePortrait: byId('dialogue-portrait'),
  dialogueSpeaker: byId('dialogue-speaker'), dialogueText: byId('dialogue-text'),
  speedControl: byId('speed-control'), speedSlider: byId('speed-slider'), speedValue: byId('speed-value'),
  repairButton: byId('repair-btn'), repairLabel: byId('repair-label'),
  storyScreen: byId('story-screen'), storyArt: byId('story-art'), storyCount: byId('story-count'),
  storyTitle: byId('story-title'), storyText: byId('story-text'), storyNextButton: byId('story-next-btn'),
  storyDots: byId('story-dots'), storyCopy: byId('story-copy'), resultArt: byId('result-art')
};

const state = {
  mode: 'menu', levelKey: 'greenvale', difficultyKey: 'normal', level: levels.greenvale,
  difficulty: difficulties.normal, wave: 0, gold: difficulties.normal.gold,
  totalWaves: difficulties.normal.waves,
  health: difficulties.normal.health, maxHealth: difficulties.normal.health, score: 0,
  towers: [], enemies: [], birds: [], projectiles: [], particles: [], steamClouds: [], runningWave: false,
  spawnCount: 0, spawnTotal: 0, spawnTimer: 0, waveResolved: 0, selectedBuild: 'ranger', selectedTower: null,
  mouse: null, baseShake: 0, baseFlash: 0, nextId: 1, messageTimer: 0, lastTime: 0,
  mopActive: false, mapFlipped: false, flipTimer: 0, waveElapsed: 0, nextChaosAt: Infinity,
  speedBoostTimer: 0, bounceTimer: 0, manualFireTimer: 0, manualCooldown: 0,
  chaosBag: [], chaosEvents: { invisible: false },
  possessedCastle: { active: false, phase: 'idle', timer: 0, progress: 0, route: [] },
  spinAngle: 0, spinTimer: 0, spinDuration: 0, aiEnabled: false, aiThinkTimer: 0,
  gameSpeed: 1, dialogueTimer: 0
};

const storySlides = [
  { title:'THE LAST PERFECT BOWL', text:'High in the castle tower, the Cat King guards the most delicious ramen in the kingdom.' },
  { title:"THE ORC KING'S PLOT", text:'The Orc King cannot stand to see the people happy. His wicked plan: steal their royal ramen and leave every bowl empty.' },
  { title:'THE RAMEN RAID', text:'Orc raiders cross forests, deserts, and frozen passes. Every road leads to the Cat King\'s castle.' },
  { title:'DEFEND THE RAMEN', text:'Build your defences, protect the bowl, and keep happiness alive. The Cat King is counting on you!' }
];
let storyIndex = 0;
let storyIdleTimer = 0;
let storyAdvanceTimer = 0;
let storyAutoPlayed = false;

class SoundEngine {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.nextMusic = 0;
    this.musicStep = 0;
    this.lastShot = 0;
    this.menuGain = null;
    this.menuActive = false;
    this.nextMenuNote = 0;
    this.menuStep = 0;
  }

  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.context = new AudioContextClass();
    }
    if (this.context?.state === 'suspended') {
      this.context.resume().then(() => { this.nextMenuNote = 0; }).catch(() => { /* waits for a browser-approved interaction */ });
    }
  }

  tone(frequency, duration = 0.08, type = 'sine', volume = 0.035, endFrequency = frequency, output = null) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(output || this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  click() { this.tone(520, 0.055, 'square', 0.025, 680); }
  hover() { this.tone(350, 0.055, 'sine', 0.018, 430); }
  menuPress() { this.tone(190, 0.045, 'square', 0.022, 150); }
  select() { this.tone(390, 0.07, 'triangle', 0.03, 540); setTimeout(() => this.tone(660, 0.08, 'triangle', 0.02), 45); }
  mapSelect(mapKey) {
    const themes = {
      greenvale: { notes: [392, 523, 659], type: 'triangle', duration: 0.13 },
      sunreach: { notes: [220, 277, 330], type: 'sawtooth', duration: 0.1 },
      frostholm: { notes: [523, 659, 784], type: 'sine', duration: 0.22 }
    };
    const theme = themes[mapKey];
    theme.notes.forEach((note, index) => setTimeout(() => this.tone(note, theme.duration, theme.type, 0.024), index * 58));
  }
  difficultySelect(difficultyKey) {
    const cues = {
      easy: [
        { note: 523, end: 523, type: 'sine', duration: 0.18, delay: 0 },
        { note: 659, end: 659, type: 'sine', duration: 0.18, delay: 90 },
        { note: 784, end: 800, type: 'sine', duration: 0.25, delay: 180 }
      ],
      normal: [
        { note: 245, end: 205, type: 'triangle', duration: 0.08, delay: 0 },
        { note: 245, end: 205, type: 'triangle', duration: 0.08, delay: 145 }
      ],
      hard: [
        { note: 196, end: 108, type: 'sawtooth', duration: 0.28, delay: 0 },
        { note: 98, end: 48, type: 'square', duration: 0.34, delay: 170 }
      ]
    };
    cues[difficultyKey].forEach((cue) => setTimeout(() => this.tone(cue.note, cue.duration, cue.type, difficultyKey === 'hard' ? 0.032 : 0.025, cue.end), cue.delay));
  }
  place() { this.tone(210, 0.09, 'triangle', 0.04, 330); setTimeout(() => this.tone(420, 0.07, 'triangle', 0.025), 55); }
  upgrade() { [330, 440, 590].forEach((note, index) => setTimeout(() => this.tone(note, 0.1, 'triangle', 0.025), index * 55)); }
  sell() { this.tone(440, 0.14, 'sine', 0.025, 220); }
  wave(mapKey) {
    const openingNotes = { greenvale: [196, 294], sunreach: [220, 330], frostholm: [330, 523] }[mapKey];
    const voice = mapKey === 'frostholm' ? 'sine' : mapKey === 'sunreach' ? 'sawtooth' : 'triangle';
    this.tone(openingNotes[0], 0.22, voice, 0.03, openingNotes[1]);
    setTimeout(() => this.tone(openingNotes[1], 0.25, voice, 0.026), 120);
  }
  death() { this.tone(150, 0.07, 'square', 0.012, 90); }
  baseHit() { this.tone(95, 0.35, 'sawtooth', 0.075, 35); }
  bird() { this.tone(880, 0.28, 'sawtooth', 0.026, 410); }
  steam() { this.tone(125, 0.7, 'sine', 0.026, 220); }
  flip() { this.tone(260, 0.7, 'sawtooth', 0.032, 72); }
  possess() {
    [185, 155, 124, 92].forEach((note, index) => setTimeout(() => this.tone(note, 0.42, 'sawtooth', 0.027, note * 0.72), index * 95));
  }
  castleReturn() {
    [196, 262, 330].forEach((note, index) => setTimeout(() => this.tone(note, 0.2, 'triangle', 0.024), index * 85));
  }
  win() { [262, 330, 392, 523].forEach((note, index) => setTimeout(() => this.tone(note, 0.32, 'triangle', 0.04), index * 140)); }
  lose() { [220, 175, 130].forEach((note, index) => setTimeout(() => this.tone(note, 0.38, 'sawtooth', 0.035, note * 0.72), index * 180)); }

  startMenuMusic() {
    this.menuActive = true;
    if (!this.enabled || !this.context) return;
    if (!this.menuGain) {
      this.menuGain = this.context.createGain();
      this.menuGain.connect(this.context.destination);
    }
    const now = this.context.currentTime;
    this.menuGain.gain.cancelScheduledValues(now);
    this.menuGain.gain.setValueAtTime(Math.max(0.0001, this.menuGain.gain.value), now);
    this.menuGain.gain.exponentialRampToValueAtTime(1, now + 0.9);
    this.nextMenuNote = 0;
  }

  fadeMenuMusic(duration = 1.8) {
    this.menuActive = false;
    if (!this.context || !this.menuGain) return;
    const now = this.context.currentTime;
    this.menuGain.gain.cancelScheduledValues(now);
    this.menuGain.gain.setValueAtTime(Math.max(0.0001, this.menuGain.gain.value), now);
    this.menuGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  menuMusicTick(timestamp) {
    if (!this.enabled || !this.menuActive || !this.context || this.context.state !== 'running' || state.mode !== 'menu' || timestamp < this.nextMenuNote) return;
    const themes = {
      greenvale: { notes: [131,165,196,247,196,165], voice: 'triangle' },
      sunreach: { notes: [147,175,220,262,220,175], voice: 'sawtooth' },
      frostholm: { notes: [196,247,330,392,330,247], voice: 'sine' }
    };
    const theme = themes[state.levelKey];
    const note = theme.notes[this.menuStep % theme.notes.length];
    this.tone(note, 1.25, theme.voice, 0.011, note * 1.004, this.menuGain);
    if (this.menuStep % 2 === 0) this.tone(note * 1.5, 0.9, 'sine', 0.005, note * 1.49, this.menuGain);
    this.menuStep += 1;
    this.nextMenuNote = timestamp + 760;
  }

  shot(type) {
    const now = performance.now();
    if (now - this.lastShot < 38) return;
    this.lastShot = now;
    const sound = towerTypes[type].sound;
    if (sound === 'arrow') this.tone(720, 0.035, 'triangle', 0.012, 430);
    if (sound === 'boom') this.tone(115, 0.12, 'square', 0.025, 55);
    if (sound === 'magic') this.tone(650, 0.11, 'sine', 0.018, 920);
  }

  musicTick(timestamp) {
    if (!this.enabled || !state.runningWave || timestamp < this.nextMusic) return;
    const themes = {
      greenvale: { notes: [196,247,294,247,220,262,330,262], voice: 'triangle', duration: 0.34 },
      sunreach: { notes: [220,262,311,349,311,262,233,262], voice: 'sawtooth', duration: 0.18 },
      frostholm: { notes: [330,392,494,587,494,392,349,440], voice: 'sine', duration: 0.5 }
    };
    const theme = themes[state.levelKey];
    const pitchScale = state.difficultyKey === 'easy' ? 1.06 : state.difficultyKey === 'hard' ? 0.88 : 1;
    const note = theme.notes[this.musicStep % theme.notes.length] * pitchScale;
    this.tone(note, theme.duration, theme.voice, state.difficultyKey === 'hard' ? 0.011 : 0.007);
    if (state.difficultyKey === 'hard' && this.musicStep % 2 === 0) this.tone(note / 2, 0.22, 'square', 0.006);
    this.musicStep += 1;
    this.nextMusic = timestamp + ({ easy: 760, normal: 620, hard: 430 }[state.difficultyKey]);
  }
}

const sounds = new SoundEngine();
let viewWidth = WORLD_WIDTH;
let worldOffsetX = 0;

function scaleGame() {
  const viewportRatio = window.innerWidth / window.innerHeight;
  viewWidth = Math.max(WORLD_WIDTH, WORLD_HEIGHT * viewportRatio);
  worldOffsetX = (viewWidth - WORLD_WIDTH) / 2;
  const scale = window.innerWidth / viewWidth;
  stage.style.setProperty('--stage-width', `${viewWidth}px`);
  stage.style.setProperty('--game-scale', Math.max(0.1, scale));
  canvas.width = Math.ceil(viewWidth);
  canvas.height = WORLD_HEIGHT;
}

function getActivePath() {
  if (worldOffsetX <= 0.01) return state.level.path;
  return [{ x: -worldOffsetX - 40, y: state.level.path[0].y }, ...state.level.path.slice(1)];
}

function getBestScore() {
  try { return Number(localStorage.getItem('kingdom-under-siege-best')) || 0; }
  catch { return 0; }
}

function saveBestScore() {
  const best = Math.max(getBestScore(), state.score);
  try { localStorage.setItem('kingdom-under-siege-best', String(best)); } catch { /* storage can be blocked on file URLs */ }
  return best;
}

function setMessage(text, duration = 2300) {
  ui.message.textContent = text;
  ui.message.style.opacity = '1';
  state.messageTimer = duration;
}

function showDialogue(speaker, text, duration = 4200) {
  if (state.mode !== 'playing') return;
  const isOrc = speaker === 'orc';
  ui.dialogueSpeaker.textContent = isOrc ? 'ORC KING · INCOMING' : 'CAT KING · ROYAL WARNING';
  ui.dialogueText.textContent = text;
  ui.dialoguePortrait.className = `dialogue-portrait ${isOrc ? 'orc' : 'cat'}`;
  ui.dialogueBox.classList.toggle('orc', isOrc);
  ui.dialogueBox.hidden = false;
  ui.dialogueBox.style.animation = 'none';
  void ui.dialogueBox.offsetWidth;
  ui.dialogueBox.style.removeProperty('animation');
  state.dialogueTimer = duration;
}

function hideDialogue() {
  state.dialogueTimer = 0;
  ui.dialogueBox.hidden = true;
}

function clearStoryTimers() {
  clearTimeout(storyIdleTimer);
  clearTimeout(storyAdvanceTimer);
  storyIdleTimer = 0;
  storyAdvanceTimer = 0;
}

function scheduleStoryCutscene() {
  clearTimeout(storyIdleTimer);
  if (state.mode !== 'menu' || storyAutoPlayed || !ui.storyScreen.hidden) return;
  storyIdleTimer = setTimeout(() => showStoryCutscene(0), 15000);
}

function showStorySlide(index) {
  storyIndex = Math.max(0, Math.min(storySlides.length - 1, index));
  const slide = storySlides[storyIndex];
  ui.storyArt.className = `story-art panel-${storyIndex + 1}`;
  ui.storyArt.style.animation = 'none';
  void ui.storyArt.offsetWidth;
  ui.storyArt.style.removeProperty('animation');
  ui.storyCopy.classList.remove('slide-changing');
  void ui.storyCopy.offsetWidth;
  ui.storyCopy.classList.add('slide-changing');
  ui.storyCount.textContent = `${storyIndex + 1} / ${storySlides.length}`;
  ui.storyTitle.textContent = slide.title;
  ui.storyText.textContent = slide.text;
  [...ui.storyDots.children].forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === storyIndex));
  ui.storyNextButton.textContent = storyIndex === storySlides.length - 1 ? 'DEFEND THE RAMEN' : 'NEXT';
  clearTimeout(storyAdvanceTimer);
  storyAdvanceTimer = setTimeout(() => {
    if (storyIndex < storySlides.length - 1) showStorySlide(storyIndex + 1);
    else closeStoryCutscene();
  }, storyIndex === storySlides.length - 1 ? 9200 : 7800);
}

function showStoryCutscene(index = 0) {
  if (state.mode !== 'menu') return;
  clearStoryTimers();
  storyAutoPlayed = true;
  ui.storyScreen.hidden = false;
  showStorySlide(index);
  sounds.select();
}

function closeStoryCutscene() {
  clearTimeout(storyAdvanceTimer);
  storyAdvanceTimer = 0;
  ui.storyScreen.hidden = true;
  sounds.click();
}

function nextStorySlide() {
  if (storyIndex >= storySlides.length - 1) closeStoryCutscene();
  else { sounds.click(); showStorySlide(storyIndex + 1); }
}

function setGameSpeed(value, announce = false) {
  state.gameSpeed = Math.max(1, Math.min(10, Number(value) || 1));
  ui.speedSlider.value = String(state.gameSpeed);
  ui.speedValue.textContent = `${state.gameSpeed}×`;
  if (announce && state.mode === 'playing') setMessage(`BATTLE SPEED · ${state.gameSpeed}×`, 900);
}

function repairCastle() {
  if (state.mode !== 'playing' || state.gold < 1000 || state.health >= state.maxHealth) return false;
  state.gold -= 1000;
  state.health = Math.min(state.maxHealth, state.health + state.maxHealth * .25);
  state.baseFlash = 650;
  state.baseShake = 180;
  const castle = getCastlePosition();
  createBurst(castle.x, castle.y, '#f3d678', 34);
  sounds.upgrade();
  setMessage('CASTLE REPAIRED · +25% HEALTH', 2200);
  showDialogue('cat', 'The royal masons restored a quarter of the castle. The ramen is safer!', 4300);
  updateUI();
  return true;
}

function makeTowerButtons() {
  ui.towerButtons.replaceChildren();
  state.level.towers.forEach((key, index) => {
    const tower = towerTypes[key];
    const button = document.createElement('button');
    button.className = `tower-btn${key === state.selectedBuild ? ' selected' : ''}`;
    button.dataset.tower = key;
    button.innerHTML = `<kbd>${index + 1}</kbd><i>${tower.icon}</i><strong>${tower.name}</strong><small>${tower.description}</small><em>${tower.cost}g</em>`;
    button.addEventListener('click', () => selectBuild(key));
    ui.towerButtons.append(button);
  });
}

function selectBuild(type) {
  if (state.mode !== 'playing') return;
  if (state.selectedBuild === type && !state.selectedTower) {
    clearSelection();
    return;
  }
  state.selectedBuild = type;
  state.selectedTower = null;
  updateInspector();
  document.querySelectorAll('.tower-btn').forEach((button) => button.classList.toggle('selected', button.dataset.tower === type));
  sounds.click();
  setMessage(`${towerTypes[type].name} — PLACE ANYWHERE OFF THE ROAD`, 1600);
}

function clearSelection() {
  state.selectedBuild = null;
  state.selectedTower = null;
  state.mopActive = false;
  ui.mopButton.classList.remove('active');
  canvas.style.cursor = 'crosshair';
  ui.placementHint.hidden = true;
  document.querySelectorAll('.tower-btn').forEach((button) => button.classList.remove('selected'));
  updateInspector();
  sounds.click();
  setMessage('SELECTION CLEARED', 900);
}

function updateInspector() {
  const inspecting = Boolean(state.selectedTower && state.towers.includes(state.selectedTower));
  ui.towerInspector.hidden = !inspecting;
  ui.towerButtons.hidden = inspecting;
  if (!inspecting) return;
  const tower = state.selectedTower;
  const definition = towerTypes[tower.type];
  const upgradeCost = getUpgradeCost(tower);
  ui.inspectorName.textContent = `${definition.name} · LEVEL ${tower.level}`;
  const cannotAffordUpgrade = state.gold < upgradeCost;
  ui.upgradeButton.textContent = tower.level >= 3 ? 'MAX LEVEL' : cannotAffordUpgrade ? `NEED ${upgradeCost}g` : `UPGRADE ${upgradeCost}g`;
  ui.upgradeButton.disabled = tower.level >= 3 || cannotAffordUpgrade;
  ui.upgradeButton.title = tower.level >= 3 ? 'Maximum level reached' : cannotAffordUpgrade ? `You need ${upgradeCost - state.gold} more gold` : 'Upgrade this tower';
  ui.sellButton.textContent = `SELL ${Math.round(tower.spent * 0.7)}g`;
}

function updateUI() {
  ui.wave.textContent = `${state.wave} / ${state.difficultyKey === 'hard' ? '?' : state.totalWaves}`;
  ui.money.textContent = state.gold;
  const shownHealth = Number.isInteger(state.health) ? state.health : Number(state.health.toFixed(2));
  ui.lives.textContent = `${Math.max(0, shownHealth)} / ${state.maxHealth}`;
  ui.score.textContent = state.score;
  ui.healthFill.style.width = `${Math.max(0, state.health / state.maxHealth) * 100}%`;
  const remaining = state.runningWave ? Math.max(0, state.spawnTotal - state.waveResolved) : 0;
  ui.enemyCount.textContent = state.runningWave ? `${remaining} LEFT` : '—';
  ui.enemyFill.style.width = `${state.spawnTotal ? Math.min(100, state.waveResolved / state.spawnTotal * 100) : 0}%`;
  const manualFire = state.manualFireTimer > 0 && state.runningWave;
  ui.waveButton.textContent = manualFire ? 'HIT SPACEBAR TO FIRE' : state.runningWave ? `WAVE ${state.wave} IN PROGRESS` : `START WAVE ${state.wave + 1}`;
  ui.waveButton.disabled = (!manualFire && state.runningWave) || state.mode !== 'playing' || (!state.runningWave && state.wave >= state.totalWaves);
  const activeEvents = [];
  if (state.manualFireTimer > 0) activeEvents.push('⚔ MANUAL FIRE — HIT SPACEBAR TO FIRE');
  if (state.speedBoostTimer > 0) activeEvents.push('» ENEMY SPEED SURGE');
  if (state.bounceTimer > 0) activeEvents.push('↠ BOUNCE-FORWARD HITS');
  if (state.mapFlipped) activeEvents.push('↻ UPSIDE DOWN');
  if (state.spinTimer > 0) activeEvents.push('⟳ SPINNING KINGDOM');
  if (state.possessedCastle.active) activeEvents.push('☾ POSSESSED CASTLE');
  ui.eventStatus.hidden = activeEvents.length === 0;
  ui.eventStatus.textContent = activeEvents.join('   ·   ');
  ui.aiButton.textContent = state.aiEnabled ? 'AI ON' : 'AI OFF';
  ui.aiButton.classList.toggle('active', state.aiEnabled);
  ui.aiButton.setAttribute('aria-pressed', String(state.aiEnabled));
  ui.aiButton.title = state.aiEnabled ? 'Turn off AI takeover' : 'Let AI take over';
  const castleFull = state.health >= state.maxHealth;
  ui.repairButton.disabled = state.mode !== 'playing' || state.gold < 1000 || castleFull;
  ui.repairLabel.textContent = castleFull ? 'CASTLE AT 100%' : '1000G · +25% HEALTH';
  document.querySelectorAll('.tower-btn').forEach((button) => {
    button.classList.toggle('cannot-afford', towerTypes[button.dataset.tower].cost > state.gold);
    button.classList.toggle('selected', button.dataset.tower === state.selectedBuild && !state.selectedTower);
  });
  updateInspector();
}

function startGame() {
  clearStoryTimers();
  stopResultArtScroll();
  ui.storyScreen.hidden = true;
  sounds.unlock();
  sounds.click();
  sounds.fadeMenuMusic(1.8);
  state.level = levels[state.levelKey];
  state.difficulty = difficulties[state.difficultyKey];
  state.totalWaves = state.difficulty.waves || Math.floor(state.difficulty.wavesMin + Math.random() * (state.difficulty.wavesMax - state.difficulty.wavesMin + 1));
  state.mode = 'playing';
  state.wave = 0;
  state.gold = state.difficulty.gold;
  state.health = state.difficulty.health;
  state.maxHealth = state.difficulty.health;
  state.score = 0;
  state.towers = [];
  state.enemies = [];
  state.birds = [];
  state.projectiles = [];
  state.particles = [];
  state.steamClouds = [];
  state.runningWave = false;
  state.waveResolved = 0;
  state.selectedTower = null;
  state.selectedBuild = state.level.towers[0];
  state.mopActive = false;
  state.mapFlipped = false;
  state.flipTimer = 0;
  state.speedBoostTimer = 0;
  state.bounceTimer = 0;
  state.manualFireTimer = 0;
  state.manualCooldown = 0;
  state.nextChaosAt = Infinity;
  state.chaosBag = [];
  state.aiEnabled = false;
  state.aiThinkTimer = 0;
  setGameSpeed(1);
  hideDialogue();
  resetPossessedCastle();
  stopBattlefieldRotation();
  ui.mopButton.hidden = true;
  ui.eventStatus.hidden = true;
  ui.mopButton.classList.remove('active');
  canvas.style.cursor = 'crosshair';
  state.baseShake = 0;
  state.baseFlash = 0;
  ui.startScreen.hidden = true;
  ui.pauseScreen.hidden = true;
  ui.menuDifficultyPanel.hidden = true;
  ui.resultScreen.hidden = true;
  ui.buildDock.hidden = false;
  ui.speedControl.hidden = false;
  ui.repairButton.hidden = false;
  makeTowerButtons();
  updateUI();
  setMessage(`${state.level.name.toUpperCase()} · ${state.difficulty.name.toUpperCase()} — DEFEND THE RAMEN`, 3200);
  showDialogue('cat', 'Guard the royal ramen. I have a very bad feeling about those orcs!', 4200);
}

function returnToLevelSelect() {
  clearStoryTimers();
  stopResultArtScroll();
  state.mode = 'menu';
  state.runningWave = false;
  state.enemies = [];
  state.birds = [];
  state.projectiles = [];
  state.steamClouds = [];
  state.mopActive = false;
  state.aiEnabled = false;
  state.aiThinkTimer = 0;
  setGameSpeed(1);
  hideDialogue();
  canvas.style.cursor = 'crosshair';
  resetPossessedCastle();
  stopBattlefieldRotation();
  ui.mopButton.hidden = true;
  ui.eventStatus.hidden = true;
  ui.startScreen.hidden = false;
  ui.pauseScreen.hidden = true;
  ui.resultScreen.hidden = true;
  ui.buildDock.hidden = true;
  ui.speedControl.hidden = true;
  ui.repairButton.hidden = true;
  ui.storyScreen.hidden = true;
  ui.placementHint.hidden = true;
  sounds.startMenuMusic();
  storyAutoPlayed = false;
  scheduleStoryCutscene();
  setMessage('PROTECT THE ROYAL RAMEN', 999999);
}

function openMenu() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  ui.pauseScreen.hidden = false;
  ui.menuDifficultyPanel.hidden = true;
  ui.difficultyMenuButton.textContent = `CHANGE DIFFICULTY · ${state.difficulty.name.toUpperCase()}`;
  ui.placementHint.hidden = true;
  sounds.click();
}

function closeMenu() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  ui.pauseScreen.hidden = true;
  sounds.click();
}

function toggleSound() {
  sounds.unlock();
  sounds.enabled = !sounds.enabled;
  ui.soundButton.textContent = sounds.enabled ? '🔊' : '🔇';
  ui.menuSoundButton.textContent = `SOUND: ${sounds.enabled ? 'ON' : 'OFF'}`;
  if (sounds.enabled) {
    sounds.click();
    if (state.mode === 'menu') sounds.startMenuMusic();
  } else sounds.fadeMenuMusic(0.15);
}

function launchWave() {
  if (state.mode !== 'playing' || state.runningWave || state.wave >= state.totalWaves) return;
  sounds.unlock();
  sounds.wave(state.levelKey);
  state.wave += 1;
  state.runningWave = true;
  state.spawnCount = 0;
  state.spawnTotal = 5 + state.wave * 2 + (state.wave === state.totalWaves ? 1 : 0);
  state.spawnTimer = 0;
  state.waveResolved = 0;
  state.waveElapsed = 0;
  state.chaosEvents = { invisible: false };
  state.chaosBag = [];
  state.nextChaosAt = state.difficulty.chaosLevel ? chaosDelay() : Infinity;
  state.selectedTower = null;
  updateInspector();
  setMessage(`WAVE ${state.wave} APPROACHES`, 2200);
  updateUI();
}

function chooseEnemyType(index) {
  const [fast, heavy, boss] = state.level.enemies;
  if (state.wave === state.totalWaves && index === state.spawnTotal - 1) return boss;
  if (state.wave >= 2 && index % 4 === 3) return heavy;
  return fast;
}

function spawnEnemy(type = chooseEnemyType(state.spawnCount), options = {}) {
  const definition = enemyTypes[type];
  const waveHealth = 1 + Math.max(0, state.wave - 1) * 0.13;
  const maxHealth = Math.round((options.health || definition.hp) * state.difficulty.enemyHealth * waveHealth);
  const start = options.position || getActivePath()[0];
  state.enemies.push({
    id: state.nextId++, type, x: start.x, y: start.y, pathIndex: options.pathIndex || 0,
    maxHealth, health: maxHealth, slowTimer: 0, dead: false, angle: 0, carried: false,
    invisible: false, phaseTimer: definition.ability === 'phase' ? 2100 : 0,
    chaosCloak: state.difficulty.chaosLevel > 0 && state.wave >= 2 && state.spawnCount % (state.difficulty.chaosLevel > 1 ? 3 : 5) === 2,
    castleAttackTimer: 0
  });
}

function getPathProgress(enemy) {
  if (enemy.kind === 'bird') return enemy.startIndex + (enemy.targetIndex - enemy.startIndex) * enemy.progress + 0.35;
  const path = getActivePath();
  const next = path[Math.min(enemy.pathIndex + 1, path.length - 1)];
  const current = path[enemy.pathIndex];
  const length = Math.max(1, Math.hypot(next.x - current.x, next.y - current.y));
  return enemy.pathIndex + (1 - Math.hypot(next.x - enemy.x, next.y - enemy.y) / length);
}

function moveEnemy(enemy, delta) {
  if (enemy.carried) return;
  updateEnemyVisibility(enemy, delta);
  if (state.possessedCastle.active && state.possessedCastle.phase === 'holding') {
    const castle = getCastlePosition();
    const attackDistance = enemyTypes[enemy.type].size + 62;
    if (Math.hypot(enemy.x - castle.x, enemy.y - castle.y) <= attackDistance) {
      enemy.angle = Math.atan2(castle.y - enemy.y, castle.x - enemy.x);
      enemy.castleAttackTimer -= delta;
      if (enemy.castleAttackTimer <= 0) {
        enemy.castleAttackTimer = 1450 + Math.random() * 550;
        damagePossessedCastle(enemy);
      }
      return;
    }
  }
  enemy.castleAttackTimer = Math.max(0, enemy.castleAttackTimer);
  const speedSurge = state.speedBoostTimer > 0 ? (state.difficulty.chaosLevel > 1 ? 1.95 : 1.65) : 1;
  const movement = enemyTypes[enemy.type].speed * state.difficulty.enemySpeed * speedSurge * (enemy.slowTimer > 0 ? 0.48 : 1) * delta / 1000;
  enemy.slowTimer = Math.max(0, enemy.slowTimer - delta);
  advanceEnemy(enemy, movement);
}

function advanceEnemy(enemy, distanceToMove) {
  const path = getActivePath();
  let movement = distanceToMove;
  while (movement > 0 && !enemy.dead) {
    const next = path[enemy.pathIndex + 1];
    if (!next) { damageBase(enemy); return; }
    const dx = next.x - enemy.x;
    const dy = next.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    enemy.angle = Math.atan2(dy, dx);
    if (movement >= distance) {
      enemy.x = next.x;
      enemy.y = next.y;
      movement -= distance;
      enemy.pathIndex += 1;
      if (enemy.pathIndex >= path.length - 1) damageBase(enemy);
    } else {
      enemy.x += dx / distance * movement;
      enemy.y += dy / distance * movement;
      movement = 0;
    }
  }
}

function updateEnemyVisibility(enemy, delta) {
  const phased = enemyTypes[enemy.type].ability === 'phase' || enemy.chaosCloak;
  if (!phased) return;
  enemy.phaseTimer -= delta;
  if (enemy.phaseTimer > 0) return;
  enemy.invisible = !enemy.invisible;
  enemy.phaseTimer = enemy.invisible ? 1450 : 3200;
  createBurst(enemy.x, enemy.y, enemy.invisible ? '#c5eaff' : enemyTypes[enemy.type].color, 7);
  if (enemy.invisible && state.difficulty.chaosLevel > 0 && !state.chaosEvents.invisible) {
    state.chaosEvents.invisible = true;
    setMessage('SOME ENEMIES HAVE BECOME INVISIBLE!', 2400);
    showDialogue('cat', 'Invisible orcs! Hold on while the royal mages reveal their footprints.', 4300);
  }
}

function applyCastleDamage(amount, impactX, impactY, message) {
  const previousRatio = state.health / state.maxHealth;
  state.health -= amount;
  const currentRatio = Math.max(0,state.health) / state.maxHealth;
  state.baseShake = 520;
  state.baseFlash = 360;
  sounds.baseHit();
  createBurst(impactX, impactY, '#f4c06a', 16);
  if ([.75,.5,.25,0].some((threshold) => previousRatio > threshold && currentRatio <= threshold)) {
    const castle = getCastlePosition();
    createBurst(castle.x,castle.y,'#82786a',32);
  }
  if (previousRatio > .5 && currentRatio <= .5) showDialogue('orc', 'Half the castle is cracked. I can already smell my ramen!', 4300);
  if (previousRatio > .25 && currentRatio <= .25) showDialogue('cat', 'The ramen tower is collapsing! We must hold this final wall!', 4300);
  setMessage(message, 1300);
  if (state.health <= 0) finishGame(false);
}

function damageBase(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  state.waveResolved += 1;
  const damage = enemyTypes[enemy.type].damage;
  applyCastleDamage(damage, enemy.x, enemy.y, `THE CASTLE TOOK ${damage} DAMAGE!`);
}

function damagePossessedCastle(enemy) {
  if (enemy.dead || state.mode !== 'playing') return;
  const damage = enemyTypes[enemy.type].damage;
  const castle = getCastlePosition();
  applyCastleDamage(damage, castle.x, castle.y, `THE POSSESSED CASTLE IS UNDER ATTACK! -${damage}`);
}

function setMapFlipped(flipped) {
  state.mapFlipped = flipped;
  canvas.classList.toggle('upside-down', flipped && state.spinTimer <= 0);
}

function resetPossessedCastle() {
  state.possessedCastle = { active: false, phase: 'idle', timer: 0, progress: 0, route: [] };
}

function getCastleHome() {
  const end = getActivePath().at(-1);
  return { x: end.x + 42, y: end.y };
}

function pointAlongRoute(route, progress) {
  if (!route.length) return getCastleHome();
  if (route.length === 1) return route[0];
  const lengths = [];
  let total = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    const length = Math.hypot(route[index + 1].x - route[index].x, route[index + 1].y - route[index].y);
    lengths.push(length);
    total += length;
  }
  let remaining = Math.max(0, Math.min(1, progress)) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const amount = lengths[index] ? Math.min(1, remaining / lengths[index]) : 0;
      return {
        x: route[index].x + (route[index + 1].x - route[index].x) * amount,
        y: route[index].y + (route[index + 1].y - route[index].y) * amount
      };
    }
    remaining -= lengths[index];
  }
  return route.at(-1);
}

function getCastlePosition() {
  if (!state.possessedCastle.active) return getCastleHome();
  return pointAlongRoute(state.possessedCastle.route, state.possessedCastle.progress);
}

function startPossessedCastleEvent() {
  if (state.possessedCastle.active) return false;
  const attackers = state.enemies.filter((enemy) => !enemy.dead && !enemy.carried);
  if (!attackers.length) return false;
  const path = getActivePath();
  const advanced = attackers.sort((a, b) => getPathProgress(b) - getPathProgress(a))[0];
  const targetIndex = Math.min(path.length - 3, Math.max(2, advanced.pathIndex + 2));
  const route = [getCastleHome(), ...path.slice(targetIndex).reverse()];
  state.possessedCastle = {
    active: true, phase: 'outbound', timer: 0, progress: 0, route,
    outboundDuration: state.difficulty.chaosLevel > 1 ? 2600 : 3400,
    holdDuration: state.difficulty.chaosLevel > 1 ? 10500 : 7200,
    returnDuration: state.difficulty.chaosLevel > 1 ? 2900 : 3600
  };
  sounds.possess();
  setMessage('THE CASTLE IS POSSESSED — IT IS CHARGING THE ENEMY!', 3900);
  showDialogue('cat', 'Oh no—the castle is possessed! Hold on while we prepare the anti-spell!', 4800);
  return true;
}

function updatePossessedCastle(delta) {
  const castle = state.possessedCastle;
  if (!castle.active) return;
  castle.timer += delta;
  const smooth = (amount) => amount * amount * (3 - 2 * amount);
  if (castle.phase === 'outbound') {
    castle.progress = smooth(Math.min(1, castle.timer / castle.outboundDuration));
    if (castle.timer >= castle.outboundDuration) {
      castle.phase = 'holding';
      castle.timer = 0;
      castle.progress = 1;
      setMessage('THE CASTLE REFUSES TO MOVE — DEFEND IT HERE!', 3000);
    }
    return;
  }
  if (castle.phase === 'holding') {
    castle.progress = 1;
    if (castle.timer >= castle.holdDuration) {
      castle.phase = 'returning';
      castle.timer = 0;
      sounds.castleReturn();
      setMessage('THE SPELL BROKE — THE CASTLE IS SLIDING HOME!', 3200);
    }
    return;
  }
  if (castle.phase === 'returning') {
    castle.progress = 1 - smooth(Math.min(1, castle.timer / castle.returnDuration));
    if (castle.timer >= castle.returnDuration) {
      resetPossessedCastle();
      sounds.castleReturn();
      setMessage('THE CASTLE IS BACK WHERE IT BELONGS', 2200);
      showDialogue('cat', 'Anti-spell complete. The ramen tower is safely back in place!', 3900);
    }
  }
}

function startBattlefieldSpin() {
  if (state.spinTimer > 0 || state.mapFlipped) return false;
  state.spinDuration = state.difficulty.chaosLevel > 1 ? 7200 : 9800;
  state.spinTimer = state.spinDuration;
  state.spinAngle = 0;
  canvas.classList.add('spinning');
  sounds.flip();
  setMessage('THE WHOLE KINGDOM IS SPINNING!', 3000);
  showDialogue('orc', 'Try aiming while the whole ramen kingdom spins!', 4200);
  return true;
}

function updateBattlefieldSpin(delta) {
  if (state.spinTimer <= 0) return;
  state.spinTimer = Math.max(0, state.spinTimer - delta);
  state.spinAngle = 360 * (1 - state.spinTimer / state.spinDuration);
  canvas.style.transform = `rotate(${state.spinAngle}deg)`;
  if (state.spinTimer <= 0) {
    canvas.style.removeProperty('transform');
    void canvas.offsetWidth;
    canvas.classList.remove('spinning');
    state.spinAngle = 0;
    setMessage('THE KINGDOM STOPPED SPINNING', 1800);
  }
}

function stopBattlefieldRotation() {
  state.mapFlipped = false;
  state.flipTimer = 0;
  state.spinTimer = 0;
  state.spinDuration = 0;
  state.spinAngle = 0;
  canvas.style.removeProperty('transform');
  void canvas.offsetWidth;
  canvas.classList.remove('upside-down', 'spinning');
}

function summonBird() {
  const passenger = state.enemies
    .filter((enemy) => !enemy.dead && !enemy.carried && enemyTypes[enemy.type].shape !== 'boss')
    .sort((a, b) => getPathProgress(b) - getPathProgress(a))[0];
  if (!passenger) return false;
  const path = getActivePath();
  const targetIndex = Math.min(path.length - 2, passenger.pathIndex + 5);
  passenger.carried = true;
  passenger.invisible = false;
  state.birds.push({
    id: state.nextId++, kind: 'bird', x: passenger.x, y: passenger.y - 22,
    startX: passenger.x, startY: passenger.y - 22, targetX: path[targetIndex].x,
    targetY: path[targetIndex].y - 55, startIndex: passenger.pathIndex, targetIndex,
    progress: 0, health: 230 * state.difficulty.enemyHealth, maxHealth: 230 * state.difficulty.enemyHealth,
    passenger, dead: false
  });
  sounds.bird();
  setMessage('A GIANT BIRD STOLE AN ENEMY — SHOOT IT DOWN!', 3200);
  showDialogue('orc', 'My bird will carry that raider straight to your precious noodles!', 4300);
  return true;
}

function dropPassenger(bird, shotDown) {
  if (!bird.passenger || bird.passenger.dead) return;
  const path = getActivePath();
  const pathIndex = Math.min(path.length - 2, Math.round(bird.startIndex + (bird.targetIndex - bird.startIndex) * bird.progress));
  const point = path[pathIndex];
  bird.passenger.carried = false;
  bird.passenger.pathIndex = pathIndex;
  bird.passenger.x = point.x;
  bird.passenger.y = point.y;
  if (shotDown) setMessage('BIRD DOWN — ATTACK THE DROPPED ENEMY!', 2200);
  else setMessage('THE BIRD DROPPED ITS PASSENGER NEAR THE CASTLE!', 2200);
}

function updateBirds(delta) {
  state.birds.forEach((bird) => {
    if (bird.dead) return;
    if (bird.kind === 'thief') {
      bird.progress = Math.min(1, bird.progress + delta / 3000);
      bird.x = bird.startX + (bird.targetX - bird.startX) * bird.progress;
      bird.y = bird.startY + (bird.targetY - bird.startY) * bird.progress - Math.sin(bird.progress * Math.PI) * 90;
      if (bird.progress >= 1) bird.dead = true;
      return;
    }
    bird.progress = Math.min(1, bird.progress + delta / 5200);
    const arc = Math.sin(bird.progress * Math.PI) * 75;
    bird.x = bird.startX + (bird.targetX - bird.startX) * bird.progress;
    bird.y = bird.startY + (bird.targetY - bird.startY) * bird.progress - arc;
    bird.passenger.x = bird.x;
    bird.passenger.y = bird.y + 34;
    if (bird.progress >= 1) {
      dropPassenger(bird, false);
      bird.dead = true;
    }
  });
  state.birds = state.birds.filter((bird) => !bird.dead);
}

function createSteam() {
  const minimumX = -worldOffsetX;
  const width = WORLD_WIDTH + worldOffsetX * 2;
  state.steamClouds = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      state.steamClouds.push({
        x: minimumX + width * (column + .5) / 5 + (row % 2 ? 35 : -25),
        y: 165 + row * 185 + (column % 2 ? 28 : -18), radius: 190, strength: 1
      });
    }
  }
  state.mopActive = false;
  ui.mopButton.hidden = false;
  ui.mopButton.classList.remove('active');
  sounds.steam();
  setMessage('CLOUD COVER! SELECT REMOVE CLOUDS AND CLEAR THE VIEW', 3600);
  showDialogue('cat', 'Cloud spell! Select REMOVE CLOUDS and clear enough of the battlefield to aim.', 4800);
}

function toggleMop() {
  if (!state.steamClouds.length || state.mode !== 'playing') return;
  state.mopActive = !state.mopActive;
  state.selectedTower = null;
  state.selectedBuild = null;
  ui.mopButton.classList.toggle('active', state.mopActive);
  canvas.style.cursor = state.mopActive ? 'grabbing' : 'crosshair';
  updateInspector();
  updateUI();
  sounds.click();
}

function wipeSteam(point) {
  let touched = false;
  state.steamClouds.forEach((cloud) => {
    if (Math.hypot(point.x - cloud.x, point.y - cloud.y) < cloud.radius + 65) {
      cloud.strength -= 0.34;
      touched = true;
    }
  });
  if (touched) createBurst(point.x, point.y, '#dff8f5', 5);
  state.steamClouds = state.steamClouds.filter((cloud) => cloud.strength > 0.04);
  if (!state.steamClouds.length) {
    state.mopActive = false;
    ui.mopButton.hidden = true;
    ui.mopButton.classList.remove('active');
    canvas.style.cursor = 'crosshair';
    setMessage('VIEW CLEARED!', 1500);
  }
}

function chaosDelay() {
  return state.difficulty.chaosLevel > 1 ? 2200 + Math.random() * 1800 : 5200 + Math.random() * 3000;
}

function refillChaosBag() {
  state.chaosBag = ['steam','bird','flip','spin','castle','manual','towerThief','speed','bounce'];
  for (let index = state.chaosBag.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [state.chaosBag[index], state.chaosBag[swap]] = [state.chaosBag[swap], state.chaosBag[index]];
  }
}

function summonTowerThief() {
  if (!state.towers.length) return false;
  const tower = state.towers[Math.floor(Math.random() * state.towers.length)];
  state.towers = state.towers.filter((item) => item !== tower);
  if (state.selectedTower === tower) state.selectedTower = null;
  state.birds.push({
    id:state.nextId++, kind:'thief', x:tower.x, y:tower.y-20, startX:tower.x, startY:tower.y-20,
    targetX:WORLD_WIDTH + worldOffsetX + 100, targetY:80, progress:0, cargoTower:tower, dead:false
  });
  sounds.bird();
  createBurst(tower.x,tower.y,'#8a5a35',16);
  setMessage(`A THIEF BIRD STOLE YOUR ${towerTypes[tower.type].name}!`, 3200);
  showDialogue('orc', 'A fine tower. I think I will keep it!', 3900);
  updateUI();
  return true;
}

function startManualFireEvent() {
  if (state.manualFireTimer > 0) return false;
  state.manualFireTimer = state.difficulty.chaosLevel > 1 ? 12000 : 9000;
  state.manualCooldown = 0;
  setMessage('MANUAL FIRE — HIT SPACEBAR TO FIRE', 3500);
  showDialogue('cat', 'The auto-fire spell is broken! Hit Spacebar—each tower will fire one normal shot.', 5000);
  sounds.flip();
  return true;
}

function startSpeedSurge() {
  if (state.speedBoostTimer > 0) return false;
  state.speedBoostTimer = state.difficulty.chaosLevel > 1 ? 10000 : 7000;
  setMessage('ENEMIES FOUND RUNNING SHOES!', 2600);
  showDialogue('orc', 'My raiders found enchanted running shoes. Catch us now!', 4000);
  sounds.bird();
  return true;
}

function startBounceEvent() {
  if (state.bounceTimer > 0) return false;
  state.bounceTimer = state.difficulty.chaosLevel > 1 ? 10000 : 7000;
  setMessage('ATTACKS NOW BOUNCE ENEMIES FORWARD!', 3000);
  showDialogue('cat', 'Our shots are bouncing them forward! Keep firing, but brace the castle.', 4300);
  sounds.steam();
  return true;
}

function triggerChaosEvent() {
  if (!state.chaosBag.length) refillChaosBag();
  for (let attempts = 0; attempts < 9; attempts += 1) {
    if (!state.chaosBag.length) refillChaosBag();
    const event = state.chaosBag.pop();
    if (event === 'steam' && !state.steamClouds.length) { createSteam(); return true; }
    if (event === 'bird' && summonBird()) return true;
    if (event === 'flip' && !state.mapFlipped && state.spinTimer <= 0) {
      state.flipTimer = state.difficulty.chaosLevel > 1 ? 11000 : 8500;
      setMapFlipped(true); sounds.flip(); setMessage('WHY IS THE KINGDOM UPSIDE DOWN?!',3000);
      showDialogue('orc', 'Behold: my upside-down kingdom spell!', 4200); return true;
    }
    if (event === 'spin' && startBattlefieldSpin()) return true;
    if (event === 'castle' && startPossessedCastleEvent()) return true;
    if (event === 'manual' && state.towers.length && startManualFireEvent()) return true;
    if (event === 'towerThief' && summonTowerThief()) return true;
    if (event === 'speed' && startSpeedSurge()) return true;
    if (event === 'bounce' && startBounceEvent()) return true;
  }
  return false;
}

function updateChaos(delta) {
  if (!state.difficulty.chaosLevel || !state.runningWave) return;
  state.waveElapsed += delta;
  state.speedBoostTimer = Math.max(0,state.speedBoostTimer-delta);
  state.bounceTimer = Math.max(0,state.bounceTimer-delta);
  state.manualFireTimer = Math.max(0,state.manualFireTimer-delta);
  state.manualCooldown = Math.max(0,state.manualCooldown-delta);
  updateBattlefieldSpin(delta);
  if (state.waveElapsed >= state.nextChaosAt) {
    triggerChaosEvent();
    state.nextChaosAt = state.waveElapsed + chaosDelay();
  }
  if (state.mapFlipped && state.spinTimer <= 0) {
    state.flipTimer -= delta;
    if (state.flipTimer <= 0) {
      setMapFlipped(false);
      setMessage('GRAVITY HAS APOLOGISED', 1800);
    }
  }
}

function getUpgradeCost(tower) {
  return Math.round(towerTypes[tower.type].cost * (0.55 + tower.level * 0.3));
}

function upgradeTower(tower) {
  if (!tower || tower.level >= 3) return;
  const cost = getUpgradeCost(tower);
  if (state.gold < cost) { setMessage('NOT ENOUGH GOLD', 1200); return; }
  state.gold -= cost;
  tower.spent += cost;
  tower.level += 1;
  sounds.upgrade();
  createBurst(tower.x, tower.y, towerTypes[tower.type].color, 14);
  setMessage(`${towerTypes[tower.type].name} REACHED LEVEL ${tower.level}`, 1700);
  updateUI();
}

function upgradeSelectedTower() {
  upgradeTower(state.selectedTower);
}

function sellSelectedTower() {
  const tower = state.selectedTower;
  if (!tower) return;
  const value = Math.round(tower.spent * 0.7);
  state.gold += value;
  state.towers = state.towers.filter((item) => item !== tower);
  state.selectedTower = null;
  sounds.sell();
  setMessage(`TOWER SOLD FOR ${value} GOLD`, 1400);
  updateInspector();
  updateUI();
}

function placementStatus(point, type = state.selectedBuild) {
  if (!type) return { valid: false, reason: 'Select a tower first' };
  if (point.x < -worldOffsetX + 35 || point.x > WORLD_WIDTH + worldOffsetX - 35 || point.y < 105 || point.y > WORLD_HEIGHT - 125) return { valid: false, reason: 'Too close to the edge' };
  const path = getActivePath();
  if (distanceToPath(point, path) < TRACK_WIDTH / 2 + TOWER_RADIUS + 5) return { valid: false, reason: 'Cannot build on the road' };
  const end = path[path.length - 1];
  if (Math.hypot(point.x - end.x, point.y - end.y) < 105) return { valid: false, reason: 'Keep the castle gate clear' };
  if (state.towers.some((tower) => Math.hypot(point.x - tower.x, point.y - tower.y) < TOWER_RADIUS * 2 + 10)) return { valid: false, reason: 'Too close to another tower' };
  if (state.gold < towerTypes[type].cost) return { valid: false, reason: 'Not enough gold' };
  return { valid: true, reason: 'Click to build' };
}

function placeTower(point, type = state.selectedBuild) {
  if (!type) return;
  const status = placementStatus(point, type);
  if (!status.valid) { setMessage(status.reason.toUpperCase(), 1200); return; }
  const definition = towerTypes[type];
  state.gold -= definition.cost;
  state.towers.push({ id: state.nextId++, type, x: point.x, y: point.y, level: 1, cooldown: 0, spent: definition.cost, angle: -Math.PI / 2 });
  sounds.place();
  createBurst(point.x, point.y, definition.color, 12);
  setMessage(`${definition.name} BUILT`, 1200);
  updateUI();
}

function getAiPathSamples() {
  const path = getActivePath();
  const samples = [];
  const segmentCount = Math.max(1, path.length - 1);
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const pieces = Math.max(1, Math.ceil(length / 26));
    for (let piece = 0; piece <= pieces; piece += 1) {
      const amount = piece / pieces;
      samples.push({
        x: start.x + (end.x - start.x) * amount,
        y: start.y + (end.y - start.y) * amount,
        weight: .75 + .5 * (index + amount) / segmentCount
      });
    }
  }
  return samples;
}

function getAiPositionScore(point, type, samples) {
  const definition = towerTypes[type];
  const coverage = samples.reduce((total, sample) => total + (Math.hypot(point.x - sample.x, point.y - sample.y) <= definition.range ? sample.weight : 0), 0);
  const attackBonus = { single: 1, splash: 1.22, slow: 1.12 }[definition.attack];
  const damagePerSecond = definition.damage * definition.rate * attackBonus;
  const overlapPenalty = state.towers.reduce((total, tower) => {
    const overlap = definition.range * .72 - Math.hypot(point.x - tower.x, point.y - tower.y);
    return total + Math.max(0, overlap / definition.range);
  }, 0);
  return coverage * damagePerSecond / definition.cost - overlapPenalty * 1.8;
}

function findBestAiBuild() {
  if (state.towers.length >= 10) return null;
  const affordable = state.level.towers.filter((type) => towerTypes[type].cost <= state.gold);
  if (!affordable.length) return null;
  const existingTypes = new Set(state.towers.map((tower) => tower.type));
  const missingTypes = affordable.filter((type) => !existingTypes.has(type));
  const consideredTypes = missingTypes.length ? missingTypes : affordable;
  const samples = getAiPathSamples();
  let best = null;
  for (const type of consideredTypes) {
    for (let y = 128; y <= WORLD_HEIGHT - 138; y += 42) {
      for (let x = -worldOffsetX + 52; x <= WORLD_WIDTH + worldOffsetX - 52; x += 42) {
        const point = { x, y };
        if (!placementStatus(point, type).valid) continue;
        const score = getAiPositionScore(point, type, samples);
        if (!best || score > best.score) best = { type, point, score };
      }
    }
  }
  return best;
}

function findBestAiUpgrade() {
  const samples = getAiPathSamples();
  return state.towers
    .filter((tower) => tower.level < 3 && getUpgradeCost(tower) <= state.gold)
    .map((tower) => ({
      tower,
      score: getAiPositionScore(tower, tower.type, samples) * (1 + (3 - tower.level) * .22) / getUpgradeCost(tower)
    }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

function runAiTurn() {
  if (!state.aiEnabled || state.mode !== 'playing') return;
  if (state.steamClouds.length) {
    const cloud = state.steamClouds.reduce((strongest, item) => item.strength > strongest.strength ? item : strongest);
    wipeSteam(cloud);
    return;
  }
  if (state.manualFireTimer > 0 && state.runningWave && state.manualCooldown <= 0) {
    manualVolley();
    return;
  }
  if (state.gold >= 1000 && state.health <= state.maxHealth * .5 && repairCastle()) return;
  const build = findBestAiBuild();
  const upgrade = findBestAiUpgrade();
  if (build && state.towers.length < 8) {
    placeTower(build.point, build.type);
    return;
  }
  if (upgrade) {
    upgradeTower(upgrade.tower);
    return;
  }
  if (build) {
    placeTower(build.point, build.type);
    return;
  }
  if (!state.runningWave && !state.possessedCastle.active && state.wave < state.totalWaves) launchWave();
}

function updateAi(delta) {
  if (!state.aiEnabled) return;
  state.aiThinkTimer -= delta;
  if (state.aiThinkTimer > 0) return;
  state.aiThinkTimer = 520;
  runAiTurn();
}

function toggleAi() {
  if (state.mode !== 'playing') return;
  state.aiEnabled = !state.aiEnabled;
  state.aiThinkTimer = 0;
  sounds.select();
  setMessage(state.aiEnabled ? 'AI TAKEOVER ENABLED — CLICK AI ON TO TAKE CONTROL BACK' : 'AI TAKEOVER DISABLED — YOU HAVE CONTROL', 3000);
  updateUI();
}

function acquireTarget(tower) {
  return targetsInRange(tower).sort((a, b) => getPathProgress(b) - getPathProgress(a))[0];
}

function targetsInRange(tower) {
  const definition = towerTypes[tower.type];
  const range = definition.range * (1 + (tower.level - 1) * 0.08);
  return [...state.enemies, ...state.birds].filter((enemy) =>
    !enemy.dead && enemy.kind !== 'thief' && !enemy.carried && !enemy.invisible && Math.hypot(enemy.x-tower.x,enemy.y-tower.y)<=range
  );
}

function fireProjectile(tower, target) {
  const definition = towerTypes[tower.type];
  tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  state.projectiles.push({
    x:tower.x+Math.cos(tower.angle)*16, y:tower.y+Math.sin(tower.angle)*16,
    target, type:tower.type, level:tower.level, speed:definition.attack==='splash'?390:650,
    life:2300, dead:false
  });
  sounds.shot(tower.type);
}

function manualVolley() {
  if (state.manualFireTimer <= 0 || state.manualCooldown > 0 || state.mode !== 'playing') return;
  let fired = 0;
  state.towers.forEach((tower) => {
    const target = acquireTarget(tower);
    if (!target) return;
    fireProjectile(tower, target);
    fired += 1;
  });
  state.manualCooldown = 620;
  if (fired) setMessage(`MANUAL VOLLEY — ${fired} SHOTS!`,800);
  else setMessage('NO ENEMIES IN RANGE',700);
}

function updateTowers(delta) {
  state.towers.forEach((tower) => {
    tower.cooldown -= delta;
    const target = acquireTarget(tower);
    if (!target) return;
    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    if (state.manualFireTimer > 0) return;
    if (tower.cooldown > 0) return;
    const definition = towerTypes[tower.type];
    const rate = definition.rate * (1 + (tower.level - 1) * 0.18);
    tower.cooldown = 1000 / rate;
    fireProjectile(tower,target);
  });
}

function damageEnemy(enemy, amount) {
  if (!enemy || enemy.dead) return;
  enemy.health -= amount;
  if (enemy.health > 0) {
    if (state.bounceTimer > 0 && enemy.kind !== 'bird' && !enemy.carried) advanceEnemy(enemy, 16 + Math.min(22, amount * 0.15));
    return;
  }
  if (enemy.kind === 'bird') {
    enemy.dead = true;
    state.gold += 45;
    state.score += 90 * state.wave;
    dropPassenger(enemy, true);
    sounds.death();
    createBurst(enemy.x, enemy.y, '#7d4d2b', 20);
    return;
  }
  enemy.dead = true;
  state.waveResolved += 1;
  const definition = enemyTypes[enemy.type];
  const reward = Math.max(1, Math.round(definition.reward * state.difficulty.reward));
  state.gold += reward;
  state.score += Math.round(reward * state.wave * ({ easy: 0.8, normal: 1, hard: 1.35 }[state.difficultyKey]));
  sounds.death();
  createBurst(enemy.x, enemy.y, definition.color, enemy.type === 'warlord' ? 28 : 10);
}

function impactProjectile(projectile) {
  const definition = towerTypes[projectile.type];
  const damage = definition.damage * (1 + (projectile.level - 1) * 0.52);
  if (definition.attack === 'splash') {
    [...state.enemies, ...state.birds].forEach((enemy) => {
      if (!enemy.dead && enemy.kind !== 'thief' && !enemy.carried && Math.hypot(enemy.x - projectile.target.x, enemy.y - projectile.target.y) < 58) damageEnemy(enemy, damage);
    });
    createBurst(projectile.target.x, projectile.target.y, '#e6804f', 18);
  } else {
    damageEnemy(projectile.target, damage);
    if (definition.attack === 'slow' && !projectile.target.dead && projectile.target.kind !== 'bird') projectile.target.slowTimer = (definition.slowDuration || 1500) + projectile.level * 250;
    createBurst(projectile.target.x, projectile.target.y, definition.projectile, 5);
  }
  projectile.dead = true;
}

function updateProjectiles(delta) {
  state.projectiles.forEach((projectile) => {
    projectile.life -= delta;
    if (projectile.target.dead || projectile.life <= 0) { projectile.dead = true; return; }
    const dx = projectile.target.x - projectile.x;
    const dy = projectile.target.y - projectile.y;
    const distance = Math.hypot(dx, dy);
    const movement = projectile.speed * delta / 1000;
    if (movement >= distance) impactProjectile(projectile);
    else { projectile.x += dx / distance * movement; projectile.y += dy / distance * movement; }
  });
  state.projectiles = state.projectiles.filter((projectile) => !projectile.dead);
}

function createBurst(x, y, color, count = 8) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI * 2 * i / count + Math.random() * 0.45;
    const speed = 0.45 + Math.random() * 1.8;
    state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 350 + Math.random() * 300, maxLife: 650, color, size: 2 + Math.random() * 3 });
  }
}

function updateParticles(delta) {
  state.particles.forEach((particle) => {
    particle.x += particle.vx * delta / 16;
    particle.y += particle.vy * delta / 16;
    particle.vy += 0.025 * delta / 16;
    particle.life -= delta;
  });
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function updateGame(delta, timestamp, realDelta = delta) {
  if (state.mode !== 'playing') return;
  updateAi(delta);
  state.baseShake = Math.max(0, state.baseShake - delta);
  state.baseFlash = Math.max(0, state.baseFlash - delta);
  if (state.messageTimer > 0) {
    state.messageTimer -= realDelta;
    if (state.messageTimer <= 0) ui.message.style.opacity = '0';
  }
  if (state.dialogueTimer > 0) {
    state.dialogueTimer -= realDelta;
    if (state.dialogueTimer <= 0) hideDialogue();
  }
  if (state.runningWave) {
    updateChaos(delta);
    updatePossessedCastle(delta);
    state.spawnTimer -= delta;
    while (state.spawnCount < state.spawnTotal && state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnCount += 1;
      state.spawnTimer += Math.max(330, 920 - state.wave * 38) / state.difficulty.enemySpeed;
    }
    state.enemies.forEach((enemy) => moveEnemy(enemy, delta));
    updateBirds(delta);
    updateTowers(delta);
    updateProjectiles(delta);
    state.enemies = state.enemies.filter((enemy) => !enemy.dead);
    if (state.spawnCount >= state.spawnTotal && state.enemies.length === 0 && state.birds.length === 0 && !state.possessedCastle.active && state.mode === 'playing') completeWave();
  }
  updateParticles(delta);
  sounds.musicTick(timestamp);
  updateUI();
}

function completeWave() {
  state.runningWave = false;
  stopBattlefieldRotation();
  resetPossessedCastle();
  state.steamClouds = [];
  state.mopActive = false;
  ui.mopButton.hidden = true;
  ui.mopButton.classList.remove('active');
  canvas.style.cursor = 'crosshair';
  state.speedBoostTimer = 0;
  state.bounceTimer = 0;
  state.manualFireTimer = 0;
  state.manualCooldown = 0;
  ui.eventStatus.hidden = true;
  if (state.wave >= state.totalWaves) { finishGame(true); return; }
  const bonus = 35 + state.wave * 7;
  state.gold += bonus;
  sounds.upgrade();
  setMessage(`WAVE CLEARED · ${bonus} BONUS GOLD`, 2800);
}

function stopResultArtScroll() {
  ui.resultArt.style.animation = 'none';
}

function startResultArtScroll(victory) {
  ui.resultArt.className = `result-art ${victory ? 'victory' : 'defeat'}`;
  ui.resultArt.style.animation = 'none';
  void ui.resultArt.offsetWidth;
  ui.resultArt.style.removeProperty('animation');
}

function finishGame(victory) {
  if (state.mode === 'won' || state.mode === 'lost') return;
  state.mode = victory ? 'won' : 'lost';
  state.runningWave = false;
  state.aiEnabled = false;
  setGameSpeed(1);
  hideDialogue();
  stopBattlefieldRotation();
  resetPossessedCastle();
  ui.eventStatus.hidden = true;
  ui.speedControl.hidden = true;
  ui.repairButton.hidden = true;
  const best = saveBestScore();
  byId('result-icon').textContent = victory ? '🐱' : '👑';
  byId('result-kicker').textContent = victory ? 'VICTORY' : 'DEFEAT';
  byId('result-title').textContent = victory ? 'THE RAMEN IS SAFE' : 'THE RAMEN WAS STOLEN';
  startResultArtScroll(victory);
  ui.resultArt.setAttribute('aria-label', victory ? 'The Cat King celebrates with the saved ramen' : 'The Orc King escapes with the stolen ramen');
  byId('result-score').textContent = state.score;
  byId('result-waves').textContent = `${state.wave}/${state.totalWaves}`;
  byId('result-best').textContent = best;
  ui.resultScreen.hidden = false;
  ui.placementHint.hidden = true;
  updateUI();
  if (victory) sounds.win(); else sounds.lose();
}

function drawGround() {
  const level = state.level;
  ctx.fillStyle = level.ground;
  ctx.fillRect(-worldOffsetX, 0, viewWidth, WORLD_HEIGHT);
  ctx.globalAlpha = 0.13;
  for (let y = 0; y < WORLD_HEIGHT; y += 48) {
    for (let x = -worldOffsetX; x < WORLD_WIDTH + worldOffsetX; x += 48) {
      if ((x / 48 + y / 48) % 3 === 0) {
        ctx.fillStyle = level.groundDark;
        ctx.fillRect(x, y, 48, 48);
      }
    }
  }
  ctx.globalAlpha = 1;
  drawDecorations();
}

function drawDecorations() {
  const spots = [
    [70,130],[105,285],[80,560],[275,120],[310,340],[320,590],[520,120],[555,345],[560,590],
    [745,110],[790,315],[780,590],[975,120],[1040,530],[1130,150],[1180,580],[1060,285],[235,610]
  ];
  spots.forEach(([x, y], index) => {
    if (distanceToPath({ x, y }, getActivePath()) < 62) return;
    ctx.save();
    ctx.translate(x, y);
    if (state.level.decor === 'forest') drawTree(index);
    if (state.level.decor === 'desert') drawDesertDecor(index);
    if (state.level.decor === 'snow') drawSnowDecor(index);
    ctx.restore();
  });
}

function drawTree(index) {
  ctx.fillStyle = '#3b2c1c'; ctx.fillRect(-4, 5, 8, 19);
  ctx.fillStyle = index % 3 ? '#315b32' : '#446f3a';
  [[-10,2,15],[7,-1,13],[0,-12,17]].forEach(([x,y,r]) => { ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); });
}

function drawDesertDecor(index) {
  if (index % 3 === 0) {
    ctx.fillStyle = '#477248'; ctx.fillRect(-4,-15,8,34); ctx.fillRect(4,-5,10,6); ctx.fillRect(-11,2,9,6);
    ctx.beginPath(); ctx.arc(0,-15,4,Math.PI,0); ctx.fill();
  } else {
    ctx.fillStyle = index % 2 ? '#7e603e' : '#96704a';
    ctx.beginPath(); ctx.ellipse(0,8,18,10,-.2,0,Math.PI*2); ctx.fill();
  }
}

function drawSnowDecor(index) {
  ctx.fillStyle = '#594737'; ctx.fillRect(-3,5,6,17);
  ctx.fillStyle = index % 2 ? '#3e6261' : '#547677';
  [[0,-15,16],[-1,-2,20],[0,10,23]].forEach(([x,y,w]) => { ctx.beginPath(); ctx.moveTo(x,y-13); ctx.lineTo(x-w/2,y+9); ctx.lineTo(x+w/2,y+9); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = '#e9f2ee'; ctx.fillRect(-8,-7,12,3); ctx.fillRect(-12,5,16,3);
}

function drawTrack() {
  const path = getActivePath();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  path.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = '#30241744'; ctx.lineWidth = TRACK_WIDTH + 14; ctx.stroke();
  ctx.strokeStyle = state.level.trackEdge; ctx.lineWidth = TRACK_WIDTH + 8; ctx.stroke();
  ctx.strokeStyle = state.level.track; ctx.lineWidth = TRACK_WIDTH; ctx.stroke();
  ctx.strokeStyle = '#5d49364a'; ctx.lineWidth = 2; ctx.setLineDash([3, 15]); ctx.stroke(); ctx.setLineDash([]);
}

function drawCatKingGuard(ratio, timestamp) {
  const catX = ratio > .25 ? -35 : 5;
  const catY = ratio > .25 ? -23 : -13;
  ctx.save();
  ctx.fillStyle = '#251b17';
  ctx.beginPath(); ctx.arc(catX, catY + 2, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d98032';
  ctx.beginPath(); ctx.moveTo(catX - 8, catY - 5); ctx.lineTo(catX - 6, catY - 14); ctx.lineTo(catX - 1, catY - 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(catX + 8, catY - 5); ctx.lineTo(catX + 6, catY - 14); ctx.lineTo(catX + 1, catY - 6); ctx.fill();
  ctx.beginPath(); ctx.arc(catX, catY, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9f5528'; ctx.fillRect(catX - 2, catY - 7, 3, 11);
  ctx.fillStyle = '#b7e45d';
  ctx.beginPath(); ctx.arc(catX - 3, catY - 1, 1.4, 0, Math.PI * 2); ctx.arc(catX + 3, catY - 1, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c34f';
  const crownBob = Math.sin(timestamp * .006) * .7;
  ctx.beginPath(); ctx.moveTo(catX - 7, catY - 8 + crownBob); ctx.lineTo(catX - 5, catY - 15 + crownBob); ctx.lineTo(catX, catY - 10 + crownBob); ctx.lineTo(catX + 5, catY - 15 + crownBob); ctx.lineTo(catX + 7, catY - 8 + crownBob); ctx.closePath(); ctx.fill();
  if (ratio > .25) {
    ctx.fillStyle = '#efdfbe';
    ctx.beginPath(); ctx.moveTo(-2,-19); ctx.quadraticCurveTo(10,-9,22,-19); ctx.lineTo(19,-13); ctx.quadraticCurveTo(10,-5,1,-13); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a84f2d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2,-19); ctx.quadraticCurveTo(10,-9,22,-19); ctx.stroke();
    ctx.strokeStyle = '#f4df87'; ctx.lineWidth = 1; [-1,1].forEach((side) => { ctx.beginPath(); ctx.moveTo(10 + side * 2,-23); ctx.quadraticCurveTo(6 + side * 4,-28,11 + side * 3,-31); ctx.stroke(); });
  }
  ctx.restore();
}

function drawBase(timestamp) {
  const position = getCastlePosition();
  const ratio = Math.max(0, state.health) / state.maxHealth;
  const shake = state.baseShake > 0 ? Math.sin(timestamp * 0.07) * Math.min(7, state.baseShake / 55) : 0;
  const possessed = state.possessedCastle.active;
  ctx.save();
  ctx.translate(position.x + shake, position.y + (possessed ? Math.sin(timestamp * 0.009) * 4 : 0));
  if (possessed) {
    const pulse = 60 + Math.sin(timestamp * 0.006) * 7;
    ctx.fillStyle = '#7d3ec12a';
    ctx.strokeStyle = '#c788ffcc';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(3, 0, pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.rotate(timestamp * 0.0011);
    ctx.setLineDash([10, 14]);
    ctx.strokeStyle = '#8d4fc9aa';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(3, 0, pulse - 11, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.fillStyle = '#00000035'; ctx.beginPath(); ctx.ellipse(12,39,65,18,0,0,Math.PI*2); ctx.fill();
  if (ratio <= 0) {
    ctx.fillStyle='#625b50';ctx.strokeStyle='#3f3a33';ctx.lineWidth=3;
    [[-42,20,35,18],[-12,11,42,27],[25,22,39,16],[-25,-2,25,20]].forEach(([x,y,w,h],index)=>{ctx.save();ctx.translate(x,y);ctx.rotate((index-1.5)*.17);ctx.fillRect(0,0,w,h);ctx.strokeRect(0,0,w,h);ctx.restore();});
    ctx.fillStyle='#392d25';ctx.beginPath();ctx.arc(2,19,18,Math.PI,0);ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = state.baseFlash > 0 ? '#d08e73' : '#8d8778';
  ctx.strokeStyle = '#4e483f'; ctx.lineWidth = 4;
  ctx.fillRect(-35,-31,80,68); ctx.strokeRect(-35,-31,80,68);
  if (ratio > .25) { ctx.fillRect(-48,-48,25,86); ctx.strokeRect(-48,-48,25,86); [-48,-35].forEach((x)=>ctx.fillRect(x,-58,12,16)); }
  else { ctx.fillStyle='#71695d';ctx.fillRect(-51,23,31,14);ctx.fillRect(-43,9,19,13); }
  ctx.fillStyle = state.baseFlash > 0 ? '#d08e73' : '#8d8778';
  if (ratio > .5) { ctx.fillRect(33,-48,25,86); ctx.strokeRect(33,-48,25,86); [33,46].forEach((x)=>ctx.fillRect(x,-58,12,16)); }
  else { ctx.fillStyle='#71695d';ctx.fillRect(31,20,33,17);ctx.fillRect(39,4,20,15); }
  ctx.fillStyle = '#3b2a21'; ctx.fillRect(-7,7,24,31);
  ctx.beginPath(); ctx.arc(5,7,12,Math.PI,0); ctx.fill();
  if (ratio > .25) { ctx.fillStyle = '#b74937'; ctx.fillRect(2,-53,4,25); ctx.beginPath(); ctx.moveTo(6,-53); ctx.lineTo(27,-45); ctx.lineTo(6,-37); ctx.fill(); }
  drawCatKingGuard(ratio, timestamp);
  ctx.strokeStyle = '#40362f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  if (ratio <= .75) { ctx.beginPath(); ctx.moveTo(-16,-28); ctx.lineTo(-5,-12); ctx.lineTo(-13,1); ctx.lineTo(-2,15); ctx.stroke(); }
  if (ratio <= .5) { ctx.beginPath(); ctx.moveTo(35,-32); ctx.lineTo(23,-17); ctx.lineTo(31,-5); ctx.lineTo(18,7); ctx.stroke(); }
  if (ratio <= .25) { ctx.beginPath(); ctx.moveTo(-35,17); ctx.lineTo(-23,9); ctx.lineTo(-18,25); ctx.lineTo(-7,34); ctx.stroke(); ctx.fillStyle='#2b242088';ctx.fillRect(-35,-10,80,47); }
  ctx.restore();
}

function drawTower(tower) {
  const definition = towerTypes[tower.type];
  const selected = tower === state.selectedTower;
  ctx.save();
  ctx.translate(tower.x, tower.y);
  if (selected) {
    const range = definition.range * (1 + (tower.level - 1) * 0.08);
    ctx.fillStyle = `${definition.color}18`; ctx.strokeStyle = `${definition.color}99`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,0,range,0,Math.PI*2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#00000035'; ctx.beginPath(); ctx.ellipse(0,17,25,10,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#665d50'; ctx.strokeStyle = '#3b352d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0,3,TOWER_RADIUS,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.rotate(tower.angle);
  if (definition.style === 'bow') {
    ctx.fillStyle = '#77502c'; ctx.fillRect(-4,-4,27,8);
    ctx.strokeStyle = '#e2c278'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(14,0,14,-1.2,1.2); ctx.stroke();
  } else if (definition.style === 'cannon') {
    ctx.fillStyle = '#373532'; ctx.fillRect(-2,-8,31,16); ctx.fillStyle = '#171715'; ctx.fillRect(21,-10,11,20);
  } else {
    ctx.rotate(-tower.angle); ctx.fillStyle = definition.color; ctx.strokeStyle = '#d8f5ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,-27); ctx.lineTo(12,2); ctx.lineTo(0,15); ctx.lineTo(-12,2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < tower.level; i += 1) {
    ctx.fillStyle = '#ffd76b'; ctx.beginPath(); ctx.arc(tower.x - 8 + i * 8, tower.y + 29, 2.4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawEnemy(enemy) {
  if (enemy.carried) return;
  const definition = enemyTypes[enemy.type];
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.invisible) ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#00000040'; ctx.beginPath(); ctx.ellipse(0,definition.size*.72,definition.size*1.05,definition.size*.55,0,0,Math.PI*2); ctx.fill();
  if (enemy.slowTimer > 0) { ctx.strokeStyle = '#a8ecff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0,0,definition.size+5,0,Math.PI*2); ctx.stroke(); }
  ctx.fillStyle = definition.color; ctx.strokeStyle = '#392921'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0,0,definition.size,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f1ddac';
  if (definition.shape === 'brute' || definition.shape === 'boss') { ctx.beginPath(); ctx.moveTo(-definition.size+4,-8); ctx.lineTo(-definition.size-8,-17); ctx.lineTo(-definition.size+1,1); ctx.fill(); ctx.beginPath(); ctx.moveTo(definition.size-4,-8); ctx.lineTo(definition.size+8,-17); ctx.lineTo(definition.size-1,1); ctx.fill(); }
  if (definition.shape === 'beetle') { ctx.strokeStyle='#4a301c'; ctx.lineWidth=2; [-1,1].forEach((side)=>[-6,0,6].forEach((y)=>{ctx.beginPath();ctx.moveTo(side*6,y);ctx.lineTo(side*16,y+side*4);ctx.stroke();})); }
  if (definition.shape === 'wolf') { ctx.beginPath(); ctx.moveTo(-8,-7); ctx.lineTo(-5,-19); ctx.lineTo(0,-9); ctx.moveTo(8,-7); ctx.lineTo(5,-19); ctx.lineTo(0,-9); ctx.fill(); }
  if (definition.shape === 'wraith') { ctx.strokeStyle='#d6f4ff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,definition.size+5,0,Math.PI*2); ctx.stroke(); }
  ctx.fillStyle = '#231915'; ctx.beginPath(); ctx.arc(-definition.size*.32,-2,2,0,Math.PI*2); ctx.arc(definition.size*.32,-2,2,0,Math.PI*2); ctx.fill();
  if (definition.shape === 'boss') { ctx.fillStyle = '#d5ad3a'; ctx.fillRect(-20,-definition.size-8,40,6); }
  ctx.restore();
  if (enemy.invisible) return;
  const width = Math.max(28, definition.size * 2.2);
  ctx.fillStyle = '#291913'; ctx.fillRect(enemy.x-width/2, enemy.y-definition.size-13, width, 5);
  ctx.fillStyle = enemy.health / enemy.maxHealth > .35 ? '#79a84e' : '#c94f3d';
  ctx.fillRect(enemy.x-width/2+1, enemy.y-definition.size-12, (width-2)*Math.max(0,enemy.health/enemy.maxHealth), 3);
}

function drawBird(bird, timestamp) {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  const flap = Math.sin(timestamp * 0.018) * 12;
  ctx.fillStyle = '#00000035'; ctx.beginPath(); ctx.ellipse(0,48,31,9,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#70472a'; ctx.strokeStyle = '#3d291c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0,0,22,14,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8,0); ctx.quadraticCurveTo(-43,-28-flap,-64,-4); ctx.quadraticCurveTo(-38,-2,-13,9); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8,0); ctx.quadraticCurveTo(43,-28+flap,64,-4); ctx.quadraticCurveTo(38,-2,13,9); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#e2ba43'; ctx.beginPath(); ctx.moveTo(18,-4);ctx.lineTo(36,1);ctx.lineTo(18,6);ctx.fill();
  ctx.strokeStyle='#4b3424';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-7,12);ctx.lineTo(-5,31);ctx.moveTo(7,12);ctx.lineTo(5,31);ctx.stroke();
  ctx.restore();
  if (bird.kind === 'thief' && bird.cargoTower) {
    const { x, y } = bird.cargoTower;
    bird.cargoTower.x = bird.x;
    bird.cargoTower.y = bird.y + 40;
    drawTower(bird.cargoTower);
    bird.cargoTower.x = x;
    bird.cargoTower.y = y;
    return;
  }
  const passenger = bird.passenger;
  if (passenger && !passenger.dead) {
    const wasCarried = passenger.carried;
    passenger.carried = false;
    drawEnemy(passenger);
    passenger.carried = wasCarried;
  }
  ctx.fillStyle='#291913';ctx.fillRect(bird.x-25,bird.y-25,50,5);
  ctx.fillStyle='#e2b84f';ctx.fillRect(bird.x-24,bird.y-24,48*Math.max(0,bird.health/bird.maxHealth),3);
}

function drawProjectiles() {
  state.projectiles.forEach((projectile) => {
    const definition = towerTypes[projectile.type];
    ctx.fillStyle = definition.projectile; ctx.shadowColor = definition.projectile; ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.arc(projectile.x,projectile.y,definition.attack === 'splash' ? 7 : 3.5,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawSteam(timestamp) {
  state.steamClouds.forEach((cloud, cloudIndex) => {
    const gradient = ctx.createRadialGradient(cloud.x,cloud.y,12,cloud.x,cloud.y,cloud.radius);
    gradient.addColorStop(0, `rgba(235,245,238,${0.94*cloud.strength})`);
    gradient.addColorStop(.55, `rgba(205,220,211,${0.82*cloud.strength})`);
    gradient.addColorStop(1, 'rgba(190,205,198,0)');
    ctx.fillStyle=gradient;
    ctx.beginPath();ctx.arc(cloud.x,cloud.y,cloud.radius,0,Math.PI*2);ctx.fill();
    for(let i=0;i<5;i+=1){
      const angle=i*1.25+timestamp*.00015*(cloudIndex%2?1:-1);
      ctx.fillStyle=`rgba(240,247,242,${0.22*cloud.strength})`;
      ctx.beginPath();ctx.arc(cloud.x+Math.cos(angle)*cloud.radius*.38,cloud.y+Math.sin(angle)*cloud.radius*.28,cloud.radius*.38,0,Math.PI*2);ctx.fill();
    }
  });
}

function drawParticles() {
  state.particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x,particle.y,particle.size,particle.size);
  });
  ctx.globalAlpha = 1;
}

function drawPlacementPreview() {
  if (!state.mouse || !state.selectedBuild || state.mode !== 'playing' || state.selectedTower || state.mopActive) return;
  const status = placementStatus(state.mouse);
  const definition = towerTypes[state.selectedBuild];
  ctx.fillStyle = status.valid ? `${definition.color}18` : '#c84c3d18';
  ctx.strokeStyle = status.valid ? `${definition.color}bb` : '#d74c42';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(state.mouse.x,state.mouse.y,definition.range,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = status.valid ? `${definition.color}aa` : '#d74c42aa';
  ctx.beginPath(); ctx.arc(state.mouse.x,state.mouse.y,TOWER_RADIUS,0,Math.PI*2); ctx.fill();
}

function draw(timestamp) {
  ctx.clearRect(0, 0, viewWidth, WORLD_HEIGHT);
  ctx.save();
  ctx.translate(worldOffsetX, 0);
  drawGround();
  drawTrack();
  drawBase(timestamp);
  state.towers.forEach(drawTower);
  state.enemies.forEach(drawEnemy);
  state.birds.forEach((bird) => drawBird(bird, timestamp));
  drawProjectiles();
  drawParticles();
  drawPlacementPreview();
  drawSteam(timestamp);
  ctx.restore();
  if (state.mode === 'paused') { ctx.fillStyle = '#19130d55'; ctx.fillRect(0,0,viewWidth,WORLD_HEIGHT); }
}

function pointerToWorld(event) {
  const rect = stage.getBoundingClientRect();
  let stageX = (event.clientX - rect.left) * viewWidth / rect.width;
  let stageY = (event.clientY - rect.top) * WORLD_HEIGHT / rect.height;
  const rotation = state.spinTimer > 0 ? state.spinAngle : state.mapFlipped ? 180 : 0;
  if (rotation) {
    const radians = -rotation * Math.PI / 180;
    const centeredX = stageX - viewWidth / 2;
    const centeredY = stageY - WORLD_HEIGHT / 2;
    stageX = viewWidth / 2 + centeredX * Math.cos(radians) - centeredY * Math.sin(radians);
    stageY = WORLD_HEIGHT / 2 + centeredX * Math.sin(radians) + centeredY * Math.cos(radians);
  }
  return { x: stageX - worldOffsetX, y: stageY };
}

function onPointerMove(event) {
  state.mouse = pointerToWorld(event);
  if (state.mopActive) {
    ui.placementHint.hidden = true;
    if (event.buttons & 1) wipeSteam(state.mouse);
    return;
  }
  if (state.mode !== 'playing' || state.selectedTower || !state.selectedBuild) { ui.placementHint.hidden = true; return; }
  const status = placementStatus(state.mouse);
  ui.placementHint.hidden = false;
  ui.placementHint.classList.toggle('invalid', !status.valid);
  ui.placementHint.textContent = status.reason;
  ui.placementHint.style.left = `${state.mouse.x}px`;
  ui.placementHint.style.top = `${state.mouse.y}px`;
}

function onCanvasClick(event) {
  if (state.mode !== 'playing') return;
  sounds.unlock();
  const point = pointerToWorld(event);
  if (state.mopActive) { wipeSteam(point); return; }
  const tower = state.towers.find((item) => Math.hypot(item.x - point.x, item.y - point.y) <= TOWER_RADIUS + 6);
  if (tower) {
    if (state.selectedTower === tower) { clearSelection(); return; }
    state.selectedTower = tower;
    state.selectedBuild = null;
    ui.placementHint.hidden = true;
    sounds.click();
    updateInspector();
    updateUI();
    return;
  }
  if (state.selectedTower) { clearSelection(); return; }
  if (!state.selectedBuild) return;
  placeTower(point);
}

function primaryAction() {
  if (state.manualFireTimer > 0 && state.runningWave) manualVolley();
  else launchWave();
}

async function toggleFullscreen() {
  sounds.click();
  try {
    if (!document.fullscreenElement) await byId('game-shell').requestFullscreen();
    else await document.exitFullscreen();
  } catch { setMessage('FULLSCREEN IS NOT AVAILABLE', 1500); }
}

function setupEvents() {
  window.addEventListener('resize', scaleGame);
  const activateMenuAudio = () => {
    sounds.unlock();
    if (state.mode === 'menu') sounds.startMenuMusic();
    if (state.mode === 'menu' && ui.storyScreen.hidden) scheduleStoryCutscene();
  };
  window.addEventListener('pointerdown', activateMenuAudio, { capture: true });
  window.addEventListener('keydown', activateMenuAudio, { capture: true });
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', () => { state.mouse = null; ui.placementHint.hidden = true; });
  canvas.addEventListener('pointerdown', onCanvasClick);
  byId('start-btn').addEventListener('click', startGame);
  byId('story-btn').addEventListener('click', () => showStoryCutscene(0));
  ui.storyNextButton.addEventListener('click', nextStorySlide);
  byId('story-skip-btn').addEventListener('click', closeStoryCutscene);
  ui.waveButton.addEventListener('click', primaryAction);
  ui.mopButton.addEventListener('click', toggleMop);
  ui.cancelSelectionButton.addEventListener('click', clearSelection);
  canvas.addEventListener('contextmenu', (event) => { event.preventDefault(); if (state.mode === 'playing') clearSelection(); });
  byId('menu-btn').addEventListener('click', openMenu);
  byId('resume-btn').addEventListener('click', closeMenu);
  byId('restart-btn').addEventListener('click', startGame);
  byId('level-select-btn').addEventListener('click', returnToLevelSelect);
  ui.difficultyMenuButton.addEventListener('click', () => {
    ui.menuDifficultyPanel.hidden = !ui.menuDifficultyPanel.hidden;
    sounds.click();
  });
  document.querySelectorAll('[data-menu-difficulty]').forEach((button) => button.addEventListener('click', () => {
    state.difficultyKey = button.dataset.menuDifficulty;
    state.difficulty = difficulties[state.difficultyKey];
    sounds.difficultySelect(state.difficultyKey);
    document.querySelectorAll('[data-difficulty]').forEach((item) => item.classList.toggle('selected', item.dataset.difficulty === state.difficultyKey));
    document.querySelectorAll('[data-menu-difficulty]').forEach((item) => item.classList.toggle('selected', item === button));
    startGame();
  }));
  byId('results-level-select-btn').addEventListener('click', returnToLevelSelect);
  byId('play-again-btn').addEventListener('click', startGame);
  ui.soundButton.addEventListener('click', toggleSound);
  ui.menuSoundButton.addEventListener('click', toggleSound);
  ui.aiButton.addEventListener('click', toggleAi);
  ui.repairButton.addEventListener('click', repairCastle);
  ui.speedSlider.addEventListener('input', () => setGameSpeed(ui.speedSlider.value));
  ui.speedSlider.addEventListener('change', () => { setGameSpeed(ui.speedSlider.value, true); sounds.click(); });
  ui.upgradeButton.addEventListener('click', upgradeSelectedTower);
  ui.sellButton.addEventListener('click', sellSelectedTower);
  byId('fullscreen-btn').addEventListener('click', toggleFullscreen);
  byId('main-fullscreen-btn').addEventListener('click', toggleFullscreen);
  document.querySelectorAll('[data-level]').forEach((button) => button.addEventListener('click', () => {
    sounds.unlock();
    sounds.mapSelect(button.dataset.level);
    state.levelKey = button.dataset.level;
    state.level = levels[state.levelKey];
    document.querySelectorAll('[data-level]').forEach((item) => item.classList.toggle('selected', item === button));
  }));
  document.querySelectorAll('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
    sounds.unlock();
    sounds.difficultySelect(button.dataset.difficulty);
    state.difficultyKey = button.dataset.difficulty;
    state.difficulty = difficulties[state.difficultyKey];
    document.querySelectorAll('[data-difficulty]').forEach((item) => item.classList.toggle('selected', item === button));
    updateUI();
  }));
  document.querySelectorAll('#start-screen button, #story-screen button, #pause-screen button, #result-screen button').forEach((button) => {
    button.addEventListener('pointerenter', () => sounds.hover());
    button.addEventListener('pointerdown', () => {
      if (!button.matches('[data-difficulty], [data-menu-difficulty]')) sounds.menuPress();
    });
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.mode === 'paused') closeMenu();
      else if (state.selectedBuild || state.selectedTower || state.mopActive) clearSelection();
      else openMenu();
    }
    if (event.code === 'Space') { event.preventDefault(); primaryAction(); }
    const type = state.level.towers[Number(event.key) - 1];
    if (type) selectBuild(type);
  });
}

function frame(timestamp) {
  const realDelta = Math.min(40, timestamp - state.lastTime || 16);
  state.lastTime = timestamp;
  sounds.menuMusicTick(timestamp);
  updateGame(realDelta * state.gameSpeed, timestamp, realDelta);
  draw(timestamp);
  requestAnimationFrame(frame);
}

function initialize() {
  scaleGame();
  makeTowerButtons();
  setupEvents();
  setGameSpeed(1);
  updateUI();
  // Start immediately where autoplay permission exists; otherwise remain queued until any interaction.
  sounds.unlock();
  sounds.startMenuMusic();
  scheduleStoryCutscene();
  document.body.dataset.gameReady = 'true';
  requestAnimationFrame(frame);
}

initialize();
