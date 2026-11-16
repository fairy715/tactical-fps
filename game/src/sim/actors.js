// Soldiers: the player and the bots are the same kind of object, moved by the same physics from an
// intent (where to go, crouch, walk, jump, scope). Movement accelerates, slides along walls,
// climbs stairs and falls off ledges; a crouched, walking or scoped soldier is slower and steadier.
import { GRENADE, HITBOX, MODELS, MOVE, ROLES } from './config.js';
import { floorAt, slideCircle } from './collision.js';
import { createGun } from './weapons.js';

export function createSoldier(id, team, roleId, isPlayer) {
  const role = ROLES[roleId];
  return {
    id,
    team,
    role,
    name: role.name,
    isPlayer,
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    recoilPitch: 0,
    recoilYaw: 0,
    crouch: 0, // 0 standing .. 1 fully crouched
    walking: false,
    scoped: false,
    onGround: true,
    health: 100,
    armor: 0,
    alive: true,
    money: 0,
    gun: createGun(MODELS.standard),
    grenades: 0, // the career's own grenade, two at most
    blind: 0, // seconds of photocopier flash left
    slowed: 0, // seconds of sedative left
    boosted: 0, // seconds of milk-puddle speed left
    charmed: 0, // seconds of rose-bouquet charm left: no shooting
    stunned: 0, // seconds of Staff Meeting left: no moving, no shooting
    burning: 0,
    hasBomb: false,
    kills: 0,
    deaths: 0,
    headshots: 0,
    roundKills: 0,
    stepClock: 0,
    lastHurt: -99,
    hurtFrom: { x: 0, z: 0 },
    action: null, // 'plant' | 'defuse' while the use key is held
    killedBy: null, // the killer's role id, for the finishing gag
    deathTime: 0,
    brain: null,
  };
}

/** Puts a soldier at a spawn for a new round; one who died loses the rifle model and gear. */
export function respawn(s, x, z, yaw, survived) {
  s.pos.x = x;
  s.pos.y = 0;
  s.pos.z = z;
  s.vel.x = s.vel.y = s.vel.z = 0;
  s.yaw = yaw;
  s.pitch = 0;
  s.recoilPitch = s.recoilYaw = 0;
  s.crouch = 0;
  s.scoped = false;
  s.health = 100;
  s.alive = true;
  s.onGround = true;
  s.action = null;
  s.killedBy = null;
  s.roundKills = 0;
  s.hasBomb = false;
  s.blind = s.slowed = s.boosted = s.charmed = s.stunned = s.burning = 0;
  if (!survived) {
    s.gun = createGun(MODELS.standard);
    s.armor = 0;
    s.grenades = 0;
  } else {
    s.gun.reloading = 0;
    s.gun.cooldown = 0;
  }
}

export function eyeHeight(s) {
  return MOVE.eyeStand + (MOVE.eyeCrouch - MOVE.eyeStand) * s.crouch;
}

/** Writes the eye position into out. */
export function eyePos(s, out) {
  out.x = s.pos.x;
  out.y = s.pos.y + eyeHeight(s);
  out.z = s.pos.z;
  return out;
}

/** Top of the body box and centre of the head sphere for the current stance, written into out. */
export function hitShape(s, out) {
  out.top = s.pos.y + HITBOX.standTop + (HITBOX.crouchTop - HITBOX.standTop) * s.crouch;
  out.headY = out.top + HITBOX.headRadius * 0.9;
  return out;
}

/**
 * One physics step. intent: { fwd, side (each -1..1), crouch, walk, jump }. Speed depends on stance,
 * the scope and the rifle. Returns true when a footstep sounds (running on the ground).
 */
export function moveSoldier(s, intent, dt) {
  s.crouch += ((intent.crouch ? 1 : 0) - s.crouch) * Math.min(1, dt * 10);
  s.walking = !!intent.walk;
  let top = MOVE.speed * s.gun.def.mobility;
  if (intent.crouch) top *= MOVE.crouchMul;
  else if (intent.walk) top *= MOVE.walkMul;
  if (s.scoped) top *= MOVE.scopedMul;
  if (s.slowed > 0) top *= GRENADE.slowMul;
  if (s.boosted > 0) top *= GRENADE.milkSpeed;
  if (s.action || s.stunned > 0) top = 0;

  const sin = Math.sin(s.yaw);
  const cos = Math.cos(s.yaw);
  let wx = -sin * intent.fwd + cos * intent.side;
  let wz = -cos * intent.fwd - sin * intent.side;
  const wl = Math.hypot(wx, wz);
  if (wl > 1) {
    wx /= wl;
    wz /= wl;
  }
  if (s.onGround) {
    // Friction first, so letting go of the keys stops you quickly: stopping to aim pays.
    const sp = Math.hypot(s.vel.x, s.vel.z);
    if (sp > 0) {
      const k = Math.max(0, sp - sp * MOVE.friction * dt) / sp;
      s.vel.x *= k;
      s.vel.z *= k;
    }
  }
  const ax = wx * top - s.vel.x;
  const az = wz * top - s.vel.z;
  const al = Math.hypot(ax, az);
  const maxA = MOVE.accel * (s.onGround ? 1 : MOVE.airControl) * dt;
  if (al > 0 && (wl > 0.01 || s.onGround)) {
    const k = Math.min(1, maxA / al);
    s.vel.x += ax * k;
    s.vel.z += az * k;
  }
  if (intent.jump && s.onGround && s.crouch < 0.5 && !s.action) {
    s.vel.y = MOVE.jumpSpeed;
    s.onGround = false;
  }

  const beforeX = s.pos.x;
  const beforeZ = s.pos.z;
  slideCircle(s.pos, MOVE.radius, s.vel.x * dt, s.vel.z * dt);
  if (dt > 0) {
    s.vel.x = (s.pos.x - beforeX) / dt;
    s.vel.z = (s.pos.z - beforeZ) / dt;
  }

  // Floors: step up stairs, follow them down, fall off a ledge.
  const floor = floorAt(s.pos.x, s.pos.z, MOVE.radius, s.pos.y);
  if (s.onGround) {
    if (floor >= s.pos.y - 0.6) s.pos.y = floor;
    else {
      s.onGround = false;
      s.vel.y = 0;
    }
  }
  if (!s.onGround) {
    s.vel.y -= MOVE.gravity * dt;
    s.pos.y += s.vel.y * dt;
    if (s.pos.y <= floor) {
      s.pos.y = floor;
      s.vel.y = 0;
      s.onGround = true;
    }
  }

  const speed = Math.hypot(s.vel.x, s.vel.z);
  if (s.onGround && speed > 2.6 && !intent.walk && !intent.crouch) {
    s.stepClock += speed * dt;
    if (s.stepClock > 2.2) {
      s.stepClock = 0;
      return true;
    }
  }
  return false;
}
