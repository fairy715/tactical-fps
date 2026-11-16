// Six sniper rifles. Each is a real bolt-action build (a shaped stock with cheek rest, pistol grip
// and fore-end, receiver and bolt, fluted barrel, muzzle brake, scope on rings with turrets,
// magazine, trigger guard and a folded bipod) finished and fitted for its owner's career: the
// Boss's black lacquer and gold with a fountain-pen nib for a muzzle; the Playboy's pearl and
// chrome with a heart in the stock; the Chef's walnut with a pepper-mill crown; the Teacher's oak
// with a chalkboard inlay and a pointer fore-end; the Office Lady's stapler-blue stock with binder
// clips for scope rings; the Nurse's white medical polymer with a graduated syringe barrel and a
// needle. Each points down -z with the grip at the origin; metal and wood keep physical shading.
import * as THREE from 'three';

const mats = new Map();
function mat(color, metalness, roughness, extra) {
  const key = `${color}|${metalness}|${roughness}|${extra ? JSON.stringify(extra) : ''}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra }));
  return mats.get(key);
}

const steel = () => mat('#3a3d42', 0.9, 0.32);
const blued = () => mat('#1d2026', 0.85, 0.38);

function add(group, geo, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.userData.pbr = true;
  group.add(m);
  return m;
}

/** A cylinder lying along z. */
function tube(group, r1, r2, len, material, x, y, z, seg = 18) {
  return add(group, new THREE.CylinderGeometry(r1, r2, len, seg), material, x, y, z, Math.PI / 2);
}

/** The stock's side profile (butt, cheek rest, pistol grip, fore-end) extruded to its width. */
function stockGeometry(width) {
  const s = new THREE.Shape();
  // Points are (z, y) with +z toward the butt; the shape is drawn in x/y then turned onto z.
  const p = [
    [0.44, 0.03], [0.44, -0.11], [0.3, -0.07], [0.12, -0.05], [0.07, -0.13], [0.03, -0.14],
    [0.0, -0.05], [-0.04, -0.03], [-0.36, -0.025], [-0.38, 0.0], [-0.36, 0.02], [0.06, 0.02],
    [0.14, 0.05], [0.3, 0.06], [0.42, 0.05],
  ];
  s.moveTo(p[0][0], p[0][1]);
  for (const [z, y] of p.slice(1)) s.lineTo(z, y);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

function heartShape(size) {
  const h = new THREE.Shape();
  h.moveTo(0, -size);
  h.bezierCurveTo(size * 1.2, -size * 0.2, size * 0.9, size * 0.9, 0, size * 0.35);
  h.bezierCurveTo(-size * 0.9, size * 0.9, -size * 1.2, -size * 0.2, 0, -size);
  return h;
}

/**
 * The common bolt-action, finished by `f`: stock, metal, scope, accent colours and which barrel and
 * muzzle to build. Returns the group so a career can add its signature parts.
 */
function rifle(f) {
  const g = new THREE.Group();
  add(g, stockGeometry(0.056), f.stock, 0, 0, 0);
  // Receiver, bolt and handle.
  add(g, new THREE.BoxGeometry(0.05, 0.05, 0.26), f.metal, 0, 0.045, -0.03);
  tube(g, 0.012, 0.012, 0.2, steel(), 0.0, 0.06, 0.02);
  add(g, new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), steel(), 0.04, 0.05, 0.07, 0, 0, Math.PI / 2.4);
  add(g, new THREE.SphereGeometry(0.012, 12, 10), f.accent, 0.065, 0.04, 0.07);
  // Trigger, guard and magazine.
  add(g, new THREE.TorusGeometry(0.03, 0.005, 6, 16, Math.PI), f.metal, 0, -0.02, 0.035, 0, Math.PI / 2, Math.PI);
  add(g, new THREE.BoxGeometry(0.008, 0.03, 0.01), steel(), 0, -0.02, 0.03, 0.3);
  add(g, new THREE.BoxGeometry(0.04, 0.07, 0.07), f.metal, 0, -0.04, -0.06);
  // Barrel: fluted, then the muzzle.
  if (!f.noBarrel) {
    tube(g, 0.012, 0.016, 0.62, f.barrel || blued(), 0, 0.045, -0.47);
    for (let i = 0; i < 4; i++) tube(g, 0.0165, 0.0165, 0.02, f.accent, 0, 0.045, -0.24 - i * 0.12, 12);
  }
  if (!f.noMuzzle) {
    tube(g, 0.02, 0.02, 0.07, f.metal, 0, 0.045, -0.8);
    for (const x of [-0.021, 0.021]) add(g, new THREE.BoxGeometry(0.004, 0.012, 0.04), steel(), x, 0.045, -0.8);
  }
  // Scope: tube, bells, turrets, rings on bases.
  const sy = 0.12;
  tube(g, 0.02, 0.02, 0.3, f.scope, 0, sy, -0.05);
  tube(g, 0.032, 0.022, 0.08, f.scope, 0, sy, -0.23);
  tube(g, 0.026, 0.02, 0.06, f.scope, 0, sy, 0.12);
  tube(g, 0.029, 0.029, 0.004, mat('#7fd6ff', 0.3, 0.05, { emissive: '#163a52' }), 0, sy, -0.272);
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12), f.accent, 0, sy + 0.03, -0.05);
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12), f.accent, 0.03, sy, -0.05, 0, 0, Math.PI / 2);
  for (const z of [-0.12, 0.04]) {
    if (f.clips) continue;
    add(g, new THREE.TorusGeometry(0.023, 0.006, 8, 18), f.rings || f.metal, 0, sy, z);
    add(g, new THREE.BoxGeometry(0.02, 0.045, 0.02), f.rings || f.metal, 0, (sy + 0.05) / 2 + 0.01, z);
  }
  // Folded bipod under the fore-end.
  for (const x of [-0.018, 0.018]) add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.2, 8), steel(), x, -0.035, -0.26, Math.PI / 2);
  return g;
}

/** A badge on the fore-end's left flank, the side a first-person view sees. */
function flank(g, geo, material, z, y = -0.004) {
  return add(g, geo, material, -0.034, y, z, 0, -Math.PI / 2);
}

const BUILD = {
  boss() {
    const gold = mat('#d9b44a', 1, 0.22);
    const g = rifle({ stock: mat('#121318', 0.3, 0.18), metal: mat('#16171c', 0.9, 0.25), accent: gold, scope: mat('#121318', 0.6, 0.25), rings: gold, noMuzzle: true });
    // The muzzle is a fountain-pen nib, slit and breather hole, and a pen clip runs the barrel.
    const nib = add(g, new THREE.ConeGeometry(0.024, 0.12, 4), gold, 0, 0.045, -0.84, -Math.PI / 2, 0, Math.PI / 4);
    nib.scale.set(1, 1, 0.45);
    add(g, new THREE.BoxGeometry(0.003, 0.002, 0.07), mat('#111', 0.5, 0.5), 0, 0.054, -0.85);
    add(g, new THREE.BoxGeometry(0.008, 0.012, 0.3), gold, 0, 0.068, -0.5);
    add(g, new THREE.TorusGeometry(0.03, 0.006, 8, 20), gold, 0, 0.0, 0.43);
    // An engraved gold nameplate and inlay lines down the fore-end.
    flank(g, new THREE.BoxGeometry(0.12, 0.026, 0.003), gold, -0.2);
    for (const z of [-0.31, -0.09]) flank(g, new THREE.BoxGeometry(0.006, 0.03, 0.003), gold, z);
    return g;
  },
  playboy() {
    const chrome = mat('#e4e8ee', 1, 0.08);
    const g = rifle({ stock: mat('#f6efe9', 0.2, 0.25), metal: chrome, accent: mat('#e2385d', 0.4, 0.3), scope: mat('#f2a7c0', 0.5, 0.3), barrel: chrome });
    const heart = add(g, new THREE.ExtrudeGeometry(heartShape(0.06), { depth: 0.012, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.004, bevelSegments: 2 }), mat('#e2385d', 0.3, 0.25, { emissive: '#3a0510' }), 0.03, -0.02, 0.26, 0, Math.PI / 2);
    heart.scale.setScalar(1.3);
    add(g, heart.geometry, heart.material, -0.042, -0.02, 0.26, 0, -Math.PI / 2).scale.setScalar(1.3);
    // A smaller heart and a chrome band on the fore-end flank.
    flank(g, heart.geometry, heart.material, -0.2, -0.006).scale.setScalar(0.45);
    flank(g, new THREE.BoxGeometry(0.012, 0.034, 0.003), mat('#e4e8ee', 1, 0.08), -0.32);
    return g;
  },
  chef() {
    const brass = mat('#c9a14a', 1, 0.28);
    const g = rifle({ stock: mat('#5e3a20', 0.05, 0.45), metal: steel(), accent: brass, scope: mat('#2a2622', 0.6, 0.3), noMuzzle: true });
    // A pepper-mill crown for the muzzle brake, knob and all.
    const crown = new THREE.LatheGeometry([[0.012, 0], [0.03, 0.01], [0.032, 0.05], [0.024, 0.07], [0.014, 0.09], [0.008, 0.1]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
    add(g, crown, mat('#5e3a20', 0.05, 0.4), 0, 0.045, -0.78, -Math.PI / 2);
    add(g, new THREE.SphereGeometry(0.014, 12, 10), brass, 0, 0.045, -0.885);
    add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.012, 14), brass, 0, 0.152, -0.05);
    // A butcher's-block checker on the fore-end and brass rivets.
    for (let i = 0; i < 6; i++) flank(g, new THREE.BoxGeometry(0.018, 0.012, 0.003), mat(i % 2 ? '#f4efe6' : '#b8322c', 0.05, 0.5), -0.27 + i * 0.018, 0.0);
    for (let i = 0; i < 6; i++) flank(g, new THREE.BoxGeometry(0.018, 0.012, 0.003), mat(i % 2 ? '#b8322c' : '#f4efe6', 0.05, 0.5), -0.27 + i * 0.018, -0.012);
    for (const z of [-0.06, -0.33]) flank(g, new THREE.SphereGeometry(0.006, 8, 6), brass, z);
    return g;
  },
  teacher() {
    const g = rifle({ stock: mat('#a57a45', 0.05, 0.5), metal: blued(), accent: mat('#c4362c', 0.2, 0.4), scope: mat('#2e4a36', 0.5, 0.3) });
    // A chalkboard inlaid in each side of the butt, and the fore-end as a pointer with a red tip.
    for (const x of [0.03, -0.03]) add(g, new THREE.BoxGeometry(0.004, 0.08, 0.16), mat('#2f5a42', 0, 0.9), x, -0.02, 0.32);
    add(g, new THREE.BoxGeometry(0.0042, 0.004, 0.11), mat('#f4f1e6', 0, 0.9), 0.031, 0.0, 0.33);
    tube(g, 0.012, 0.016, 0.4, mat('#b58a52', 0.05, 0.5), 0, 0.01, -0.5);
    add(g, new THREE.SphereGeometry(0.014, 12, 10), mat('#c4362c', 0.1, 0.5), 0, 0.01, -0.705);
    // A slate on the fore-end with a chalk tick and a ruler's marks along its edge.
    flank(g, new THREE.BoxGeometry(0.15, 0.032, 0.003), mat('#2f5a42', 0, 0.9), -0.19);
    flank(g, new THREE.BoxGeometry(0.03, 0.004, 0.004), mat('#f4f1e6', 0, 0.9), -0.2, 0.0).rotation.x = 0.6;
    flank(g, new THREE.BoxGeometry(0.05, 0.004, 0.004), mat('#f4f1e6', 0, 0.9), -0.17, 0.004).rotation.x = -0.5;
    for (let i = 0; i < 8; i++) flank(g, new THREE.BoxGeometry(0.002, i % 2 ? 0.006 : 0.01, 0.003), mat('#3a2a1a', 0, 0.8), -0.33 + i * 0.03, -0.024);
    return g;
  },
  office() {
    const blue = mat('#3e5c99', 0.45, 0.3);
    const clip = mat('#121214', 0.7, 0.3);
    const g = rifle({ stock: blue, metal: mat('#2b3442', 0.85, 0.3), accent: mat('#c9ccd2', 1, 0.2), scope: clip, clips: true, noMuzzle: true });
    // Binder clips hold the scope; the stapler's top arm rides over the receiver; a staple brake.
    for (const z of [-0.12, 0.04]) {
      add(g, new THREE.ConeGeometry(0.03, 0.045, 3), clip, 0, 0.088, z, 0, 0, Math.PI);
      add(g, new THREE.TorusGeometry(0.02, 0.003, 6, 12, Math.PI), mat('#c9ccd2', 1, 0.2), 0, 0.12, z);
    }
    add(g, new THREE.BoxGeometry(0.058, 0.022, 0.38), blue, 0, 0.078, -0.06, 0.03);
    // A yellow sticky note slapped on the fore-end, scribbled on.
    flank(g, new THREE.BoxGeometry(0.05, 0.04, 0.002), mat('#ffe066', 0, 0.8), -0.2);
    for (const y of [0.006, -0.004]) flank(g, new THREE.BoxGeometry(0.034, 0.003, 0.003), mat('#3b4a7a', 0, 0.8), -0.2, y);
    add(g, new THREE.BoxGeometry(0.044, 0.004, 0.05), mat('#c9ccd2', 1, 0.2), 0, 0.045, -0.82);
    for (const x of [-0.02, 0.02]) add(g, new THREE.BoxGeometry(0.004, 0.03, 0.05), mat('#c9ccd2', 1, 0.2), x, 0.033, -0.82);
    return g;
  },
  nurse() {
    const white = mat('#f3f6f8', 0.15, 0.35);
    const g = rifle({ stock: white, metal: mat('#b9c2ca', 0.9, 0.25), accent: mat('#41b6c8', 0.3, 0.35), scope: white, noBarrel: true, noMuzzle: true });
    // The barrel is a graduated syringe with a dose in it, ending in a needle; a red cross on the stock.
    tube(g, 0.026, 0.026, 0.5, mat('#e9f6ff', 0, 0.05, { transparent: true, opacity: 0.45 }), 0, 0.045, -0.42);
    tube(g, 0.02, 0.02, 0.36, mat('#55d3c6', 0.1, 0.2, { emissive: '#0d4a44' }), 0, 0.045, -0.47);
    for (let i = 0; i < 6; i++) tube(g, 0.0262, 0.0262, 0.003, mat('#2d6f8a', 0, 0.5), 0, 0.045, -0.24 - i * 0.06, 12);
    tube(g, 0.008, 0.012, 0.05, white, 0, 0.045, -0.69);
    tube(g, 0.002, 0.002, 0.18, steel(), 0, 0.045, -0.8, 8);
    for (const x of [0.031, -0.031]) {
      add(g, new THREE.BoxGeometry(0.003, 0.06, 0.018), mat('#e2384d', 0.1, 0.4), x, -0.03, 0.3);
      add(g, new THREE.BoxGeometry(0.003, 0.018, 0.06), mat('#e2384d', 0.1, 0.4), x, -0.03, 0.3);
    }
    flank(g, new THREE.BoxGeometry(0.036, 0.012, 0.003), mat('#e2384d', 0.1, 0.4), -0.2, -0.002);
    flank(g, new THREE.BoxGeometry(0.012, 0.036, 0.003), mat('#e2384d', 0.1, 0.4), -0.2, -0.002);
    return g;
  },
};

/** A new rifle for a career. */
export function buildGun(roleId) {
  return BUILD[roleId]();
}
