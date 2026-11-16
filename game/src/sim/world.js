// The match: one state object holding every soldier, both charges, thrown gear, the round clock,
// the score and the economy, stepped at a fixed rate. Commands come in (the player's from the
// keyboard and mouse, each bot's from its brain), events come out (shots, hits, kills, plants,
// round ends) for the renderer, the HUD and the sound to react to. Nothing here draws. The
// objective (charges, drop zones, the ring) lives in objective.js.
import { ECONOMY, GEAR, GRENADES, GRENADE_MAX, MODELS, ROLE_ORDER, ROUND, TEAMS } from './config.js';
import { createSoldier, eyePos, moveSoldier, respawn } from './actors.js';
import { createBrain, botBuy, planRound, updateBot } from './bots.js';
import { applyHit, traceShot } from './combat.js';
import { throwGrenade, updateGrenades } from './grenades.js';
import { ROUTES, SPAWNS } from './map.js';
import { checkRound, dropBomb, enemyOf, markDropZones, pickUpBombs, resetObjective, updateRing, useAction } from './objective.js';
import { createRng } from './rng.js';
import { createGun, fireGun, settleRecoil, startReload, tickGun } from './weapons.js';

const shotDir = { x: 0, y: 0, z: 0 };
const shotHit = { t: 0, victim: null, head: false, x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0 };
const eye = { x: 0, y: 0, z: 0 };

/**
 * A new match. options: { seed, playerTeam ('atk' | 'def' | null for a bots-only match),
 * playerRole }.
 */
export function createWorld(options) {
  const world = {
    rng: createRng(options.seed || 1),
    time: 0,
    phase: 'freeze', // freeze, live, over, match
    phaseTime: ROUND.freeze,
    round: 0,
    score: { atk: 0, def: 0 },
    lossStreak: { atk: 0, def: 0 },
    winner: null,
    soldiers: [],
    player: null,
    grenades: [],
    smokes: [],
    zones: [], // lingering grenade areas: fire and sedative
    events: [],
    bombs: null, // each team's charge
    dropZones: null, // each team's drop zone, once the other team loses someone
    ring: null, // the closing ring: { x, z, r, minR, startAt }
    plan: { site: 'A', lane: 0 },
    routes: ROUTES,
    economy: ECONOMY,
    combo: [], // recent grenade bursts, for the team combos
    comboCalls: { atk: null, def: null }, // where each team's bots should land their next throw
    buy: (s, item) => buy(world, s, item),
    botThrow: (s) => throwGrenade(world, s),
    dropBomb: (s) => dropBomb(world, s),
  };
  let id = 0;
  for (const team of ['atk', 'def']) {
    for (const roleId of ROLE_ORDER[team]) {
      const isPlayer = options.playerTeam === team && options.playerRole === roleId;
      const s = createSoldier(id++, team, roleId, isPlayer);
      s.money = ECONOMY.start;
      if (isPlayer) world.player = s;
      else s.brain = createBrain(s);
      world.soldiers.push(s);
    }
  }
  startRound(world);
  return world;
}

function startRound(world) {
  world.round += 1;
  world.phase = 'freeze';
  world.phaseTime = ROUND.freeze;
  world.grenades = [];
  world.smokes = [];
  world.zones = [];
  world.combo = [];
  world.comboCalls = { atk: null, def: null };
  for (const team of ['atk', 'def']) {
    world.soldiers.filter((s) => s.team === team).forEach((s, i) => {
      const [x, z, yaw] = SPAWNS[team][i % SPAWNS[team].length];
      respawn(s, x, z, yaw, s.alive && world.round > 1);
    });
  }
  resetObjective(world);
  for (const s of world.soldiers) if (s.brain) botBuy(world, s);
  planRound(world);
  world.events.push({ type: 'roundStart', round: world.round });
}

/** Buys an item for a soldier during the freeze; returns why not, or null on success. */
export function buy(world, s, item) {
  if (world.phase !== 'freeze') return 'Buying closes when the round goes live';
  const model = MODELS[item];
  if (model) {
    if (s.gun.def === model) return 'Already carried';
    if (s.money < model.price) return 'Not enough money';
    s.money -= model.price;
    s.gun = createGun(model);
    world.events.push({ type: 'buy', id: s.id, item });
    return null;
  }
  const gear = item === 'grenade' ? GRENADES[s.role.id] : GEAR[item];
  if (!gear) return 'Unknown item';
  if (s.money < gear.price) return 'Not enough money';
  if (item === 'vest') {
    if (s.armor >= 100) return 'Already wearing one';
    s.armor = 100;
  } else {
    if (s.grenades >= GRENADE_MAX) return 'Carrying the most you can';
    s.grenades += 1;
  }
  s.money -= gear.price;
  world.events.push({ type: 'buy', id: s.id, item });
  return null;
}

const IDLE = { fwd: 0, side: 0, crouch: false, walk: false, jump: false };

/**
 * One soldier's command for this step: { fwd, side, crouch, walk, jump, fire, firePressed, scope,
 * reload, use, grenade }. Returns a round result when a defuse finishes it, else null.
 */
