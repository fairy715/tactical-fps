// The six careers as figures in the plaza, built from simple shapes and dressed for the job: the
// Teacher in a cardigan, pencil skirt and glasses; the Office Lady in a shirt and suspender
// trousers with her ID badge; the Nurse in scrubs and cap; the Boss in a dark suit and gold tie;
// the Playboy in a white suit with shades and a heart pin; the Chef in whites and a tall toque.
// Each carries its career's rifle and wears its team's armband.
import * as THREE from 'three';
import { TEAMS } from '../sim/config.js';
import { buildGun } from './guns.js';

const cache = {};
function mat(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  if (!cache[key]) cache[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
  return cache[key];
}

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A limb hanging from a pivot: the mesh hangs below the group's origin. */
function limb(w, len, d, color, footColor) {
  const pivot = new THREE.Group();
  const m = box(w, len, d, color, 0, -len / 2, 0);
  pivot.add(m);
  if (footColor) pivot.add(box(w + 0.02, 0.08, d + 0.1, footColor, 0, -len + 0.04, -0.04));
  return pivot;
}

const OUTFIT = {
  boss: { legs: '#22252e', shoes: '#111', torso: '#2b2f3a', arms: '#2b2f3a' },
  playboy: { legs: '#f1ece2', shoes: '#c7a27a', torso: '#f4f1ea', arms: '#f4f1ea' },
  chef: { legs: '#2a2a2e', shoes: '#111', torso: '#fafafa', arms: '#fafafa' },
  teacher: { legs: '#3a3236', shoes: '#5a2c22', torso: '#3e6b4f', arms: '#3e6b4f' },
  office: { legs: '#28324a', shoes: '#1a1a1a', torso: '#f2f4f7', arms: '#f2f4f7' },
  nurse: { legs: '#cfe9ef', shoes: '#f5f5f5', torso: '#e8f3f6', arms: '#e8f3f6' },
};

function dress(roleId, role, rig) {
  const { torso, head } = rig;
  const skin = role.skin;
  const hair = role.hair;
  // Hair cap on every head; details per career below.
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hair));
  cap.position.y = 0.01;
  head.add(cap);
  if (roleId === 'boss') {
    torso.add(box(0.08, 0.36, 0.02, '#f2efe8', 0, 0.05, -0.135));
    torso.add(box(0.05, 0.32, 0.025, role.trim, 0, 0.03, -0.14));
  } else if (roleId === 'playboy') {
    torso.add(box(0.14, 0.3, 0.02, '#f08bb0', 0, 0.06, -0.135));
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#e2385d', { emissive: '#4a0612' }));
    pin.position.set(-0.13, 0.15, -0.14);
    torso.add(pin);
    head.add(box(0.26, 0.05, 0.03, '#0b0b0d', 0, 0.02, -0.14));
  } else if (roleId === 'chef') {
    torso.add(box(0.36, 0.1, 0.27, '#d63a35', 0, 0.26, 0));
    for (const y of [0.12, 0.0, -0.12]) torso.add(box(0.03, 0.03, 0.02, '#333', 0.07, y, -0.135));
    const toque = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.3, 14), mat('#ffffff'));
    toque.position.y = 0.26;
    head.add(toque);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), mat('#ffffff'));
    puff.position.y = 0.43;
    head.add(puff);
  } else if (roleId === 'teacher') {
    torso.add(box(0.2, 0.3, 0.02, role.trim, 0, 0.06, -0.135));
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mat(hair));
    bun.position.set(0, 0.06, 0.15);
    head.add(bun);
    // Glasses: two rims and a bridge.
    const rim = mat('#1d1d1f');
    for (const x of [-0.055, 0.055]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 6, 16), rim);
      ring.position.set(x, 0.01, -0.145);
      head.add(ring);
    }
    head.add(box(0.035, 0.008, 0.008, '#1d1d1f', 0, 0.015, -0.148));
  } else if (roleId === 'office') {
    // Suspender straps over the shirt, an ID badge on a lanyard.
    for (const x of [-0.1, 0.1]) torso.add(box(0.035, 0.6, 0.27, '#28324a', x, 0, 0));
    torso.add(box(0.07, 0.09, 0.02, '#3a7bd5', -0.02, -0.08, -0.14));
    torso.add(box(0.012, 0.2, 0.012, '#c33', -0.02, 0.06, -0.14));
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(hair));
    head.add(bob);
  } else if (roleId === 'nurse') {
    const hat = box(0.2, 0.07, 0.12, '#ffffff', 0, 0.16, -0.02);
    hat.add(box(0.05, 0.015, 0.012, '#e2384d', 0, 0, -0.062));
    hat.add(box(0.015, 0.05, 0.012, '#e2384d', 0, 0, -0.062));
    head.add(hat);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.24, 8), mat(hair));
    tail.position.set(0, -0.06, 0.16);
    tail.rotation.x = 0.4;
    head.add(tail);
    torso.add(box(0.06, 0.06, 0.02, role.trim, -0.12, 0.15, -0.135));
  }
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat(skin)));
}

