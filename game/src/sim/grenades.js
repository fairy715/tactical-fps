// Each career's signature grenade, flown as a simple body that bounces off the plaza and the boxes
// until its fuse runs out, then: chalk smoke that blocks sight, a photocopier flash that blinds,
// a sedative gas that slows and unscopes, a money bag that explodes, a rose bouquet that charms
// enemies out of shooting, or a flaming pan that sets the ground alight; and two support throws, a
// wall of code with a cola behind it and a milk puddle that speeds and heals the thrower's side.
// A kill by a grenade counts for its thrower, finisher and all.
import { COMBOS, COMBO_RULES, GRENADE, GRENADES, MOVE } from './config.js';
import { eyePos } from './actors.js';
import { killSoldier } from './combat.js';
import { lineOfSight } from './collision.js';
import { SOLIDS } from './map.js';
import { dirFromAngles } from './vec.js';

/** The kinds that help the thrower's side; they never count toward a combo. */
const SUPPORT = new Set(Object.values(GRENADES).filter((g) => g.support).map((g) => g.kind));
const QUICK = new Set(['fire', 'slow', 'milk', 'code']);

const dir = { x: 0, y: 0, z: 0 };
const eye = { x: 0, y: 0, z: 0 };
const at = { x: 0, y: 0, z: 0 };

export function throwGrenade(world, s) {
  if (s.grenades <= 0) return false;
  s.grenades -= 1;
  const kind = GRENADES[s.role.id].kind;
  dirFromAngles(dir, s.yaw, s.pitch + 0.12);
  eyePos(s, eye);
  world.grenades.push({
    kind,
    owner: s.id,
    team: s.team,
    x: eye.x + dir.x * 0.6,
    y: eye.y - 0.1,
    z: eye.z + dir.z * 0.6,
    vx: dir.x * GRENADE.throwSpeed + s.vel.x,
    vy: dir.y * GRENADE.throwSpeed + 1.5,
    vz: dir.z * GRENADE.throwSpeed + s.vel.z,
    fuse: QUICK.has(kind) ? 1.1 : GRENADE.fuse,
    fromX: s.pos.x,
    fromZ: s.pos.z,
  });
  world.events.push({ type: 'throw', kind, by: s.id });
  return true;
}

function insideBox(g) {
  for (let i = 0; i < SOLIDS.length; i++) {
    const b = SOLIDS[i];
    if (g.x > b.x0 && g.x < b.x1 && g.z > b.z0 && g.z < b.z1 && g.y > b.y0 && g.y < b.h) return b;
  }
  return null;
}

function fly(g, dt) {
  g.vy -= GRENADE.gravity * dt;
  const px = g.x;
  const py = g.y;
  const pz = g.z;
  g.x += g.vx * dt;
  g.y += g.vy * dt;
  g.z += g.vz * dt;
  if (g.y < 0.08) {
    g.y = 0.08;
    g.vy = -g.vy * GRENADE.bounce;
    g.vx *= 0.7;
    g.vz *= 0.7;
  }
  const b = insideBox(g);
  if (!b) return;
  if (py >= b.h) {
    g.y = b.h + 0.05;
    g.vy = -g.vy * GRENADE.bounce;
    g.vx *= 0.7;
    g.vz *= 0.7;
  } else if (px <= b.x0 || px >= b.x1) {
    g.x = px;
    g.vx = -g.vx * GRENADE.bounce;
  } else {
    g.z = pz;
    g.vz = -g.vz * GRENADE.bounce;
  }
}

