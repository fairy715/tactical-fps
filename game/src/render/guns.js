// Six sniper rifles. Each is a real bolt-action build (a shaped stock with cheek rest, pistol grip
// and fore-end, receiver and bolt, fluted barrel, muzzle brake, scope on rings with turrets,
// magazine, trigger guard and a folded bipod) kitted out for its owner's career: the Boss's black
// lacquer, gold-plated barrel, fountain-pen nib and a roll of cash; the Playboy's pearl and chrome
// with a heart front sight and a rose tied along the barrel; the Chef's walnut with a pepper-mill
// crown and a knife and carving fork lashed on; the Teacher's oak with a pointer cane past the
// muzzle and a chalk tray; the Office Lady's stapler-blue stock with binder clips, sticky notes and
// her staff ID on a lanyard; the Nurse's white polymer with a graduated syringe barrel and needle.
// Each points down -z with the grip at the origin; metal and wood keep physical shading.
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

/** Twine lashing something to the rifle: a short dark band across the flank. */
function lash(g, z, y = 0.0, h = 0.07) {
  add(g, new THREE.BoxGeometry(0.008, h, 0.008), mat('#8a6a3c', 0, 0.9), -0.046, y, z);
}

const BUILD = {
  boss() {
    const gold = mat('#d9b44a', 1, 0.2);
    const g = rifle({ stock: mat('#121318', 0.3, 0.18), metal: mat('#16171c', 0.9, 0.25), accent: gold, scope: mat('#121318', 0.6, 0.25), rings: gold, barrel: gold, noMuzzle: true });
    // The muzzle is a fountain-pen nib, slit and breather hole, on a gold-plated barrel.
    const nib = add(g, new THREE.ConeGeometry(0.024, 0.12, 4), gold, 0, 0.045, -0.84, -Math.PI / 2, 0, Math.PI / 4);
    nib.scale.set(1, 1, 0.45);
    add(g, new THREE.BoxGeometry(0.003, 0.002, 0.07), mat('#111', 0.5, 0.5), 0, 0.054, -0.85);
    add(g, new THREE.TorusGeometry(0.03, 0.006, 8, 20), gold, 0, 0.0, 0.43);
    // A fat roll of banknotes in a paper band, lashed to the fore-end, and a gold nameplate.
    const cash = mat('#5f9a5a', 0, 0.7);
    for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.012, 0.045, 0.1), cash, -0.04 - i * 0.008, -0.002, -0.2 + i * 0.004);
    add(g, new THREE.BoxGeometry(0.034, 0.05, 0.022), mat('#efe6cc', 0, 0.8), -0.048, -0.002, -0.2);
    add(g, new THREE.BoxGeometry(0.003, 0.02, 0.01), mat('#2f5f2c', 0, 0.8), -0.066, -0.002, -0.2);
    flank(g, new THREE.BoxGeometry(0.06, 0.02, 0.003), gold, -0.33);
    return g;
  },
  playboy() {
    const chrome = mat('#e4e8ee', 1, 0.08);
    const red = mat('#e2385d', 0.3, 0.25, { emissive: '#3a0510' });
    const g = rifle({ stock: mat('#f6efe9', 0.2, 0.25), metal: chrome, accent: red, scope: mat('#f2a7c0', 0.5, 0.3), barrel: chrome });
    const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.06), { depth: 0.012, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.004, bevelSegments: 2 });
    for (const [x, ry] of [[0.03, Math.PI / 2], [-0.042, -Math.PI / 2]]) add(g, heartGeo, red, x, -0.02, 0.26, 0, ry).scale.setScalar(1.3);
    // A big heart stands on the muzzle as the front sight.
    add(g, heartGeo, red, -0.006, 0.1, -0.79, 0, -Math.PI / 2).scale.setScalar(0.75);
    // A long-stemmed red rose tied along the barrel, bloom forward, two leaves.
    tube(g, 0.004, 0.004, 0.36, mat('#2f7a35', 0, 0.6), -0.032, 0.03, -0.45, 8);
    const petal = mat('#c8102e', 0.1, 0.45, { emissive: '#2a0006' });
    for (const [dx, dy, dz, r] of [[0, 0, 0, 0.026], [-0.01, 0.014, 0.006, 0.018], [-0.008, -0.012, 0.01, 0.018], [-0.016, 0.0, -0.012, 0.016]]) {
      add(g, new THREE.SphereGeometry(r, 12, 10), petal, -0.036 + dx, 0.03 + dy, -0.645 + dz);
    }
    for (const [z, rx] of [[-0.42, 0.7], [-0.52, -0.7]]) {
      const leaf = add(g, new THREE.SphereGeometry(0.02, 10, 8), mat('#3c9a44', 0, 0.6), -0.04, 0.03 + rx * 0.018, z, rx);
      leaf.scale.set(0.3, 0.5, 1.4);
    }
    lash(g, -0.36, 0.035, 0.04);
    return g;
  },
  chef() {
    const brass = mat('#c9a14a', 1, 0.28);
    const blade = mat('#e3e7ec', 0.7, 0.25);
    const handle = mat('#1c1a1a', 0.2, 0.5);
    const g = rifle({ stock: mat('#5e3a20', 0.05, 0.45), metal: steel(), accent: brass, scope: mat('#2a2622', 0.6, 0.3), noMuzzle: true });
    // A pepper-mill crown for the muzzle brake, knob and all.
    const crown = new THREE.LatheGeometry([[0.012, 0], [0.03, 0.01], [0.032, 0.05], [0.024, 0.07], [0.014, 0.09], [0.008, 0.1]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
    add(g, crown, mat('#5e3a20', 0.05, 0.4), 0, 0.045, -0.78, -Math.PI / 2);
    add(g, new THREE.SphereGeometry(0.014, 12, 10), brass, 0, 0.045, -0.885);
    add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.012, 14), brass, 0, 0.152, -0.05);
    // A chef's knife lashed to the fore-end, edge down and point forward, its handle riveted.
    add(g, new THREE.BoxGeometry(0.003, 0.046, 0.2), blade, -0.048, -0.006, -0.23);
    add(g, new THREE.BoxGeometry(0.003, 0.034, 0.05), blade, -0.048, -0.014, -0.335, 0.45);
    add(g, new THREE.BoxGeometry(0.004, 0.006, 0.2), mat('#9aa0a8', 0.9, 0.2), -0.048, 0.014, -0.23);
    add(g, new THREE.BoxGeometry(0.01, 0.026, 0.1), handle, -0.047, -0.006, -0.08);
    for (const z of [-0.06, -0.1]) add(g, new THREE.SphereGeometry(0.004, 6, 5), brass, -0.053, -0.006, z);
    // A carving fork strapped along the barrel, tines forward.
    add(g, new THREE.BoxGeometry(0.004, 0.01, 0.16), handle, -0.026, 0.06, -0.38);
    add(g, new THREE.BoxGeometry(0.004, 0.006, 0.05), blade, -0.026, 0.06, -0.485);
    add(g, new THREE.BoxGeometry(0.004, 0.03, 0.012), blade, -0.026, 0.06, -0.515);
    for (const y of [-0.012, 0.0, 0.012]) add(g, new THREE.BoxGeometry(0.003, 0.004, 0.07), blade, -0.026, 0.06 + y, -0.555);
    for (const z of [-0.2, -0.33]) lash(g, z);
    lash(g, -0.42, 0.055, 0.03);
    return g;
  },
  teacher() {
    const g = rifle({ stock: mat('#a57a45', 0.05, 0.5), metal: blued(), accent: mat('#c4362c', 0.2, 0.4), scope: mat('#2e4a36', 0.5, 0.3) });
    for (const x of [0.03, -0.03]) add(g, new THREE.BoxGeometry(0.004, 0.08, 0.16), mat('#2f5a42', 0, 0.9), x, -0.02, 0.32);
    add(g, new THREE.BoxGeometry(0.0042, 0.004, 0.11), mat('#f4f1e6', 0, 0.9), 0.031, 0.0, 0.33);
    // The classroom pointer: a long tapered cane under the barrel, well past the muzzle, red tip.
    const cane = mat('#c49a5e', 0.05, 0.45);
    tube(g, 0.005, 0.011, 0.9, cane, -0.012, 0.004, -0.52, 12);
    add(g, new THREE.SphereGeometry(0.008, 10, 8), mat('#c4362c', 0.1, 0.5), -0.012, 0.004, -0.975);
    for (const z of [-0.36, -0.62]) add(g, new THREE.TorusGeometry(0.02, 0.003, 6, 14), mat('#3a2a1a', 0.2, 0.6), -0.006, 0.024, z);
    // A chalk tray on the fore-end flank holding white, yellow and pink sticks, dusted.
    add(g, new THREE.BoxGeometry(0.016, 0.008, 0.15), mat('#7a5530', 0.05, 0.6), -0.042, -0.026, -0.2);
    for (const [y, c, z] of [[-0.016, '#f6f4ec', -0.19], [-0.004, '#f2d94a', -0.21], [0.008, '#f29ab8', -0.2]]) {
      tube(g, 0.0065, 0.0065, 0.08, mat(c, 0, 0.95), -0.044, y, z, 10);
    }
    add(g, new THREE.BoxGeometry(0.002, 0.03, 0.12), mat('#eae6dc', 0, 1, { transparent: true, opacity: 0.35 }), -0.035, -0.008, -0.2);
    return g;
  },
  office() {
    const blue = mat('#3e5c99', 0.45, 0.3);
    const clip = mat('#121214', 0.7, 0.3);
    const silver = mat('#c9ccd2', 1, 0.2);
    const g = rifle({ stock: blue, metal: mat('#2b3442', 0.85, 0.3), accent: silver, scope: clip, clips: true, noMuzzle: true });
    // Binder clips hold the scope; the stapler's top arm rides over the receiver; a staple brake.
    for (const z of [-0.12, 0.04]) {
      add(g, new THREE.ConeGeometry(0.03, 0.045, 3), clip, 0, 0.088, z, 0, 0, Math.PI);
      add(g, new THREE.TorusGeometry(0.02, 0.003, 6, 12, Math.PI), silver, 0, 0.12, z);
    }
    add(g, new THREE.BoxGeometry(0.058, 0.022, 0.38), blue, 0, 0.078, -0.06, 0.03);
    add(g, new THREE.BoxGeometry(0.044, 0.004, 0.05), silver, 0, 0.045, -0.82);
    for (const x of [-0.02, 0.02]) add(g, new THREE.BoxGeometry(0.004, 0.03, 0.05), silver, x, 0.033, -0.82);
    // Sticky notes slapped on the fore-end, scribbled on.
    for (const [z, c, r] of [[-0.21, '#ffe066', 0.1], [-0.27, '#7fd1ff', -0.12]]) {
      flank(g, new THREE.BoxGeometry(0.05, 0.04, 0.002), mat(c, 0, 0.8), z).rotation.x = r;
    }
    for (const y of [0.006, -0.004]) flank(g, new THREE.BoxGeometry(0.034, 0.003, 0.003), mat('#3b4a7a', 0, 0.8), -0.21, y);
    // Her staff ID on a red lanyard, hung from the front scope clip and swinging under the rifle.
    const cord = mat('#c33333', 0.1, 0.6);
    add(g, new THREE.BoxGeometry(0.004, 0.17, 0.006), cord, -0.036, 0.03, -0.11, 0.25, 0, 0.12);
    add(g, new THREE.BoxGeometry(0.004, 0.17, 0.006), cord, -0.036, 0.03, -0.15, -0.25, 0, 0.12);
    add(g, new THREE.BoxGeometry(0.004, 0.06, 0.044), mat('#f7f8fb', 0, 0.5), -0.048, -0.085, -0.13);
    add(g, new THREE.BoxGeometry(0.005, 0.014, 0.044), mat('#3a7bd5', 0, 0.5), -0.049, -0.062, -0.13);
    add(g, new THREE.BoxGeometry(0.005, 0.022, 0.016), mat('#c9a184', 0, 0.6), -0.049, -0.088, -0.142);
    for (const y of [-0.084, -0.094]) add(g, new THREE.BoxGeometry(0.005, 0.003, 0.016), mat('#555a66', 0, 0.6), -0.049, y, -0.12);
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
