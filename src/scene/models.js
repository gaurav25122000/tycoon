// Procedural models. Each is one merged geometry with vertex colours,
// so a token, a landmark or a car costs a single draw call.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export class Builder {
  constructor() { this.parts = []; }
  // o.grad = [bottom, top] shades the part darker towards its base
  add(geo, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    _m.compose(_p.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0)), _s.set(o.sx || 1, o.sy || 1, o.sz || 1));
    g.applyMatrix4(_m);
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (o.grad) shade(g, o.grad);
    this.parts.push(g);
    return this;
  }
  build(grad) { const g = mergeGeometries(this.parts); if (grad) shade(g, grad); g.computeBoundingSphere(); g.computeBoundingBox(); return g; }
}
function shade(g, [lo, hi]) {
  g.computeBoundingBox();
  const p = g.attributes.position, c = g.attributes.color, y0 = g.boundingBox.min.y, dy = g.boundingBox.max.y - y0 || 1;
  for (let i = 0; i < p.count; i++) { const k = lo + (hi - lo) * (p.getY(i) - y0) / dy; c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
}
// a smooth lumpy ball: foliage, bushes, clouds
function blob(r, seed, detail = 2, amt = 0.16, flat = 0.92) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 1.9) * Math.sin(z * 3.3 + seed * 2.6) + 0.5 * Math.sin(x * 6.3 - z * 5.1 + seed * 3.1) * Math.sin(y * 5.7 + seed);
    const k = r * (1 + n * amt);
    p.setXYZ(i, x * k, y * k * flat, z * k);
  }
  g.computeVertexNormals();
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, n = 16) => new THREE.CylinderGeometry(rt, rb, h, n);
const cone = (r, h, n = 16) => new THREE.ConeGeometry(r, h, n);
const sph = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const tor = (r, t, rs = 8, ts = 20, arc) => new THREE.TorusGeometry(r, t, rs, ts, arc);
const lathe = (pts, n = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), n);
function prism(w, h, d) { // triangular roof, ridge along x
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2);
  return g;
}

