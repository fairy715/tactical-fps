// Finishing gags: a kill plays the killer's career on the victim. The Teacher hands back an F;
// the Office Lady buries you in paperwork stamped OVERTIME; the Nurse sedates you to sleep; the
// Boss fires you in a shower of banknotes; the Playboy leaves you swooning among hearts; the
// Chef serves you under a cloche. Each gag poses the fallen figure and adds its props.
import * as THREE from 'three';
import { labelTexture } from './textures.js';

const labels = {};
function label(text, color, bg, height) {
  const key = text + color + bg;
  if (!labels[key]) labels[key] = labelTexture(text, color, bg);
  const { tex, aspect } = labels[key];
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  sprite.scale.set(height * aspect, height, 1);
  return sprite;
}

const GAG_TEXT = {
  graded: ['F  ·  SEE ME', '#d32f2f', '#fbf6e9'],
  overtime: ['OVERTIME', '#c62828', 'rgba(255,255,255,0.92)'],
  sedated: ['SEDATED', '#11807a', 'rgba(232,248,246,0.92)'],
  fired: ["YOU'RE FIRED", '#c62828', 'rgba(255,248,230,0.92)'],
  swoon: ['SWOONED', '#e2385d', 'rgba(255,236,244,0.92)'],
  served: ['ORDER UP!', '#2b2b2b', 'rgba(255,255,255,0.92)'],
};

export const GAG_VERBS = {
  graded: 'graded',
  overtime: 'buried in overtime',
  sedated: 'sedated',
  fired: 'fired',
  swoon: 'swept off their feet',
  served: 'served',
  blast: 'glittered',
};