/**
 * A soldier figure. Returns { root, rig, gun } where rig holds the posable parts: hips, torso,
 * head, legs and arms (each a pivot group), and skirt for the pencil skirt.
 */
export function buildSoldier(role, team) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const fit = OUTFIT[role.id];
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  body.add(hips);

  const legL = limb(0.15, 0.9, 0.16, fit.legs, fit.shoes);
  const legR = limb(0.15, 0.9, 0.16, fit.legs, fit.shoes);
  legL.position.x = -0.1;
  legR.position.x = 0.1;
  hips.add(legL, legR);
  let skirt = null;
  if (role.id === 'teacher') {
    // A pencil skirt to the knee over dark tights.
    skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.5, 14), mat('#3b3d45'));
    skirt.position.y = -0.24;
    skirt.castShadow = true;
    hips.add(skirt);
  }
  if (role.id === 'nurse') {
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.42, 14), mat(role.suit));
    hem.position.y = -0.18;
    hem.castShadow = true;
    hips.add(hem);
  }

  const torso = box(0.42, 0.6, 0.26, fit.torso, 0, 0.32, 0);
  hips.add(torso);
  // Team armband.
  torso.add(box(0.03, 0.1, 0.18, TEAMS[team].color, 0.225, 0.14, 0));
  torso.add(box(0.03, 0.1, 0.18, TEAMS[team].color, -0.225, 0.14, 0));

  const head = new THREE.Group();
  head.position.y = 0.48;
  torso.add(head);

  const armL = limb(0.11, 0.56, 0.12, fit.arms, null);
  const armR = limb(0.11, 0.56, 0.12, fit.arms, null);
  armL.position.set(-0.26, 0.24, 0);
  armR.position.set(0.26, 0.24, 0);
  for (const a of [armL, armR]) a.add(box(0.1, 0.1, 0.1, role.skin, 0, -0.6, 0));
  torso.add(armL, armR);

  const gun = buildGun(role.id);
  gun.position.set(0.05, 0.18, -0.32);
  torso.add(gun);

  dress(role.id, role, { torso, head });
  root.userData.walk = 0;
  return { root, rig: { body, hips, torso, head, legL, legR, armL, armR, skirt }, gun };
}

/** Poses a living soldier from its simulation state. */
export function poseSoldier(fig, s, dt) {
  const { root, rig } = fig;
  root.visible = true;
  root.position.set(s.pos.x, s.pos.y, s.pos.z);
  root.rotation.set(0, s.yaw, 0);
  rig.body.position.set(0, 0, 0);
  rig.body.rotation.set(0, 0, 0);
  const speed = Math.hypot(s.vel.x, s.vel.z);
  root.userData.walk += speed * dt * 2.4;
  const swing = Math.sin(root.userData.walk) * Math.min(0.6, speed * 0.12);
  const crouch = s.crouch;
  rig.hips.position.y = 0.92 - 0.38 * crouch;
  rig.legL.rotation.x = swing - 0.9 * crouch;
  rig.legR.rotation.x = -swing - 0.9 * crouch;
  rig.legL.scale.y = rig.legR.scale.y = 1 - 0.25 * crouch;
  if (rig.skirt) rig.skirt.rotation.x = -0.3 * crouch;
  rig.torso.rotation.x = 0.15 * crouch;
  // Both arms up holding the rifle, aimed with the soldier's pitch.
  const aim = -Math.PI / 2 + s.pitch;
  rig.armL.rotation.set(aim, 0, 0.35);
  rig.armR.rotation.set(aim, 0, -0.1);
  fig.gun.rotation.set(s.pitch, 0, 0);
  rig.head.rotation.set(s.pitch * 0.5, 0, 0);
}