// ---------- tokens: pewter and brass miniatures ----------
const PEWTER = '#dfe3ea', GOLD = '#e9bb52', INK = '#2a2d36';
const TOKENS = [
  function skyscraper(b) {
    b.add(box(.2, .26, .2), PEWTER, { y: .13 }).add(box(.15, .16, .15), PEWTER, { y: .34 }).add(box(.1, .1, .1), PEWTER, { y: .47 });
    b.add(box(.205, .012, .205), GOLD, { y: .262 }).add(box(.155, .012, .155), GOLD, { y: .422 }).add(cyl(.006, .014, .16, 8), GOLD, { y: .6 });
  },
  function gramophone(b) {
    b.add(box(.24, .08, .2), INK, { y: .04 }).add(cyl(.08, .08, .014, 24), PEWTER, { x: -.02, y: .087 });
    b.add(cyl(.008, .008, .2, 8), PEWTER, { x: .06, y: .17, z: -.05, rz: .5 });
    b.add(lathe([[.012, 0], [.018, .08], [.035, .17], [.075, .24], [.12, .27], [.13, .272]], 24), GOLD, { x: .1, y: .25, z: -.04, rz: -.9 });
  },
  function pocketWatch(b) {
    b.add(cyl(.13, .13, .045, 32), GOLD, { y: .15, rx: Math.PI / 2 }).add(cyl(.108, .108, .05, 32), '#faf6ea', { y: .15, rx: Math.PI / 2 });
    b.add(box(.012, .07, .01), INK, { y: .18, z: .03 }).add(box(.01, .05, .01), INK, { x: .018, y: .15, z: .03, rz: -1.1 });
    b.add(cyl(.02, .02, .035, 12), GOLD, { y: .295 }).add(tor(.035, .009, 8, 20), GOLD, { y: .34 });
  },
  function key(b) {
    b.add(tor(.07, .022, 12, 28), GOLD, { y: .45 }).add(cyl(.02, .02, .32, 12), GOLD, { y: .22 });
    b.add(box(.07, .04, .02), GOLD, { x: .035, y: .1 }).add(box(.05, .035, .02), GOLD, { x: .025, y: .17 }).add(tor(.03, .008, 8, 16), GOLD, { y: .45 });
  },
  function fountainPen(b) {
    b.add(cyl(.042, .042, .14, 20), INK, { y: .07 }).add(cyl(.044, .044, .016, 20), GOLD, { y: .14 });
    b.add(cyl(.036, .04, .22, 20), INK, { y: .26 }).add(cyl(.03, .036, .02, 20), GOLD, { y: .38 });
    b.add(cone(.03, .11, 20), GOLD, { y: .445 }).add(box(.012, .1, .012), GOLD, { x: .045, y: .08 });
  },
  function saxophone(b) {
    const body = new THREE.CatmullRomCurve3([[0, .5, 0], [0, .28, 0], [0, .14, 0], [.04, .08, 0], [.1, .08, 0], [.13, .14, 0], [.135, .2, 0]].map(v => new THREE.Vector3(...v)));
    b.add(new THREE.TubeGeometry(body, 40, .028, 12, false), GOLD);
    b.add(lathe([[.03, 0], [.035, .04], [.06, .08], [.085, .1]], 20), GOLD, { x: .135, y: .2 });
    const neck = new THREE.CatmullRomCurve3([[0, .5, 0], [-.02, .55, 0], [-.07, .57, 0]].map(v => new THREE.Vector3(...v)));
    b.add(new THREE.TubeGeometry(neck, 12, .016, 8, false), GOLD).add(cyl(.01, .016, .04, 10), INK, { x: -.085, y: .57 });
    [.22, .3, .38].forEach(y => b.add(cyl(.012, .012, .01, 10), PEWTER, { x: .028, y }));
  },
  function camera(b) {
    b.add(box(.26, .15, .12), INK, { y: .1 }).add(box(.265, .03, .125), PEWTER, { y: .19 });
    b.add(cyl(.055, .06, .07, 24), PEWTER, { y: .1, z: .09, rx: Math.PI / 2 }).add(cyl(.04, .04, .072, 24), '#141824', { y: .1, z: .093, rx: Math.PI / 2 });
    b.add(box(.08, .05, .07), PEWTER, { x: -.06, y: .225 }).add(cyl(.018, .018, .02, 12), GOLD, { x: .08, y: .215 });
  },
  function umbrella(b) {
    b.add(cyl(.012, .012, .42, 10), PEWTER, { y: .21 });
    b.add(lathe([[.2, 0], [.17, .05], [.11, .1], [.04, .125], [0, .13]], 8), GOLD, { y: .36 });
    b.add(cone(.012, .05, 8), PEWTER, { y: .51 }).add(tor(.04, .012, 8, 16, Math.PI), PEWTER, { x: -.04, y: .02, rz: Math.PI });
  },
];
// how each token likes to travel
export const GAIT = ['hop', 'spin', 'roll', 'twirl', 'hop', 'sway', 'hop', 'glide'];
// the figure carries the base's gold rim too, so a token is two draw calls
export function tokenGeometry(i) { const b = new Builder(); TOKENS[i](b); b.add(tor(.2, .012, 8, 40), GOLD, { rx: Math.PI / 2 }); return b.build(); }
// polished miniatures: chrome and brass on an enamelled base in the player's colour
export const tokenMetal = env => new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 1, roughness: 0.14, clearcoat: 0.6, clearcoatRoughness: 0.1, envMap: env, envMapIntensity: 1.25 });
export const tokenEnamel = (color, env) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.06, envMap: env, envMapIntensity: 1.1 });
export function tokenBase() { return new Builder().add(cyl(.2, .215, .05, 40), '#ffffff', { y: .025 }).build(); }

