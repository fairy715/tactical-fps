// The cartoon look: three-step toon shading and ink outlines. An outline is the inverted-hull
// trick: a slightly larger copy of a mesh drawn from behind in flat ink, so every figure, rifle
// and prop gets a drawn edge without any post-processing pass.
import * as THREE from 'three';

let ramp = null;
/** The three-band light ramp every toon material shares. */
function gradient() {
  if (ramp) return ramp;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

const toonCache = new Map();
/** A shared toon material for a colour (or a canvas map), optionally glowing. */
export function toon(color, opts = {}) {
  const key = `${color}|${opts.map ? opts.map.uuid : ''}|${opts.emissive || ''}|${opts.opacity || 1}`;
  if (!toonCache.has(key)) {
    toonCache.set(key, new THREE.MeshToonMaterial({
      color,
      map: opts.map || null,
      gradientMap: gradient(),
      emissive: opts.emissive || '#000000',
      transparent: (opts.opacity || 1) < 1,
      opacity: opts.opacity || 1,
    }));
  }
  return toonCache.get(key);
}

const INK = new THREE.MeshBasicMaterial({ color: '#1b1622', side: THREE.BackSide });
const box3 = new THREE.Box3();
const size = new THREE.Vector3();

/** Gives a mesh an ink outline about `width` metres thick. */
export function outline(mesh, width = 0.018) {
  mesh.geometry.computeBoundingBox();
  box3.copy(mesh.geometry.boundingBox);
  box3.getSize(size);
  const hull = new THREE.Mesh(mesh.geometry, INK);
  hull.scale.set(1 + (2 * width) / Math.max(size.x, 0.01), 1 + (2 * width) / Math.max(size.y, 0.01), 1 + (2 * width) / Math.max(size.z, 0.01));
  // Re-centre so an off-centre geometry grows evenly about its own middle.
  box3.getCenter(size);
  hull.position.set(-size.x * (hull.scale.x - 1), -size.y * (hull.scale.y - 1), -size.z * (hull.scale.z - 1));
  hull.castShadow = false;
  hull.userData.outline = true;
  mesh.add(hull);
  return mesh;
}

/**
 * Converts every standard material under root to toon shading and outlines each solid mesh.
 * Transparent parts (glass, the syringe barrel) keep their material and get no outline; meshes
 * marked userData.pbr (the rifles) keep their physical metal and wood but get the outline.
 */
export function toonify(root, width) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.outline) meshes.push(o);
  });
  for (const m of meshes) {
    const src = m.material;
    if (src.transparent) continue;
    // Rifles keep their metal and wood (physically shaded); everything else goes toon.
    if (src.isMeshStandardMaterial && !m.userData.pbr) m.material = toon(`#${src.color.getHexString()}`, { map: src.map, emissive: src.emissive && src.emissive.getHex() ? `#${src.emissive.getHexString()}` : null });
    outline(m, width);
  }
  return root;
}
