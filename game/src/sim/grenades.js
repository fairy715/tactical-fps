// Thrown gear: the talc bomb blooms into a smoke cloud that blocks every line of sight through it,
// and the camera flash blinds whoever is facing it with a clear view. Both fly as simple bodies
// that bounce off the plaza and the boxes until their fuse runs out.
import { GRENADE } from './config.js';
import { eyePos } from './actors.js';
import { lineOfSight } from './collision.js';
import { SOLIDS } from './map.js';
import { dirFromAngles } from './vec.js';

const dir = { x: 0, y: 0, z: 0 };
const eye = { x: 0, y: 0, z: 0 };

export function throwGrenade(world, s, kind) {
  if (kind === 'smoke' ? s.smokes <= 0 : s.flashes <= 0) return false;
  if (kind === 'smoke') s.smokes -= 1;
  else s.flashes -= 1;
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
    fuse: GRENADE.fuse,
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

export function updateGrenades(world, dt) {
  for (const g of world.grenades) {
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
    if (b) {
      // Bounce off whichever face it came through.
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
}

function detonate(world, g) {
  if (g.kind === 'smoke') {
    world.smokes.push({ x: g.x, y: 1.6, z: g.z, r: 0.5, life: GRENADE.smokeLife });
    world.events.push({ type: 'smoke', x: g.x, y: g.y, z: g.z });
    return;
  }
  // Camera flash: blinds whoever sees it, more the closer and the more squarely they face it.
  const at = { x: g.x, y: g.y + 0.3, z: g.z };
  for (const s of world.soldiers) {
    if (!s.alive) continue;
    eyePos(s, eye);
    const d = Math.hypot(at.x - eye.x, at.y - eye.y, at.z - eye.z);
    if (d > GRENADE.flashRadius || !lineOfSight(eye, at, world.smokes)) continue;
    dirFromAngles(dir, s.yaw, s.pitch);
    const facing = ((at.x - eye.x) * dir.x + (at.y - eye.y) * dir.y + (at.z - eye.z) * dir.z) / Math.max(d, 0.001);
    const strength = (1 - d / GRENADE.flashRadius) * (facing > 0.3 ? 1 : facing > -0.2 ? 0.45 : 0.12);
    s.blind = Math.max(s.blind, GRENADE.flashBlind * strength);
    if (s.brain && strength > 0.3) s.brain.blinded(world);
  }
  world.events.push({ type: 'flash', x: g.x, y: g.y, z: g.z });
}