// ---------- landmarks that rise on bought property (front faces +z) ----------
const WIN = '#2b3a55', WHITE = '#f4f1ea', ROOF = '#5b4a44';
function windows(b, w, h, z, rows, cols, y0, color = WIN) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    b.add(box(w * 0.7 / cols, h * 0.5 / rows, .01), color, { x: -w * 0.35 + (c + 0.5) * w * 0.7 / cols, y: y0 + (r + 0.5) * h / rows, z });
  }
}
const LANDMARKS = [
  function stall(b, v) { // The Hills: street food stall
    b.add(box(.46, .2, .3), '#b8834f', { y: .1 }).add(box(.5, .03, .34), '#8a5a3c', { y: .215 });
    for (let i = 0; i < 5; i++) b.add(box(.1, .02, .2), i % 2 ? WHITE : '#d6453f', { x: -.2 + i * .1, y: .37, z: .08, rx: -.35 });
    b.add(cyl(.012, .012, .16, 6), '#6b4a2f', { x: -.22, y: .3, z: .15 }).add(cyl(.012, .012, .16, 6), '#6b4a2f', { x: .22, y: .3, z: .15 });
    [-.12, .12].forEach(x => b.add(sph(.035), '#e8433f', { x, y: .3, z: .17 }));
    b.add(box(.2, .08, .02), '#f2d58a', { y: .44 + v * .02, z: -.05 });
  },
  function shop(b, v) { // Beach Towns: corner shop with striped awning
    b.add(box(.46, .34 + v * .04, .36), '#9fd4ef', { y: .17 }).add(box(.5, .04, .4), WHITE, { y: .36 + v * .04 });
    for (let i = 0; i < 6; i++) b.add(box(.077, .02, .14), i % 2 ? WHITE : '#3a8fc2', { x: -.19 + i * .077, y: .25, z: .22, rx: -.5 });
    b.add(box(.1, .16, .01), '#6b4a2f', { y: .08, z: .181 });
    b.add(box(.12, .09, .01), '#cde9f7', { x: -.15, y: .12, z: .181 }).add(box(.12, .09, .01), '#cde9f7', { x: .15, y: .12, z: .181 });
  },
  function studio(b, v) { // Rajasthan: pink studio with a ring light
    b.add(box(.42, .4 + v * .05, .36), '#f28cbf', { y: .2 }).add(cyl(.21, .21, .36, 20, 1), '#e86fa9', { y: .4 + v * .05, rz: Math.PI / 2, sx: 1, sy: 1, sz: .5 });
    b.add(tor(.09, .018, 8, 24), WHITE, { y: .22, z: .19 }).add(cyl(.07, .07, .01, 20), '#ffe8f4', { y: .22, z: .182, rx: Math.PI / 2 });
    windows(b, .42, .12, .181, 1, 2, .3);
  },
  function theatre(b, v) { // Heritage Cities: theatre with a marquee
    b.add(box(.52, .36 + v * .04, .4), '#f5a04a', { y: .18 }).add(prism(.54, .12, .42), '#c96f1f', { y: .36 + v * .04 });
    b.add(box(.44, .1, .06), '#7a2e1a', { y: .2, z: .22 });
    for (let i = 0; i < 7; i++) b.add(sph(.014, 6, 4), '#ffe27a', { x: -.18 + i * .06, y: .26, z: .25 });
    b.add(box(.14, .16, .01), '#5a1d10', { y: .08, z: .201 });
  },
  function spa(b, v) { // The East: spa with a dome and hedges
    b.add(cyl(.2, .22, .3, 20), '#f7e3dc', { y: .15 }).add(sph(.2, 20, 10), '#e0453c', { y: .3 + v * .02, sy: .8 });
    b.add(cyl(.02, .02, .1, 8), GOLD, { y: .5 + v * .02 });
    [-1, 1].forEach(s => b.add(sph(.08, 8, 6), '#3e9b4f', { x: s * .23, y: .07, z: .1 }));
    b.add(box(.1, .14, .02), '#8a3b2f', { y: .07, z: .21 });
  },
  function apartments(b, v) { // The South: tall townhouse with a rooftop star
    const h = .62 + v * .1;
    b.add(box(.36, h, .34), '#f5d54a', { y: h / 2 }).add(box(.4, .04, .38), WHITE, { y: h });
    windows(b, .36, h - .1, .171, 4, 2, .06);
    b.add(cone(.05, .08, 5), GOLD, { y: h + .08 });
  },
  function mansion(b, v) { // Tech Hubs: columned mansion
    b.add(box(.56, .28, .38), WHITE, { y: .14 }).add(prism(.6, .14, .44), '#2e9e5b', { y: .28 + v * .02 });
    for (let i = 0; i < 4; i++) b.add(cyl(.018, .018, .24, 8), '#ffffff', { x: -.18 + i * .12, y: .12, z: .22 });
    b.add(box(.5, .03, .1), WHITE, { y: .25, z: .22 }).add(box(.1, .14, .01), '#2b2b2b', { y: .07, z: .191 });
  },
  function tower(b, v) { // Metros: glass skyscraper
    const h = .9 + v * .12;
    b.add(box(.32, h, .32), '#2f5fb3', { y: h / 2 }).add(box(.24, .14, .24), '#244a8f', { y: h + .07 });
    for (let i = 1; i < 8; i++) b.add(box(.326, .012, .326), '#9cc2ff', { y: i * h / 8 });
    b.add(cyl(.006, .012, .22, 6), '#d9dde3', { y: h + .25 });
  },
];
function station(b) {
  b.add(box(.56, .04, .3), '#b9b2a6', { y: .02 }).add(box(.4, .2, .14), '#d9cfbd', { y: .14, z: -.06 }).add(prism(.44, .1, .2), '#a33a2c', { y: .24, z: -.06 });
  b.add(box(.36, .12, .1), '#c62f2f', { y: .1, z: .1 }).add(box(.34, .03, .11), '#2b2b2b', { y: .045, z: .1 });
  windows(b, .36, .06, .151, 1, 4, .1, '#cfe7ff');
}
function wifiTower(b) {
  b.add(cyl(.02, .06, .7, 6), '#c9ccd3', { y: .35 }).add(sph(.04), '#e8433f', { y: .73 });
  [.3, .45, .6].forEach(y => b.add(tor(.07 - y * .05, .008, 6, 16), '#5a8fd6', { y, rx: Math.PI / 2 }));
  b.add(box(.2, .06, .2), '#8d929c', { y: .03 });
}
function waterTower(b) {
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => b.add(cyl(.012, .012, .34, 6), '#8d6b4a', { x: x * .1, y: .17, z: z * .1 }));
  b.add(cyl(.16, .16, .2, 18), '#3b8fd1', { y: .44 }).add(cone(.18, .1, 18), '#2a6ea8', { y: .59 });
  b.add(box(.08, .03, .01), WHITE, { y: .44, z: .161 });
}
export function landmarkGeometry(sq, pos) {
  const b = new Builder(), v = ((pos * 37) % 10) / 10;
  if (sq.t === 'prop') LANDMARKS[sq.g](b, v);
  else if (sq.t === 'station') station(b);
  else if (pos === 12) wifiTower(b);
  else waterTower(b);
  return b.build();
}

