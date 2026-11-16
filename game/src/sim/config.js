// Every tuning number of Office Hours in one place: movement, the six careers and their
// signature sniper rifles, gear, the economy, the round clock and the bots. tools/balance.mjs
// plays bot-only matches on these numbers.

export const TICK = 1 / 60;

export const TEAMS = {
  atk: { id: 'atk', name: 'The Gentlemen', short: 'GENTS', role: 'plant the glitter charge', color: '#4f8ff7' },
  def: { id: 'def', name: 'The Night Shift', short: 'SHIFT', role: 'defend the plaza', color: '#f2609a' },
};

/**
 * The six careers. Each carries a sniper rifle shaped after the job, and a kill by it plays the
 * job's own finishing gag on the victim (render/finishers.js draws them).
 */
export const ROLES = {
  boss: { id: 'boss', team: 'atk', name: 'The Boss', gun: 'Gold Nib', finisher: 'fired', suit: '#2b2f3a', trim: '#d9b44a', skin: '#e2b48f', hair: '#2a2321' },
  playboy: { id: 'playboy', team: 'atk', name: 'The Playboy', gun: 'Heartbreaker', finisher: 'swoon', suit: '#f4f1ea', trim: '#e2385d', skin: '#d9a07a', hair: '#6b4428' },
  chef: { id: 'chef', team: 'atk', name: 'The Chef', gun: 'Pepper Mill', finisher: 'served', suit: '#fafafa', trim: '#2f2f2f', skin: '#c98d66', hair: '#1f1a17' },
  teacher: { id: 'teacher', team: 'def', name: 'The Teacher', gun: 'Pointer', finisher: 'graded', suit: '#3e6b4f', trim: '#f2e9d0', skin: '#e9be9b', hair: '#5a3825' },
  office: { id: 'office', team: 'def', name: 'The Office Lady', gun: 'Stapler', finisher: 'overtime', suit: '#353c4a', trim: '#e9edf2', skin: '#f0c8a8', hair: '#1c1715' },
  nurse: { id: 'nurse', team: 'def', name: 'The Nurse', gun: 'Syringe', finisher: 'sedated', suit: '#e8f3f6', trim: '#41b6c8', skin: '#e3b08d', hair: '#8a5a33' },
};

export const ROLE_ORDER = { atk: ['boss', 'playboy', 'chef'], def: ['teacher', 'office', 'nurse'] };

export const MOVE = {
  speed: 5.6,
  accel: 40,
  friction: 11,
  airControl: 0.35,
  crouchMul: 0.42,
  walkMul: 0.52,
  scopedMul: 0.6,
  jumpSpeed: 4.8,
  gravity: 15,
  radius: 0.36,
  step: 0.55, // a ledge this high is stepped up without jumping: stairs climb the towers
  eyeStand: 1.62,
  eyeCrouch: 1.12,
};

/**
 * Three models of each career's rifle. dmg to the body, head multiplier, fire rate, magazine,
 * reserve, reload seconds, scoped spread, hip spread (unscoped), extra spread per metre-a-second
 * of speed, view kick, price, kill reward, run-speed multiplier, armour penetration and the
 * scope's zoom.
 */
export const MODELS = {
  standard: { id: 'standard', name: 'Standard', dmg: 72, head: 2.6, rpm: 46, mag: 5, reserve: 20, reload: 3.0, spread: 0.0012, hip: 0.09, moveSpread: 0.03, kick: 0.07, price: 0, reward: 300, mobility: 0.86, pen: 0.85, zoom: 4 },
  rapid: { id: 'rapid', name: 'Rapid', dmg: 48, head: 3.0, rpm: 150, mag: 10, reserve: 30, reload: 2.6, spread: 0.0022, hip: 0.07, moveSpread: 0.022, kick: 0.04, price: 1900, reward: 300, mobility: 0.9, pen: 0.75, zoom: 2.6 },
  heavy: { id: 'heavy', name: 'Heavy', dmg: 115, head: 2.2, rpm: 40, mag: 5, reserve: 15, reload: 3.6, spread: 0.0006, hip: 0.13, moveSpread: 0.045, kick: 0.11, price: 4200, reward: 150, mobility: 0.78, pen: 0.95, zoom: 6 },
};