export function updateGrenades(world, dt) {
  for (const g of world.grenades) {
    fly(g, dt);
    g.fuse -= dt;
    if (g.fuse <= 0) detonate(world, g);
  }
  world.grenades = world.grenades.filter((g) => g.fuse > 0);
  for (const s of world.smokes) {
    s.life -= dt;
    s.r = Math.min(GRENADE.smokeRadius, s.r + GRENADE.smokeRadius * GRENADE.smokeGrow * dt);
    if (s.life < 2) s.r = Math.max(0, s.r - GRENADE.smokeRadius * dt * 0.6);
  }
  world.smokes = world.smokes.filter((s) => s.life > 0);
  // Lingering zones: fire burns and sedative slows the thrower's enemies; milk speeds and heals
  // the thrower's own side.
  for (const z of world.zones) {
    z.life -= dt;
    const helps = SUPPORT.has(z.kind);
    for (const s of world.soldiers) {
      if (!s.alive || (s.team === z.team) !== helps || Math.hypot(s.pos.x - z.x, s.pos.z - z.z) > z.r || s.pos.y > 2) continue;
      if (z.kind === 'milk') {
        s.boosted = 0.3;
        s.health = Math.min(100, s.health + GRENADE.milkHeal * dt);
      } else if (z.kind === 'slow') s.slowed = 0.3;
      else {
        s.health -= GRENADE.fireDps * dt;
        s.burning = 0.3;
        if (s.health <= 0) killSoldier(world, s, world.soldiers[z.owner], false);
      }
    }
  }
  world.zones = world.zones.filter((z) => z.life > 0);
  updateWalls(world, dt);
}

/**
 * Code walls stand for a while: nobody walks through one (soldiers are pushed back out of it),
 * and shots and sight stop at it (collision.js). The cola behind each heals the first teammate
 * of the thrower to reach it.
 */
function updateWalls(world, dt) {
  for (const w of world.walls) {
    w.life -= dt;
    for (const s of world.soldiers) {
      if (!s.alive || s.pos.y > w.h) continue;
      const rx = s.pos.x - w.x;
      const rz = s.pos.z - w.z;
      const along = rx * w.ux + rz * w.uz;
      if (Math.abs(along) > w.half + MOVE.radius) continue;
      const across = rx * w.uz - rz * w.ux;
      if (Math.abs(across) >= MOVE.radius + 0.1) continue;
      const push = (across >= 0 ? 1 : -1) * (MOVE.radius + 0.1) - across;
      s.pos.x += w.uz * push;
      s.pos.z -= w.ux * push;
    }
  }
  world.walls = world.walls.filter((w) => w.life > 0);
  for (const p of world.pickups) {
    p.life -= dt;
    for (const s of world.soldiers) {
      if (p.life <= 0 || !s.alive || s.team !== p.team || s.health >= 100) continue;
      if (Math.hypot(s.pos.x - p.x, s.pos.z - p.z) > 0.9 || Math.abs(s.pos.y - p.y) > 1) continue;
      s.health = Math.min(100, s.health + GRENADE.colaHeal);
      p.life = 0;
      world.events.push({ type: 'cola', id: s.id, x: p.x, y: p.y, z: p.z });
    }
  }
  world.pickups = world.pickups.filter((p) => p.life > 0);
}

/** Every living enemy of the thrower within r of the blast with a clear line to it. */
function caught(world, g, r, fn) {
  at.x = g.x;
  at.y = g.y + 0.3;
  at.z = g.z;
  for (const s of world.soldiers) {
    if (!s.alive || s.team === g.team) continue;
    eyePos(s, eye);
    const d = Math.hypot(at.x - eye.x, at.y - eye.y, at.z - eye.z);
    if (d <= r && lineOfSight(eye, at, world.smokes, world.walls)) fn(s, d);
  }
}