// ---------- houses, hotels, flags ----------
// glossy plastic for houses and hotels
export const pieceGloss = () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.08 });
export function houseGeometry() {
  return new Builder().add(new RoundedBoxGeometry(.11, .085, .1, 2, .008), '#2fa24a', { y: .0425 }).add(prism(.115, .055, .11), '#23863b', { y: .085 })
    .add(box(.018, .03, .018), '#23863b', { x: .03, y: .12, z: .02 }).build();
}
export function hotelGeometry() {
  return new Builder().add(new RoundedBoxGeometry(.26, .13, .12, 2, .01), '#d63a33', { y: .065 }).add(prism(.265, .06, .13), '#b02a25', { y: .13 }).build();
}
export function flagPoleGeometry() { return new Builder().add(cyl(.006, .006, .26, 6), '#f4f1ea', { y: .13 }).add(sph(.012, 6, 4), GOLD, { y: .265 }).build(); }
export function flagClothGeometry() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(.12, -.035); s.lineTo(0, -.07); s.closePath();
  const g = new THREE.ShapeGeometry(s); g.translate(0, .255, 0);
  return new Builder().add(g, '#ffffff').build();
}

// ---------- props ----------
export function gavelGeometry() {
  return new Builder().add(cyl(.05, .05, .2, 16), '#7a4a2a', { rz: Math.PI / 2 }).add(cyl(.052, .052, .03, 16), GOLD, { x: .06, rz: Math.PI / 2 })
    .add(cyl(.052, .052, .03, 16), GOLD, { x: -.06, rz: Math.PI / 2 }).add(cyl(.014, .018, .34, 10), '#9a6438', { y: -.17 }).build();
}
export function cageGeometry(size) {
  const b = new Builder(), h = .5, n = 6;
  for (let i = 0; i <= n; i++) {
    const t = -size / 2 + i * size / n;
    [[t, -size / 2], [t, size / 2], [-size / 2, t], [size / 2, t]].forEach(([x, z]) => b.add(cyl(.012, .012, h, 6), '#4b5160', { x, y: h / 2, z }));
  }
  [0.02, h].forEach(y => [[0, -size / 2, size, .04], [0, size / 2, size, .04], [-size / 2, 0, .04, size], [size / 2, 0, .04, size]]
    .forEach(([x, z, w, d]) => b.add(box(w + .03, .03, d + .01), '#2f343f', { x, y, z })));
  return b.build();
}

