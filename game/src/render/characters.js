// The six careers as cartoon figures: big round heads with drawn faces, rounded bodies and limbs,
// toon shading and ink outlines. The Teacher wears a cardigan, pencil skirt and glasses; the Office
// Lady a white blouse, black pencil skirt, heels, long permed hair and an ID badge; the Nurse scrubs and a cap; the Boss a dark
// suit and gold tie; the Playboy a white suit, shades and a heart pin; the Chef whites and a toque;
// the Coder a hoodie, square glasses, headphones and bed hair; the Nanny a cardigan, apron and a
// bun with a bow. A career with no entry in these tables still gets a plain figure in its colours.
// Faces change with what happens: dizzy when stunned, heart eyes when charmed, and the finishing
// gag's own look when they fall. Each carries its career's rifle and its team's armband.
import * as THREE from 'three';
import { TEAMS } from '../sim/config.js';
import { buildGun } from './guns.js';
import { toon, toonify } from './toon.js';

function mesh(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
const ball = (r) => new THREE.SphereGeometry(r, 18, 14);
const block = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ---- faces -----------------------------------------------------------------------------------

const FACE_STYLE = {
  boss: { brow: 5, lip: '#8a4b3a', lashes: false, extra: 'mustache' },
  playboy: { brow: 4, lip: '#8a4b3a', lashes: false, extra: 'grin' },
  chef: { brow: 6, lip: '#8a4b3a', lashes: false, extra: 'curl' },
  teacher: { brow: 3, lip: '#c4475b', lashes: true },
  office: { brow: 3, lip: '#d0506a', lashes: true },
  nurse: { brow: 3, lip: '#e0607a', lashes: true },
  coder: { brow: 4, lip: '#8a4b3a', lashes: false },
  nanny: { brow: 3, lip: '#d0607a', lashes: true },
};
const PLAIN_FACE = { brow: 4, lip: '#8a4b3a', lashes: false };

const faceCache = new Map();

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x + s * 1.3, y, x + s * 0.6, y - s, x, y - s * 0.3);
  ctx.bezierCurveTo(x - s * 0.6, y - s, x - s * 1.3, y, x, y + s * 0.9);
  ctx.fill();
}

