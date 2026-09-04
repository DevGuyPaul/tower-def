const WORLD_WIDTH = 1280;
const WORLD_HEIGHT = 720;
const TRACK_WIDTH = 58;
const TOWER_RADIUS = 23;

const towerTypes = {
  ranger: { name:'RANGER POST', icon:'🏹', cost:65, range:145, rate:2.1, damage:18, color:'#e5b94d', projectile:'#fff0a8', description:'Fast arrows · single target', attack:'single', style:'bow', sound:'arrow' },
  acorn: { name:'ACORN CANNON', icon:'🌰', cost:108, range:165, rate:.72, damage:58, color:'#a96b37', projectile:'#e8a04e', description:'Forest shells · area damage', attack:'splash', style:'cannon', sound:'boom' },
  druid: { name:'DRUID GROVE', icon:'🌿', cost:90, range:128, rate:1.25, damage:10, color:'#77b85a', projectile:'#b9ed83', description:'Entangling magic · slows', attack:'slow', style:'spire', sound:'magic', slowDuration:1900 },
  ballista: { name:'DESERT BALLISTA', icon:'➶', cost:78, range:178, rate:1.35, damage:31, color:'#8a4f2e', projectile:'#f4d28a', description:'Long range · heavy bolts', attack:'single', style:'bow', sound:'arrow' },
  firepot: { name:'FIRE-POT HURLER', icon:'🔥', cost:118, range:158, rate:.65, damage:69, color:'#d75d2c', projectile:'#ff9e43', description:'Burning pots · area damage', attack:'splash', style:'cannon', sound:'boom' },
  sunspire: { name:'SUN OBELISK', icon:'☀', cost:96, range:122, rate:1.4, damage:12, color:'#e9bd42', projectile:'#fff0a1', description:'Blinding rays · slows', attack:'slow', style:'spire', sound:'magic', slowDuration:1550 },
  icebow: { name:'ICEWIND ARCHER', icon:'❄', cost:70, range:152, rate:2.45, damage:16, color:'#65b8d8', projectile:'#d9f8ff', description:'Rapid ice arrows', attack:'single', style:'bow', sound:'arrow' },
  snowball: { name:'SNOWBALL MORTAR', icon:'☃', cost:102, range:172, rate:.82, damage:51, color:'#8db5c3', projectile:'#f3ffff', description:'Packed snow · area damage', attack:'splash', style:'cannon', sound:'boom' },
  blizzard: { name:'BLIZZARD ORB', icon:'◉', cost:106, range:138, rate:1.05, damage:13, color:'#6cc9e8', projectile:'#c7f6ff', description:'Deep freeze · strong slow', attack:'slow', style:'spire', sound:'magic', slowDuration:2400 }
};

const enemyTypes = {
  goblin: { name:'Goblin Scout', hp:46, speed:82, reward:12, size:11, color:'#a5b94f', damage:1, shape:'small' },
  ogre: { name:'Moss Ogre', hp:275, speed:34, reward:37, size:21, color:'#557f48', damage:2, shape:'brute' },
  forestTitan: { name:'Forest Titan', hp:1250, speed:24, reward:225, size:31, color:'#3d5d34', damage:5, shape:'boss' },
  scarab: { name:'Gold Scarab', hp:39, speed:94, reward:11, size:10, color:'#c9972f', damage:1, shape:'beetle' },
  duneRaider: { name:'Dune Raider', hp:165, speed:51, reward:25, size:16, color:'#a84e35', damage:2, shape:'raider' },
  sandGolem: { name:'Sand Golem', hp:1420, speed:22, reward:245, size:32, color:'#8d6539', damage:6, shape:'boss' },
  frostWolf: { name:'Frost Wolf', hp:52, speed:88, reward:13, size:12, color:'#d7e9e9', damage:1, shape:'wolf' },
  iceWraith: { name:'Ice Wraith', hp:155, speed:57, reward:29, size:16, color:'#688eae', damage:2, shape:'wraith', ability:'phase' },
  frostGiant: { name:'Frost Giant', hp:1550, speed:20, reward:270, size:34, color:'#527785', damage:6, shape:'boss' }
};

const difficulties = {
  easy: { name:'Easy', waves:8, health:20, gold:240, enemyHealth:1, enemySpeed:1, reward:1, chaosLevel:0 },
  normal: { name:'Normal', waves:10, health:15, gold:195, enemyHealth:1.28, enemySpeed:1.12, reward:.9, chaosLevel:1 },
  hard: { name:'Hard', wavesMin:12, wavesMax:20, health:12, gold:180, enemyHealth:1.46, enemySpeed:1.2, reward:.86, chaosLevel:2 }
};

const levels = {
  greenvale: {
    name:'Greenvale', subtitle:'Woodland Crossing', ground:'#668d4f', groundDark:'#537642', track:'#b89968', trackEdge:'#846a47', water:'#4e8d92', detail:'#365b35', decor:'forest',
    towers:['ranger','acorn','druid'], enemies:['goblin','ogre','forestTitan'],
    path:[{x:-40,y:175},{x:185,y:175},{x:185,y:430},{x:405,y:430},{x:405,y:225},{x:650,y:225},{x:650,y:520},{x:900,y:520},{x:900,y:335},{x:1165,y:335}]
  },
  sunreach: {
    name:'Sunreach', subtitle:'Desert Ruins', ground:'#c99c58', groundDark:'#ad7e42', track:'#ead19a', trackEdge:'#9d7042', water:'#4b94a0', detail:'#75552f', decor:'desert',
    towers:['ballista','firepot','sunspire'], enemies:['scarab','duneRaider','sandGolem'],
    path:[{x:-40,y:420},{x:175,y:420},{x:175,y:205},{x:435,y:205},{x:435,y:485},{x:705,y:485},{x:705,y:165},{x:945,y:165},{x:945,y:400},{x:1165,y:400}]
  },
  frostholm: {
    name:'Frostholm', subtitle:'Frozen Pass', ground:'#b7cad0', groundDark:'#91aeb8', track:'#dbe1dc', trackEdge:'#718b93', water:'#5592a7', detail:'#607d83', decor:'snow',
    towers:['icebow','snowball','blizzard'], enemies:['frostWolf','iceWraith','frostGiant'],
    path:[{x:-40,y:300},{x:220,y:300},{x:220,y:515},{x:485,y:515},{x:485,y:165},{x:765,y:165},{x:765,y:435},{x:1005,y:435},{x:1005,y:250},{x:1165,y:250}]
  }
};

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function distanceToPath(point, path) {
  let distance = Infinity;
  for (let i = 0; i < path.length - 1; i += 1) distance = Math.min(distance, distanceToSegment(point, path[i], path[i + 1]));
  return distance;
}

if (typeof module !== 'undefined') module.exports = { WORLD_WIDTH, WORLD_HEIGHT, TRACK_WIDTH, TOWER_RADIUS, towerTypes, enemyTypes, difficulties, levels, distanceToSegment, distanceToPath };