export const MODEL_ORDER = ['standard', 'rapid', 'heavy'];

export const GEAR = {
  vest: { id: 'vest', name: 'Padded blazer (armour)', price: 650 },
};

/**
 * Each career throws its own grenade, and only its own: the Teacher's chalk eraser smokes a
 * sightline shut, the Office Lady's photocopier flash blinds, the Nurse's sedative vial leaves a
 * gas that slows and unscopes, the Boss's money bag explodes, the Playboy's rose bouquet charms
 * enemies so they cannot shoot, and the Chef's flaming pan sets the ground alight. Two at most.
 */
export const GRENADES = {
  teacher: { kind: 'smoke', name: 'Chalk eraser', note: 'A cloud of chalk dust that blocks every sightline', price: 300 },
  office: { kind: 'flash', name: 'Photocopier flash', note: 'Blinds whoever is looking at it', price: 250 },
  nurse: { kind: 'slow', name: 'Sedative vial', note: 'Drowsy gas: enemies inside crawl and cannot scope', price: 300 },
  boss: { kind: 'frag', name: 'Money bag', note: 'Bursts in a hail of coins: damage around it', price: 350 },
  playboy: { kind: 'charm', name: 'Rose bouquet', note: 'Charms enemies near it: no shooting for a moment', price: 300 },
  chef: { kind: 'fire', name: 'Flaming pan', note: 'Sets the ground alight: burns whoever stands in it', price: 400 },
};

export const GRENADE_MAX = 2;

/**
 * Team combos: when a team's three grenades land within `window` seconds and `radius` metres of
 * each other (wherever they were thrown from), every enemy within `reach` of them pays. The Night
 * Shift's Staff Meeting stuns and hurts; the Gentlemen's Hostile Takeover strips armour and
 * grenades, hurts more and dazes for a moment.
 */
export const COMBOS = {
  def: { name: 'Staff Meeting', kinds: ['smoke', 'flash', 'slow'], stun: 3, damage: 35, strip: false },
  atk: { name: 'Hostile Takeover', kinds: ['frag', 'charm', 'fire'], stun: 1.5, damage: 45, strip: true },
};

export const COMBO_RULES = { window: 6, radius: 7, reach: 8.5 };

export const BUY_LIST = ['standard', 'rapid', 'heavy', 'vest', 'grenade'];

export const GRENADE = {
  throwSpeed: 17,
  gravity: 13,
  bounce: 0.36,
  fuse: 1.6,
  smokeRadius: 5.2,
  smokeLife: 15,
  smokeGrow: 1.3,
  flashRadius: 22,
  flashBlind: 2.8,
  fragRadius: 7,
  fragDamage: 105,
  fireRadius: 3.6,
  fireLife: 7,
  fireDps: 22,
  slowRadius: 4.6,
  slowLife: 8,
  slowMul: 0.4,
  charmRadius: 8,
  charmTime: 2.6,
};

export const ECONOMY = {
  start: 1000,
  max: 16000,
  winElim: 3250,
  winObjective: 3500,
  lossBase: 1600,
  lossStep: 500,
  lossMax: 3400,
  plantBonus: 300,
  plantTeamBonus: 800,
  defuseBonus: 300,
};

export const ROUND = {
  freeze: 7,
  live: 115,
  bombTimer: 40,
  plantTime: 2.5,
  defuseTime: 6,
  over: 5,
  winsToTake: 4,
  siteRadius: 6,
};

export const BOT = {
  fov: 1.75,
  sight: 140,
  thinkEvery: 0.12,
  reaction: [0.35, 0.7],
  turnSpeed: 4.2,
  aimError: 0.06, // radians when it first acquires a target
  aimSettle: 1.9, // how fast that error shrinks, per second
  fireCone: 0.012,
  hearGun: 70,
  hearStep: 10,
  memory: 5,
};

export const HITBOX = {
  headRadius: 0.15,
  bodyHalf: 0.27,
  standTop: 1.5,
  crouchTop: 1.08,
};
