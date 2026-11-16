// Collision against the map's boxes: sliding a soldier's circle around the ones in its way,
// stepping up stairs and ledges below knee height, finding the floor under it, and casting rays
// for bullets and eyesight. A box spans its own bottom to top, so a rail on a tower deck stops a
// bullet only at deck height, and a crouched sniper behind it is hidden.
import { MOVE } from './config.js';
import { SOLIDS } from './map.js';

const EPS = 1e-4;
const BODY_H = 1.75;

function blocks(b, feetY) {
  return b.y0 < feetY + BODY_H && b.h > feetY + MOVE.step;
}

/** Moves a circle at (pos.x, pos.z), feet at pos.y, by (dx, dz), pushing it out of what it hits. */
export function slideCircle(pos, radius, dx, dz) {
  pos.x += dx;
  resolve(pos, radius, true);
  pos.z += dz;
  resolve(pos, radius, false);
}

function resolve(pos, r, alongX) {
  for (let i = 0; i < SOLIDS.length; i++) {
    const b = SOLIDS[i];
    if (pos.x + r <= b.x0 || pos.x - r >= b.x1 || pos.z + r <= b.z0 || pos.z - r >= b.z1) continue;
    if (!blocks(b, pos.y)) continue;
    const cx = pos.x < b.x0 ? b.x0 : pos.x > b.x1 ? b.x1 : pos.x;
    const cz = pos.z < b.z0 ? b.z0 : pos.z > b.z1 ? b.z1 : pos.z;
    const ox = pos.x - cx;
    const oz = pos.z - cz;
    const d2 = ox * ox + oz * oz;
    if (d2 >= r * r) continue;
    if (d2 > EPS) {
      const d = Math.sqrt(d2);
      pos.x = cx + (ox / d) * r;
      pos.z = cz + (oz / d) * r;
    } else if (alongX) {
      pos.x = pos.x - b.x0 < b.x1 - pos.x ? b.x0 - r : b.x1 + r;
    } else {
      pos.z = pos.z - b.z0 < b.z1 - pos.z ? b.z0 - r : b.z1 + r;
    }
  }
}

/**
 * The floor under a circle whose feet are at feetY: the highest box top it stands over that is
 * no more than a step above its feet (0 is the plaza).
 */
export function floorAt(x, z, r, feetY) {
  let floor = 0;
  const rr = r * 0.7;
  for (let i = 0; i < SOLIDS.length; i++) {
    const b = SOLIDS[i];
    if (x + rr <= b.x0 || x - rr >= b.x1 || z + rr <= b.z0 || z - rr >= b.z1) continue;
    if (b.h <= feetY + MOVE.step + EPS && b.h > floor) floor = b.h;
  }
  return floor;
}

/** Distance along a ray (unit dir) to one box, or Infinity. */
export function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(d.x) < EPS) {
    if (o.x < x0 || o.x > x1) return Infinity;
  } else {
    let t1 = (x0 - o.x) / d.x;
    let t2 = (x1 - o.x) / d.x;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(d.y) < EPS) {
    if (o.y < y0 || o.y > y1) return Infinity;
  } else {
    let t1 = (y0 - o.y) / d.y;
    let t2 = (y1 - o.y) / d.y;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(d.z) < EPS) {
    if (o.z < z0 || o.z > z1) return Infinity;
  } else {
    let t1 = (z0 - o.z) / d.z;
    let t2 = (z1 - o.z) / d.z;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

/** The nearest map hit along a ray: writes { t, solid } into out (t = Infinity on a miss). */
export function raycastMap(o, d, maxDist, out) {
  out.t = Infinity;
  out.solid = null;
  if (d.y < -EPS) {
    const tg = -o.y / d.y;
    if (tg <= maxDist) out.t = tg;
  }
  for (let i = 0; i < SOLIDS.length; i++) {
    const b = SOLIDS[i];
    const t = rayBox(o, d, b.x0, b.y0, b.z0, b.x1, b.h, b.z1);
    if (t < out.t && t <= maxDist) {
      out.t = t;
      out.solid = b;
    }
  }
  return out;
}

/** Distance along a ray to where it enters a sphere, or Infinity. */
export function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx;
  const oy = o.y - cy;
  const oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - c;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : c < 0 ? 0 : Infinity;
}

const rayScratch = { x: 0, y: 0, z: 0 };
const hitScratch = { t: Infinity, solid: null };

/** Whether b can be seen from a: no box on the segment and no smoke cloud across it. */
export function lineOfSight(a, b, smokes) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < EPS) return true;
  rayScratch.x = dx / len;
  rayScratch.y = dy / len;
  rayScratch.z = dz / len;
  raycastMap(a, rayScratch, len, hitScratch);
  if (hitScratch.t < len - 0.05) return false;
  if (smokes) {
    for (let i = 0; i < smokes.length; i++) {
      const s = smokes[i];
      if (s.r <= 0.5) continue;
      if (raySphere(a, rayScratch, s.x, s.y, s.z, s.r * 0.85) < len) return false;
    }
  }
  return true;
}
