const assert = require('node:assert/strict');
const {
  WORLD_WIDTH, WORLD_HEIGHT, TRACK_WIDTH, TOWER_RADIUS,
  towerTypes, enemyTypes, difficulties, levels, distanceToSegment, distanceToPath
} = require('./data.js');

assert.equal(WORLD_WIDTH / WORLD_HEIGHT, 16 / 9, 'the game uses a scalable 16:9 stage');
assert.equal(Object.keys(towerTypes).length, 9, 'each of the three maps has three distinct towers');
assert.equal(Object.keys(enemyTypes).length, 9, 'each of the three maps has three distinct enemies');
assert.deepEqual(Object.keys(difficulties), ['easy', 'normal', 'hard'], 'three difficulty modes exist');
assert.equal(Object.keys(levels).length, 3, 'three levels exist');
assert.ok(Object.values(levels).every((level) => level.towers.length === 3 && level.enemies.length === 3), 'every map declares a three-tower and three-enemy roster');
assert.equal(new Set(Object.values(levels).flatMap((level) => level.towers)).size, 9, 'tower rosters do not overlap between maps');
assert.equal(new Set(Object.values(levels).flatMap((level) => level.enemies)).size, 9, 'enemy rosters do not overlap between maps');
assert.ok(new Set(Object.values(levels).map((level) => JSON.stringify(level.path))).size === 3, 'every level has a unique track');
assert.ok(Object.values(levels).every((level) => level.path.length >= 8), 'every track has enough turns');
assert.deepEqual([difficulties.easy.waves,difficulties.easy.health,difficulties.easy.gold], [8,20,240], 'Easy uses the former Normal rules');
assert.deepEqual([difficulties.normal.waves,difficulties.normal.health,difficulties.normal.gold], [10,15,195], 'Normal uses the former Hard rules');
assert.deepEqual([difficulties.hard.wavesMin,difficulties.hard.wavesMax], [12,20], 'Hard chooses a hidden total from 12 to 20 waves');
assert.equal(difficulties.easy.chaosLevel, 0, 'Easy has no random events');
assert.equal(difficulties.normal.chaosLevel, 1, 'Normal has moderate random events');
assert.equal(difficulties.hard.chaosLevel, 2, 'Hard has frequent random events');
assert.ok(difficulties.easy.health > difficulties.normal.health && difficulties.normal.health > difficulties.hard.health, 'health scales by difficulty');
assert.ok(difficulties.easy.enemyHealth < difficulties.normal.enemyHealth && difficulties.normal.enemyHealth < difficulties.hard.enemyHealth, 'enemy health scales by difficulty');
assert.equal(distanceToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5, 'segment collision distance is correct');
assert.equal(distanceToPath(levels.greenvale.path[2], levels.greenvale.path), 0, 'track points are detected as blocked');
assert.ok(distanceToPath({ x: 600, y: 650 }, levels.greenvale.path) > TRACK_WIDTH / 2 + TOWER_RADIUS, 'open ground remains buildable');
assert.ok(towerTypes.acorn.damage > towerTypes.ranger.damage, 'forest cannon trades speed for damage');
assert.ok(towerTypes.druid.attack === 'slow' && towerTypes.blizzard.attack === 'slow', 'map-specific magic towers have slowing behaviour');

console.log('Kingdom Under Siege unit tests passed');
