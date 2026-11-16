// Shots and damage. A shot is a ray from the shooter's eye: the first thing it meets, a wall, a
// rail, a crate or a soldier's head or body, takes it. A head takes the rifle's head multiplier;
// armour soaks what the rifle does not penetrate. A kill pays the killer and remembers the
// killer's career, so the victim plays that career's finishing gag.
import { HITBOX, MODELS } from './config.js';
import { eyePos, hitShape } from './actors.js';
import { raycastMap, rayBox, raySphere } from './collision.js';

const eye = { x: 0, y: 0, z: 0 };
const mapHit = { t: Infinity, solid: null };
const shape = { top: 0, headY: 0 };
const MAX_RANGE = 220;

/**
 * Traces one shot from s along dir. Writes into out: { t, victim, head, x, y, z } (victim null when
 * the shot hit the map or nothing). Ignores the shooter and the dead.
 */
export function traceShot(world, s, dir, out) {
  eyePos(s, eye);
  raycastMap(eye, dir, MAX_RANGE, mapHit);
  let best = mapHit.t;
  out.victim = null;
  out.head = false;
  for (const o of world.soldiers) {
    // No friendly fire: a teammate in the way is shot past.
    if (o === s || !o.alive || o.team === s.team) continue;
    hitShape(o, shape);
    const th = raySphere(eye, dir, o.pos.x, shape.headY, o.pos.z, HITBOX.headRadius);
    if (th < best) {
      best = th;
      out.victim = o;
      out.head = true;
    }
    const half = HITBOX.bodyHalf;
    const tb = rayBox(eye, dir, o.pos.x - half, o.pos.y, o.pos.z - half, o.pos.x + half, shape.top, o.pos.z + half);
    if (tb < best) {
      best = tb;
      out.victim = o;
      out.head = false;
    }
  }
  const t = Math.min(best, MAX_RANGE);
  out.t = t;
  out.x = eye.x + dir.x * t;
  out.y = eye.y + dir.y * t;
  out.z = eye.z + dir.z * t;
  out.sx = eye.x;
  out.sy = eye.y;
  out.sz = eye.z;
  return out;
}

/** Applies a rifle hit to a victim; kills, pays and reports it. */
export function applyHit(world, shooter, victim, head, def) {
  let dmg = def.dmg * (head ? def.head : 1);
  if (victim.armor > 0) {
    const soaked = dmg * (1 - def.pen);
    dmg -= soaked;
    victim.armor = Math.max(0, victim.armor - soaked * 1.5);
  }
  dmg = Math.round(dmg);
  victim.health -= dmg;
  victim.lastHurt = world.time;
  victim.hurtFrom.x = shooter.pos.x;
  victim.hurtFrom.z = shooter.pos.z;
  world.events.push({ type: 'hit', shooter: shooter.id, victim: victim.id, head, dmg });
  if (victim.brain) victim.brain.alertAt(world, shooter.pos.x, shooter.pos.z, shooter.pos.y);
  if (victim.health <= 0) killSoldier(world, victim, shooter, head);
}

/** A soldier falls. killer may be null, with cause naming what did it ('blast', 'ring'). */
export function killSoldier(world, victim, killer, head, cause = 'blast') {
  victim.health = 0;
  victim.alive = false;
  victim.deaths += 1;
  victim.scoped = false;
  victim.action = null;
  victim.deathTime = world.time;
  victim.killedBy = killer ? killer.role.finisher : cause;
  if (victim.hasBomb) world.dropBomb(victim);
  if (killer && killer.team !== victim.team) {
    killer.kills += 1;
    killer.roundKills += 1;
    if (head) killer.headshots += 1;
    killer.money = Math.min(world.economy.max, killer.money + (killer.gun.def.reward || MODELS.standard.reward));
  }
  world.events.push({ type: 'kill', killer: killer ? killer.id : null, victim: victim.id, head, finisher: victim.killedBy, x: victim.pos.x, y: victim.pos.y, z: victim.pos.z });
}
