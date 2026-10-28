// Glossy 3D emoji for the emote picker, the emote button and the pops over tokens; each faces +z, centred, about 1 unit across.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), Z = V(0, 0, 1);
const gloss = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, ...o });
const glass = () => gloss('#3a9bff', { transparent: true, opacity: 0.88, roughness: 0.04, clearcoatRoughness: 0.02, ior: 1.7, emissive: '#1f74ff', emissiveIntensity: 0.18 });
const skin = (o = {}) => gloss('#ffffff', { vertexColors: true, roughness: 0.34, clearcoatRoughness: 0.1, ...o });
const INK = '#3b2414', YEL = ['#ffd43b', '#ff8c0c'];

// colour a geometry from bot to top by height
function tint(geo, [top, bot], y0 = -0.55, y1 = 0.4) {
  const p = geo.attributes.position, a = new Float32Array(p.count * 3), lo = new THREE.Color(bot), hi = new THREE.Color(top), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) c.copy(lo).lerp(hi, THREE.MathUtils.smoothstep(p.getY(i), y0, y1)).toArray(a, i * 3);
  return geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
}
// a glossy head; returns at(x, y, lift) -> { p, n } on its front surface
function head(g, cols, [a, b, c] = [0.5, 0.5, 0.44], o) {
  g.add(new THREE.Mesh(tint(new THREE.SphereGeometry(1, 64, 48).scale(a, b, c), cols), skin(o)));
  return (x, y, h = 0) => { const z = c * Math.sqrt(Math.max(0, 1 - (x / a) ** 2 - (y / b) ** 2)), n = V(x / a / a, y / b / b, z / c / c).normalize(); return { p: V(x, y, z).addScaledVector(n, h), n }; };
}
// a smooth grid laid on the face: f(u, t) -> [x, y, lift]
function patch(at, f, nu = 48, nt = 8) {
  const pos = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nt; j++) { const [x, y, h] = f(i / nu, j / nt), { p } = at(x, y, h); pos.push(p.x, p.y, p.z); }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nt; j++) { const k = i * (nt + 1) + j; idx.push(k, k + nt + 1, k + 1, k + 1, k + nt + 1, k + nt + 2); }
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}
// the area between y = lo(x) and y = hi(x) over |x| < w, puffed up in the middle
const span = (at, w, lo, hi, h, puff = 0) => patch(at, (u, t) => { const x = w * (2 * u - 1), a = lo(x), b = hi(x); return [x, a + (b - a) * t, h + puff * Math.sin(PI * t) * Math.sin(PI * u) ** 0.3]; });
// a round-ended raised stroke along c(u) -> [x, y], half-width w growing by `grow` towards the end
function stroke(at, c, w0, h = 0.016, grow = 0) {
  let len = 0; for (let i = 0; i < 32; i++) { const [x0, y0] = c(i / 32), [x1, y1] = c((i + 1) / 32); len += Math.hypot(x1 - x0, y1 - y0); }
  return patch(at, (s, t) => {
    const u = (1 - Math.cos(PI * s)) / 2, w = w0 * (1 + grow * u), [x0, y0] = c(Math.max(0, u - 1e-3)), [x1, y1] = c(Math.min(1, u + 1e-3)), [x, y] = c(u);
    const l = Math.hypot(x1 - x0, y1 - y0), r = Math.sqrt(1 - (1 - Math.min(1, Math.min(u, 1 - u) * len / w)) ** 2), q = 2 * t - 1;
    return [x - (y1 - y0) / l * q * w * r, y + (x1 - x0) / l * q * w * r, 0.003 + h * r * Math.sqrt(1 - q * q)];
  }, 64, 8);
}
// a half-sunk ellipsoid on the face
function bead(at, x, y, [sx, sy, sz], mat, rz = 0) {
  const { p, n } = at(x, y), m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16).scale(sx, sy, sz), mat);
  m.position.copy(p); m.quaternion.setFromUnitVectors(Z, n); m.rotateZ(rz); return m;
}
// an open mouth between top(x) and bot(x): dark inside, teeth along the top, a tongue at the bottom
function mouth(g, at, w, top, bot, tongue = '#ff5a6a') {
  g.add(new THREE.Mesh(span(at, w, bot, top, 0.004), gloss('#4a1a10')));
  g.add(new THREE.Mesh(span(at, w * 0.97, x => top(x) - Math.min(0.055, 0.42 * (top(x) - bot(x))), top, 0.007, 0.008), gloss('#ffffff', { roughness: 0.2 })));
  if (tongue) { const tw = w * 0.56, d = top(0) - bot(0); g.add(new THREE.Mesh(span(at, tw, x => bot(x) + 0.002, x => bot(x) + d * 0.38 * (1 - (x / tw) ** 2) ** 0.8, 0.007, 0.012), gloss(tongue))); }
}
// a teardrop with its tip at height h, bent sideways by bend and flattened in depth
function drop(r, h, bend = 0, flat = 1) {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const a = -PI / 2 + PI / 2 * i / 12; pts.push(new THREE.Vector2(r * Math.cos(a) + 1e-4, r * Math.sin(a))); }
  for (let i = 1; i <= 16; i++) { const y = h * i / 16; pts.push(new THREE.Vector2(r * Math.max(0, Math.cos(PI / 2 * y / h)) ** 1.6 + 1e-4, y)); }
  const geo = new THREE.LatheGeometry(pts, 32, PI), p = geo.attributes.position; // seam at the back
  for (let i = 0; i < p.count; i++) { const y = Math.max(0, p.getY(i)) / h; p.setXYZ(i, p.getX(i) + bend * y * y, p.getY(i), p.getZ(i) * flat); }
  geo.computeVertexNormals(); return geo;
}
// bow a geometry back by z -= k * x² (or y²), keeping its normals true
function bow(geo, k, a = 'x') {
  const p = geo.attributes.position, n = geo.attributes.normal, q = V(), m = V();
  for (let i = 0; i < p.count; i++) { q.fromBufferAttribute(p, i); m.fromBufferAttribute(n, i); m[a] += 2 * k * q[a] * m.z; p.setZ(i, q.z - k * q[a] ** 2); m.normalize(); n.setXYZ(i, m.x, m.y, m.z); }
  return geo;
}
const mesh = (geo, mat, x = 0, y = 0, z = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; return m; };
const arc = (cx, cy, rx, ry, a0, a1) => u => [cx + rx * Math.cos(a0 + (a1 - a0) * u), cy + ry * Math.sin(a0 + (a1 - a0) * u)];
const ovalEyes = (g, at, y, s, ink = gloss(INK)) => g.add(bead(at, -0.16, y, s, ink), bead(at, 0.16, y, s, ink));