function applyCommand(world, s, cmd, dt) {
  if (!s.alive) return null;
  const frozen = world.phase !== 'live';
  if (moveSoldier(s, frozen ? IDLE : cmd, dt)) world.events.push({ type: 'step', id: s.id, x: s.pos.x, y: s.pos.y, z: s.pos.z });
  const gun = s.gun;
  if (tickGun(gun, dt) === 'reloaded') world.events.push({ type: 'reloaded', id: s.id });
  settleRecoil(s, dt);
  s.blind = Math.max(0, s.blind - dt);
  s.slowed = Math.max(0, s.slowed - dt);
  s.charmed = Math.max(0, s.charmed - dt);
  s.stunned = Math.max(0, s.stunned - dt);
  s.burning = Math.max(0, s.burning - dt);
  if (frozen || s.stunned > 0) return null;
  if (cmd.reload && startReload(gun)) {
    s.scoped = false;
    world.events.push({ type: 'reload', id: s.id });
  }
  if (cmd.scope !== undefined) s.scoped = cmd.scope && gun.reloading <= 0;
  // Sedated soldiers cannot steady a scope; charmed ones cannot bring themselves to shoot.
  if (s.slowed > 0 || s.charmed > 0) s.scoped = false;
  if (cmd.fire && s.charmed <= 0) fire(world, s, cmd);
  if (cmd.grenade) throwGrenade(world, s);
  return useAction(world, s, cmd.use, dt);
}

function fire(world, s, cmd) {
  const gun = s.gun;
  if (gun.mag <= 0 && gun.reloading <= 0) {
    if (startReload(gun)) world.events.push({ type: 'reload', id: s.id });
    else if (s.isPlayer && cmd.firePressed) world.events.push({ type: 'dry', id: s.id });
    return;
  }
  if (!fireGun(s, world.rng, shotDir)) return;
  traceShot(world, s, shotDir, shotHit);
  world.events.push({ type: 'shot', id: s.id, role: s.role.id, sx: shotHit.sx, sy: shotHit.sy, sz: shotHit.sz, x: shotHit.x, y: shotHit.y, z: shotHit.z, victim: shotHit.victim ? shotHit.victim.id : null });
  // Gunfire carries: every enemy bot within earshot turns toward it.
  for (const o of world.soldiers) {
    if (o.brain && o.alive && o.team !== s.team && Math.hypot(o.pos.x - s.pos.x, o.pos.z - s.pos.z) < 70) o.brain.alertAt(world, s.pos.x, s.pos.z, s.pos.y);
  }
  if (shotHit.victim) applyHit(world, s, shotHit.victim, shotHit.head, gun.def);
  // A bolt-action drops out of the scope to cycle.
  if (gun.def.rpm < 60 && s.isPlayer) s.scoped = false;
}

function endRound(world, winner, reason) {
  const loser = enemyOf(winner);
  world.score[winner] += 1;
  world.lossStreak[winner] = 0;
  world.lossStreak[loser] += 1;
  const objective = reason === 'detonated' || reason === 'defused';
  for (const s of world.soldiers) {
    let pay;
    if (s.team === winner) pay = objective ? ECONOMY.winObjective : ECONOMY.winElim;
    else {
      pay = Math.min(ECONOMY.lossMax, ECONOMY.lossBase + ECONOMY.lossStep * (world.lossStreak[loser] - 1));
      if (world.bombs[s.team].planter !== null) pay += ECONOMY.plantTeamBonus;
    }
    s.money = Math.min(ECONOMY.max, s.money + pay);
  }
  const done = world.score[winner] >= ROUND.winsToTake;
  world.phase = done ? 'match' : 'over';
  world.phaseTime = ROUND.over;
  if (done) world.winner = winner;
  world.events.push({ type: done ? 'matchOver' : 'roundOver', winner, reason, teamName: TEAMS[winner].name });
}

/**
 * One fixed step. playerCmd drives the player (ignored in a bots-only match). Events are added to
 * world.events; the caller drains them.
 */
export function stepWorld(world, playerCmd, dt) {
  world.time += dt;
  world.phaseTime -= dt;
  if (world.phase === 'freeze' && world.phaseTime <= 0) {
    world.phase = 'live';
    world.phaseTime = ROUND.live;
    world.events.push({ type: 'live' });
  }
  if (world.phase === 'over' && world.phaseTime <= 0) {
    startRound(world);
    return;
  }

  let result = null;
  for (const s of world.soldiers) {
    let cmd = null;
    if (s.brain) {
      updateBot(world, s, dt);
      const b = s.brain;
      BOT_CMD.fwd = b.intent.fwd;
      BOT_CMD.side = b.intent.side;
      BOT_CMD.crouch = b.intent.crouch;
      BOT_CMD.walk = b.intent.walk;
      BOT_CMD.jump = b.intent.jump;
      BOT_CMD.fire = b.wantFire;
      BOT_CMD.use = b.wantUse;
      cmd = BOT_CMD;
    } else if (s.isPlayer) cmd = playerCmd;
    if (cmd) result = applyCommand(world, s, cmd, dt) || result;
  }
  updateGrenades(world, dt);
  if (world.phase !== 'live') return;
  pickUpBombs(world);
  markDropZones(world);
  for (const s of world.soldiers) s.outside = false;
  updateRing(world, dt);
  result = result || checkRound(world, dt);
  if (result) endRound(world, result.winner, result.reason);
}

const BOT_CMD = { fwd: 0, side: 0, crouch: false, walk: false, jump: false, fire: false, use: false };

/** Where a soldier's eyes are, for cameras. */
export function soldierEye(s) {
  return eyePos(s, eye);
}

export { inDropZone, plantedBombs } from './objective.js';
