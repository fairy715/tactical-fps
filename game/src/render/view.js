// The view: draws the world from a soldier's eyes. It keeps a figure for every soldier, poses the
// living from the simulation, hands the fallen to the finishing gags, turns events into effects,
// zooms the camera through the scope, and draws the first-person rifle in its own pass so it
// never sinks into a wall.
import * as THREE from 'three';
import { createStage } from './stage.js';
import { buildSoldier, poseSoldier } from './characters.js';
import { buildGun } from './guns.js';
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
    vmGun = buildGun(roleId);
    vmGun.position.set(0.26, -0.27, -0.62);
    vmGun.rotation.y = -0.05;
    vmGun.scale.setScalar(0.85);
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

  /** Points the view at a new match: the same six careers, so the figures carry over. */
  function rebind(next) {
    world = next;
    finishers.clear();
    for (const fig of figures) fig.root.visible = true;
  }

  return { render, react, rebind, renderer, camera };
}
