// Small vector helpers on plain {x, y, z} objects. The simulation keeps its own math so it runs
// without three.js (the balance tool plays whole matches in Node). Functions write into an `out`
// argument where a result is a vector, so hot loops reuse objects instead of making new ones.

export function vec(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function set(out, x, y, z) {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

export function copy(out, a) {
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  return out;
}

export function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Unit direction for a yaw (0 looks toward -z) and pitch (positive looks up). */
export function dirFromAngles(out, yaw, pitch) {
  const c = Math.cos(pitch);
  out.x = -Math.sin(yaw) * c;
  out.y = Math.sin(pitch);
  out.z = -Math.cos(yaw) * c;
  return out;
}

/** The yaw that faces from a toward b on the ground plane. */
export function yawTo(a, b) {
  return Math.atan2(-(b.x - a.x), -(b.z - a.z));
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
