// The bots' minds. Each bot sees with a cone of vision and a line of sight that smoke and walls
// cut, hears gunfire and footsteps, reacts after a human-like delay, settles its aim over time and
// stops to scope before it fires. Its job comes from its team's plan for the round: the
// Gentlemen push a lane to a site, plant the charge and guard it; the Night Shift spread over
// posts (tower decks included), rotate toward trouble and retake a planted site to defuse.
import { BOT } from './config.js';
import { eyePos, hitShape } from './actors.js';
import { lineOfSight } from './collision.js';
import { HOLDS, SITES } from './map.js';
import { planRoute } from './nav.js';
import { clamp, wrapAngle, yawTo } from './vec.js';

const eye = { x: 0, y: 0, z: 0 };
const aimAt = { x: 0, y: 0, z: 0 };
const shape = { top: 0, headY: 0 };

export function createBrain(s) {
  const brain = {
    task: null, // { kind: 'route'|'hold'|'plant'|'guard'|'retake'|'fetch'|'search', ... }
    path: [],
    goal: null,
    target: null,
    react: 0,
    error: 0,
    errorYaw: 0,
    errorPitch: 0,
    aimHead: false,
    think: 0,
    lastSeen: null,
    lastSeenAt: -99,
    alert: null,
    stuck: 0,
    lastPos: { x: 0, z: 0 },
    crouchPeek: false,
    nextThrow: 0,
    intent: { fwd: 0, side: 0, crouch: false, walk: false, jump: false },
    wantFire: false,
    wantUse: false,
    alertAt(world, x, z, y) {
      if (!brain.target) brain.alert = { x, z, y: y || 0, t: world.time };
    },
    blinded() {
      brain.target = null;
      brain.react = 0.6;
    },
  };
  return brain;
}

/** Hands out each bot's job at the start of a round. */
export function planRound(world) {
  const rng = world.rng;
  world.plan = { site: rng.chance(0.5) ? 'A' : 'B', lane: 0 };
  world.plan.lane = rng.int(0, 2);
  const atk = world.soldiers.filter((s) => s.team === 'atk' && s.brain);
  const def = world.soldiers.filter((s) => s.team === 'def' && s.brain);
  atk.forEach((s, i) => {
    const b = s.brain;
    reset(b);
    // One Gentleman may take a tower to cover the push from on high.
    if (!s.hasBomb && i === atk.length - 1 && rng.chance(0.45)) {
      const post = rng.pick(HOLDS.atkTowers);
      b.task = { kind: 'hold', post, until: world.time + 35 };
    } else {
      b.task = { kind: 'route', site: world.plan.site, lane: world.plan.lane };
    }
  });
  const posts = ['A', 'B', 'mid'];
  rng.next() < 0.5 && posts.reverse();
  def.forEach((s, i) => {
    const b = s.brain;
    reset(b);
    const group = HOLDS[posts[i % posts.length]];
    b.task = { kind: 'hold', post: group[rng.int(0, group.length - 1)] };
  });
}

function reset(b) {
  b.task = null;
  b.path = [];
  b.goal = null;
  b.target = null;
  b.lastSeen = null;
  b.alert = null;
  b.nextThrow = 0;
  b.wantFire = false;
  b.wantUse = false;
}

function setGoal(world, s, b, x, z, y, via) {
  if (b.goal && Math.abs(b.goal.x - x) < 0.5 && Math.abs(b.goal.z - z) < 0.5 && !via) return;
  b.goal = { x, z, y: y || 0 };
  b.path = planRoute(s.pos.x, s.pos.z, s.pos.y, x, z, y || 0, via);
}