// ---------- the city ----------
// Vehicles and trees come in two parts sharing one transform: `paint` takes the theme's instance
// colour, `detail` keeps its own colours (glass, tyres, lights, bark).
const BARK = '#6b4a32', IRON = '#262b31', GLASS = '#1d2a38', TYRE = '#17181b', CHROME = '#c9ced6';
function profile(points, depth, bevel) { // a side silhouette extruded across the width
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))),
    { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}
const CARS = {
  sedan: { L: .56, W: .25, body: [[-.27, .06], [.27, .06], [.275, .115], [.25, .145], [.12, .158], [-.2, .158], [-.265, .145], [-.275, .1]], cab: [[.115, .15], [.035, .232], [-.12, .232], [-.195, .15]], wx: .17, wr: .055 },
  hatch: { L: .46, W: .24, body: [[-.22, .06], [.22, .06], [.225, .115], [.2, .15], [.1, .162], [-.205, .162], [-.225, .115]], cab: [[.095, .155], [.025, .245], [-.165, .245], [-.205, .155]], wx: .14, wr: .055 },
  van: { L: .58, W: .27, body: [[-.28, .065], [.28, .065], [.285, .13], [.26, .185], [.19, .195], [-.28, .195]], cab: [[.19, .19], [.13, .29], [-.27, .29], [-.27, .19]], wx: .19, wr: .06 },
};
export function vehicleParts(kind, wheels = true) {
  const C = CARS[kind], paint = new Builder(), detail = new Builder(), hw = C.W / 2, fx = C.L / 2 + .02; // the bevel pushes the nose out
  const top = Math.max(...C.cab.map(p => p[1])), xs = C.cab.filter(p => p[1] === top).map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
  paint.add(profile(C.body, C.W, .022), '#ffffff');
  paint.add(new RoundedBoxGeometry(x1 - x0 + .03, .022, C.W - .035, 2, .008), '#ffffff', { x: (x0 + x1) / 2, y: top + .004 });
  paint.add(box(.022, top - .15, C.W - .04), '#ffffff', { x: (x0 + x1) / 2 - .01, y: (top + .15) / 2 });
  [-1, 1].forEach(sd => paint.add(box(.028, .022, .02), '#ffffff', { x: C.cab[0][0] - .02, y: C.cab[0][1] + .02, z: sd * (hw + .008) }));
  detail.add(profile(C.cab, C.W - .045, .012), GLASS);
  [-1, 1].forEach(sd => {
    detail.add(box(.014, .03, .05), '#fffbe8', { x: fx, y: .125, z: sd * (hw - .05) });
    detail.add(box(.014, .026, .055), '#e0302e', { x: -fx, y: .125, z: sd * (hw - .045) });
    detail.add(box(.03, .03, C.W - .02), '#2b2e33', { x: sd * fx, y: .07 });
  });
  detail.add(box(.01, .028, .09), '#14161a', { x: fx, y: .1 });
  if (wheels) [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const o = { x: sx * C.wx, y: C.wr, z: sz * (hw - .012), rx: Math.PI / 2 };
    detail.add(cyl(C.wr, C.wr, .045, 18), TYRE, o).add(cyl(C.wr * .6, C.wr * .6, .049, 14), CHROME, o).add(cyl(C.wr * .2, C.wr * .2, .052, 8), '#5a6068', o);
  });
  else detail.add(box(C.L * .7, .02, C.W * .8), '#3cf2ff', { y: .05 });
  return { paint: paint.build(), detail: detail.build() };
}
export function cartParts() {
  const paint = new Builder().add(new THREE.CylinderGeometry(.13, .13, .34, 14, 1, true, 0, Math.PI), '#ffffff', { y: .27, rz: Math.PI / 2 });
  const detail = new Builder().add(new RoundedBoxGeometry(.42, .09, .24, 2, .015), '#8a5a3c', { y: .15 }).add(box(.44, .02, .25), '#6b4429', { y: .2 });
  [[.14, 1], [.14, -1], [-.14, 1], [-.14, -1]].forEach(([x, sd]) => {
    detail.add(tor(.07, .012, 6, 18), '#4a3020', { x, y: .07, z: sd * .13 });
    detail.add(box(.13, .012, .01), '#4a3020', { x, y: .07, z: sd * .13 }).add(box(.012, .13, .01), '#4a3020', { x, y: .07, z: sd * .13 });
  });
  detail.add(cyl(.012, .012, .2, 6), '#4a3020', { x: .3, y: .12, rz: Math.PI / 2 - .3 }).add(sph(.03, 10, 8), '#ffd166', { x: .2, y: .42 });
  return { paint: paint.build(), detail: detail.build() };
}
export function treeParts() {
  const trunk = new Builder().add(cyl(.032, .058, .64, 7), BARK, { y: .32, grad: [.6, 1] })
    .add(cyl(.011, .02, .26, 5), BARK, { x: .07, y: .58, rz: -.8 }).add(cyl(.011, .02, .24, 5), BARK, { x: -.06, y: .6, z: .03, rz: .75 }).build();
  const crown = new Builder();
  [[.34, 0, .88, 0], [.25, .21, .76, .1], [.24, -.2, .78, -.08], [.22, .03, 1.1, -.04], [.2, -.04, .8, .23], [.18, .1, .82, -.23]]
    .forEach(([r, x, y, z], i) => crown.add(blob(r, i * 1.7 + 0.4), '#ffffff', { x, y, z, grad: [.8, 1.04] }));
  return { trunk, crown: crown.build([.62, 1.1]) };
}
function tier(r, h, seed) { // one drooping skirt of pine boughs
  const g = lathe([[0.001, h], [r * .55, h * .42], [r, 0], [r * .7, -.035]], 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0.01) continue;
    const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + Math.sin(a * 6 + seed) * .1;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) - (k - 1) * .2, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}
