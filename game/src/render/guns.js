// Six sniper rifles, each shaped after its owner's career: the Boss's gold fountain pen, the
// Playboy's Heartbreaker, the Chef's pepper mill, the Teacher's pointer with a chalkboard stock,
// the Office Lady's stapler with a binder-clip scope and the Nurse's syringe. Each model points
// down -z with the grip at the origin; the same model serves the first-person view and the
// soldiers in the plaza.
import * as THREE from 'three';

const mats = {};
function mat(key, opts) {
  if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial(opts);
  return mats[key];
}

function part(geo, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

/** A cylinder lying along z. */
function tube(r1, r2, len, material, x, y, z, seg = 14) {
  return part(new THREE.CylinderGeometry(r1, r2, len, seg), material, x, y, z, Math.PI / 2, 0, 0);
}

function scope(group, material, y, z, len = 0.34, r = 0.035) {
  group.add(tube(r, r, len, material, 0, y, z));
  const glass = mat('lens', { color: '#7fd6ff', emissive: '#1f6f8f', roughness: 0.1, metalness: 0.2 });
  group.add(tube(r * 0.9, r * 0.9, 0.01, glass, 0, y, z - len / 2 - 0.005));
}

function heartShape(size) {
  const s = new THREE.Shape();
  s.moveTo(0, -size);
  s.bezierCurveTo(size * 1.2, -size * 0.2, size * 0.9, size * 0.9, 0, size * 0.35);
  s.bezierCurveTo(-size * 0.9, size * 0.9, -size * 1.2, -size * 0.2, 0, -size);
  return s;
}

const BUILD = {
  boss(g) {
    const black = mat('penBlack', { color: '#16171c', roughness: 0.25, metalness: 0.6 });
    const gold = mat('gold', { color: '#d9b44a', roughness: 0.25, metalness: 0.9 });
    g.add(tube(0.035, 0.045, 0.9, black, 0, 0.04, -0.45));
    for (const z of [-0.12, -0.5, -0.82]) g.add(tube(0.05, 0.05, 0.03, gold, 0, 0.04, z));
    g.add(part(new THREE.ConeGeometry(0.035, 0.16, 4), gold, 0, 0.04, -0.98, -Math.PI / 2, 0, Math.PI / 4));
    g.add(part(new THREE.BoxGeometry(0.06, 0.1, 0.32), black, 0, -0.02, 0.12));
    g.add(part(new THREE.BoxGeometry(0.035, 0.12, 0.05), gold, 0, -0.07, -0.02, 0.3, 0, 0));
    scope(g, gold, 0.12, -0.3);
  },
  playboy(g) {
    const pink = mat('pink', { color: '#f0a3bd', roughness: 0.35, metalness: 0.3 });
    const red = mat('heart', { color: '#e2385d', roughness: 0.3, emissive: '#5a0716' });
    const chrome = mat('chrome', { color: '#d9dde3', roughness: 0.15, metalness: 0.95 });
    g.add(tube(0.025, 0.03, 0.8, chrome, 0, 0.04, -0.5));
    g.add(part(new THREE.BoxGeometry(0.07, 0.11, 0.5), pink, 0, 0, -0.05));
    const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.13), { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), red);
    heart.position.set(-0.025, 0, 0.3);
    heart.rotation.y = Math.PI / 2;
    heart.castShadow = true;
    g.add(heart);
    scope(g, pink, 0.12, -0.15);
  },
  chef(g) {
    const wood = mat('mill', { color: '#7a4a28', roughness: 0.55 });
    const steel = mat('steel', { color: '#b6bcc4', roughness: 0.3, metalness: 0.85 });
    const body = new THREE.Mesh(new THREE.LatheGeometry([0.03, 0.06, 0.055, 0.065, 0.05, 0.03].map((r, i) => new THREE.Vector2(r, i * 0.09)), 16), wood);
    body.rotation.x = -Math.PI / 2;
    body.position.set(0, 0.02, 0.15);
    body.castShadow = true;
    g.add(body);
    g.add(tube(0.025, 0.028, 0.7, steel, 0, 0.03, -0.55));
    g.add(part(new THREE.SphereGeometry(0.045, 12, 8), steel, 0, 0.13, -0.12));
    scope(g, wood, 0.13, -0.32, 0.26, 0.032);
  },
  teacher(g) {
    const wood = mat('pointer', { color: '#b58a52', roughness: 0.6 });
    const tip = mat('tip', { color: '#c4362c', roughness: 0.4 });
    const board = mat('board', { color: '#2f5a42', roughness: 0.9 });
    const frame = mat('frame', { color: '#8a5d34', roughness: 0.7 });
    g.add(tube(0.012, 0.022, 1.0, wood, 0, 0.04, -0.6));
    g.add(part(new THREE.SphereGeometry(0.02, 10, 8), tip, 0, 0.04, -1.1));
    g.add(part(new THREE.BoxGeometry(0.05, 0.18, 0.3), frame, 0, -0.01, 0.15));
    g.add(part(new THREE.BoxGeometry(0.052, 0.15, 0.26), board, 0, -0.01, 0.15));
    g.add(part(new THREE.BoxGeometry(0.06, 0.08, 0.2), frame, 0, 0.02, -0.08));
    scope(g, mat('scopeBlack', { color: '#202226', roughness: 0.4, metalness: 0.5 }), 0.11, -0.12);
  },
  office(g) {
    const body = mat('stapler', { color: '#3e5c99', roughness: 0.35, metalness: 0.4 });
    const steel = mat('steel', { color: '#b6bcc4', roughness: 0.3, metalness: 0.85 });
    const clip = mat('clip', { color: '#121214', roughness: 0.3, metalness: 0.6 });
    g.add(part(new THREE.BoxGeometry(0.08, 0.05, 0.62), body, 0, -0.02, -0.08));
    g.add(part(new THREE.BoxGeometry(0.075, 0.05, 0.6), body, 0, 0.045, -0.1, 0.05, 0, 0));
    g.add(tube(0.02, 0.022, 0.55, steel, 0, 0.02, -0.62));
    // Binder clip as the scope mount.
    g.add(part(new THREE.ConeGeometry(0.06, 0.08, 3), clip, 0, 0.12, -0.1, 0, 0, Math.PI));
    g.add(part(new THREE.TorusGeometry(0.035, 0.005, 6, 12, Math.PI), steel, 0, 0.17, -0.1));
    scope(g, clip, 0.18, -0.12, 0.28, 0.03);
  },
  nurse(g) {
    const glass = mat('syringe', { color: '#e9f6ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.45 });
    const dose = mat('dose', { color: '#55d3c6', roughness: 0.2, emissive: '#0d4a44' });
    const white = mat('plunger', { color: '#f4f6f8', roughness: 0.4 });
    const steel = mat('steel', { color: '#b6bcc4', roughness: 0.3, metalness: 0.85 });
    g.add(tube(0.06, 0.06, 0.62, glass, 0, 0.04, -0.3));
    g.add(tube(0.05, 0.05, 0.4, dose, 0, 0.04, -0.38));
    g.add(tube(0.008, 0.008, 0.45, steel, 0, 0.04, -0.83));
    g.add(part(new THREE.BoxGeometry(0.2, 0.025, 0.04), white, 0, 0.04, 0.02));
    g.add(tube(0.012, 0.012, 0.25, white, 0, 0.04, 0.14));
    g.add(part(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14), white, 0, 0.04, 0.27, Math.PI / 2));
    g.add(part(new THREE.BoxGeometry(0.05, 0.11, 0.07), white, 0, -0.04, 0.05, 0.25, 0, 0));
    scope(g, white, 0.14, -0.25, 0.26, 0.03);
  },
};

/** A new rifle model for a career. */
export function buildGun(roleId) {
  const g = new THREE.Group();
  BUILD[roleId](g);
  return g;
}