/** Picks the most pressing visible enemy, or null. */
function perceive(world, s, b) {
  if (s.blind > 0.4) return null;
  eyePos(s, eye);
  let best = null;
  let bestScore = Infinity;
  for (const o of world.soldiers) {
    if (!o.alive || o.team === s.team) continue;
    const dx = o.pos.x - s.pos.x;
    const dz = o.pos.z - s.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > BOT.sight) continue;
    const off = Math.abs(wrapAngle(yawTo(s.pos, o.pos) - s.yaw));
    if (off > BOT.fov / 2 && d > 5) continue;
    hitShape(o, shape);
    aimAt.x = o.pos.x;
    aimAt.z = o.pos.z;
    aimAt.y = shape.headY;
    let seen = lineOfSight(eye, aimAt, world.smokes);
    if (!seen) {
      aimAt.y = shape.top - 0.35;
      seen = lineOfSight(eye, aimAt, world.smokes);
    }
    if (!seen) continue;
    const score = d * (o === b.target ? 0.6 : 1) * (o.isPlayer ? 0.9 : 1);
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

/** Turns toward a point, the bot's aim error laid over it; returns the remaining aim offset. */
function aimToward(s, b, x, y, z, dt) {
  eyePos(s, eye);
  const dx = x - eye.x;
  const dy = y - eye.y;
  const dz = z - eye.z;
  const flat = Math.hypot(dx, dz);
  const wantYaw = Math.atan2(-dx, -dz) + b.errorYaw * b.error;
  const wantPitch = Math.atan2(dy, flat) + b.errorPitch * b.error - s.recoilPitch * 0.6;
  const dy0 = wrapAngle(wantYaw - s.yaw);
  const dp0 = wantPitch - s.pitch;
  const step = BOT.turnSpeed * dt;
  s.yaw = wrapAngle(s.yaw + clamp(dy0, -step, step));
  s.pitch = clamp(s.pitch + clamp(dp0, -step, step), -1.2, 1.2);
  return Math.abs(wrapAngle(wantYaw - s.yaw)) + Math.abs(wantPitch - s.pitch);
}

function followPath(s, b, dt) {
  const intent = b.intent;
  while (b.path.length && Math.hypot(b.path[0].x - s.pos.x, b.path[0].z - s.pos.z) < 0.9) b.path.shift();
  if (!b.path.length) {
    intent.fwd = 0;
    return true;
  }
  const p = b.path[0];
  const want = Math.atan2(-(p.x - s.pos.x), -(p.z - s.pos.z));
  // Walk toward the next point while looking roughly along the way.
  const delta = wrapAngle(want - s.yaw);
  s.yaw = wrapAngle(s.yaw + clamp(delta, -BOT.turnSpeed * dt, BOT.turnSpeed * dt));
  s.pitch *= 0.9;
  intent.fwd = Math.cos(delta) > 0.3 ? 1 : 0.2;
  intent.side = clamp(Math.sin(delta) * 1.5, -1, 1) * (Math.cos(delta) > 0.3 ? 1 : 0);
  return false;
}

function siteOf(world) {
  return SITES[world.bomb.site || world.plan.site];
}

/** The bot's decisions for one step; writes its intent and its fire/use wishes. */
export function updateBot(world, s, dt) {
  const b = s.brain;
  const intent = b.intent;
  intent.fwd = 0;
  intent.side = 0;
  intent.jump = false;
  intent.walk = false;
  b.wantFire = false;
  b.wantUse = false;
  if (!s.alive || world.phase === 'freeze') {
    intent.crouch = false;
    return;
  }

  b.think -= dt;
  if (b.think <= 0) {
    b.think = BOT.thinkEvery;
    const seen = perceive(world, s, b);
    if (seen && seen !== b.target) {
      b.target = seen;
      const [lo, hi] = BOT.reaction;
      b.react = lo + (hi - lo) * world.rng.next() * (b.alert ? 0.6 : 1);
      b.error = 1;
      b.errorYaw = world.rng.gauss() * BOT.aimError;
      b.errorPitch = world.rng.gauss() * BOT.aimError * 0.6;
      b.aimHead = world.rng.chance(0.45);
      b.crouchPeek = world.rng.chance(0.4);
    } else if (!seen && b.target) {
      b.lastSeen = { x: b.target.pos.x, z: b.target.pos.z, y: b.target.pos.y };
      b.lastSeenAt = world.time;
      b.target = null;
    }
    if (b.target) {
      b.lastSeen = { x: b.target.pos.x, z: b.target.pos.z, y: b.target.pos.y };
      b.lastSeenAt = world.time;
    }
    // Stuck on something: plan again from here.
    const moved = Math.hypot(s.pos.x - b.lastPos.x, s.pos.z - b.lastPos.z);
    if (b.path.length && moved < 0.05) b.stuck += BOT.thinkEvery;
    else b.stuck = 0;
    b.lastPos.x = s.pos.x;
    b.lastPos.z = s.pos.z;
    if (b.stuck > 1.2 && b.goal) {
      b.path = planRoute(s.pos.x, s.pos.z, s.pos.y, b.goal.x, b.goal.z, b.goal.y);
      b.stuck = 0;
      intent.jump = true;
    }
  }

  // A grenade first, when the moment suits the career's.
  const lob = grenadeTarget(world, s, b);
  if (lob && lobAt(world, s, b, lob.x, lob.z, dt)) return;

  // Engaging: stop, scope, settle the aim, fire.
  if (b.target && b.target.alive) {
    const t = b.target;
    hitShape(t, shape);
    const y = b.aimHead ? shape.headY : shape.top - 0.4;
    b.react -= dt;
    b.error = Math.max(0, b.error - dt * BOT.aimSettle * (s.scoped ? 1 : 0.6));
    const off = aimToward(s, b, t.pos.x, y, t.pos.z, dt);
    const d = Math.hypot(t.pos.x - s.pos.x, t.pos.z - s.pos.z);
    s.scoped = d > 10;
    intent.crouch = b.crouchPeek && s.pos.y < 0.5;
    if (s.gun.mag === 0) s.gun.reloading || (s.gun.reloading = s.gun.def.reload);
    if (b.react <= 0 && off < BOT.fireCone + (d > 0 ? 0.25 / d : 0) && Math.hypot(s.vel.x, s.vel.z) < 1.2) b.wantFire = true;
    return;
  }
  b.target = null;
  if (s.scoped && world.time - b.lastSeenAt > 1.5) s.scoped = false;
  if (s.gun.mag < s.gun.def.mag && world.time - b.lastSeenAt > 2) s.gun.reloading || (s.gun.mag < 2 && (s.gun.reloading = s.gun.def.reload));

  doTask(world, s, b, dt);
}

function doTask(world, s, b, dt) {
  const intent = b.intent;
  const bomb = world.bomb;

  // The charge is down: Night Shift retake and defuse; Gentlemen guard it.
  if (bomb.state === 'planted') {
    if (s.team === 'def') {
      const d = Math.hypot(bomb.x - s.pos.x, bomb.z - s.pos.z);
      if (d < 1.3) {
        intent.crouch = true;
        b.wantUse = true;
        return;
      }
      setGoal(world, s, b, bomb.x, bomb.z, 0);
      intent.crouch = false;
      followPath(s, b, dt);
      return;
    }
    if (!b.task || b.task.kind !== 'guard') {
      const site = siteOf(world);
      const a = world.rng.next() * Math.PI * 2;
      b.task = { kind: 'guard', x: site.x + Math.cos(a) * 7, z: site.z + Math.sin(a) * 7 };
    }
  }

  // A dropped charge: the nearest Gentleman fetches it.
  if (s.team === 'atk' && bomb.state === 'dropped') {
    const mine = world.soldiers.filter((o) => o.team === 'atk' && o.alive).sort((p, q) => Math.hypot(p.pos.x - bomb.x, p.pos.z - bomb.z) - Math.hypot(q.pos.x - bomb.x, q.pos.z - bomb.z))[0];
    if (mine === s) {
      setGoal(world, s, b, bomb.x, bomb.z, bomb.y);
      followPath(s, b, dt);
      return;
    }
  }

  // Heard something and nothing better to do: go and look.
  const memory = b.lastSeen && world.time - b.lastSeenAt < BOT.memory ? b.lastSeen : b.alert && world.time - b.alert.t < BOT.memory ? b.alert : null;
  const task = b.task;
  // The carrier does not chase noises: the charge goes to the site.
  if (memory && !s.hasBomb) {
    if (task && task.kind === 'hold') {
      // Holders turn to face the noise but keep their post.
      aimToward(s, b, memory.x, (memory.y || 0) + 1.4, memory.z, dt);
      intent.crouch = s.pos.y < 0.5 && world.rng.next() < 0.02 ? !intent.crouch : intent.crouch;
      return;
    }
    setGoal(world, s, b, memory.x, memory.z, memory.y || 0);
    if (followPath(s, b, dt)) b.alert = null;
    return;
  }

  if (!task) return;
  if (task.kind === 'hold') {
    const [x, z, y, fx, fz] = task.post;
    if (task.until && world.time > task.until) {
      b.task = { kind: 'route', site: world.plan.site, lane: world.plan.lane };
      return;
    }
    setGoal(world, s, b, x, z, y);
    if (followPath(s, b, dt)) {
      aimToward(s, b, fx, 1.5, fz, dt);
      intent.crouch = y > 1 ? false : world.time % 9 < 4;
    }
    return;
  }
  if (task.kind === 'guard') {
    setGoal(world, s, b, task.x, task.z, 0);
    if (followPath(s, b, dt)) {
      aimToward(s, b, bomb.x * 2 - task.x, 1.4, bomb.z * 2 - task.z, dt);
      intent.crouch = true;
    }
    return;
  }
  if (task.kind === 'route') {
    const site = SITES[task.site];
    if (s.hasBomb) {
      const d = Math.hypot(site.x - s.pos.x, site.z - s.pos.z);
      if (d < 2.2) {
        intent.crouch = true;
        b.wantUse = true;
        return;
      }
    }
    if (!b.goal) {
      const lanes = world.routes[task.site];
      const lane = lanes[task.lane % lanes.length];
      setGoal(world, s, b, site.x + (s.hasBomb ? 0 : (world.rng.next() - 0.5) * 8), site.z + (s.hasBomb ? 0 : (world.rng.next() - 0.5) * 6), 0, lane.slice(0, -1));
    }
    // The Chef burns out the site's defenders on the way in.
    if (s.role.id === 'chef' && s.grenades > 0 && Math.hypot(site.x - s.pos.x, site.z - s.pos.z) < 24) {
      if (lobAt(world, s, b, site.x, site.z, dt)) return;
    }
    if (followPath(s, b, dt) && !s.hasBomb) {
      b.task = { kind: 'guard', x: s.pos.x, z: s.pos.z };
    }
  }
}

/**
 * Lobs the career's grenade at (x, z): turns to it, raises the arc the distance needs (a throw
 * flies at 17 m/s under 13 m/s² of gravity), and lets go once lined up. Returns true while busy.
 */
function lobAt(world, s, b, x, z, dt) {
  if (world.time < b.nextThrow) return false;
  const d = Math.hypot(x - s.pos.x, z - s.pos.z);
  if (d < 6 || d > 30) return false;
  const want = Math.atan2(-(x - s.pos.x), -(z - s.pos.z));
  const delta = wrapAngle(want - s.yaw);
  s.yaw = wrapAngle(s.yaw + clamp(delta, -BOT.turnSpeed * dt, BOT.turnSpeed * dt));
  s.pitch = 0.5 * Math.asin(Math.min(1, (13 * d) / (17 * 17))) - 0.12;
  s.scoped = false;
  if (Math.abs(delta) < 0.06) {
    world.botThrow(s);
    b.nextThrow = world.time + 8;
  }
  return true;
}

/** Whether a bot should spend its grenade on what it just saw or heard, and where. */
function grenadeTarget(world, s, b) {
  if (s.grenades <= 0 || world.time < b.nextThrow) return null;
  const kind = s.role.id;
  // The Playboy charms a foe that is in view; the rest lob at what they remember or heard.
  if (kind === 'playboy') return b.target ? b.target.pos : null;
  if (b.target && kind !== 'teacher') return null;
  return b.lastSeen && world.time - b.lastSeenAt < 3 ? b.lastSeen : b.alert && world.time - b.alert.t < 3 ? b.alert : null;
}

/** What a bot buys when the freeze starts, by its money. */
export function botBuy(world, s) {
  const m = s.money;
  if (m >= 4200 + 650 + 300 && world.rng.chance(0.5)) world.buy(s, 'heavy');
  else if (m >= 1900 + 650) world.buy(s, 'rapid');
  if (s.money >= 650 && s.armor < 50) world.buy(s, 'vest');
  if (s.money >= 400 && world.rng.chance(0.7)) world.buy(s, 'grenade');
  if (s.money >= 1200 && world.rng.chance(0.4)) world.buy(s, 'grenade');
}