export function pineParts() {
  const trunk = new Builder().add(cyl(.026, .045, .36, 6), BARK, { y: .18, grad: [.6, 1] }).build();
  const crown = new Builder();
  for (let i = 0; i < 5; i++) { const t = i / 4; crown.add(tier(.34 - t * .22, .32 - t * .1, i * 2.1), '#ffffff', { y: .24 + t * .62, ry: i * .7 }); }
  return { trunk, crown: crown.build([.5, 1.12]) };
}
export function bushGeometry() { return new Builder().add(blob(.2, 3.3, 2, .2, .7), '#ffffff', { y: .1 }).add(blob(.14, 5.1, 2, .2, .75), '#ffffff', { x: .14, y: .08, z: .05 }).build([.6, 1.1]); }
export function lampParts() {
  const post = new Builder().add(cyl(.05, .06, .05, 10), IRON, { y: .025 }).add(cyl(.026, .045, .09, 10), IRON, { y: .095 })
    .add(cyl(.011, .016, .7, 8), IRON, { y: .49 }).add(tor(.02, .006, 6, 12), IRON, { y: .36, rx: Math.PI / 2 })
    .add(cyl(.03, .016, .03, 8), IRON, { y: .845 }).add(cone(.058, .06, 4), IRON, { y: .955, ry: Math.PI / 4 }).add(sph(.012, 8, 6), IRON, { y: .99 }).build();
  const glass = new Builder().add(cyl(.042, .03, .075, 4), '#ffffff', { y: .895, ry: Math.PI / 4 }).build();
  return { post, glass };
}
// rooftops: cornice and parapet, plus AC units, a water tank, or a mast for towers (unit footprint)
export function crownGeometry(kind) {
  const b = new Builder().add(box(1.05, .05, 1.05), '#ffffff', { y: .025 }).add(box(.94, .02, .94), '#9aa0a8', { y: .055 });
  [[0, .5, 1.04, .03], [0, -.5, 1.04, .03], [.5, 0, .03, 1.04], [-.5, 0, .03, 1.04]].forEach(([x, z, w, d]) => b.add(box(w, .06, d), '#ffffff', { x: x * .97, y: .08, z: z * .97 }));
  if (kind === 0) b.add(box(.18, .09, .13), '#d5d8dd', { x: -.2, y: .11, z: .15 }).add(box(.14, .08, .12), '#d5d8dd', { x: .18, y: .1, z: -.2 }).add(cyl(.03, .03, .08, 8), '#b8bcc4', { x: .2, y: .1, z: .22 });
  else if (kind === 1) {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => b.add(cyl(.008, .008, .14, 5), '#5a4a3a', { x: .12 + x * .06, y: .13, z: .1 + z * .06 }));
    b.add(cyl(.1, .1, .16, 14), '#8d6b4a', { x: .12, y: .28, z: .1 }).add(cone(.11, .07, 14), '#6b5038', { x: .12, y: .395, z: .1 }).add(box(.12, .1, .12), '#c9ccd3', { x: -.22, y: .11, z: -.18 });
  } else b.add(box(.3, .14, .3), '#c9ccd3', { y: .13 }).add(cyl(.012, .02, .8, 6), '#c9ccd3', { y: .6 }).add(sph(.025, 8, 6), '#ff4d4d', { y: 1.0 });
  return b.build();
}
export function cloudGeometry() {
  const b = new Builder();
  [[0, 0, 0, 1], [.7, -.1, .1, .75], [-.7, -.15, 0, .7], [.3, .25, -.1, .7], [-.3, .2, .1, .6]].forEach(([x, y, z, r], i) => b.add(blob(r, i * 2.3, 2, .08), '#ffffff', { x, y, z }));
  return b.build([.82, 1.05]);
}
export function fishGeometry() {
  const tail = new THREE.Shape(); tail.moveTo(0, 0); tail.quadraticCurveTo(-.08, .1, -.15, .11); tail.lineTo(-.11, 0); tail.lineTo(-.15, -.11); tail.quadraticCurveTo(-.08, -.1, 0, 0);
  const fin = new THREE.Shape(); fin.moveTo(-.08, 0); fin.quadraticCurveTo(-.02, .1, .06, 0); fin.closePath();
  const body = lathe([[0, -.2], [.05, -.16], [.095, -.06], [.1, .03], [.08, .11], [.035, .17], [0, .19]], 18);
  return new Builder().add(body, '#ffffff', { rz: -Math.PI / 2, sz: .62 })
    .add(new THREE.ShapeGeometry(tail, 6), '#ffffff', { x: -.17 }).add(new THREE.ShapeGeometry(fin, 6), '#ffffff', { y: .085 })
    .add(sph(.022, 8, 6), '#1d2433', { x: .12, y: .03, z: .05 }).add(sph(.022, 8, 6), '#1d2433', { x: .12, y: .03, z: -.05 }).build([.75, 1.1]);
}
// mushroom houses for the forest: a stem with a door and window, and a spotted cap
export function mushroomStem() {
  return new Builder().add(new THREE.CylinderGeometry(0.42, 0.5, 1, 14), '#ffffff', { y: 0.5 })
    .add(new THREE.BoxGeometry(0.22, 0.34, 0.06), '#6b4a2f', { y: 0.17, z: 0.46 }).add(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 10), '#fff2b0', { y: 0.62, z: 0.44, rx: Math.PI / 2 }).build();
}
export function mushroomCap() {
  const b = new Builder().add(new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', { sy: 0.7 });
  [[0.2, 0.25, 0.25], [-0.25, 0.22, 0.1], [0.05, 0.33, -0.2], [-0.1, 0.2, -0.33], [0.32, 0.14, -0.1]].forEach(([x, y, z]) => b.add(new THREE.SphereGeometry(0.06, 8, 6), '#fff6e0', { x, y, z }));
  return b.build();
}
export function birdGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .06, -.14, .02, -.02, 0, 0, -.04, 0, 0, .06, 0, 0, -.04, .14, .02, -.02], 3));
  g.computeVertexNormals();
  return new Builder().add(g, '#2b2f3a').build();
}