const MAKE = {
  '😀'(g) {
    const at = head(g, YEL), w = 0.27, top = x => -0.07 + 0.06 * (x / w) ** 2;
    ovalEyes(g, at, 0.13, [0.062, 0.1, 0.04]);
    mouth(g, at, w, top, x => top(x) - 0.22 * (1 - (x / w) ** 2) ** 0.6);
  },
  '😂'(g) {
    const at = head(g, ['#ffd23a', '#ff7a0a'], [0.53, 0.47, 0.44]), ink = gloss(INK), tear = glass(), w = 0.31, top = x => -0.03 + 0.08 * (x / w) ** 2;
    [-1, 1].forEach(s => {
      g.add(new THREE.Mesh(stroke(at, arc(s * 0.16, 0.1, 0.085, 0.07, PI, 0), 0.024), ink));
      const t = at(s * 0.26, 0.1, -0.01).p, m = mesh(drop(0.08, 0.17, 0, 0.8), tear); // tip just outside the eye, drop flying outwards round the cheek
      m.rotation.set(0, s * 0.5, s * 1.15); m.position.copy(t).sub(V(0, 0.17, 0).applyEuler(m.rotation)); g.add(m);
    });
    mouth(g, at, w, top, x => top(x) - 0.3 * (1 - (x / w) ** 2) ** 0.55);
  },
  '😎'(g) {
    const at = head(g, ['#ffc93a', '#ff8000']), lens = skin({ roughness: 0.06, clearcoatRoughness: 0.02, metalness: 0.3 }), LENS = ['#2a3140', '#06080c'];
    const shine = gloss('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6, transparent: true, opacity: 0.9 });
    const s = new THREE.Shape(); s.moveTo(-0.15, 0.08); s.lineTo(0.15, 0.08); s.bezierCurveTo(0.16, -0.04, 0.1, -0.11, 0, -0.11); s.bezierCurveTo(-0.1, -0.11, -0.16, -0.04, -0.15, 0.08);
    const lg = tint(bow(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 4, curveSegments: 16 }), 0.6), LENS, -0.12, 0.09);
    [-1, 1].forEach(k => {
      const l = mesh(lg, lens, k * 0.18, 0.1, 0.41); l.rotation.y = k * 0.36; g.add(l);
      l.add(mesh(new THREE.CapsuleGeometry(0.012, 0.09, 4, 12), shine, -0.07, 0, 0.034, -0.6));
    });
    g.add(mesh(tint(new THREE.BoxGeometry(0.1, 0.035, 0.03), LENS), lens, 0, 0.16, 0.45));
    g.add(new THREE.Mesh(stroke(at, u => [-0.17 + 0.34 * u, -0.2 - 0.075 * Math.sin(PI * u) + 0.04 * u], 0.03), gloss(INK)));
  },
  '🤑'(g) {
    const at = head(g, ['#ffcf2a', '#e88400'], undefined, { metalness: 0.15 }), green = gloss('#1f9a4a'), lite = gloss('#8fe0a0'), w = 0.27, top = x => -0.05 + 0.06 * (x / w) ** 2;
    const S = u => u < 0.5 ? arc(0, 0.5, 0.5, 0.5, PI / 6, 1.5 * PI)(u * 2) : arc(0, -0.5, 0.5, 0.5, PI / 2, -5 * PI / 6)(u * 2 - 1); // the $'s S, 2 units tall
    const dollar = (at, cx, cy, s, w) => [stroke(at, u => { const [x, y] = S(u); return [cx + x * s, cy + y * s]; }, w, w * 0.9), stroke(at, u => [cx, cy + 1.33 * s - 2.67 * s * u], w * 0.7, w * 0.7)].map(geo => new THREE.Mesh(geo, green));
    [-1, 1].forEach(k => g.add(...dollar(at, k * 0.16, 0.14, 0.075, 0.02)));
    mouth(g, at, w, top, x => top(x) - 0.2 * (1 - (x / w) ** 2) ** 0.6, null);
    // the banknote tongue: root in the mouth, curling down over the lip; its own at() follows the bend
    const note = new THREE.Group(), nat = (x, y, h = 0) => ({ p: V(x, y, 0.03 + h - 0.5 * y * y) }), slab = (i, z, mat) => { // a round-tipped tongue outline, inset by i
      const s = new THREE.Shape(), r = 0.12 - i, ry = 0.09 - i / 2; s.moveTo(-r, -i); s.lineTo(-r, ry + i - 0.28); s.absellipse(0, ry + i - 0.28, r, ry, PI, 2 * PI); s.lineTo(r, -i);
      note.add(new THREE.Mesh(bow(new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 20 }).translate(0, 0, z - 0.007), 0.5, 'y'), mat));
    };
    note.position.set(0, -0.13, 0.44); note.rotation.x = 0.1; g.add(note);
    slab(0, 0, green); slab(0.02, 0.004, lite); slab(0.03, 0.008, green);
    note.add(new THREE.Mesh(bow(new THREE.SphereGeometry(1, 24, 16).scale(0.055, 0.07, 0.01).translate(0, -0.14, 0.02), 0.5, 'y'), lite), ...dollar(nat, 0, -0.14, 0.045, 0.013));
  },
  '😡'(g) {
    const at = head(g, ['#c40808', '#ff4a0a'], [0.52, 0.48, 0.44], { clearcoatRoughness: 0.2 }), ink = gloss('#2e140c');
    ovalEyes(g, at, 0.04, [0.055, 0.07, 0.035], ink);
    [-1, 1].forEach(k => g.add(new THREE.Mesh(stroke(at, u => [k * (0.31 - 0.24 * u), 0.25 - 0.1 * u], 0.04, 0.02), ink)));
    g.add(new THREE.Mesh(stroke(at, arc(0, -0.24, 0.17, 0.07, PI * 0.95, PI * 0.05), 0.036), ink));
  },
  '😭'(g) {
    const at = head(g, ['#ffe46a', '#f5a623'], [0.48, 0.52, 0.44]), ink = gloss(INK), tear = glass(), w = 0.24, top = x => -0.07 - 0.12 * (x / w) ** 2;
    [-1, 1].forEach(k => {
      g.add(new THREE.Mesh(stroke(at, u => [k * (0.07 + 0.18 * u), 0.15 - 0.06 * u + 0.05 * Math.sin(PI * u)], 0.024), ink));
      g.add(new THREE.Mesh(stroke(at, u => [k * (0.25 + 0.09 * u), 0.09 - 0.45 * u], 0.03, 0.03, 1.2), tear));
    });
    mouth(g, at, w, top, x => top(x) - 0.2 * (1 - (x / w) ** 2) ** 0.45);
  },
  '👍'(g) {
    const h = new THREE.Group(), sk = skin(), add = (geo, x, y, z, rz = 0) => h.add(new THREE.Mesh(tint(geo.rotateZ(rz).translate(x, y, z), ['#ffd23a', '#ffa31a'], -0.55, 0.6), sk));
    h.rotation.y = 0.4; g.add(h); // three-quarter view keeps the fist inside the same framing as the faces
    add(new RoundedBoxGeometry(0.74, 0.58, 0.72, 5, 0.27), 0.06, -0.16, -0.08);
    [[0.4, 0.095, 0.06], [0.4, 0.095, -0.11], [0.36, 0.09, -0.27], [0.3, 0.085, -0.41]].forEach(([l, r, y]) => add(new THREE.CapsuleGeometry(r, l, 8, 24), 0.46 - l / 2 - r, y, 0.2, PI / 2));
    add(new THREE.CapsuleGeometry(0.15, 0.2, 10, 28), -0.16, 0.28, -0.02, 0.15);
    h.add(mesh(new THREE.SphereGeometry(1, 20, 14).scale(0.07, 0.085, 0.02), gloss('#ffe27a', { roughness: 0.15 }), -0.16, 0.42, 0.115, 0.15));
  },
  '🔥'(g) {
    // dim base + emissive keeps it saturated: brighter, NeutralToneMapping washes red to pink
    const add = (geo, cols, glow, x, y, z, rz = 0, ei = 0.45) => g.add(mesh(tint(geo, cols, -0.3, 0.6), gloss('#8c8c8c', { vertexColors: true, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3, specularIntensity: 0.35, envMapIntensity: 0.4, emissive: glow, emissiveIntensity: ei }), x, y, z, rz));
    const OUT = ['#e8200c', '#ff5a14'];
    add(drop(0.36, 0.72, 0.28, 0.85), OUT, '#ff3a12', 0, -0.12, 0);
    add(drop(0.2, 0.42, -0.1, 0.85), OUT, '#ff3a12', -0.2, -0.2, -0.02, 0.35);
    add(drop(0.17, 0.36, 0.08, 0.85), OUT, '#ff3a12', 0.22, -0.18, -0.02, -0.32);
    add(drop(0.25, 0.48, -0.18, 0.85), ['#ff7a00', '#ffb000'], '#ff8a00', 0.02, -0.15, 0.16);
    add(drop(0.13, 0.32, 0.12, 0.85), ['#ffc400', '#ffe45c'], '#ffd23a', 0.02, -0.2, 0.3, 0, 0.6);
  },
};

export function emoteModel(e) {
  if (!MAKE[e]) throw new Error('no 3D emote for ' + e);
  const g = new THREE.Group(); MAKE[e](g);
  const c = new THREE.Box3().setFromObject(g).getCenter(V()); g.children.forEach(o => o.position.sub(c));
  return g;
}
