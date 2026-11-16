// Sniper rifles: magazine, reserve, bolt or semi-auto cycle, reload, and where each shot really
// goes. Scoped and still, a rifle puts the round on the crosshair; from the hip, on the move or in
// the air it scatters wide. Each shot kicks the view up, and the kick settles while the bolt cycles.
import { dirFromAngles } from './vec.js';

export function createGun(def) {
  return { def, mag: def.mag, reserve: def.reserve, cooldown: 0, reloading: 0, sinceShot: 9 };
}

export function startReload(gun) {
  if (gun.reloading > 0 || gun.mag >= gun.def.mag || gun.reserve <= 0) return false;
  gun.reloading = gun.def.reload;
  return true;
}

/** Advances the gun's timers; a finished reload moves rounds from reserve to magazine. */
export function tickGun(gun, dt) {
  gun.cooldown = Math.max(0, gun.cooldown - dt);
  gun.sinceShot += dt;
  if (gun.reloading > 0) {
    gun.reloading -= dt;
    if (gun.reloading <= 0) {
      gun.reloading = 0;
      const take = Math.min(gun.def.mag - gun.mag, gun.reserve);
      gun.mag += take;
      gun.reserve -= take;
      return 'reloaded';
    }
  }
  return null;
}

/** Lets a soldier's view kick settle back toward the aim. */
export function settleRecoil(s, dt) {
  const k = Math.exp(-dt * (s.gun.sinceShot < 0.1 ? 2 : 6));
  s.recoilPitch *= k;
  s.recoilYaw *= k;
}

/** The spread (radians) a shot would have right now. */
export function currentSpread(s) {
  const def = s.gun.def;
  const speed = Math.hypot(s.vel.x, s.vel.z);
  let spread = (s.scoped ? def.spread : def.hip) + speed * def.moveSpread;
  if (!s.onGround) spread += 0.12;
  spread *= 1 - 0.3 * s.crouch;
  return spread;
}

/** Fires if it can: spends a round, kicks the view and writes the shot's direction into dir. */
export function fireGun(s, rng, dir) {
  const gun = s.gun;
  if (gun.cooldown > 0 || gun.reloading > 0 || gun.mag <= 0) return false;
  const spread = currentSpread(s);
  const r = spread * Math.sqrt(rng.next());
  const a = rng.next() * Math.PI * 2;
  dirFromAngles(dir, s.yaw + s.recoilYaw + Math.cos(a) * r, s.pitch + s.recoilPitch + Math.sin(a) * r);
  gun.mag -= 1;
  gun.cooldown = 60 / gun.def.rpm;
  gun.sinceShot = 0;
  s.recoilPitch += gun.def.kick * (0.85 + 0.3 * rng.next());
  s.recoilYaw += rng.gauss() * gun.def.kick * 0.2;
  return true;
}
