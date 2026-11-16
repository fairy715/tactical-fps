// Effects, all drawn from fixed pools made once (nothing is allocated per frame): tracers tinted by
// career, muzzle flashes, impact sparks and hit puffs, smoke clouds, the camera-flash pop, and the
// glitter charge itself with its blinking light and its confetti blast.
import * as THREE from 'three';
import { zoneDecal as zoneDecal_ } from './textures.js';

const TRACER_COLORS = { boss: '#ffd56b', playboy: '#ff7aa8', chef: '#ffe0b0', teacher: '#ffffff', office: '#9fc4ff', nurse: '#6ff2df' };
const MAX_TRACERS = 24;
const MAX_PARTICLES = 900;
const SMOKE_PUFFS = 14;

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createEffects(scene) {
  const dot = softDot();

  // Tracers: one line-segment buffer, each slot fading on its own.
  const tracerPos = new Float32Array(MAX_TRACERS * 6);
  const tracerCol = new Float32Array(MAX_TRACERS * 6);
  const tracerLife = new Float32Array(MAX_TRACERS);
  const tracerBase = Array.from({ length: MAX_TRACERS }, () => new THREE.Color());
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  tracerGeo.setAttribute('color', new THREE.BufferAttribute(tracerCol, 3));
  const tracers = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  tracers.frustumCulled = false;
  scene.add(tracers);
  let nextTracer = 0;

  // Particles: sparks, puffs and glitter share one point cloud.
  const pPos = new Float32Array(MAX_PARTICLES * 3);
  const pCol = new Float32Array(MAX_PARTICLES * 3);
  const pVel = new Float32Array(MAX_PARTICLES * 3);
  const pLife = new Float32Array(MAX_PARTICLES);
  const pGrav = new Float32Array(MAX_PARTICLES);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.12, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false;
  scene.add(points);
  let nextParticle = 0;
  const tmpColor = new THREE.Color();

  function burst(x, y, z, count, color, speed, life, gravity) {
    tmpColor.set(color);
    for (let i = 0; i < count; i++) {
      const k = nextParticle;
      nextParticle = (nextParticle + 1) % MAX_PARTICLES;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.3 + Math.random() * 0.8);
      pPos[k * 3] = x;
      pPos[k * 3 + 1] = y;
      pPos[k * 3 + 2] = z;
      pVel[k * 3] = Math.cos(a) * Math.cos(b) * s;
      pVel[k * 3 + 1] = Math.sin(b) * s + speed * 0.4;
      pVel[k * 3 + 2] = Math.sin(a) * Math.cos(b) * s;
      pCol[k * 3] = tmpColor.r;
      pCol[k * 3 + 1] = tmpColor.g;
      pCol[k * 3 + 2] = tmpColor.b;
      pLife[k] = life * (0.6 + Math.random() * 0.6);
      pGrav[k] = gravity;
    }
  }

  // Muzzle flash: one light and one sprite, moved to whoever just fired near the camera.
  const flashLight = new THREE.PointLight('#ffcf8a', 0, 9);
  scene.add(flashLight);
  let flashLife = 0;

  // Smoke clouds: a pool of puffs per cloud slot.
  const smokeMat = new THREE.SpriteMaterial({ map: dot, color: '#e4ddd2', transparent: true, depthWrite: false, opacity: 0.9 });
  const smokeSlots = [];
  for (let i = 0; i < 6; i++) {
    const group = new THREE.Group();
    for (let j = 0; j < SMOKE_PUFFS; j++) {
      const s = new THREE.Sprite(smokeMat);
      s.userData.offset = new THREE.Vector3(Math.cos(j * 2.4) * (0.3 + (j % 3) * 0.25), (j % 4) * 0.22 - 0.2, Math.sin(j * 2.4) * (0.3 + (j % 3) * 0.25));
      group.add(s);
    }
    group.visible = false;
    scene.add(group);
    smokeSlots.push(group);
  }

  // Lingering zones (the Chef's fire, the Nurse's sedative): a glowing ring on the ground each.
  const zoneMats = {
    fire: new THREE.MeshBasicMaterial({ color: '#ff6a1f', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
    slow: new THREE.MeshBasicMaterial({ color: '#5fe0b8', transparent: true, opacity: 0.25, depthWrite: false }),
  };
  const zoneDiscs = [];
  for (let i = 0; i < 6; i++) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 32), zoneMats.fire);
    disc.rotation.x = -Math.PI / 2;
    disc.visible = false;
    scene.add(disc);
    zoneDiscs.push(disc);
  }

  // The drop zone: a painted ring where the first of the Night Shift fell, and a beam of light.
  const zone = new THREE.Group();
  const zoneDecal = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ map: zoneDecal_('★', '#f5c45b'), transparent: true, depthWrite: false }));
  zoneDecal.rotation.x = -Math.PI / 2;
  zoneDecal.position.y = 0.03;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#f5c45b', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = 15;
  zone.add(zoneDecal, beam);
  zone.visible = false;
  scene.add(zone);

  // The glitter charge.
  const charge = new THREE.Group();
  const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: '#d63c8f', roughness: 0.3, metalness: 0.5 }));
  caseMesh.position.y = 0.11;
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.03, 8, 16), new THREE.MeshStandardMaterial({ color: '#f5c45b', metalness: 0.8, roughness: 0.3 }));
  bow.position.y = 0.26;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3355' }));
  led.position.set(0.12, 0.23, -0.1);
  charge.add(caseMesh, bow, led);
  charge.visible = false;
  scene.add(charge);
  const ledLight = new THREE.PointLight('#ff3355', 0, 6);
  charge.add(ledLight);

  return {
    tracer(e, color, near) {
      const k = nextTracer;
      nextTracer = (nextTracer + 1) % MAX_TRACERS;
      // Start the line a little ahead of the eye so it reads as leaving the barrel.
      const dx = e.x - e.sx;
      const dy = e.y - e.sy;
      const dz = e.z - e.sz;
      const len = Math.hypot(dx, dy, dz) || 1;
      const lead = near ? 0.9 : 0.4;
      tracerPos.set([e.sx + (dx / len) * lead, e.sy - (near ? 0.12 : 0) + (dy / len) * lead, e.sz + (dz / len) * lead, e.x, e.y, e.z], k * 6);
      tracerBase[k].set(TRACER_COLORS[color] || '#ffffff');
      tracerLife[k] = 0.18;
      flashLight.position.set(e.sx, e.sy, e.sz);
      flashLight.color.set('#ffcf8a');
      flashLight.intensity = near ? 6 : 3;
      flashLife = 0.06;
      if (!e.victim) burst(e.x, e.y, e.z, 7, '#ffd9a0', 2.2, 0.35, 9);
    },
    hit(x, y, z, head) {
      burst(x, y, z, head ? 18 : 10, head ? '#ff5a6e' : '#d9384d', 2.2, 0.5, 6);
    },
    /** A grenade going off, by kind: the lingering clouds and flames are drawn in update. */
    burstOf(kind, x, y, z) {
      if (kind === 'flash') {
        burst(x, y, z, 40, '#ffffff', 6, 0.3, 0);
        flashLight.position.set(x, y + 0.5, z);
        flashLight.intensity = 40;
        flashLife = 0.25;
      } else if (kind === 'frag') {
        burst(x, y + 0.3, z, 90, '#ffcf4a', 9, 1.2, 12);
        burst(x, y + 0.3, z, 50, '#ff8a3a', 5, 0.5, 0);
        flashLight.position.set(x, y + 1, z);
        flashLight.color.set('#ffb35a');
        flashLight.intensity = 30;
        flashLife = 0.3;
      } else if (kind === 'charm') {
        burst(x, y + 0.5, z, 70, '#ff5d8f', 5, 1.4, -1);
        burst(x, y + 0.5, z, 30, '#ffc2d6', 3, 1.6, -1);
      } else {
        burst(x, y, z, 24, kind === 'fire' ? '#ff7a2a' : kind === 'slow' ? '#7fe7c8' : '#ffffff', 3, 0.6, 2);
      }
    },
    /** A team combo: a ring of the team's colours and a column of sparks. */
    combo(x, z, team) {
      const colors = team === 'def' ? ['#f2609a', '#ffffff', '#7fe7c8'] : ['#4f8ff7', '#ffcf4a', '#ff5d8f'];
      for (const c of colors) burst(x, 0.6, z, 80, c, 9, 1.6, 3);
      flashLight.position.set(x, 2, z);
      flashLight.color.set(colors[0]);
      flashLight.intensity = 50;
      flashLife = 0.5;
    },
    glitter(x, z) {
      const colors = ['#ff6fb5', '#ffd35b', '#7fe0ff', '#b98cff', '#ffffff'];
      for (const c of colors) burst(x, 1, z, 150, c, 11, 2.2, 4);
    },
    update(world, dt, time) {
      for (let k = 0; k < MAX_TRACERS; k++) {
        tracerLife[k] = Math.max(0, tracerLife[k] - dt);
        const a = tracerLife[k] / 0.18;
        const c = tracerBase[k];
        const o = k * 6;
        tracerCol[o] = c.r * a;
        tracerCol[o + 1] = c.g * a;
        tracerCol[o + 2] = c.b * a;
        tracerCol[o + 3] = c.r * a * 0.2;
        tracerCol[o + 4] = c.g * a * 0.2;
        tracerCol[o + 5] = c.b * a * 0.2;
      }
      tracerGeo.attributes.position.needsUpdate = true;
      tracerGeo.attributes.color.needsUpdate = true;
      for (let k = 0; k < MAX_PARTICLES; k++) {
        if (pLife[k] <= 0) continue;
        pLife[k] -= dt;
        pVel[k * 3 + 1] -= pGrav[k] * dt;
        pPos[k * 3] += pVel[k * 3] * dt;
        pPos[k * 3 + 1] = Math.max(0.02, pPos[k * 3 + 1] + pVel[k * 3 + 1] * dt);
        pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt;
        if (pLife[k] <= 0) pPos[k * 3 + 1] = -100;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      flashLife -= dt;
      if (flashLife <= 0) flashLight.intensity = 0;
      // Smoke.
      smokeSlots.forEach((group, i) => {
        const s = world.smokes[i];
        group.visible = !!s;
        if (!s) return;
        group.position.set(s.x, s.y - 0.4, s.z);
        for (const puff of group.children) {
          const o = puff.userData.offset;
          puff.position.set(o.x * s.r, o.y * s.r + Math.sin(time * 0.5 + o.x) * 0.1, o.z * s.r);
          puff.scale.setScalar(s.r * 1.25);
        }
      });
      // Zones: a ring on the ground and a steady trickle of flame or gas from it.
      zoneDiscs.forEach((disc, i) => {
        const z = world.zones[i];
        disc.visible = !!z;
        if (!z) return;
        disc.material = zoneMats[z.kind];
        disc.position.set(z.x, 0.04, z.z);
        disc.scale.setScalar(z.r * (0.92 + Math.sin(time * 9 + i) * 0.04));
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * z.r;
        if (z.kind === 'fire') burst(z.x + Math.cos(a) * r, 0.1, z.z + Math.sin(a) * r, 3, Math.random() < 0.5 ? '#ff7a2a' : '#ffd25a', 1.2, 0.7, -2.5);
        else burst(z.x + Math.cos(a) * r, 0.4, z.z + Math.sin(a) * r, 1, '#7fe7c8', 0.4, 1.6, -0.4);
      });
      const dz = world.dropZone;
      zone.visible = !!dz;
      if (dz) {
        zone.position.set(dz.x, dz.y, dz.z);
        zoneDecal.rotation.z = time * 0.3;
        beam.material.opacity = 0.12 + Math.sin(time * 3) * 0.04;
      }
      // The charge: carried charges are drawn on the carrier; here, dropped or planted ones.
      const bomb = world.bomb;
      charge.visible = bomb.state === 'dropped' || bomb.state === 'planted';
      if (charge.visible) {
        charge.position.set(bomb.x, bomb.y, bomb.z);
        const rate = bomb.state === 'planted' ? Math.max(1.5, 12 - bomb.timer * 0.25) : 0.7;
        const on = Math.sin(time * rate * Math.PI) > 0;
        led.material.color.set(on ? '#ff3355' : '#330a12');
        ledLight.intensity = bomb.state === 'planted' && on ? 3 : 0;
      }
    },
  };
}
