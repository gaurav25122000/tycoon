// Physics dice: simulate a real throw, then turn the dice so the engine's numbers land face up.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { drawDieFace } from './art2d.js';
import { DECK_AT, CARD } from './layout.js';
import { DICE_LOOK } from './themes.js';

export const SIZE = 0.34;
const HALF = 3.35;   // dice stay inside the board's centre square
const FPS = 60;
// value on each BoxGeometry face: +x, -x, +y, -y, +z, -z (opposite faces add to 7)
const FACE_VALUE = [3, 4, 1, 6, 2, 5];
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(v => new THREE.Vector3(...v));

// two dice in each player's chosen design, plus the red speed die.
// All six faces share one atlas texture so a die is a single draw call.
function atlasGeometry() {
  const geo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, SIZE * 0.14), uv = geo.attributes.uv, idx = geo.index;
  geo.groups.forEach((g, face) => {
    const seen = new Set();
    for (let k = g.start; k < g.start + g.count; k++) {
      const v = idx ? idx.getX(k) : k;
      if (seen.has(v)) continue;
      seen.add(v); uv.setX(v, (face + 0.015 + uv.getX(v) * 0.97) / 6); // inset so faces don't bleed
    }
  });
  geo.clearGroups();
  return geo;
}
export function makeDice(scene, maxTex) {
  const geo = atlasGeometry();
  const mats = (look, speed) => {
    const cv = document.createElement('canvas'); cv.width = 768; cv.height = 128;
    FACE_VALUE.forEach((v, i) => cv.getContext('2d').drawImage(drawDieFace(v, speed, look), i * 128, 0));
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxTex;
    return new THREE.MeshStandardMaterial({ map: t, roughness: look.rough, metalness: look.metal, envMapIntensity: look.metal ? 1 : 0.5 });
  };
  const skins = DICE_LOOK.map(l => mats(l, false)), red = mats(DICE_LOOK[0], true);
  const meshes = [0, 1, 2].map(i => {
    const m = new THREE.Mesh(geo, i === 2 ? red : skins[0]);
    m.castShadow = m.receiveShadow = true; m.visible = i < 2;
    scene.add(m);
    return m;
  });
  meshes[0].position.set(-0.3, SIZE / 2, 1.4); meshes[1].position.set(0.3, SIZE / 2, 1.5);
  meshes.skin = k => { meshes[0].material = meshes[1].material = skins[k] || skins[0]; };
  return meshes;
}

// Run the throw offline: returns per-frame transforms, impacts for sound, and the face each die ended on.
export function simulate(n, from, rng = Math.random) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -42, 0) });
  world.allowSleep = true;
  const dieMat = new CANNON.Material('die'), floorMat = new CANNON.Material('floor');
  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, floorMat, { friction: 0.3, restitution: 0.32 }));
  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.1, restitution: 0.4 }));
  const floor = new CANNON.Body({ mass: 0, material: floorMat, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  [[HALF, 0, -Math.PI / 2], [-HALF, 0, Math.PI / 2], [0, HALF, Math.PI], [0, -HALF, 0]].forEach(([x, z, r]) => {
    const w = new CANNON.Body({ mass: 0, material: floorMat, shape: new CANNON.Plane() });
    w.position.set(x, 0, z);
    w.quaternion.setFromEuler(0, r, 0); // plane normal (+z) turned to face the centre
    world.addBody(w);
  });
  for (const k of ['F', 'T']) {
    const d = DECK_AT[k], b = new CANNON.Body({ mass: 0, material: floorMat, shape: new CANNON.Box(new CANNON.Vec3(CARD.w / 2 + 0.05, 0.15, CARD.d / 2 + 0.05)) });
    b.position.set(d.x, 0.15, d.z); b.quaternion.setFromEuler(0, d.r, 0);
    world.addBody(b);
  }
  const dir = new THREE.Vector3(-from.x, 0, -from.z).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
  const bodies = Array.from({ length: n }, (_, i) => {
    const b = new CANNON.Body({ mass: 1, material: dieMat, shape: new CANNON.Box(new CANNON.Vec3(SIZE / 2, SIZE / 2, SIZE / 2)), sleepSpeedLimit: 0.12, sleepTimeLimit: 0.3, linearDamping: 0.12, angularDamping: 0.12 });
    const off = (i - (n - 1) / 2) * 0.45;
    b.position.set(from.x + side.x * off, 1.3 + rng() * 0.4, from.z + side.z * off);
    b.quaternion.setFromEuler(rng() * 6.3, rng() * 6.3, rng() * 6.3);
    const speed = 7 + rng() * 3;
    b.velocity.set(dir.x * speed + (rng() - 0.5) * 2, 1 + rng() * 2, dir.z * speed + (rng() - 0.5) * 2);
    b.angularVelocity.set((rng() - 0.5) * 30, (rng() - 0.5) * 30, (rng() - 0.5) * 30);
    world.addBody(b);
    return b;
  });
  const frames = [], impacts = [];
  bodies.forEach((b, i) => b.addEventListener('collide', e => {
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (v > 1.2) impacts.push({ f: frames.length, i, v });
  }));
  for (let f = 0; f < FPS * 6; f++) {
    world.step(1 / 120); world.step(1 / 120);
    frames.push(bodies.map(b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
    if (f > 20 && bodies.every(b => b.sleepState === CANNON.Body.SLEEPING)) break;
  }
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
  const tops = bodies.map(b => {
    q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    let best = 0, bd = -2;
    NORMALS.forEach((nrm, k) => { const d = nrm.clone().applyQuaternion(q).dot(up); if (d > bd) { bd = d; best = k; } });
    return best;
  });
  return { frames, impacts, tops };
}

// Rotation (in the die's own frame) that brings face `value` to where face `top` landed.
export function correction(value, top) {
  return new THREE.Quaternion().setFromUnitVectors(NORMALS[FACE_VALUE.indexOf(value)], NORMALS[top]);
}
export { FPS };
