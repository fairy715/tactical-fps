// Each career's signature grenade, flown as a simple body that bounces off the plaza and the boxes
// until its fuse runs out, then: chalk smoke that blocks sight, a photocopier flash that blinds,
// a sedative gas that slows and unscopes, a money bag that explodes, a rose bouquet that charms
// enemies out of shooting, or a flaming pan that sets the ground alight. A kill by a grenade
// counts for its thrower, finisher and all.
import { COMBOS, COMBO_RULES, GRENADE, GRENADES } from './config.js';
import { eyePos } from './actors.js';
import { killSoldier } from './combat.js';
import { lineOfSight } from './collision.js';
import { SOLIDS } from './map.js';
import { dirFromAngles } from './vec.js';

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
    fuse: kind === 'fire' || kind === 'slow' ? 1.1 : GRENADE.fuse,
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
  // Lingering zones: fire burns, sedative slows; enemies of the thrower only.
  for (const z of world.zones) {
    z.life -= dt;
    for (const s of world.soldiers) {
      if (!s.alive || s.team === z.team || Math.hypot(s.pos.x - z.x, s.pos.z - z.z) > z.r || s.pos.y > 2) continue;
      if (z.kind === 'slow') s.slowed = 0.3;
      else {
        s.health -= GRENADE.fireDps * dt;
        s.burning = 0.3;
        if (s.health <= 0) killSoldier(world, s, world.soldiers[z.owner], false);
      }
    }
  }
  world.zones = world.zones.filter((z) => z.life > 0);
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
    if (d <= r && lineOfSight(eye, at, world.smokes)) fn(s, d);
  }
}

function detonate(world, g) {
  const owner = world.soldiers[g.owner];
  if (g.kind === 'smoke') world.smokes.push({ x: g.x, y: 1.6, z: g.z, r: 0.5, life: GRENADE.smokeLife });
  else if (g.kind === 'fire') world.zones.push({ kind: 'fire', x: g.x, z: g.z, r: GRENADE.fireRadius, life: GRENADE.fireLife, team: g.team, owner: g.owner });
  else if (g.kind === 'slow') world.zones.push({ kind: 'slow', x: g.x, z: g.z, r: GRENADE.slowRadius, life: GRENADE.slowLife, team: g.team, owner: g.owner });
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
  if (COMBOS[g.team].kinds.includes(g.kind)) checkCombo(world, g, owner);
}

/**
 * Team combos: a team's three grenades landing together (thrown from anywhere) set off its combo
 * on every enemy near them. Each grenade counts toward one combo only.
 */
function checkCombo(world, g, owner) {
  const c = COMBOS[g.team];
  world.combo = world.combo.filter((b) => world.time - b.t <= COMBO_RULES.window);
  world.combo.push({ kind: g.kind, x: g.x, z: g.z, t: world.time, team: g.team });
  const near = world.combo.filter((b) => b.team === g.team && Math.hypot(b.x - g.x, b.z - g.z) <= COMBO_RULES.radius);
  const picked = c.kinds.map((k) => near.find((b) => b.kind === k));
  // Call it out: teammates in range land theirs on the same spot while the window is open.
  if (picked.some((b) => !b)) {
    world.comboCalls[g.team] = { x: g.x, z: g.z, t: world.time, kinds: near.map((b) => b.kind) };
    return;
  }
  world.comboCalls[g.team] = null;
  world.combo = world.combo.filter((b) => !picked.includes(b));
  const x = (picked[0].x + picked[1].x + picked[2].x) / 3;
  const z = (picked[0].z + picked[1].z + picked[2].z) / 3;
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
