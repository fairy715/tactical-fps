// The stage: the WebGL renderer, the camera, dusk lighting with long shadows, and Sundown Plaza
// itself built from the simulation's boxes (so what you see is exactly what blocks you), dressed
// with lamps, trees, benches and the painted site letters.
import * as THREE from 'three';
import { DECOR, SITES, SOLIDS } from '../sim/map.js';
import * as T from './textures.js';

const BUILDING_LOOK = {
  school: ['#9a4a3a', '#e8dcc6', '#2c3a4a', '#ffd98e', "ST. MERIDIAN SCHOOL", '#f6e7c4', 'rgba(60,20,10,0.25)'],
  clinic: ['#e6ecef', '#9fb3bd', '#3a5160', '#c9f1ff', 'CITY CLINIC +', '#e2384d', 'rgba(120,140,150,0.3)'],
  office: ['#5d7184', '#2c3946', '#30475f', '#ffe7a8', 'HALCYON TOWER', '#dbe8f5', null],
  restaurant: ['#7d4b37', '#2a1d16', '#3b2a22', '#ffb86b', 'BRASSERIE NINE', '#ffd27a', null],
  club: ['#3b2a4f', '#1b1326', '#2a1d3a', '#ff7ad1', 'VELVET CLUB', '#ff86d8', null],
  bank: ['#c8bba3', '#8e826e', '#3c4652', '#ffe2a3', 'FIRST HARBOR BANK', '#3d2f1d', 'rgba(90,80,60,0.3)'],
  cafe: ['#d97c4f', '#5a2e1c', '#3a2a24', '#ffd28f', 'CAFE NOON', '#fff2d8', null],
  kiosk: ['#2f6f73', '#173b3d', '#22393b', '#fff0b0', 'PRESS', '#fdf6dc', null],
};

const CONTAINER_COLORS = ['#a8452f', '#2f7f86', '#c99a2e', '#4e6aa8'];

export function createStage(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = T.skyGradient();
  scene.fog = new THREE.Fog('#d9997a', 70, 240);
  const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 500);
  camera.rotation.order = 'YXZ';

  addLights(scene);
  addGround(scene);
  addSolids(scene);
  addDecor(scene);
  addSkyline(scene);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  return { renderer, scene, camera, resize };
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight('#ffd9b8', '#463a5c', 1.15));
  const sun = new THREE.DirectionalLight('#ffbf7f', 2.6);
  sun.position.set(-70, 46, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -75;
  c.right = 75;
  c.top = 60;
  c.bottom = -60;
  c.near = 10;
  c.far = 220;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#8fa6ff', 0.35);
  fill.position.set(60, 30, -40);
  scene.add(fill);
}

function addGround(scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 100), new THREE.MeshStandardMaterial({ map: T.paving(), roughness: 0.92 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  for (const site of Object.values(SITES)) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ map: T.siteDecal(site.id, '#f5c45b'), transparent: true, opacity: 0.85, depthWrite: false }));
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(site.x, 0.02, site.z);
    scene.add(decal);
  }
}

function materialFor(kind, id, cache) {
  const key = kind.startsWith('container') ? `${kind}${id % CONTAINER_COLORS.length}` : kind;
  if (cache[key]) return cache[key];
  let mat;
  if (BUILDING_LOOK[kind]) {
    const [base, frame, glass, lit, sign, signColor, tile] = BUILDING_LOOK[kind];
    mat = new THREE.MeshStandardMaterial({ map: T.facade(base, frame, glass, lit, sign, signColor, tile), roughness: 0.8 });
  } else if (kind.startsWith('container')) mat = new THREE.MeshStandardMaterial({ map: T.containerRibs(CONTAINER_COLORS[id % CONTAINER_COLORS.length]), roughness: 0.6, metalness: 0.3 });
  else if (kind.startsWith('crate')) mat = new THREE.MeshStandardMaterial({ map: T.cratePlanks(), roughness: 0.85 });
  else if (kind === 'hedge') mat = new THREE.MeshStandardMaterial({ map: T.hedge(), roughness: 1 });
  else if (kind === 'monument') mat = new THREE.MeshStandardMaterial({ map: T.stone(), roughness: 0.7 });
  else if (kind === 'tower') mat = new THREE.MeshStandardMaterial({ color: '#56606b', roughness: 0.5, metalness: 0.6 });
  else if (kind === 'step') mat = new THREE.MeshStandardMaterial({ color: '#7b848e', roughness: 0.6, metalness: 0.5 });
  else if (kind === 'rail') mat = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.4, metalness: 0.3 });
  else if (kind === 'screen') mat = new THREE.MeshStandardMaterial({ color: '#2f3b52', roughness: 0.8 });
  else if (kind === 'salt') mat = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 1 });
  else mat = new THREE.MeshStandardMaterial({ color: '#4a4652', roughness: 0.9 });
  cache[key] = mat;
  return mat;
}

