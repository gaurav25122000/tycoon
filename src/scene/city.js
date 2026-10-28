// The living world around the board, dressed by a theme: streets with traffic, buildings, parks,
// clouds, flyers and ambient particles (snow, fireflies, bubbles, stars).
import * as THREE from 'three';
import { canvas } from './art2d.js';
import { vehicleParts, cartParts, treeParts, pineParts, bushGeometry, lampParts, crownGeometry, cloudGeometry, birdGeometry, fishGeometry, mushroomStem, mushroomCap, Builder } from './models.js';

export const GROUND_Y = -0.36;
const MAP = 22;                 // the painted street map covers ±MAP world units
const PLAZA = 6.75, ROAD_IN = 6.9, ROAD_OUT = 8.4, WALK = 8.9, AVE = 0.65, RING2 = [15.4, 16.6];
const POND = { x0: 10.2, x1: 14.2, z0: -6, z1: -1.4 };
const PARK = { x0: -14.4, x1: -9.6, z0: 1.4, z1: 6.4 };
const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
const cheb = (x, z) => Math.max(Math.abs(x), Math.abs(z));

function painter(seed0) {
  let seed = seed0;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// roads: false paints the same ground without its streets, for the tabletop view
function paintMap(S, G, rnd, roads = true) {
  const cv = canvas(S), ctx = cv.getContext('2d'), k = S / (MAP * 2), X = v => (v + MAP) * k;
  ctx.fillStyle = G.grass; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(${rnd() < 0.5 ? G.speck[0] : G.speck[1]},${0.08 + rnd() * 0.1})`; ctx.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 6, 2 + rnd() * 6); }
  const sq = (h, color) => { ctx.fillStyle = color; ctx.fillRect(X(-h), X(-h), 2 * h * k, 2 * h * k); };
  const rect = (x0, z0, x1, z1, color) => { ctx.fillStyle = color; ctx.fillRect(X(x0), X(z0), (x1 - x0) * k, (z1 - z0) * k); };
  if (roads) {
    sq(RING2[1] + 0.3, G.walk); sq(RING2[1], G.road); sq(RING2[0], G.walk); sq(RING2[0] - 0.3, G.grass);
    for (const s of [-1, 1]) { rect(-AVE - 0.3, s > 0 ? WALK : -MAP, AVE + 0.3, s > 0 ? MAP : -WALK, G.walk); rect(s > 0 ? WALK : -MAP, -AVE - 0.3, s > 0 ? MAP : -WALK, AVE + 0.3, G.walk); }
    for (const s of [-1, 1]) { rect(-AVE, s > 0 ? ROAD_OUT : -MAP, AVE, s > 0 ? MAP : -ROAD_OUT, G.road); rect(s > 0 ? ROAD_OUT : -MAP, -AVE, s > 0 ? MAP : -ROAD_OUT, AVE, G.road); }
    sq(WALK, G.walk); sq(ROAD_OUT, G.road); sq(ROAD_IN, G.ringIn);
  } else sq(PLAZA + 0.3, G.walk);
  sq(PLAZA, G.plaza);
  ctx.strokeStyle = 'rgba(120,105,85,.18)'; ctx.lineWidth = Math.max(1, k * 0.02);
  for (let v = -PLAZA; v <= PLAZA; v += 0.75) { ctx.beginPath(); ctx.moveTo(X(v), X(-PLAZA)); ctx.lineTo(X(v), X(PLAZA)); ctx.moveTo(X(-PLAZA), X(v)); ctx.lineTo(X(PLAZA), X(v)); ctx.stroke(); }
  if (roads) {
    ctx.strokeStyle = G.mark; ctx.lineWidth = k * 0.06; ctx.setLineDash([k * 0.4, k * 0.35]);
    const mid = (ROAD_IN + ROAD_OUT) / 2, mid2 = (RING2[0] + RING2[1]) / 2;
    [mid, mid2].forEach(h => ctx.strokeRect(X(-h), X(-h), 2 * h * k, 2 * h * k));
    ctx.beginPath();
    for (const s of [-1, 1]) { ctx.moveTo(X(0), X(s * ROAD_OUT)); ctx.lineTo(X(0), X(s * MAP)); ctx.moveTo(X(s * ROAD_OUT), X(0)); ctx.lineTo(X(s * MAP), X(0)); }
    ctx.stroke(); ctx.setLineDash([]);
    for (const [ax, az] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (let i = -3; i <= 3; i++) {
      const along = i * 0.18;
      if (ax === 0) rect(along - 0.06, az * WALK - (az > 0 ? 0 : 0.5), along + 0.06, az * WALK + (az > 0 ? 0.5 : 0), G.mark);
      else rect(ax * WALK - (ax > 0 ? 0 : 0.5), along - 0.06, ax * WALK + (ax > 0 ? 0.5 : 0), along + 0.06, G.mark);
    }
  }
  rect(PARK.x0, PARK.z0, PARK.x1, PARK.z1, G.park);
  ctx.strokeStyle = G.path; ctx.lineWidth = k * 0.25; ctx.beginPath(); ctx.ellipse(X((PARK.x0 + PARK.x1) / 2), X((PARK.z0 + PARK.z1) / 2), 1.6 * k, 1.8 * k, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = G.path; ctx.beginPath(); ctx.ellipse(X((POND.x0 + POND.x1) / 2), X((POND.z0 + POND.z1) / 2), 2.25 * k, 2.6 * k, 0, 0, Math.PI * 2); ctx.fill();
  return cv;
}
// Windows drawn by the shader: columns fit each face of the (stretched) box, floors follow world
// height so setbacks line up, the ground floor gets shop fronts, and at night some panes light up.
function facade(mat, lit) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uGround = { value: GROUND_Y };
    sh.uniforms.uLit = { value: lit };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc;\nvarying vec3 vScl;\nvarying vec3 vNrm;\nvarying float vWY;\nvarying float vSeed;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vLoc = position; vNrm = normal;
        vScl = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vWY = (modelMatrix * instanceMatrix * vec4(position, 1.0)).y;
        vSeed = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc;\nvarying vec3 vScl;\nvarying vec3 vNrm;\nvarying float vWY;\nvarying float vSeed;\nuniform float uGround;\nuniform vec3 uLit;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wall = 1.0 - step(0.5, abs(vNrm.y));
        float yy = vWY - uGround, shop = step(yy, 0.34);
        bool alongX = abs(vNrm.z) > 0.5;
        float width = alongX ? vScl.x : vScl.z, a = ((alongX ? vLoc.x : vLoc.z) + 0.5) * width;
        float cols = max(1.0, floor(width / mix(0.27, 0.5, shop) + 0.5));
        vec2 cell = vec2(a / (width / cols), shop > 0.5 ? yy / 0.34 : (yy - 0.34) / 0.3);
        vec2 f = fract(cell);
        vec2 lo = mix(vec2(0.2, 0.22), vec2(0.08, 0.12), shop), hi = mix(vec2(0.8, 0.8), vec2(0.92, 0.86), shop);
        float win = wall * step(lo.x, f.x) * step(f.x, hi.x) * step(lo.y, f.y) * step(f.y, hi.y);
        float sill = wall * (1.0 - win) * step(lo.x - 0.05, f.x) * step(f.x, hi.x + 0.05) * step(lo.y - 0.07, f.y) * step(f.y, lo.y);
        float wrnd = fract(sin(dot(floor(cell) + vec2(vSeed, alongX ? 0.0 : 7.0), vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - sill * 0.35), mix(vec3(0.09, 0.13, 0.19), vec3(0.28, 0.37, 0.47), wrnd), win);
        diffuseColor.rgb *= mix(0.68, 1.0, smoothstep(0.0, 0.7, yy));`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.06, win);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.55, win);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uLit * win * step(0.42, wrnd) * (0.6 + wrnd);');
  };
  return mat;
}
// treetops lean with the wind; the trunk base stays put
function sway(mat, wind) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9, bend = max(position.y - 0.35, 0.0);
      transformed.xz += vec2(sin(uWind * 1.7 + ph), cos(uWind * 1.3 + ph * 1.3)) * 0.05 * bend * bend;`);
  };
  return mat;
}
function blobTexture() {
  const cv = canvas(64), ctx = cv.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(0.55, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return cv;
}
// tileable ripples for the pond
function rippleNormals() {
  const S = 128, cv = canvas(S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), T = Math.PI * 2 / S;
  const h = (x, y) => Math.sin((x * 3 + y) * T * 2) + Math.sin((x - y * 2) * T * 3) * 0.6 + Math.sin((x * 5 + y * 3) * T) * 0.4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1), l = Math.hypot(dx, dy, 2), o = (y * S + x) * 4;
    img.data[o] = (-dx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[o + 2] = (2 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
// raised kerbs along the road edges, with gaps where the avenues leave the rings
function kerbs(color) {
  const b = new Builder(), H = 0.035, T = 0.07;
  const run = (x0, z0, x1, z1) => b.add(new THREE.BoxGeometry(Math.max(T, Math.abs(x1 - x0)), H, Math.max(T, Math.abs(z1 - z0))), color, { x: (x0 + x1) / 2, y: GROUND_Y + H / 2, z: (z0 + z1) / 2 });
  const ring = (h, gap) => { for (const sg of [-1, 1]) for (const [a, c] of gap ? [[-h, -AVE], [AVE, h]] : [[-h, h]]) { run(a, sg * h, c, sg * h); run(sg * h, a, sg * h, c); } };
  ring(ROAD_IN, false); ring(ROAD_OUT, true); ring(RING2[0], true); ring(RING2[1], true);
  for (const sg of [-1, 1]) for (const e of [-AVE, AVE]) for (const [a, c] of [[ROAD_OUT, RING2[0]], [RING2[1], MAP]]) { run(e, sg * a, e, sg * c); run(sg * a, e, sg * c, e); }
  return b.build();
}
// rounded-square loop for traffic; position and heading at distance d
function loop(h, r) {
  const straight = 2 * (h - r), quarter = Math.PI * r / 2, len = 4 * (straight + quarter);
  return {
    len,
    at(d) {
      d = ((d % len) + len) % len;
      const seg = straight + quarter, i = Math.floor(d / seg), t = d - i * seg;
      const rot = [0, -Math.PI / 2, Math.PI, Math.PI / 2][i];
      let x, z, a;
      if (t < straight) { x = -h + r + t; z = h; a = 0; }
      else { const u = (t - straight) / r; x = h - r + Math.sin(u) * r; z = h - r + Math.cos(u) * r; a = u; }
      const c = Math.cos(rot), s = Math.sin(rot);
      return { x: x * c - z * s, z: x * s + z * c, heading: rot - a };
    },
  };
}

export function makeCity(scene, maxAniso, T, glowTex) {
  const rnd = painter(11);
  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];
  const keep = x => { disposables.push(x); return x; };
  const tex = cv => { const t = keep(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
  const G = T.ground, night = !!T.glow;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);

  const grass = new THREE.Mesh(keep(new THREE.PlaneGeometry(400, 400)), keep(new THREE.MeshStandardMaterial({ color: G.base, roughness: 1 })));
  grass.rotation.x = -Math.PI / 2; grass.position.y = GROUND_Y - 0.02; grass.receiveShadow = true;
  const streets = tex(paintMap(2048, G, rnd));
  let plain = null; // the roadless ground, painted the first time the tabletop view asks for it
  const map = new THREE.Mesh(keep(new THREE.PlaneGeometry(MAP * 2, MAP * 2)), keep(new THREE.MeshStandardMaterial({ map: streets, roughness: 0.95 })));
  map.rotation.x = -Math.PI / 2; map.position.y = GROUND_Y; map.receiveShadow = true;
  group.add(grass, map);

  let water = null;
  if (T.water) {
    const nm = keep(new THREE.CanvasTexture(rippleNormals())); nm.wrapS = nm.wrapT = THREE.RepeatWrapping; nm.repeat.set(3, 3);
    water = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 48)), keep(new THREE.MeshPhysicalMaterial({ color: T.water.color, roughness: 0.05, metalness: 0, clearcoat: 1, normalMap: nm, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.4 })));
    water.rotation.x = -Math.PI / 2; water.scale.set(2, 2.35, 1);
    water.position.set((POND.x0 + POND.x1) / 2, GROUND_Y + 0.01, (POND.z0 + POND.z1) / 2);
    group.add(water);
  }
  const kerb = new THREE.Mesh(keep(kerbs(G.ringIn)), keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  kerb.receiveShadow = true;
  group.add(kerb);

  // buildings (or mushroom houses) on the blocks beyond the inner ring
  const spots = [];
  for (let x = -MAP * 1.6; x <= MAP * 1.6; x += 1.7) for (let z = -MAP * 1.6; z <= MAP * 1.6; z += 1.7) {
    const jx = x + (rnd() - 0.5) * 0.3, jz = z + (rnd() - 0.5) * 0.3, c = cheb(jx, jz);
    if (c < WALK + 1 || Math.abs(jx) < AVE + 1.1 || Math.abs(jz) < AVE + 1.1) continue;
    if (c > RING2[0] - 1 && c < RING2[1] + 1) continue;
    if (inRect(jx, jz, POND, 1) || inRect(jx, jz, PARK, 0.6)) continue;
    if (rnd() < (T.mushrooms ? 0.45 : 0.18)) continue;
    spots.push([jx, jz, c]);
  }
  if (T.mushrooms) {
    const stems = new THREE.InstancedMesh(keep(mushroomStem()), keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })), spots.length);
    const caps = new THREE.InstancedMesh(keep(mushroomCap()), keep(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.6 })), spots.length);
    spots.forEach(([x, z], i) => {
      const w = 1 + rnd() * 0.35, h = 0.8 + rnd() * 1.4;
      q.setFromAxisAngle(up, rnd() * 6);
      stems.setMatrixAt(i, m4.compose(p.set(x, GROUND_Y, z), q, s.set(w * 0.5, h, w * 0.5)));
      stems.setColorAt(i, col.set(T.buildings[Math.floor(rnd() * T.buildings.length)]));
      caps.setMatrixAt(i, m4.compose(p.set(x, GROUND_Y + h, z), q, s.set(w * 1.5, w, w * 1.5)));
      caps.setColorAt(i, col.set(T.roofs[Math.floor(rnd() * T.roofs.length)]));
    });
    stems.castShadow = caps.castShadow = true;
    group.add(stems, caps);
  } else {
    // midrises get a rooftop; towers step back twice on the way up
    const bodies = [], crowns = [[], [], []];
    spots.forEach(([x, z, c]) => {
      const w = 1 + rnd() * 0.35, d = 1 + rnd() * 0.35, ry = rnd() < 0.5 ? 0 : Math.PI / 2;
      const h = Math.min(11, 0.9 + Math.max(0, c - 9) * 0.28 + rnd() * (c < 13 ? 1 : 3.5));
      const color = T.buildings[Math.floor(rnd() * T.buildings.length)], roof = T.roofs[Math.floor(rnd() * T.roofs.length)];
      if (h < 4.5) { bodies.push([x, z, w, d, 0, h, ry, color]); crowns[rnd() < 0.5 ? 0 : 1].push([x, z, w, d, h, ry, roof]); return; }
      const a = h * 0.62, b = h * 0.85;
      bodies.push([x, z, w, d, 0, a, ry, color], [x, z, w * 0.8, d * 0.8, a, b, ry, color], [x, z, w * 0.6, d * 0.6, b, h, ry, color]);
      crowns[0].push([x, z, w, d, a, ry, roof]); crowns[1].push([x, z, w * 0.8, d * 0.8, b, ry, roof]); crowns[2].push([x, z, w * 0.6, d * 0.6, h, ry, roof]);
    });
    const bGeo = keep(new THREE.BoxGeometry(1, 1, 1)); bGeo.translate(0, 0.5, 0);
    const lit = night ? new THREE.Color(T.glow[0]).multiplyScalar(2.4) : new THREE.Color(0, 0, 0);
    const bMat = keep(facade(new THREE.MeshStandardMaterial({ roughness: night ? 0.5 : 0.82 }), lit));
    const bm = new THREE.InstancedMesh(bGeo, bMat, bodies.length);
    bodies.forEach(([x, z, w, d, y0, y1, ry, color], i) => {
      bm.setMatrixAt(i, m4.compose(p.set(x, GROUND_Y + y0, z), q.setFromAxisAngle(up, ry), s.set(w, y1 - y0, d)));
      bm.setColorAt(i, col.set(color));
    });
    bm.castShadow = bm.receiveShadow = true;
    group.add(bm);
    // at night rooftops are unlit neon in their instance colours
    const roofMat = keep(night ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
    crowns.forEach((list, k) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(keep(crownGeometry(k)), roofMat, list.length);
      list.forEach(([x, z, w, d, y, ry, roof], i) => {
        im.setMatrixAt(i, m4.compose(p.set(x, GROUND_Y + y, z), q.setFromAxisAngle(up, ry), s.set(w, 1, d)));
        im.setColorAt(i, col.set(roof));
      });
      im.castShadow = true;
      group.add(im);
    });
  }

  // trees: plaza corners, sidewalks, the park, around the pond; bushes in planters and the park
  const treeSpots = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) treeSpots.push([sx * 6.1, sz * 6.1], [sx * 6.1, sz * 4.9], [sx * 4.9, sz * 6.1]);
  for (let v = -7.8; v <= 7.8; v += 1.95) if (Math.abs(v) > 1.2) for (const sgn of [-1, 1]) treeSpots.push([v, sgn * 8.65], [sgn * 8.65, v]);
  for (let i = 0; i < 26; i++) treeSpots.push([PARK.x0 + 0.4 + rnd() * (PARK.x1 - PARK.x0 - 0.8), PARK.z0 + 0.4 + rnd() * (PARK.z1 - PARK.z0 - 0.8)]);
  for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2; treeSpots.push([(POND.x0 + POND.x1) / 2 + Math.cos(a) * 2.7, (POND.z0 + POND.z1) / 2 + Math.sin(a) * 3]); }
  if (T.mushrooms) for (let i = 0; i < 60; i++) { const a = rnd() * Math.PI * 2, r = 9.5 + rnd() * 5; treeSpots.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const wind = { value: 0 };
  const crownMat = keep(sway(night ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), wind));
  const trunkMat = keep(sway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), wind));
  const shadowMat = keep(new THREE.MeshBasicMaterial({ map: tex(blobTexture()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const flat = keep(new THREE.PlaneGeometry(1, 1)); flat.rotateX(-Math.PI / 2);
  const treeShadows = new THREE.InstancedMesh(flat, shadowMat, treeSpots.length);
  let ts = 0;
  const leafy = treeSpots.filter((_, i) => i % 3), pines = treeSpots.filter((_, i) => !(i % 3));
  [[treeParts(), leafy, T.leafy], [pineParts(), pines, T.pines]].forEach(([parts, list, greens]) => {
    const trunks = new THREE.InstancedMesh(keep(parts.trunk), trunkMat, list.length), crowns = new THREE.InstancedMesh(keep(parts.crown), crownMat, list.length);
    list.forEach(([x, z], i) => {
      const k = 0.8 + rnd() * 0.5;
      m4.compose(p.set(x, GROUND_Y, z), q.setFromAxisAngle(up, rnd() * 6), s.set(k, k, k));
      trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4);
      crowns.setColorAt(i, col.set(greens[Math.floor(rnd() * greens.length)]));
      treeShadows.setMatrixAt(ts++, m4.compose(p.set(x + 0.08, GROUND_Y + 0.004, z + 0.06), q.identity(), s.set(k * 0.95, 1, k * 0.95)));
    });
    trunks.castShadow = crowns.castShadow = true;
    group.add(trunks, crowns);
  });
  const bushSpots = [];
  for (const sg of [-1, 1]) for (const v of [-5, -3, 3, 5]) bushSpots.push([v, sg * 6.42], [sg * 6.42, v]);
  for (let i = 0; i < 18; i++) bushSpots.push([PARK.x0 + 0.3 + rnd() * (PARK.x1 - PARK.x0 - 0.6), PARK.z0 + 0.3 + rnd() * (PARK.z1 - PARK.z0 - 0.6)]);
  const bushes = new THREE.InstancedMesh(keep(bushGeometry()), crownMat, bushSpots.length);
  bushSpots.forEach(([x, z], i) => {
    const k = 0.7 + rnd() * 0.5;
    bushes.setMatrixAt(i, m4.compose(p.set(x, GROUND_Y, z), q.setFromAxisAngle(up, rnd() * 6), s.set(k, k, k)));
    bushes.setColorAt(i, col.set(T.leafy[Math.floor(rnd() * T.leafy.length)]));
  });
  bushes.castShadow = true;
  group.add(bushes, treeShadows);

  // street lamps around the plaza
  const lamp = lampParts(), lampSpots = [];
  for (let v = -6; v <= 6; v += 2) for (const sg of [-1, 1]) lampSpots.push([v, sg * 6.55], [sg * 6.55, v]);
  const posts = new THREE.InstancedMesh(keep(lamp.post), keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 })), lampSpots.length);
  const bulbs = new THREE.InstancedMesh(keep(lamp.glass), keep(new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#ffcf7a', emissiveIntensity: night ? 3 : 0.5, roughness: 0.15 })), lampSpots.length);
  lampSpots.forEach(([x, z], i) => { m4.compose(p.set(x, GROUND_Y, z), q.identity(), s.set(1, 1, 1)); posts.setMatrixAt(i, m4); bulbs.setMatrixAt(i, m4); });
  posts.castShadow = true;
  group.add(posts, bulbs);

  // traffic on both rings: cars, carts, hover cars or fish
  const lanes = [{ path: loop(7.3, 1), dir: 1 }, { path: loop(8.0, 1.4), dir: -1 }, { path: loop(15.7, 1.2), dir: 1 }, { path: loop(16.3, 1.5), dir: -1 }];
  const cars = [];
  const slow = T.vehicles === 'carts' ? 0.45 : 1;
  lanes.forEach((ln, li) => { const n = li < 2 ? 7 : 9; for (let i = 0; i < n; i++) cars.push({ ln, d: (i / n) * ln.path.len + rnd(), v: (1.1 + rnd() * 0.6) * slow, ph: rnd() * 6 }); });
  const hover = T.vehicles === 'hover', fishy = T.vehicles === 'fish';
  const kinds = fishy ? [{ paint: fishGeometry() }] : T.vehicles === 'carts' ? [cartParts()] : ['sedan', 'hatch', 'van'].map(k => vehicleParts(k, !hover));
  const paintMat = keep(T.vehicles === 'carts' ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })
    : new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: hover ? 0.25 : 0.35, metalness: hover ? 0.7 : 0.3, clearcoat: 1, clearcoatRoughness: 0.06, side: fishy ? THREE.DoubleSide : THREE.FrontSide }));
  // hover cars glow underneath, so their trim is unlit
  const detailMat = keep(hover ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.25 }));
  const fleets = kinds.map((k, ki) => {
    const n = cars.filter((_, i) => i % kinds.length === ki).length;
    const f = { paint: new THREE.InstancedMesh(keep(k.paint), paintMat, n), detail: k.detail && new THREE.InstancedMesh(keep(k.detail), detailMat, n) };
    f.paint.castShadow = !hover; if (f.detail) f.detail.castShadow = !hover;
    group.add(f.paint); if (f.detail) group.add(f.detail);
    return f;
  });
  cars.forEach((c, i) => { c.fleet = fleets[i % kinds.length]; c.slot = Math.floor(i / kinds.length); c.fleet.paint.setColorAt(c.slot, col.set(T.carColors[i % T.carColors.length])); });
  const carShadows = new THREE.InstancedMesh(flat, shadowMat, cars.length);
  if (!hover && !fishy) group.add(carShadows);
  const lift = hover ? 1.1 : fishy ? 0.9 : 0;

  // clouds and flyers
  const clouds = T.clouds ? Array.from({ length: 9 }, () => ({ x: (rnd() - 0.5) * 80, z: (rnd() - 0.5) * 80, y: 13 + rnd() * 5, k: 1.4 + rnd() * 1.6, v: 0.35 + rnd() * 0.3 })) : [];
  const cloudMesh = new THREE.InstancedMesh(keep(cloudGeometry()), keep(new THREE.MeshStandardMaterial({ color: T.clouds || '#ffffff', vertexColors: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 })), Math.max(1, clouds.length));
  cloudMesh.count = clouds.length;
  const flyGeo = keep(T.flyers === 'fish' ? fishGeometry() : birdGeometry());
  const FLY = { birds: '#8a93a6', drones: '#3cf2ff', butterflies: '#ffd166', fish: '#ffffff' };
  const birds = Array.from({ length: T.flyers === 'fish' ? 18 : 7 }, (_, i) => ({ a: i * (T.flyers === 'fish' ? 0.12 : 0.25), r: T.flyers === 'fish' ? 11 + (i % 4) * 0.5 : 19 + (i % 3) * 0.8, y: T.flyers === 'fish' ? 4 + (i % 3) * 0.4 : T.flyers === 'butterflies' ? 2.5 + (i % 3) : 9 + (i % 2) * 0.5, ph: rnd() * 6 }));
  const birdMesh = new THREE.InstancedMesh(flyGeo, keep(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, color: FLY[T.flyers], emissive: T.flyers === 'drones' ? '#3cf2ff' : '#000000', emissiveIntensity: 0.8 })), birds.length);
  if (T.flyers === 'fish' || T.flyers === 'butterflies') birds.forEach((b, i) => birdMesh.setColorAt(i, col.set(T.flyers === 'fish' ? T.carColors[i % T.carColors.length] : ['#ffd166', '#ff8fab', '#7cf0ff', '#c38bff'][i % 4])));
  group.add(cloudMesh, birdMesh);

  // ambient particles
  let pts = null;
  if (T.particles) {
    const N = T.particles === 'stars' ? 500 : 700, pos = new Float32Array(N * 3), cols = new Float32Array(N * 3), seeds = new Float32Array(N);
    const base = new THREE.Color({ snow: '#ffffff', fireflies: '#fff27a', bubbles: '#dff8ff', stars: '#ffffff' }[T.particles]);
    for (let i = 0; i < N; i++) {
      seeds[i] = rnd() * 100;
      if (T.particles === 'stars') { const a = rnd() * Math.PI * 2, e = 0.25 + rnd() * 0.9; pos.set([Math.cos(a) * Math.cos(e) * 70, Math.sin(e) * 60, Math.sin(a) * Math.cos(e) * 70], i * 3); }
      else pos.set([(rnd() - 0.5) * 44, rnd() * (T.particles === 'fireflies' ? 3.5 : 16) + GROUND_Y, (rnd() - 0.5) * 44], i * 3);
      cols.set([base.r, base.g, base.b], i * 3);
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const size = { snow: 0.16, fireflies: 0.22, bubbles: 0.2, stars: 0.6 }[T.particles];
    pts = new THREE.Points(g, keep(new THREE.PointsMaterial({ size, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, fog: T.particles !== 'stars', blending: T.particles === 'snow' || T.particles === 'bubbles' ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: T.particles === 'bubbles' ? 0.7 : 1 })));
    pts.frustumCulled = false;
    pts.userData = { pos, cols, seeds, base, N };
    group.add(pts);
  }

  function update(dt, t) {
    wind.value = t;
    cars.forEach((c, i) => {
      c.d += c.v * dt * c.ln.dir;
      const at = c.ln.path.at(c.d);
      const y = GROUND_Y + lift + (lift ? Math.sin(t * 2 + c.ph) * 0.12 : 0);
      q.setFromAxisAngle(up, at.heading + (c.ln.dir < 0 ? Math.PI : 0));
      m4.compose(p.set(at.x, y, at.z), q, s.set(1, 1, 1));
      c.fleet.paint.setMatrixAt(c.slot, m4); if (c.fleet.detail) c.fleet.detail.setMatrixAt(c.slot, m4);
      carShadows.setMatrixAt(i, m4.compose(p.set(at.x, GROUND_Y + 0.004, at.z), q, s.set(0.75, 1, 0.42)));
    });
    fleets.forEach(f => { f.paint.instanceMatrix.needsUpdate = true; if (f.detail) f.detail.instanceMatrix.needsUpdate = true; });
    carShadows.instanceMatrix.needsUpdate = true;
    clouds.forEach((c, i) => {
      c.x += c.v * dt; if (c.x > 45) c.x = -45;
      cloudMesh.setMatrixAt(i, m4.compose(p.set(c.x, c.y, c.z), q.identity(), s.set(c.k, c.k * 0.55, c.k)));
    });
    cloudMesh.instanceMatrix.needsUpdate = true;
    const fish = T.flyers === 'fish', fa = t * (fish ? 0.08 : T.flyers === 'butterflies' ? 0.2 : 0.12);
    birds.forEach((b, i) => {
      const a = fa + b.a;
      const flap = fish ? 1 : 0.4 + Math.abs(Math.sin(t * (T.flyers === 'butterflies' ? 14 : 9) + b.ph)) * 0.9;
      const k = fish ? 1.2 : T.flyers === 'butterflies' ? 0.8 : 1.4;
      birdMesh.setMatrixAt(i, m4.compose(p.set(Math.cos(a) * b.r, b.y + Math.sin(t + b.ph) * 0.25, Math.sin(a) * b.r), q.setFromAxisAngle(up, -a + (fish ? Math.PI : 0)), s.set(k, k * flap, k)));
    });
    birdMesh.instanceMatrix.needsUpdate = true;
    if (water) water.material.normalMap.offset.set(t * 0.02, t * 0.013);
    if (pts) {
      const { pos, cols, seeds, base, N } = pts.userData;
      for (let i = 0; i < N; i++) {
        const o = i * 3, sd = seeds[i];
        if (T.particles === 'snow') {
          pos[o + 1] -= (0.6 + (sd % 1) * 0.6) * dt; pos[o] += Math.sin(t + sd) * 0.15 * dt;
          if (pos[o + 1] < GROUND_Y) pos[o + 1] = 15;
        } else if (T.particles === 'bubbles') {
          pos[o + 1] += (0.5 + (sd % 1) * 0.6) * dt; pos[o] += Math.sin(t * 2 + sd) * 0.2 * dt;
          if (pos[o + 1] > 15) pos[o + 1] = GROUND_Y;
        } else if (T.particles === 'fireflies') {
          pos[o] += Math.sin(t * 0.7 + sd) * 0.3 * dt; pos[o + 2] += Math.cos(t * 0.6 + sd * 1.3) * 0.3 * dt; pos[o + 1] += Math.sin(t * 1.1 + sd) * 0.15 * dt;
          const k = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.5 + sd * 7));
          cols[o] = base.r * k; cols[o + 1] = base.g * k; cols[o + 2] = base.b * k;
        } else {
          const k = 0.6 + 0.4 * Math.sin(t * 1.5 + sd * 9);
          cols[o] = cols[o + 1] = cols[o + 2] = k;
        }
      }
      pts.geometry.attributes.position.needsUpdate = true;
      pts.geometry.attributes.color.needsUpdate = true;
    }
  }
  // the tabletop view shows the board without streets, traffic, kerbs or street lamps
  function setRoads(on) {
    if (!on && !plain) plain = tex(paintMap(2048, G, painter(11), false)); // same seed: the same grass specks
    map.material.map = on ? streets : plain;
    [kerb, posts, bulbs, carShadows, ...fleets.flatMap(f => [f.paint, f.detail])].forEach(o => { if (o) o.visible = on; });
  }
  update(0, 0);
  return {
    update,
    setRoads,
    dispose() { scene.remove(group); disposables.forEach(d => d.dispose()); },
  };
}
