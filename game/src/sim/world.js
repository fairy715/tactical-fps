// The match: one state object holding every soldier, the charge, thrown gear, the round clock,
// the score and the economy, stepped at a fixed rate. Commands come in (the player's from the
// keyboard and mouse, each bot's from its brain), events come out (shots, hits, kills, plants,
// round ends) for the renderer, the HUD and the sound to react to. Nothing here draws.
import { ECONOMY, GEAR, GRENADES, GRENADE_MAX, MODELS, ROLE_ORDER, ROUND, TEAMS } from './config.js';
import { createSoldier, eyePos, moveSoldier, respawn } from './actors.js';
import { createBrain, botBuy, planRound, updateBot } from './bots.js';
import { applyHit, killSoldier, traceShot } from './combat.js';
import { throwGrenade, updateGrenades } from './grenades.js';
import { ROUTES, SITES, SPAWNS } from './map.js';
import { createRng } from './rng.js';
import { fireGun, settleRecoil, startReload, tickGun } from './weapons.js';
import { createGun } from './weapons.js';

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
    phase: 'freeze', // freeze, live, planted, over, match
    phaseTime: ROUND.freeze,
    round: 0,
    score: { atk: 0, def: 0 },
    lossStreak: { atk: 0, def: 0 },
    winner: null,
    lastRound: null,
    soldiers: [],
    player: null,
    grenades: [],
    smokes: [],
    events: [],
    bomb: { state: 'carried', carrier: null, x: 0, y: 0, z: 0, site: null, timer: 0, plant: 0, defuse: 0, defuser: null, planter: null },
    plan: { site: 'A', lane: 0 },
    routes: ROUTES,
    economy: ECONOMY,
    buy: (s, item) => buy(world, s, item),
    zones: [],
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
  for (const team of ['atk', 'def']) {
    const squad = world.soldiers.filter((s) => s.team === team);
    squad.forEach((s, i) => {
      const [x, z, yaw] = SPAWNS[team][i % SPAWNS[team].length];
      respawn(s, x, z, yaw, s.alive && world.round > 1);
    });
  }
  // The charge goes to a random Gentleman.
  const atk = world.soldiers.filter((s) => s.team === 'atk');
  const carrier = atk[world.rng.int(0, atk.length - 1)];
  carrier.hasBomb = true;
  Object.assign(world.bomb, { state: 'carried', carrier: carrier.id, site: null, timer: 0, plant: 0, defuse: 0, defuser: null, planter: null });
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

function dropBomb(world, s) {
  s.hasBomb = false;
  Object.assign(world.bomb, { state: 'dropped', carrier: null, x: s.pos.x, y: s.pos.y, z: s.pos.z });
  world.events.push({ type: 'bombDropped', x: s.pos.x, z: s.pos.z });
}

/** The player's command for this step: { fwd, side, crouch, walk, jump, fire, scope, reload, use, smoke, flash }. */
function applyCommand(world, s, cmd, dt) {
  if (!s.alive) return;
  const frozen = world.phase === 'freeze' || world.phase === 'match';
  const step = moveSoldier(s, frozen ? IDLE : cmd, dt);
  if (step) world.events.push({ type: 'step', id: s.id, x: s.pos.x, y: s.pos.y, z: s.pos.z });
  const gun = s.gun;
  if (tickGun(gun, dt) === 'reloaded') world.events.push({ type: 'reloaded', id: s.id });
  settleRecoil(s, dt);
  s.blind = Math.max(0, s.blind - dt);
  s.slowed = Math.max(0, s.slowed - dt);
  s.charmed = Math.max(0, s.charmed - dt);
  s.burning = Math.max(0, s.burning - dt);
  if (frozen) return;
  if (cmd.reload && startReload(gun)) {
    s.scoped = false;
    world.events.push({ type: 'reload', id: s.id });
  }
  if (cmd.scope !== undefined) s.scoped = cmd.scope && gun.reloading <= 0;
  // Sedated soldiers cannot steady a scope; charmed ones cannot bring themselves to shoot.
  if (s.slowed > 0 || s.charmed > 0) s.scoped = false;
  if (cmd.fire && s.charmed <= 0) {
    if (gun.mag <= 0 && gun.reloading <= 0) {
      if (startReload(gun)) world.events.push({ type: 'reload', id: s.id });
      else if (s.isPlayer && cmd.firePressed) world.events.push({ type: 'dry', id: s.id });
    } else if (fireGun(s, world.rng, shotDir)) {
      traceShot(world, s, shotDir, shotHit);
      world.events.push({ type: 'shot', id: s.id, role: s.role.id, sx: shotHit.sx, sy: shotHit.sy, sz: shotHit.sz, x: shotHit.x, y: shotHit.y, z: shotHit.z, victim: shotHit.victim ? shotHit.victim.id : null });
      // Gunfire carries: every bot within earshot turns toward it.
      for (const o of world.soldiers) if (o.brain && o.alive && o.team !== s.team && Math.hypot(o.pos.x - s.pos.x, o.pos.z - s.pos.z) < 70) o.brain.alertAt(world, s.pos.x, s.pos.z, s.pos.y);
      if (shotHit.victim) applyHit(world, s, shotHit.victim, shotHit.head, gun.def);
      // A bolt-action drops out of the scope to cycle.
      if (gun.def.rpm < 60 && s.isPlayer) s.scoped = false;
    }
  }
  if (cmd.grenade) throwGrenade(world, s);
  useAction(world, s, cmd.use, dt);
}