function detonate(world, g) {
  const owner = world.soldiers[g.owner];
  if (g.kind === 'smoke') world.smokes.push({ x: g.x, y: 1.6, z: g.z, r: 0.5, life: GRENADE.smokeLife });
  else if (g.kind === 'fire') world.zones.push({ kind: 'fire', x: g.x, z: g.z, r: GRENADE.fireRadius, life: GRENADE.fireLife, team: g.team, owner: g.owner });
  else if (g.kind === 'slow') world.zones.push({ kind: 'slow', x: g.x, z: g.z, r: GRENADE.slowRadius, life: GRENADE.slowLife, team: g.team, owner: g.owner });
  else if (g.kind === 'milk') world.zones.push({ kind: 'milk', x: g.x, z: g.z, r: GRENADE.milkRadius, life: GRENADE.milkLife, team: g.team, owner: g.owner });
  else if (g.kind === 'code') {
    // The wall stands across the line from the thrower, the cola a step behind it on their side.
    let nx = g.x - g.fromX;
    let nz = g.z - g.fromZ;
    const n = Math.hypot(nx, nz) || 1;
    nx /= n;
    nz /= n;
    const y = Math.max(0, g.y - 0.1);
    world.walls.push({ x: g.x, z: g.z, y, ux: -nz, uz: nx, half: GRENADE.codeHalf, h: y + GRENADE.codeHeight, life: GRENADE.codeLife, team: g.team });
    world.pickups.push({ kind: 'cola', x: g.x - nx * 1.1, y, z: g.z - nz * 1.1, life: GRENADE.codeLife, team: g.team });
  }
  else if (g.kind === 'frag') {
    caught(world, g, GRENADE.fragRadius, (s, d) => {
      const dmg = GRENADE.fragDamage * (1 - d / GRENADE.fragRadius) * (s.armor > 0 ? 0.6 : 1);
      s.health -= dmg;
      s.lastHurt = world.time;
      world.events.push({ type: 'hit', shooter: g.owner, victim: s.id, head: false, dmg: Math.round(dmg) });
      if (s.health <= 0) killSoldier(world, s, owner, false);
    });
  } else if (g.kind === 'charm') {
    caught(world, g, GRENADE.charmRadius, (s, d) => {
      s.charmed = Math.max(s.charmed, GRENADE.charmTime * (1 - (d / GRENADE.charmRadius) * 0.5));
      s.scoped = false;
    });
  } else if (g.kind === 'flash') {
    // Blinds whoever sees it, more the closer and the more squarely they face it.
    caught(world, g, GRENADE.flashRadius, (s, d) => {
      dirFromAngles(dir, s.yaw, s.pitch);
      eyePos(s, eye);
      const facing = ((at.x - eye.x) * dir.x + (at.y - eye.y) * dir.y + (at.z - eye.z) * dir.z) / Math.max(d, 0.001);
      const strength = (1 - d / GRENADE.flashRadius) * (facing > 0.3 ? 1 : facing > -0.2 ? 0.45 : 0.12);
      s.blind = Math.max(s.blind, GRENADE.flashBlind * strength);
      if (s.brain && strength > 0.3) s.brain.blinded(world);
    });
  }
  world.events.push({ type: 'burst', kind: g.kind, x: g.x, y: g.y, z: g.z, by: g.owner });
  if (!SUPPORT.has(g.kind)) checkCombo(world, g, owner);
}

/**
 * Team combos: COMBO_RULES.count different attack grenades of one team landing together (thrown
 * from anywhere) set off its combo on every enemy near them. Each grenade counts toward one only.
 */
function checkCombo(world, g, owner) {
  const c = COMBOS[g.team];
  world.combo = world.combo.filter((b) => world.time - b.t <= COMBO_RULES.window);
  world.combo.push({ kind: g.kind, x: g.x, z: g.z, t: world.time, team: g.team });
  const near = world.combo.filter((b) => b.team === g.team && Math.hypot(b.x - g.x, b.z - g.z) <= COMBO_RULES.radius);
  const picked = [];
  for (const b of near) if (picked.length < COMBO_RULES.count && !picked.some((p) => p.kind === b.kind)) picked.push(b);
  // Call it out: teammates in range land theirs on the same spot while the window is open.
  if (picked.length < COMBO_RULES.count) {
    world.comboCalls[g.team] = { x: g.x, z: g.z, t: world.time, kinds: near.map((b) => b.kind) };
    return;
  }
  world.comboCalls[g.team] = null;
  world.combo = world.combo.filter((b) => !picked.includes(b));
  let x = 0;
  let z = 0;
  for (const b of picked) {
    x += b.x / picked.length;
    z += b.z / picked.length;
  }
  world.events.push({ type: 'combo', name: c.name, x, z, team: g.team });
  for (const s of world.soldiers) {
    if (!s.alive || s.team === g.team || Math.hypot(s.pos.x - x, s.pos.z - z) > COMBO_RULES.reach) continue;
    s.stunned = c.stun;
    s.scoped = false;
    if (c.strip) {
      s.armor = 0;
      s.grenades = 0;
    }
    s.health -= c.damage;
    s.lastHurt = world.time;
    world.events.push({ type: 'hit', shooter: owner.id, victim: s.id, head: false, dmg: c.damage });
    if (s.health <= 0) killSoldier(world, s, owner, false);
  }
}