function addSolids(scene) {
  const cache = {};
  for (const b of SOLIDS) {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const h = b.h - b.y0;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materialFor(b.kind, b.id, cache));
    mesh.position.set((b.x0 + b.x1) / 2, b.y0 + h / 2, (b.z0 + b.z1) / 2);
    mesh.castShadow = b.kind !== 'perimeter';
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (b.kind === 'monument') addStatue(scene, mesh.position.x, b.h, mesh.position.z);
    if (b.kind === 'tower') addScaffold(scene, b);
  }
}

/** Bracing and a canopy on each tower, so it reads as a scaffold, not a block. */
function addScaffold(scene, b) {
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ced4', roughness: 0.4, metalness: 0.7 });
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8.4, 0.16), steel);
    post.position.set(cx + dx * 1.95, 4.2, cz + dz * 1.95);
    post.castShadow = true;
    scene.add(post);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.15, 4.4), new THREE.MeshStandardMaterial({ color: '#d2513a', roughness: 0.7 }));
  canopy.position.set(cx, 8.4, cz);
  canopy.castShadow = true;
  scene.add(canopy);
}

function addStatue(scene, x, top, z) {
  const bronze = new THREE.MeshStandardMaterial({ color: '#7a5a33', roughness: 0.45, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.2, 10), bronze);
  body.position.set(x, top + 1.6, z);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), bronze);
  head.position.set(x, top + 3.6, z);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 0.32), bronze);
  arm.position.set(x + 0.8, top + 2.8, z);
  arm.rotation.z = 0.5;
  for (const m of [body, head, arm]) {
    m.castShadow = true;
    scene.add(m);
  }
}

function addDecor(scene) {
  const pole = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.5, metalness: 0.6 });
  const bulb = new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffcf7a', emissiveIntensity: 2.2 });
  for (const [x, z] of DECOR.lamps) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 8), pole);
    p.position.set(x, 2.5, z);
    p.castShadow = true;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), bulb);
    b.position.set(x, 5.1, z);
    scene.add(p, b);
  }
  const trunk = new THREE.MeshStandardMaterial({ color: '#5b3e2b', roughness: 0.9 });
  const leaves = new THREE.MeshStandardMaterial({ color: '#4c7a3e', roughness: 1 });
  for (const [x, z] of DECOR.trees) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.6, 8), trunk);
    t.position.set(x, 1.3, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), leaves);
    crown.position.set(x, 3.6, z);
    crown.scale.y = 1.2;
    t.castShadow = crown.castShadow = true;
    scene.add(t, crown);
  }
  const wood = new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: 0.8 });
  for (const [x, z, turn] of DECOR.benches) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), wood);
    seat.position.set(x, 0.5, z);
    seat.rotation.y = turn ? Math.PI / 2 : 0;
    seat.castShadow = true;
    scene.add(seat);
  }
}

/** Far towers beyond the fence, for a skyline at dusk. */
function addSkyline(scene) {
  const mat = new THREE.MeshStandardMaterial({ color: '#3e3550', roughness: 1, emissive: '#1d1626' });
  const lit = new THREE.MeshBasicMaterial({ color: '#ffd28f' });
  let n = 5;
  for (let i = 0; i < 26; i++) {
    n = (n * 37 + 11) % 97;
    const a = (i / 26) * Math.PI * 2;
    const r = 105 + (n % 30);
    const h = 18 + (n % 40);
    const w = 8 + (n % 9);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    tower.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    scene.add(tower);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.6, w * 1.01), lit);
    strip.position.set(tower.position.x, h * 0.6, tower.position.z);
    scene.add(strip);
  }
}