export function createFinishers(scene) {
  const active = [];
  const paper = new THREE.MeshStandardMaterial({ color: '#f7f5ef', roughness: 0.9 });
  const bill = new THREE.MeshStandardMaterial({ color: '#7fbf6a', roughness: 0.8, side: THREE.DoubleSide });
  const heart = new THREE.MeshStandardMaterial({ color: '#ff4f7b', emissive: '#6b0d22', roughness: 0.4 });
  const silver = new THREE.MeshStandardMaterial({ color: '#d7dbe0', roughness: 0.15, metalness: 0.95 });
  const bandage = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });

  /** Starts a gag on a fallen figure: kind is the killer's finisher ('blast' for the charge). */
  function start(fig, s, kind, time) {
    const g = { fig, kind: kind || 'blast', t0: time, props: [], x: s.pos.x, y: s.pos.y, z: s.pos.z };
    const root = new THREE.Group();
    root.position.set(g.x, g.y, g.z);
    scene.add(root);
    g.root = root;
    const words = GAG_TEXT[g.kind];
    if (words) {
      const tag = label(words[0], words[1], words[2], 0.55);
      tag.position.y = 2.3;
      root.add(tag);
      g.tag = tag;
    }
    if (g.kind === 'overtime') {
      for (let i = 0; i < 9; i++) {
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.3), paper);
        sheet.userData.drop = 2.4 + i * 0.35;
        sheet.userData.rest = 0.05 + i * 0.045;
        sheet.rotation.y = i * 0.7;
        sheet.castShadow = true;
        root.add(sheet);
        g.props.push(sheet);
      }
    } else if (g.kind === 'fired') {
      for (let i = 0; i < 14; i++) {
        const note = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), bill);
        note.userData.v = new THREE.Vector3(Math.cos(i * 2.4) * 1.6, 3 + (i % 4), Math.sin(i * 2.4) * 1.6);
        note.position.y = 1.3;
        root.add(note);
        g.props.push(note);
      }
    } else if (g.kind === 'swoon') {
      for (let i = 0; i < 8; i++) {
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), heart);
        h.userData.a = (i / 8) * Math.PI * 2;
        root.add(h);
        g.props.push(h);
      }
    } else if (g.kind === 'served') {
      const lid = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), silver);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), silver);
      knob.position.y = 1.12;
      lid.add(knob);
      lid.position.y = 6;
      lid.castShadow = true;
      root.add(lid);
      g.props.push(lid);
    } else if (g.kind === 'sedated') {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 18), bandage);
      fig.rig.head.add(wrap);
      wrap.rotation.x = Math.PI / 2;
      g.wrap = wrap;
      for (let i = 0; i < 3; i++) {
        const z = label('z', '#11807a', null, 0.35 + i * 0.12);
        z.userData.i = i;
        root.add(z);
        g.props.push(z);
      }
    } else if (g.kind === 'graded') {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.46), new THREE.MeshBasicMaterial({ map: label('F', '#d32f2f', '#fbf6e9', 1).material.map }));
      fig.rig.head.add(sheet);
      sheet.position.set(0, 0.05, -0.17);
      sheet.rotation.y = Math.PI;
      g.sheet = sheet;
    }
    active.push(g);
  }

  /** Poses every fallen figure and moves the gag props. */
  function update(time) {
    for (const g of active) {
      const t = time - g.t0;
      const { rig, root: body } = g.fig;
      const k = Math.min(1, t / 0.6);
      body.visible = g.kind !== 'served' || t < 0.9;
      rig.armL.rotation.set(-0.3, 0, 0.5);
      rig.armR.rotation.set(-0.3, 0, -0.5);
      if (g.kind === 'graded') {
        // Sits down in the corner.
        rig.hips.position.y = 0.92 - 0.62 * k;
        rig.legL.rotation.x = rig.legR.rotation.x = -1.45 * k;
        rig.torso.rotation.x = 0.25 * k;
      } else if (g.kind === 'sedated') {
        rig.body.rotation.z = (Math.PI / 2) * k;
        rig.body.position.y = 0.2 * k;
        g.props.forEach((z, i) => {
          const c = (t * 0.6 + i * 0.33) % 1;
          z.position.set(0.5 + c * 0.4, 0.6 + c * 1.6, 0);
          z.material.opacity = 1 - c;
        });
      } else if (g.kind === 'swoon') {
        rig.body.rotation.x = 0.5 * k;
        rig.body.position.y = 0.35 * Math.min(1, t / 1.2) + Math.sin(t * 2) * 0.05;
        rig.head.rotation.x = -0.6 * k;
        g.props.forEach((h) => {
          const a = h.userData.a + t * 1.8;
          h.position.set(Math.cos(a) * 0.7, 0.9 + ((t * 0.6 + h.userData.a) % 1.6), Math.sin(a) * 0.7);
        });
      } else if (g.kind === 'served') {
        const lid = g.props[0];
        lid.position.y = Math.max(0, 6 - t * t * 14);
      } else {
        // Falls flat: backward when fired, forward otherwise.
        const dir = g.kind === 'fired' ? -1 : 1;
        rig.body.rotation.x = dir * (Math.PI / 2) * k;
        rig.body.position.y = 0.15 * k;
      }
      if (g.kind === 'overtime') {
        for (const sheet of g.props) sheet.position.y = Math.max(sheet.userData.rest + 0.15, sheet.userData.drop - t * 4);
      }
      if (g.kind === 'fired') {
        for (const note of g.props) {
          const v = note.userData.v;
          const tt = Math.min(t, 2.2);
          note.position.set(v.x * tt * 0.6, Math.max(0.05, 1.3 + v.y * tt - 4 * tt * tt), v.z * tt * 0.6);
          note.rotation.set(t * 5 + v.x, t * 3, t * 4);
        }
      }
      if (g.tag) g.tag.position.y = 2.3 + Math.sin(t * 3) * 0.06;
    }
  }

  /** Clears every gag (a new round). */
  function clear() {
    for (const g of active) {
      scene.remove(g.root);
      if (g.wrap) g.wrap.removeFromParent();
      if (g.sheet) g.sheet.removeFromParent();
      g.fig.rig.body.rotation.set(0, 0, 0);
    }
    active.length = 0;
  }

  return { start, update, clear };
}
