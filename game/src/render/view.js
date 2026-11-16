// The view: draws the world from a soldier's eyes. It keeps a figure for every soldier, poses the
// living from the simulation, hands the fallen to the finishing gags, turns events into effects,
// zooms the camera through the scope, and draws the first-person rifle in its own pass so it
// never sinks into a wall.
import * as THREE from 'three';
import { createStage } from './stage.js';
import { buildSoldier, poseSoldier } from './characters.js';
import { buildGun } from './guns.js';
import { toonify } from './toon.js';
import { createEffects } from './effects.js';
import { createFinishers } from './finishers.js';
import { soldierEye } from '../sim/world.js';

const BASE_FOV = 74;

export function createView(host, world) {
  const stage = createStage(host);
  const { renderer, scene, camera } = stage;
  const figures = world.soldiers.map((s) => {
    const fig = buildSoldier(s.role, s.team);
    scene.add(fig.root);
    return fig;
  });
  const effects = createEffects(scene);
  const finishers = createFinishers(scene);

  // First-person rifle: its own scene and camera, lit like the plaza.
  const vmScene = new THREE.Scene();
  vmScene.environment = stage.env;
  vmScene.add(new THREE.HemisphereLight('#ffe2c2', '#4a3d5e', 1.6));
  const key = new THREE.DirectionalLight('#ffc48a', 1.8);
  key.position.set(-1, 1, 1);
  vmScene.add(key);
  const vmCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
  const vmHolder = new THREE.Group();
  vmScene.add(vmHolder);
  let vmRole = null;
  let vmGun = null;
  const kick = { z: 0, pitch: 0 };
  let bob = 0;

  function setViewGun(roleId) {
    if (vmRole === roleId) return;
    if (vmGun) vmHolder.remove(vmGun);
    // No ink on the first-person rifle: up close it is shaded as real metal, wood and polymer.
    vmGun = buildGun(roleId);
    // Held low on the right and angled in, so the rifle's left flank, bolt and scope read.
    vmGun.position.set(0.22, -0.25, -0.58);
    vmGun.rotation.set(0.03, 0.24, -0.22);
    vmHolder.add(vmGun);
    vmRole = roleId;
  }

  /** Turns simulation events into effects and gags. */
  function react(events, viewer, time) {
    for (const e of events) {
      if (e.type === 'shot') {
        const s = world.soldiers[e.id];
        effects.tracer(e, s.role.id, s === viewer);
        if (s === viewer) {
          kick.z = 0.12;
          kick.pitch = 0.12;
        }
      } else if (e.type === 'hit') {
        const v = world.soldiers[e.victim];
        effects.hit(v.pos.x, v.pos.y + (e.head ? 1.65 : 1.15), v.pos.z, e.head);
      } else if (e.type === 'kill') {
        const v = world.soldiers[e.victim];
        finishers.start(figures[e.victim], v, e.finisher, time);
      } else if (e.type === 'burst') {
        effects.burstOf(e.kind, e.x, e.y, e.z);
      } else if (e.type === 'combo') {
        effects.combo(e.x, e.z, e.team, e.name);
      } else if (e.type === 'detonated') {
        effects.glitter(e.x, e.z);
      } else if (e.type === 'roundStart') {
        finishers.clear();
      }
    }
  }

  /** Draws a frame from viewer's eyes (a living soldier, or a teammate being spectated). */
  function render(viewer, dt, time) {
    // The living are posed from the simulation (the viewer's own figure hidden); the fallen are
    // left to their finishing gag.
    world.soldiers.forEach((s, i) => {
      if (!s.alive) return;
      poseSoldier(figures[i], s, dt);
      figures[i].root.visible = s !== viewer;
    });
    finishers.update(time);
    effects.update(world, dt, time);

    const eye = soldierEye(viewer);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.set(viewer.pitch + viewer.recoilPitch, viewer.yaw + viewer.recoilYaw, 0);
    const zoom = viewer.scoped ? viewer.gun.def.zoom : 1;
    const fov = BASE_FOV / zoom;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 18);
      camera.updateProjectionMatrix();
    }
    renderer.clear();
    renderer.render(scene, camera);

    if (viewer.alive && !viewer.scoped) {
      setViewGun(viewer.role.id);
      const speed = Math.hypot(viewer.vel.x, viewer.vel.z);
      bob += speed * dt * 1.6;
      kick.z *= Math.exp(-dt * 12);
      kick.pitch *= Math.exp(-dt * 10);
      const reload = viewer.gun.reloading > 0 ? Math.sin(Math.min(1, (viewer.gun.def.reload - viewer.gun.reloading) / viewer.gun.def.reload) * Math.PI) : 0;
      vmHolder.position.set(Math.sin(bob) * 0.012 * Math.min(1, speed / 3), Math.abs(Math.cos(bob)) * 0.01 * Math.min(1, speed / 3) - reload * 0.25, kick.z);
      vmHolder.rotation.set(kick.pitch + reload * 0.6, 0, -reload * 0.4);
      vmCamera.aspect = camera.aspect;
      vmCamera.updateProjectionMatrix();
      renderer.clearDepth();
      renderer.render(vmScene, vmCamera);
    }
  }

  /**
   * The title's line-up: the six careers on the plaza before the monument, the Gentlemen on the
   * left and the Night Shift on the right, idling, each holding its rifle.
   */
  // The title screen's team photo: the Night Shift in front, the Gentlemen on a stone riser
  // behind them so all six faces show, framed in the half of the screen the title panel leaves.
  // Each row is as wide as its side, so the photo grows with the roster.
  const perRow = Math.max(...['atk', 'def'].map((t) => world.soldiers.filter((s) => s.team === t).length));
  const PHOTO = { x: 5, z: 12.2, gap: 1.12, rise: 0.8 };
  const riser = new THREE.Mesh(new THREE.BoxGeometry(perRow * PHOTO.gap + 0.9, PHOTO.rise, 1.3), new THREE.MeshStandardMaterial({ color: '#b9ad9b' }));
  riser.position.set(PHOTO.x, PHOTO.rise / 2, PHOTO.z - 0.75);
  riser.receiveShadow = riser.castShadow = true;
  toonify(riser, 0.02);
  riser.visible = false;
  scene.add(riser);

  function renderLineup(time) {
    finishers.update(time);
    riser.visible = true;
    const seat = { atk: 0, def: 0 };
    world.soldiers.forEach((s, i) => {
      const fig = figures[i];
      const back = s.team === 'atk';
      const side = world.soldiers.filter((o) => o.team === s.team).length;
      const col = seat[s.team]++ - (side - 1) / 2;
      fig.root.visible = true;
      fig.root.position.set(PHOTO.x + col * PHOTO.gap, back ? PHOTO.rise : 0, back ? PHOTO.z - 0.75 : PHOTO.z + 0.55);
      // Facing the camera, each turned a little toward the middle of the photo.
      fig.root.rotation.set(0, Math.PI - col * 0.16, 0);
      const { rig } = fig;
      rig.body.position.set(0, Math.abs(Math.sin(time * 2 + i)) * 0.03, 0);
      rig.body.rotation.set(0, 0, 0);
      rig.hips.position.y = 0.9;
      rig.legL.rotation.x = rig.legR.rotation.x = 0;
      rig.legL.scale.y = rig.legR.scale.y = 1;
      rig.torso.rotation.set(0, Math.sin(time * 0.8 + i) * 0.12, 0);
      rig.head.rotation.set(-0.05, Math.sin(time * 0.6 + i * 2) * 0.2, 0);
      // Order arms: rifle stood upright at the right side, muzzle up, so it never hides a face.
      rig.armL.rotation.set(-0.15, 0, 0.12);
      rig.armR.rotation.set(-0.25, 0, -0.18);
      fig.gun.position.set(0.36, -0.12, -0.1);
      fig.gun.rotation.set(Math.PI / 2 - 0.08, 0, -0.06);
      fig.setFace(i % 2 ? 'normal' : 'love');
    });
    effects.update(world, 0.016, time);
    // The camera looks a little left of the group so the photo sits right of the title panel.
    camera.position.set(PHOTO.x, 1.7, PHOTO.z + 4.6 + perRow * 0.95);
    camera.rotation.set(-0.04, 0.31, 0);
    camera.fov = BASE_FOV * 0.62;
    camera.updateProjectionMatrix();
    renderer.clear();
    renderer.render(scene, camera);
  }

  /** Points the view at a new match: the same six careers, so the figures carry over. */
  function rebind(next) {
    world = next;
    finishers.clear();
    riser.visible = false;
    for (const fig of figures) {
      fig.root.visible = true;
      fig.gun.position.set(0.05, 0.16, -0.36);
    }
  }

  return { render, renderLineup, react, rebind, renderer, camera };
}