const IDLE = { fwd: 0, side: 0, crouch: false, walk: false, jump: false };

/** Planting and defusing: hold the use key, stand still, keep at it. */
function useAction(world, s, using, dt) {
  const bomb = world.bomb;
  s.action = null;
  if (!using || !s.onGround) {
    if (bomb.defuser === s.id) {
      bomb.defuser = null;
      bomb.defuse = 0;
    }
    if (s.hasBomb) bomb.plant = 0;
    return;
  }
  if (s.team === 'atk' && s.hasBomb && world.phase === 'live') {
    const site = Object.values(SITES).find((t) => Math.hypot(t.x - s.pos.x, t.z - s.pos.z) < ROUND.siteRadius);
    if (!site) return;
    s.action = 'plant';
    bomb.plant += dt;
    if (bomb.plant >= ROUND.plantTime) {
      s.hasBomb = false;
      Object.assign(bomb, { state: 'planted', carrier: null, x: s.pos.x, y: s.pos.y, z: s.pos.z, site: site.id, timer: ROUND.bombTimer, planter: s.id });
      s.money = Math.min(ECONOMY.max, s.money + ECONOMY.plantBonus);
      world.phase = 'planted';
      world.events.push({ type: 'planted', site: site.id, by: s.id });
    }
    return;
  }
  if (s.team === 'def' && bomb.state === 'planted' && Math.hypot(bomb.x - s.pos.x, bomb.z - s.pos.z) < 1.6) {
    if (bomb.defuser !== null && bomb.defuser !== s.id) return;
    s.action = 'defuse';
    bomb.defuser = s.id;
    bomb.defuse += dt;
    if (bomb.defuse >= ROUND.defuseTime) {
      bomb.state = 'defused';
      s.money = Math.min(ECONOMY.max, s.money + ECONOMY.defuseBonus);
      world.events.push({ type: 'defused', by: s.id });
      endRound(world, 'def', 'defused');
    }
  }
}

function endRound(world, winner, reason) {
  if (world.phase === 'over' || world.phase === 'match') return;
  const loser = winner === 'atk' ? 'def' : 'atk';
  world.score[winner] += 1;
  world.lossStreak[winner] = 0;
  world.lossStreak[loser] += 1;
  const objective = reason === 'detonated' || reason === 'defused';
  for (const s of world.soldiers) {
    let pay;
    if (s.team === winner) pay = objective ? ECONOMY.winObjective : ECONOMY.winElim;
    else {
      pay = Math.min(ECONOMY.lossMax, ECONOMY.lossBase + ECONOMY.lossStep * (world.lossStreak[loser] - 1));
      if (s.team === 'atk' && world.bomb.planter !== null) pay += ECONOMY.plantTeamBonus;
    }
    s.money = Math.min(ECONOMY.max, s.money + pay);
  }
  world.lastRound = { winner, reason, round: world.round };
  const done = world.score[winner] >= ROUND.winsToTake;
  world.phase = done ? 'match' : 'over';
  world.phaseTime = ROUND.over;
  if (done) world.winner = winner;
  world.events.push({ type: done ? 'matchOver' : 'roundOver', winner, reason, teamName: TEAMS[winner].name });
}

function checkRound(world) {
  const alive = (team) => world.soldiers.some((s) => s.team === team && s.alive);
  if (world.phase === 'live') {
    if (!alive('atk')) return endRound(world, 'def', 'eliminated');
    if (!alive('def')) return endRound(world, 'atk', 'eliminated');
    if (world.phaseTime <= 0) return endRound(world, 'def', 'time');
  } else if (world.phase === 'planted') {
    if (!alive('def')) return endRound(world, 'atk', 'eliminated');
    if (world.bomb.timer <= 0) {
      world.bomb.state = 'detonated';
      world.events.push({ type: 'detonated', x: world.bomb.x, z: world.bomb.z, site: world.bomb.site });
      // The glitter charge knocks out anyone caught close to it.
      for (const s of world.soldiers) {
        if (s.alive && Math.hypot(s.pos.x - world.bomb.x, s.pos.z - world.bomb.z) < 9) killSoldier(world, s, null, false);
      }
      return endRound(world, 'atk', 'detonated');
    }
  }
  return null;
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
  if (world.phase === 'planted') world.bomb.timer -= dt;
  if (world.phase === 'over' && world.phaseTime <= 0) {
    startRound(world);
    return;
  }

  for (const s of world.soldiers) {
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
      applyCommand(world, s, BOT_CMD, dt);
    } else if (s.isPlayer) {
      applyCommand(world, s, playerCmd, dt);
    }
  }

  // Picking up a dropped charge.
  const bomb = world.bomb;
  if (bomb.state === 'dropped') {
    for (const s of world.soldiers) {
      if (s.team === 'atk' && s.alive && Math.hypot(s.pos.x - bomb.x, s.pos.z - bomb.z) < 1.3) {
        s.hasBomb = true;
        bomb.state = 'carried';
        bomb.carrier = s.id;
        world.events.push({ type: 'bombTaken', id: s.id });
        break;
      }
    }
  }
  updateGrenades(world, dt);
  if (world.phase === 'live' || world.phase === 'planted') checkRound(world);
}

const BOT_CMD = { fwd: 0, side: 0, crouch: false, walk: false, jump: false, fire: false, use: false };

/** Where a soldier's eyes are, for cameras. */
export function soldierEye(s) {
  return eyePos(s, eye);
}