/** A face drawn for a career and an expression: normal, ko, sleep, love, shock or dizzy. */
function faceTexture(roleId, expr) {
  const key = `${roleId}:${expr}`;
  if (faceCache.has(key)) return faceCache.get(key);
  const st = FACE_STYLE[roleId] || PLAIN_FACE;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1b1622';
  ctx.fillStyle = '#1b1622';
  const eyes = [[88, 120], [168, 120]];
  // Cheeks.
  ctx.fillStyle = 'rgba(240, 120, 120, 0.35)';
  for (const [x] of eyes) {
    ctx.beginPath();
    ctx.ellipse(x + (x < 128 ? -14 : 14), 160, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1b1622';
  ctx.lineWidth = st.brow;
  for (const [x, y] of eyes) {
    // Brows.
    ctx.beginPath();
    const tilt = expr === 'shock' ? -10 : expr === 'ko' ? 8 : 0;
    ctx.moveTo(x - 20, y - 34 + (x < 128 ? tilt : -tilt) * 0.3);
    ctx.lineTo(x + 20, y - 36 - (x < 128 ? tilt : -tilt) * 0.3);
    ctx.stroke();
    ctx.lineWidth = 6;
    if (expr === 'ko') {
      ctx.beginPath();
      ctx.moveTo(x - 14, y - 14);
      ctx.lineTo(x + 14, y + 14);
      ctx.moveTo(x + 14, y - 14);
      ctx.lineTo(x - 14, y + 14);
      ctx.stroke();
    } else if (expr === 'sleep') {
      ctx.beginPath();
      ctx.arc(x, y - 4, 16, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (expr === 'love') {
      ctx.fillStyle = '#e2385d';
      heart(ctx, x, y, 18);
      ctx.fillStyle = '#1b1622';
    } else if (expr === 'dizzy') {
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) ctx.lineTo(x + Math.cos(a) * a * 1.3, y + Math.sin(a) * a * 1.3);
      ctx.stroke();
    } else {
      const big = expr === 'shock' ? 1.35 : 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y, 15 * big, 19 * big, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2a1f2e';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 3, 8 * big, 11 * big, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + 5, y - 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b1622';
      if (st.lashes) {
        ctx.lineWidth = 4;
        for (const dx of [-14, -6, 4]) {
          ctx.beginPath();
          ctx.moveTo(x + dx * (x < 128 ? 1 : -1), y - 18);
          ctx.lineTo(x + (dx - 6) * (x < 128 ? 1 : -1), y - 28);
          ctx.stroke();
        }
      }
    }
    ctx.lineWidth = st.brow;
  }
  // Mouth.
  ctx.lineWidth = 6;
  ctx.strokeStyle = st.lip;
  ctx.fillStyle = st.lip;
  ctx.beginPath();
  if (expr === 'shock' || expr === 'ko') {
    ctx.ellipse(128, 190, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (expr === 'sleep') {
    ctx.ellipse(128, 192, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (expr === 'love' || st.extra === 'grin') {
    ctx.arc(128, 176, 24, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    ctx.arc(128, 172, 18, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
  }
  ctx.strokeStyle = '#1b1622';
  if (st.extra === 'mustache') {
    ctx.fillStyle = '#2a2321';
    ctx.beginPath();
    ctx.ellipse(110, 170, 20, 7, 0.2, 0, Math.PI * 2);
    ctx.ellipse(146, 170, 20, 7, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (st.extra === 'curl') {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(110, 172, 14, 0.1 * Math.PI, 1.1 * Math.PI, true);
    ctx.moveTo(160, 172);
    ctx.arc(146, 172, 14, 0, -1 * Math.PI, false);
    ctx.stroke();
  }
  if (expr === 'shock') {
    ctx.fillStyle = '#7fd6ff';
    ctx.beginPath();
    ctx.moveTo(206, 70);
    ctx.quadraticCurveTo(222, 100, 206, 108);
    ctx.quadraticCurveTo(190, 100, 206, 70);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  faceCache.set(key, tex);
  return tex;
}

// ---- outfits ---------------------------------------------------------------------------------

/**
 * Each career's build, so the six read apart at a glance: height (the whole figure), and the
 * torso's width and depth. The Boss is broad with a paunch, the Playboy tall and slim, the Chef
 * round; the Office Lady stands tall in heels, the Nurse is petite. Builds are looks only: every
 * soldier has the same hitbox.
 */
const BUILD = {
  boss: { height: 1.0, width: 1.22, depth: 1.25 },
  playboy: { height: 1.07, width: 0.88, depth: 0.9 },
  chef: { height: 0.97, width: 1.28, depth: 1.4 },
  teacher: { height: 0.98, width: 0.95, depth: 0.95 },
  office: { height: 1.06, width: 0.9, depth: 0.92 },
  nurse: { height: 0.88, width: 0.88, depth: 0.9 },
  coder: { height: 0.95, width: 1.16, depth: 1.3 },
  nanny: { height: 0.94, width: 1.04, depth: 1.02 },
};

const OUTFIT = {
  boss: { legs: '#22252e', shoes: '#141418', torso: '#2b2f3a', arms: '#2b2f3a' },
  playboy: { legs: '#f1ece2', shoes: '#b07a4f', torso: '#f4f1ea', arms: '#f4f1ea' },
  chef: { legs: '#2f2f35', shoes: '#141418', torso: '#fafafa', arms: '#fafafa' },
  teacher: { legs: '#4a3b40', shoes: '#7a2f25', torso: '#3e7a55', arms: '#3e7a55' },
  office: { legs: '#d9a88f', shoes: '#1a1a1a', torso: '#f7f8fb', arms: '#f7f8fb' },
  nurse: { legs: '#f0e3d8', shoes: '#f7f7f7', torso: '#dff1f5', arms: '#dff1f5' },
  coder: { legs: '#3b5179', shoes: '#ececec', torso: '#3a3f4b', arms: '#3a3f4b' },
  nanny: { legs: '#efd3c0', shoes: '#c9876b', torso: '#f6c7d4', arms: '#f6c7d4' },
};

/** A figure for a career the tables above do not know yet: its suit, plain trousers. */
function plainOutfit(role) {
  return { legs: '#33343c', shoes: '#18181c', torso: role.suit, arms: role.suit };
}

function dress(roleId, role, torso, head) {
  const hair = role.hair;
  if (roleId === 'boss') {
    torso.add(mesh(block(0.1, 0.32, 0.02), '#f2efe8', 0, 0.06, -0.15));
    torso.add(mesh(block(0.06, 0.3, 0.025), role.trim, 0, 0.04, -0.158));
    head.add(mesh(new THREE.SphereGeometry(0.205, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 0, 0.02, 0.01));
    // A fedora with a gold band.
    head.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.025, 24), '#1d1f26', 0, 0.15, 0));
    head.add(mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 20), '#1d1f26', 0, 0.26, 0));
    head.add(mesh(new THREE.CylinderGeometry(0.202, 0.202, 0.045, 20), role.trim, 0, 0.18, 0));
  } else if (roleId === 'playboy') {
    torso.add(mesh(block(0.16, 0.28, 0.02), '#f08bb0', 0, 0.08, -0.15));
    const pin = new THREE.Mesh(ball(0.04), toon('#e2385d', { emissive: '#3a0510' }));
    pin.position.set(-0.13, 0.15, -0.155);
    torso.add(pin);
    // A heavy gold chain at the open collar.
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 24), toon('#e5b53a', { emissive: '#3a2a05' }));
    chain.position.set(0, 0.22, -0.06);
    chain.rotation.x = 1.2;
    torso.add(chain);
    head.add(mesh(block(0.3, 0.07, 0.04), '#0b0b0d', 0, 0.03, -0.19));
    const quiff = mesh(ball(0.13), hair, 0, 0.2, -0.08);
    quiff.scale.set(1.3, 0.9, 1.1);
    head.add(quiff, mesh(new THREE.SphereGeometry(0.205, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), hair, 0, 0.02, 0.01));
  } else if (roleId === 'chef') {
    torso.add(mesh(block(0.36, 0.08, 0.3), '#d63a35', 0, 0.22, 0));
    for (const y of [0.1, -0.02, -0.14]) torso.add(mesh(ball(0.02), '#333333', 0.07, y, -0.15));
    // A white apron down to the knees.
    torso.add(mesh(block(0.34, 0.62, 0.02), '#f4f1ea', 0, -0.32, -0.16));
    head.add(mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.3, 16), '#ffffff', 0, 0.3, 0));
    const puff = mesh(ball(0.22), '#ffffff', 0, 0.48, 0);
    puff.scale.y = 0.75;
    head.add(puff);
  } else if (roleId === 'teacher') {
    torso.add(mesh(block(0.18, 0.28, 0.02), role.trim, 0, 0.07, -0.15));
    head.add(mesh(new THREE.SphereGeometry(0.212, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.01, 0.01), mesh(ball(0.09), hair, 0, 0.1, 0.18));
    for (const x of [-0.07, 0.07]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.009, 6, 18), toon('#1d1d1f'));
      ring.position.set(x, 0.0, -0.198);
      head.add(ring);
    }
    head.add(mesh(block(0.05, 0.01, 0.01), '#1d1d1f', 0, 0.01, -0.2));
  } else if (roleId === 'office') {
    // A white blouse: pointed collar, a row of pearl buttons, and the ID badge on its lanyard.
    for (const x of [-0.06, 0.06]) {
      const tab = mesh(block(0.09, 0.05, 0.02), '#ffffff', x, 0.27, -0.13);
      tab.rotation.z = x > 0 ? 0.5 : -0.5;
      torso.add(tab);
    }
    for (const y of [0.18, 0.08, -0.02, -0.12]) torso.add(mesh(ball(0.014), '#e9e3d6', 0, y, -0.152));
    torso.add(mesh(block(0.08, 0.1, 0.02), '#3a7bd5', -0.03, -0.06, -0.16), mesh(block(0.012, 0.2, 0.012), '#c33333', -0.03, 0.08, -0.155));
    // Long permed hair: a crown cap, then loose curls that fall past the shoulders, open at the face.
    head.add(mesh(new THREE.SphereGeometry(0.222, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), hair, 0, 0.0, 0.015));
    for (let a = -2.2; a <= 2.21; a += 0.55) {
      for (let k = 0; k < 4; k++) {
        const r = 0.2 + k * 0.018;
        const curl = mesh(ball(0.075 - k * 0.006), hair, Math.sin(a) * r + (k % 2 ? 0.012 : -0.012), 0.04 - k * 0.12, Math.cos(a) * r);
        head.add(curl);
      }
    }
  } else if (roleId === 'coder') {
    // Hoodie: the hood bunched behind the neck, drawstrings, a green </> on the chest.
    const hood = mesh(new THREE.TorusGeometry(0.15, 0.07, 10, 20), role.suit, 0, 0.3, 0.1);
    hood.rotation.x = Math.PI / 2.4;
    torso.add(hood);
    for (const x of [-0.05, 0.05]) torso.add(mesh(block(0.015, 0.16, 0.015), '#f2f2f2', x, 0.16, -0.152));
    torso.add(mesh(block(0.12, 0.05, 0.02), role.trim, 0.0, 0.0, -0.152));
    // Headphones round the neck.
    const band = mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 20, Math.PI), '#111216', 0, 0.36, 0);
    band.rotation.x = Math.PI / 2;
    torso.add(band);
    for (const x of [-0.16, 0.16]) torso.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14), '#111216', x, 0.34, -0.03));
    // Square thick-rimmed glasses and a mop of bed hair.
    for (const x of [-0.075, 0.075]) {
      head.add(mesh(block(0.11, 0.08, 0.012), '#111216', x, 0.0, -0.198));
      head.add(mesh(block(0.085, 0.056, 0.014), '#bfe3ff', x, 0.0, -0.2));
    }
    head.add(mesh(new THREE.SphereGeometry(0.212, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 0, 0.01, 0.01));
    for (const [x, y, z] of [[-0.12, 0.17, -0.05], [0.0, 0.21, -0.08], [0.12, 0.16, -0.02], [0.06, 0.2, 0.08], [-0.08, 0.19, 0.1]]) head.add(mesh(ball(0.07), hair, x, y, z));
  } else if (roleId === 'nanny') {
    // Cardigan buttons, a white apron with a pocket, a bun with a pink bow.
    for (const y of [0.18, 0.08, -0.02]) torso.add(mesh(ball(0.016), '#ffffff', 0.0, y, -0.152));
    torso.add(mesh(block(0.3, 0.3, 0.02), '#ffffff', 0, -0.1, -0.16), mesh(block(0.12, 0.08, 0.025), '#ffe0ea', 0, -0.16, -0.17));
    head.add(mesh(new THREE.SphereGeometry(0.212, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.01, 0.01), mesh(ball(0.1), hair, 0, 0.16, 0.14));
    for (const x of [-0.06, 0.06]) {
      const bow = mesh(new THREE.ConeGeometry(0.05, 0.08, 4), '#ff7fa8', x, 0.24, 0.12);
      bow.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      head.add(bow);
    }
  } else if (roleId === 'nurse') {
    const hat = mesh(block(0.24, 0.08, 0.14), '#ffffff', 0, 0.2, -0.02);
    hat.add(mesh(block(0.06, 0.018, 0.012), '#e2384d', 0, 0, -0.075), mesh(block(0.018, 0.06, 0.012), '#e2384d', 0, 0, -0.075));
    head.add(hat, mesh(new THREE.SphereGeometry(0.21, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, 0, 0.01, 0.01));
    const tail = mesh(capsule(0.05, 0.18), hair, 0, -0.08, 0.2);
    tail.rotation.x = 0.5;
    head.add(tail);
    torso.add(mesh(block(0.07, 0.07, 0.02), role.trim, -0.12, 0.13, -0.15));
  }
}

/** A limb hanging from its pivot: a capsule with an end cap (a hand or a shoe). */
function limb(r, len, color, endColor, end) {
  const pivot = new THREE.Group();
  pivot.add(mesh(capsule(r, len), color, 0, -len / 2 - r * 0.5, 0));
  if (end === 'hand') pivot.add(mesh(ball(r * 1.15), endColor, 0, -len - r * 1.2, 0));
  if (end === 'shoe') {
    const shoe = mesh(capsule(r * 1.05, 0.12), endColor, 0, -len - r * 1.1, -0.05);
    shoe.rotation.x = Math.PI / 2;
    pivot.add(shoe);
  }
  return pivot;
}

/**
 * A soldier figure. Returns { root, rig, gun, setFace } where rig holds the posable parts: body,
 * hips, torso, head, legs and arms (pivots), and skirt where the career wears one.
 */
export function buildSoldier(role, team) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const fit = OUTFIT[role.id] || plainOutfit(role);
  const hips = new THREE.Group();
  hips.position.y = 0.9;
  body.add(hips);

  const legL = limb(0.075, 0.62, fit.legs, fit.shoes, 'shoe');
  const legR = limb(0.075, 0.62, fit.legs, fit.shoes, 'shoe');
  legL.position.x = -0.1;
  legR.position.x = 0.1;
  hips.add(legL, legR);
  let skirt = null;
  if (role.id === 'teacher') {
    skirt = mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.52, 18), '#3b3d48', 0, -0.25, 0);
    hips.add(skirt);
  } else if (role.id === 'nanny') {
    // A full pastel skirt to the knee.
    skirt = mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.5, 18), '#fff0b8', 0, -0.22, 0);
    hips.add(skirt);
  } else if (role.id === 'office') {
    // A black pencil skirt, tight to just above the knee.
    skirt = mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.42, 18), '#1d1e26', 0, -0.2, 0);
    hips.add(skirt);
  } else if (role.id === 'nurse') {
    skirt = mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.44, 18), role.suit, 0, -0.2, 0);
    hips.add(skirt);
  }

  const torso = mesh(capsule(0.2, 0.22), fit.torso, 0, 0.3, 0);
  torso.scale.z = 0.72;
  hips.add(torso);
  // Team armbands.
  for (const x of [-0.235, 0.235]) torso.add(mesh(block(0.04, 0.09, 0.2), TEAMS[team].color, x, 0.12, 0));

  const head = new THREE.Group();
  head.position.y = 0.5;
  torso.add(head);
  head.add(mesh(ball(0.2), role.skin));
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(0.202, 24, 16, Math.PI * 1.5 - Math.PI * 0.4, Math.PI * 0.8, Math.PI * 0.22, Math.PI * 0.56),
    new THREE.MeshBasicMaterial({ map: faceTexture(role.id, 'normal'), transparent: true, depthWrite: false }),
  );
  head.add(face);

  const armL = limb(0.055, 0.4, fit.arms, role.skin, 'hand');
  const armR = limb(0.055, 0.4, fit.arms, role.skin, 'hand');
  armL.position.set(-0.26, 0.2, 0);
  armR.position.set(0.26, 0.2, 0);
  torso.add(armL, armR);

  const gun = buildGun(role.id);
  gun.position.set(0.05, 0.16, -0.36);
  torso.add(gun);

  dress(role.id, role, torso, head);
  // The career's build: height for the whole figure, girth for the torso (the head keeps its size).
  const build = BUILD[role.id] || { height: 1, width: 1, depth: 1 };
  body.scale.setScalar(build.height);
  torso.scale.set(build.width, 1, 0.72 * build.depth);
  // What hangs from the torso keeps its own shape: undo the torso's girth on the head, arms and rifle.
  for (const part of [head, armL, armR, gun]) part.scale.set(1 / build.width, 1, 1 / (0.72 * build.depth));
  if (role.id === 'office') {
    // Heels: a raised back to each shoe.
    for (const leg of [legL, legR]) leg.add(mesh(block(0.05, 0.1, 0.05), '#1a1a1a', 0, -0.76, 0.06));
  }
  toonify(root, 0.014);
  root.userData.walk = 0;
  let current = 'normal';
  return {
    root,
    rig: { body, hips, torso, head, legL, legR, armL, armR, skirt },
    gun,
    /** Shows an expression: normal, ko, sleep, love, shock or dizzy. */
    setFace(expr) {
      if (expr === current) return;
      current = expr;
      face.material.map = faceTexture(role.id, expr);
    },
  };
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
  rig.hips.position.y = 0.9 - 0.36 * crouch;
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
  fig.setFace(s.stunned > 0 ? 'dizzy' : s.charmed > 0 ? 'love' : 'normal');
}
