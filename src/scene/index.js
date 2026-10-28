// The 3D board in its living city. Pure presentation: the presenter calls these to show what the engine did.
import * as THREE from 'three';
import { BOARD, OWNABLE } from '../engine.js';
import { TOK } from '../art.js';
import * as L from './layout.js';
import * as A from './art2d.js';
import * as M from './models.js';
import { makeDice, simulate, correction, FPS } from './dice.js';
import { makeCity, GROUND_Y } from './city.js';
import { makeFX } from './fx.js';
import { THEMES } from './themes.js';
import { makeLook } from './look.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sfx } from '../sound.js';

const QUALITY = {
  high: { dpr: 2, shadow: 2048, board: 4096 },
  medium: { dpr: 1.5, shadow: 2048, board: 2048 },
  low: { dpr: 1, shadow: 0, board: 2048 },
};
const ease = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;
const UP = new THREE.Vector3(0, 1, 0);

async function fontsReady() {
  if (!document.fonts) return;
  const load = Promise.all(["700 40px 'Archivo Narrow'", '600 40px Archivo Narrow', '400 40px Limelight', '600 20px Manrope'].map(f => document.fonts.load(f)));
  await Promise.race([load, new Promise(r => setTimeout(r, 3000))]).catch(() => {});
}

export async function createScene({ canvas, onSquare, onDice, quality = 'auto', speed = 1, theme = 'city' }) {
  await fontsReady();
  const coarse = matchMedia('(pointer: coarse)').matches;
  let level = quality === 'auto' ? (coarse ? 'medium' : 'high') : quality;
  let Q = QUALITY[level];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.info.autoReset = false; // post passes render several times a frame; count the whole frame
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = Q.shadow > 0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let dpr = Math.min(devicePixelRatio || 1, Q.dpr);
  renderer.setPixelRatio(dpr);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (cv, aniso = maxAniso) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };

  const scene = new THREE.Scene();
  const skyCv = A.canvas(4, 256), skyTex = tex(skyCv, 1);
  scene.background = skyTex;
  scene.fog = new THREE.Fog('#d6ecf7', 30, 78);
  scene.environmentIntensity = 0.7;
  const hemi = new THREE.HemisphereLight('#e3f2ff', '#6f8a52', 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff2da', 2.5);
  sun.position.set(6, 15, 8);
  sun.castShadow = Q.shadow > 0;
  sun.shadow.mapSize.set(Q.shadow || 512, Q.shadow || 512);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 2, far: 45 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);
  scene.add(camera);
  const look = makeLook(renderer, scene, camera);
  look.setLevel(level);

  // ---------- board ----------
  const boardS = Math.min(Q.board, renderer.capabilities.maxTextureSize);
  const boardTex = tex(A.canvas(4));
  // a laminated board on a gilded rim and a stone plinth
  const edgeMat = new THREE.MeshPhysicalMaterial({ color: '#f3eee4', roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(L.W, 0.3, L.W), [edgeMat, edgeMat, new THREE.MeshPhysicalMaterial({ map: boardTex, roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.28 }), edgeMat, edgeMat, edgeMat]);
  slab.position.y = -0.15; slab.receiveShadow = true;
  const trim = new THREE.Mesh(new RoundedBoxGeometry(L.W + 0.24, 0.08, L.W + 0.24, 3, 0.035), new THREE.MeshPhysicalMaterial({ color: '#c99a3a', metalness: 1, roughness: 0.24, clearcoat: 0.5 }));
  trim.position.y = -0.27;
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(L.W + 0.7, 0.06, L.W + 0.7, 3, 0.025), new THREE.MeshStandardMaterial({ color: '#d9d0bf', roughness: 0.8 }));
  plinth.position.y = -0.33; plinth.receiveShadow = true;
  scene.add(slab, trim, plinth);

  const glowTex = tex(A.drawGlow(), 1);
  // tokens and coins reflect a photo studio rather than the soft sky, so their metal reads as polished chrome and brass
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const studio = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose(); room.dispose();
  const fx = makeFX(scene, glowTex, tex(A.drawBill(), 4), studio);
  // a theme dresses the sky, light, board print and the world around the board
  let city = null, themeName = null, roads = true, attracting = false;
  function setTheme(name) {
    if (name === themeName || !THEMES[name]) return;
    themeName = name;
    const T = THEMES[name];
    const sctx = skyCv.getContext('2d'), sg = sctx.createLinearGradient(0, 0, 0, 256);
    sg.addColorStop(0, T.sky[0]); sg.addColorStop(0.6, T.sky[1]); sg.addColorStop(1, T.sky[2]);
    sctx.fillStyle = sg; sctx.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
    scene.fog.color.set(T.fog[0]); scene.fog.near = T.fog[1]; scene.fog.far = T.fog[2];
    hemi.color.set(T.hemi[0]); hemi.groundColor.set(T.hemi[1]); hemi.intensity = T.hemi[2];
    sun.color.set(T.sun[0]); sun.intensity = T.sun[1];
    renderer.toneMappingExposure = T.exposure;
    look.setTheme(T, sun.position);
    boardTex.image = A.drawBoard(boardS, T.board); boardTex.needsUpdate = true;
    edgeMat.color.set(T.board.edge); trim.material.color.set(T.board.trim); plinth.material.color.set(T.board.plinth);
    if (city) city.dispose();
    city = makeCity(scene, maxAniso, T, glowTex);
    city.setRoads(roads);
  }
  setTheme(theme);

  // ---------- tweens ----------
  const tweens = new Set();
  let timeScale = speed;
  function tween(ms, fn) {
    const tw = { start: performance.now(), dur: Math.max(1, ms / timeScale), fn };
    tw.done = new Promise(r => { tw.res = r; });
    tweens.add(tw);
    return tw;
  }
  function kill(tw) { if (tw && tweens.has(tw)) { tweens.delete(tw); tw.res(); } }
  const wait = ms => new Promise(r => setTimeout(r, ms / timeScale));

  // ---------- square geometry helpers ----------
  const at = p => { const c = L.centreOf(p); return new THREE.Vector3(c.x, 0, c.z); };
  // along: direction of travel along the side; out: from the square towards the board edge
  function axes(p) {
    const sd = L.sideOf(p), inn = L.IN[sd];
    return { out: new THREE.Vector3(-inn[0], 0, -inn[1]), along: new THREE.Vector3(inn[1], 0, -inn[0]), rot: L.VIEW[sd] };
  }
  function tokenSpot(pos, i, n, jailed) {
    let base;
    if (pos === 10) base = new THREE.Vector3(jailed ? L.JAIL_CELL.x : L.JAIL_VISIT.x, 0, jailed ? L.JAIL_CELL.z : L.JAIL_VISIT.z);
    else if (pos % 10 === 0) base = at(pos);
    else base = at(pos).addScaledVector(axes(pos).out, -0.12);
    if (n <= 1) return base;
    const { out, along } = axes(pos), sp = pos % 10 === 0 ? 0.26 : 0.2;
    const grid = n === 2 ? [[-1, 0], [1, 0]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    const [a, o] = grid[i];
    return base.clone().addScaledVector(along, a * sp).addScaledVector(out, o * sp * (n === 2 ? 0 : 1));
  }

  // ---------- tokens ----------
  const metal = M.tokenMetal(studio);
  const figGeo = [], baseGeo = M.tokenBase();
  const pawns = new Map(); // id -> { g, fig, tok, color, pos, jail, tw }
  function pawn(id, tok, color) {
    let p = pawns.get(id);
    if (p && p.tok === tok) return p;
    if (p) scene.remove(p.g);
    figGeo[tok] = figGeo[tok] || M.tokenGeometry(tok);
    const g = new THREE.Group(), fig = new THREE.Mesh(figGeo[tok], metal);
    const base = new THREE.Mesh(baseGeo, M.tokenEnamel(color, studio));
    fig.position.y = 0.05;
    g.add(base, fig);
    g.traverse(m => { m.castShadow = true; });
    scene.add(g);
    p = { g, fig, tok, color, pos: -1, jail: false, tw: null, scale: 1 };
    pawns.set(id, p);
    return p;
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.31, 48), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false;
  scene.add(ring);
  let turnId = null;

  function layoutSquare(pos, except) {
    const here = [...pawns.entries()].filter(([, p]) => p.pos === pos && !p.out);
    const groups = [here.filter(([, p]) => !p.jail), here.filter(([, p]) => p.jail)];
    for (const list of groups) {
      list.forEach(([id, p], i) => {
        if (id === except) return;
        const target = tokenSpot(pos, i, list.length, p.jail), sc = list.length > 2 ? 0.82 : 1;
        p.scale = sc;
        if (p.g.position.distanceTo(target) < 0.001 && p.g.scale.x === sc) return;
        kill(p.tw);
        const from = p.g.position.clone(), s0 = p.g.scale.x;
        p.tw = tween(260, t => { p.g.position.lerpVectors(from, target, ease(t)); p.g.scale.setScalar(lerp(s0, sc, t)); });
      });
    }
  }

  // ---------- living property: owner plates, landmarks and flags on the plaza, houses, mortgages ----------
  const flagPole = M.flagPoleGeometry(), flagCloth = M.flagClothGeometry();
  const stampTex = tex(A.drawMortgage(), 4);
  const gilt = new THREE.MeshPhysicalMaterial({ color: '#e8c36a', metalness: 0.85, roughness: 0.34, clearcoat: 0.4 });
  // landmarks stand on the plaza beside their square, so they never cover its name
  const LM_Y = GROUND_Y, LM_Z = L.CW / 2 + 0.66, LM_K = 1.3, FLAG_K = 1.7;
  // the owner plate covers the square's outer end, where the price was printed
  const PLATE = { w: L.EW * 0.8, d: 0.34 }, PLATE_Z = L.CW / 2 - 0.21;
  const lots = {};
  OWNABLE.forEach(pos => {
    const { out, along, rot } = axes(pos), c = at(pos), sq = BOARD[pos];
    const g = new THREE.Group(); g.position.copy(c); g.rotation.y = rot; scene.add(g);
    const lmMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 });
    const lm = new THREE.Mesh(M.landmarkGeometry(sq, pos), lmMat);
    lm.position.set(0, LM_Y, LM_Z); lm.scale.setScalar(LM_K); lm.castShadow = lm.receiveShadow = true; lm.visible = false;
    // flags are drawn instanced; these empties only carry their transforms
    const flag = new THREE.Object3D(), cloth = new THREE.Object3D();
    flag.add(cloth);
    flag.position.set(L.EW / 2 - 0.1, LM_Y, LM_Z + 0.34); flag.scale.setScalar(FLAG_K);
    const stamp = new THREE.Mesh(new THREE.PlaneGeometry(L.EW * 0.94, L.CW * 0.94), new THREE.MeshBasicMaterial({ map: stampTex, transparent: true, depthWrite: false }));
    stamp.rotation.x = -Math.PI / 2; stamp.position.y = 0.004; stamp.visible = false;
    g.add(lm, flag, stamp);
    g.updateMatrixWorld(true);
    const top = LM_Y + LM_K * lm.geometry.boundingBox.max.y; // above the board
    lots[pos] = { g, lm, lmMat, flag, cloth, stamp, top, fade: 1, owner: null, pw: null, pa: null, h: 0, m: false, out, along, c, ph: pos * 0.7, i: Object.keys(lots).length };
  });
  const N_LOTS = OWNABLE.length, ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const poles = new THREE.InstancedMesh(flagPole, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), N_LOTS);
  const cloths = new THREE.InstancedMesh(flagCloth, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }), N_LOTS);
  // plates: enamel in the owner's colour (instance colour) with their token's emblem from an atlas (aTok picks the cell)
  const pg = cardGeometry(PLATE.w, 0.03, PLATE.d, 0.06), plateGeo = mergeGeometries([pg.back, pg.face]);
  plateGeo.setAttribute('aTok', new THREE.InstancedBufferAttribute(new Float32Array(N_LOTS), 1));
  const emblems = tex(A.drawPlates());
  const plateMat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 });
  plateMat.onBeforeCompile = sh => {
    sh.uniforms.uEmblems = { value: emblems };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTok;\nvarying vec3 vPlate;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlate = vec3(uv, aTok);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D uEmblems;\nvarying vec3 vPlate;\nconst float CELLS = ${TOK.length}.0;`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n{ vec4 e = texture2D(uEmblems, vec2((vPlate.x + vPlate.z) / CELLS, vPlate.y)); diffuseColor.rgb = mix(diffuseColor.rgb, e.rgb, e.a); }');
  };
  const plates = new THREE.InstancedMesh(plateGeo, plateMat, N_LOTS), rims = new THREE.InstancedMesh(pg.edge, [gilt], N_LOTS);
  poles.castShadow = cloths.castShadow = true;
  plates.receiveShadow = rims.receiveShadow = true;
  // instances move after the bounding sphere is first computed (all at the origin), so never cull these
  poles.frustumCulled = cloths.frustumCulled = plates.frustumCulled = rims.frustumCulled = false;
  [poles, cloths, plates, rims].forEach(im => { for (let i = 0; i < N_LOTS; i++) { im.setMatrixAt(i, ZERO); im.setColorAt(i, new THREE.Color('#ffffff')); } });
  scene.add(poles, cloths, plates, rims);
  function layoutFlags() {
    for (const pos of OWNABLE) {
      const lot = lots[pos];
      if (!lot.owner) { poles.setMatrixAt(lot.i, ZERO); cloths.setMatrixAt(lot.i, ZERO); continue; }
      lot.g.updateMatrixWorld(true);
      poles.setMatrixAt(lot.i, lot.flag.matrixWorld); cloths.setMatrixAt(lot.i, lot.cloth.matrixWorld);
    }
    poles.instanceMatrix.needsUpdate = cloths.instanceMatrix.needsUpdate = true;
  }
  // lot.pa animates a plate: { y, flip, s }
  const plateLocal = new THREE.Object3D(), REST = { y: 0, flip: 0, s: 1 };
  const plateAt = lot => lot.c.clone().addScaledVector(lot.out, PLATE_Z).setY(0.03);
  function layoutPlates() {
    for (const pos of OWNABLE) {
      const lot = lots[pos], a = lot.pa || REST;
      if (!lot.owner) { plates.setMatrixAt(lot.i, ZERO); rims.setMatrixAt(lot.i, ZERO); continue; }
      plateLocal.position.set(0, 0.017 + a.y, PLATE_Z); plateLocal.rotation.set(a.flip, 0, 0); plateLocal.scale.setScalar(a.s);
      plateLocal.updateMatrix();
      _m.multiplyMatrices(lot.g.matrixWorld, plateLocal.matrix);
      plates.setMatrixAt(lot.i, _m); rims.setMatrixAt(lot.i, _m);
    }
    plates.instanceMatrix.needsUpdate = rims.instanceMatrix.needsUpdate = true;
  }
  const houseMat = M.pieceGloss();
  const houses = new THREE.InstancedMesh(M.houseGeometry(), houseMat, 88), hotels = new THREE.InstancedMesh(M.hotelGeometry(), houseMat, 22);
  houses.castShadow = hotels.castShadow = true; houses.count = hotels.count = 0;
  houses.frustumCulled = hotels.frustumCulled = false;
  scene.add(houses, hotels);
  const hanim = {}; // 'pos:i' -> { y, s, sx, sy } while a building is animating
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const squash = a => _s.set(a.s * (a.sx || 1), a.s * (a.sy || 1), a.s * (a.sx || 1));
  function houseSlot(pos, i, n) {
    const { out, along } = lots[pos];
    return lots[pos].c.clone().addScaledVector(out, -(L.CW / 2 - 0.15)).addScaledVector(along, (i - (n - 1) / 2) * 0.17);
  }
  function layoutBuildings() {
    let nh = 0, nH = 0;
    for (const pos of OWNABLE) {
      const lot = lots[pos];
      if (BOARD[pos].t !== 'prop' || !lot.h) continue;
      _q.setFromAxisAngle(UP, axes(pos).rot);
      if (lot.h === 5) {
        const a = hanim[pos + ':H'] || { y: 0, s: 1 };
        hotels.setMatrixAt(nH++, _m.compose(_v.copy(houseSlot(pos, 0, 1)).setY(a.y), _q, squash(a)));
      } else for (let i = 0; i < lot.h; i++) {
        const a = hanim[pos + ':' + i] || { y: 0, s: 1 };
        houses.setMatrixAt(nh++, _m.compose(_v.copy(a.at || houseSlot(pos, i, lot.h)).setY(a.y), _q, squash(a)));
      }
    }
    houses.count = nh; hotels.count = nH;
    houses.instanceMatrix.needsUpdate = hotels.instanceMatrix.needsUpdate = true;
  }
  const GREY = new THREE.Color('#8d8f96');
  const plateColor = (lot, m = lot.m ? 1 : 0) => _c.set(lot.pw.color).lerp(GREY, 0.75 * m);
  function setOwner(pos, id) {
    const lot = lots[pos], pw = (id && pawns.get(id)) || null;
    lot.owner = pw ? id : null; lot.pw = pw;
    lot.lm.visible = !!pw;
    if (pw) {
      cloths.setColorAt(lot.i, _c.set(pw.color)); plates.setColorAt(lot.i, plateColor(lot));
      plateGeo.attributes.aTok.setX(lot.i, pw.tok);
      cloths.instanceColor.needsUpdate = plates.instanceColor.needsUpdate = plateGeo.attributes.aTok.needsUpdate = true;
    }
    layoutFlags(); layoutPlates();
  }
  function setMortgage(pos, m) {
    const lot = lots[pos];
    lot.m = m; lot.stamp.visible = m;
    lot.lmMat.color.set(m ? '#8d8f96' : '#ffffff');
    lot.lm.position.y = LM_Y - (m ? 0.06 : 0);
    if (lot.pw) { plates.setColorAt(lot.i, plateColor(lot)); plates.instanceColor.needsUpdate = true; }
  }
  // a plate turns over to its new owner, like a card
  function flipOwner(pos, id) {
    const lot = lots[pos], a = lot.pa = { y: 0, flip: 0, s: 1 };
    let turned = false;
    return tween(700, t => {
      if (!turned && t >= 0.25) { turned = true; setOwner(pos, id); }
      a.flip = easeInOut(t) * Math.PI * 2; a.y = Math.sin(Math.PI * t) * 0.35; layoutPlates();
    }).done.then(() => { if (lot.pa === a) lot.pa = null; layoutPlates(); });
  }

  // ---------- dice ----------
  const dice = makeDice(scene, maxAniso);
  let diceTw = null;
  function throwFrom() {
    const r = 2.7;
    return { x: Math.max(-3, Math.min(3, Math.sin(cam.theta) * r)), z: Math.max(-3, Math.min(3, Math.cos(cam.theta) * r)) };
  }
  function roll(values, skin) {
    kill(diceTw);
    dice.skin(skin);
    const n = values.length, sim = simulate(n, throwFrom());
    const fix = values.map((v, i) => correction(v, sim.tops[i]));
    dice.forEach((m, i) => { m.visible = i < n; });
    sfx.shake();
    const frames = sim.frames, total = frames.length / FPS * 1000;
    let lastF = -1;
    const q = new THREE.Quaternion();
    diceTw = tween(total, (t) => {
      const f = Math.min(frames.length - 1, Math.floor(t * (frames.length - 1)));
      for (let i = 0; i < n; i++) {
        const fr = frames[f][i];
        dice[i].position.set(fr[0], fr[1], fr[2]);
        dice[i].quaternion.copy(q.set(fr[3], fr[4], fr[5], fr[6]).multiply(fix[i]));
      }
      for (const im of sim.impacts) if (im.f > lastF && im.f <= f) sfx.clack(Math.min(1, im.v / 9));
      lastF = f;
    });
    return diceTw.done.then(() => { const c = diceCentre(); fx.dust(c, 0.5); });
  }
  function setDice(values) {
    dice.forEach((m, i) => { m.visible = i < values.length; });
  }
  const diceCentre = () => { const v = new THREE.Vector3(); let n = 0; dice.forEach(m => { if (m.visible) { v.add(m.position); n++; } }); return v.multiplyScalar(1 / Math.max(1, n)).setY(0); };

  // ---------- card decks ----------
  // cards have rounded corners, a printed face (-y), a back (+y) and a gilded edge
  function roundRect(w, d, r) {
    const s = new THREE.Shape(), x = w / 2, z = d / 2;
    s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r); s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
    s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
    return s;
  }
  // uv matches a BoxGeometry's bottom (face) and top (back), so the print reads the same way up
  function cardGeometry(w, t, d, r) { // width, thickness, depth like a BoxGeometry
    const shape = roundRect(w, d, r);
    const cap = up => {
      const g = new THREE.ShapeGeometry(shape, 8);
      g.rotateX(up ? -Math.PI / 2 : Math.PI / 2); g.translate(0, up ? t / 2 : -t / 2, 0);
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, up ? 0.5 - p.getZ(i) / d : p.getZ(i) / d + 0.5);
      return g;
    };
    const edge = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 8 });
    edge.rotateX(Math.PI / 2); edge.translate(0, t / 2, 0);
    edge.groups = edge.groups.filter(g => g.materialIndex === 1).map(g => ({ ...g, materialIndex: 0 })); // sides only: draw with a material array
    return { face: cap(false), back: cap(true), edge };
  }
  // printed stock: colour from the print, foil and emboss from its surface map; `sweep` runs a glint across it
  function printMat(cv, sweep) {
    const surf = new THREE.CanvasTexture(cv.surface), m = new THREE.MeshPhysicalMaterial({ // the surface map is data: no sRGB
      map: tex(cv, 8), roughnessMap: surf, metalnessMap: surf, roughness: 1, metalness: 1,
      clearcoat: 0.55, clearcoatRoughness: 0.18,
    });
    if (sweep) {
      m.emissive.set('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = 0.14;
      m.onBeforeCompile = sh => {
        sh.uniforms.uSweep = sweep;
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSweep;')
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n{ float b = vMapUv.x * 0.8 + vMapUv.y * 0.6 - uSweep; gl_FragColor.rgb += exp(-b * b * 70.0) * 0.5; }');
      };
    }
    return m;
  }
  const disposeMat = m => { [m.map, m.roughnessMap].forEach(t => t && t.dispose()); m.dispose(); };
  const paperMat = new THREE.MeshPhysicalMaterial({ color: '#f4eedf', roughness: 0.7, clearcoat: 0.3 });
  const cardGeo = cardGeometry(L.CARD.w, 0.012, L.CARD.d, 0.07), deedGeo = cardGeometry(0.7, 0.01, 0.98, 0.05);
  const backMat = { F: printMat(A.drawCardBack('F')), T: printMat(A.drawCardBack('T')) };
  function cardObject(geo, face, back) {
    const g = new THREE.Group();
    [[geo.face, face], [geo.back, back], [geo.edge, [gilt]]].forEach(([gg, m]) => { const mesh = new THREE.Mesh(gg, m); mesh.castShadow = true; g.add(mesh); });
    return g;
  }
  for (const dk of ['F', 'T']) {
    const d = L.DECK_AT[dk], stack = cardGeometry(L.CARD.w, 0.12, L.CARD.d, 0.07), g = new THREE.Group();
    const top = new THREE.Mesh(stack.back, backMat[dk]), sides = new THREE.Mesh(stack.edge, [gilt]);
    top.receiveShadow = sides.castShadow = sides.receiveShadow = true;
    g.add(top, sides); g.position.set(d.x, 0.06, d.z); g.rotation.y = d.r;
    scene.add(g);
  }
  // a card held in front of the camera, face towards the viewer
  // the card's printed face (-y) turned towards the camera, text upright
  const HOLD = new THREE.Vector3(0, 0.05, -3.3), HOLD_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  async function present(mesh, from, holdMs, gone, sweep) {
    mesh.position.copy(from.p); mesh.quaternion.copy(from.q);
    scene.add(mesh);
    const p0 = mesh.position.clone();
    await tween(320, t => { mesh.position.copy(p0).setY(p0.y + ease(t) * 0.5); }).done;
    camera.attach(mesh);
    const lp = mesh.position.clone(), lq = mesh.quaternion.clone();
    await tween(520, t => { const e = easeInOut(t); mesh.position.lerpVectors(lp, HOLD, e); mesh.quaternion.slerpQuaternions(lq, HOLD_Q, e); }).done;
    tween(1100, t => { sweep.value = -0.4 + t * 2.4; });
    await holdMs();
    scene.attach(mesh);
    const wp = mesh.position.clone(), wq = mesh.quaternion.clone();
    await tween(480, t => { const e = easeInOut(t); mesh.position.lerpVectors(wp, gone.p, e); mesh.quaternion.slerpQuaternions(wq, gone.q, e); }).done;
    scene.remove(mesh);
  }
  function card(dk, faceCanvas, holdMs) {
    const d = L.DECK_AT[dk], q = new THREE.Quaternion().setFromAxisAngle(UP, d.r), sweep = { value: -1 };
    const face = printMat(faceCanvas, sweep), mesh = cardObject(cardGeo, face, backMat[dk]);
    sfx.card();
    const deck = { p: new THREE.Vector3(d.x, 0.13, d.z), q };
    return present(mesh, deck, holdMs, { p: new THREE.Vector3(d.x, 0.02, d.z), q }, sweep).then(() => disposeMat(face));
  }
  function deed(pos, faceCanvas, holdMs, toId) {
    const lot = lots[pos], sweep = { value: -1 }, face = printMat(faceCanvas, sweep), mesh = cardObject(deedGeo, face, paperMat);
    const q = new THREE.Quaternion().setFromAxisAngle(UP, axes(pos).rot);
    const p = toId && pawns.get(toId) ? pawns.get(toId).g.position.clone().setY(0.3) : at(pos).setY(0.3);
    return present(mesh, { p: lot ? lot.c.clone().setY(0.05) : at(pos), q }, holdMs, { p, q }, sweep).then(() => disposeMat(face));
  }

  // ---------- props: gavel, jail cage, highlights ----------
  const gavel = new THREE.Mesh(M.gavelGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2 }));
  gavel.visible = false; gavel.castShadow = true; scene.add(gavel);
  let gavelPos = null;
  const cage = new THREE.Mesh(M.cageGeometry(0.86), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.35 }));
  cage.position.set(L.JAIL_CELL.x, 3, L.JAIL_CELL.z); cage.visible = false; cage.castShadow = true;
  scene.add(cage);
  let cageDown = false;
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const unit = new THREE.PlaneGeometry(1, 1); unit.rotateX(-Math.PI / 2);
  const hover = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false }));
  hover.visible = false; hover.position.y = 0.006; scene.add(hover);
  const squareSize = p => (p % 10 === 0 ? [L.CW, L.CW] : L.side(p) === 'b' || L.side(p) === 't' ? [L.EW, L.CW] : [L.CW, L.EW]);
  function flash(p, color = '#ffd166', ms = 700, peak = 0.55) {
    const m = new THREE.Mesh(unit, glowMat.clone());
    m.material.color.set(color);
    const [w, d] = squareSize(p), c = at(p);
    m.scale.set(w * 0.96, 1, d * 0.96); m.position.set(c.x, 0.008, c.z);
    scene.add(m);
    return tween(ms, t => { m.material.opacity = peak * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t * 0.3); }).done.then(() => { scene.remove(m); m.material.dispose(); });
  }
  // squares a player can tap (triples): pulse them all
  const pickMeshes = [];
  function pickMode(list) {
    pickMeshes.splice(0).forEach(m => scene.remove(m));
    for (const p of list || []) {
      const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: '#7cf0c8', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
      const [w, d] = squareSize(p), c = at(p);
      m.scale.set(w * 0.9, 1, d * 0.9); m.position.set(c.x, 0.007, c.z); m.userData.ph = p * 0.4;
      scene.add(m); pickMeshes.push(m);
    }
  }

  // ---------- camera: cinematic follow plus free orbit ----------
  const cam = { theta: 0, phi: 0.92, r: 15, t: new THREE.Vector3(0, 0, 0.3) };
  const want = { theta: 0, phi: 0.92, r: 15, t: new THREE.Vector3(0, 0, 0.3) };
  let fit = 15, manual = false, follow = null, cinematic = true, tabletop = false, orbitSpin = 0, lastInput = 0;
  const table = { theta: 0, phi: 0, r: 15, t: new THREE.Vector3() }; // straight down at the flat board
  const corners = [[-5.6, -5.6], [5.6, -5.6], [5.6, 5.6], [-5.6, 5.6]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const rim = corners.map(c => c.clone().multiplyScalar(5.15 / 5.6)); // the gilded edge: a phone's tabletop fills its width
  function place(o) {
    const sp = Math.sin(o.phi);
    camera.position.set(o.t.x + o.r * sp * Math.sin(o.theta), o.t.y + o.r * Math.cos(o.phi), o.t.z + o.r * sp * Math.cos(o.theta));
    camera.lookAt(o.t);
    camera.updateMatrixWorld();
  }
  // the board fits between the seats at the top and the dock at the bottom
  const HOME = new THREE.Vector3(0, 0, 0.9);
  function computeFit() {
    const probe = { theta: 0, phi: 0.92, r: 0, t: HOME };
    const bottom = camera.aspect < 0.8 ? -0.5 : -0.66;
    let lo = 4, hi = 80;
    for (let i = 0; i < 24; i++) {
      probe.r = (lo + hi) / 2; place(probe);
      const ok = corners.every(c => { const v = c.clone().project(camera); return Math.abs(v.x) <= 0.95 && v.y <= 0.9 && v.y >= bottom && v.z < 1; });
      if (ok) hi = probe.r; else lo = probe.r;
    }
    fit = hi;
    // tabletop: the whole board from above, as large as the screen allows; on a phone it stays clear of the seats and dock
    const phone = camera.aspect < 0.8, top = phone ? 0.7 : 0.97, low = phone ? bottom : -0.97, band = (top - low) / 2, edge = phone ? rim : corners;
    table.t.set(0, 0, 0); lo = 4; hi = 80;
    for (let i = 0; i < 24; i++) {
      table.r = (lo + hi) / 2; place(table);
      const ok = edge.every(c => { const v = c.clone().project(camera); return Math.abs(v.x) <= 0.99 && Math.abs(v.y) <= band && v.z < 1; });
      if (ok) hi = table.r; else lo = table.r;
    }
    table.r = hi;
    table.t.z = (top + low) / 2 * hi * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    place(cam);
  }
  const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
  function setWant(o) {
    if (o.theta !== undefined) want.theta = cam.theta + wrapAngle(o.theta - cam.theta);
    if (o.phi !== undefined) want.phi = o.phi;
    if (o.r !== undefined) want.r = o.r;
    if (o.t) want.t.copy(o.t);
  }
  function overview() { follow = null; setWant(tabletop ? table : { theta: 0, phi: 0.92, r: fit, t: HOME }); }
  // the camera moves by itself only in the follow view
  function auto(fn) { if (!manual && !tabletop) fn(); }
  const api = {};
  api.overview = () => auto(overview);
  api.follow = id => auto(() => { follow = id; setWant({ phi: 0.86, r: fit * 0.52 }); });
  // edge: aim at the square's outer edge, so its landmark on the plaza is in shot too
  api.focus = (pos, zoom = 0.5, edge) => auto(() => {
    follow = null;
    const lim = edge ? 5.2 : 3.6, t = edge ? at(pos).addScaledVector(axes(pos).out, L.CW / 2) : at(pos);
    setWant({ t: t.clamp(new THREE.Vector3(-lim, 0, -lim), new THREE.Vector3(lim, 0, lim)), r: fit * zoom, phi: 0.82, ...(cinematic ? { theta: L.VIEW[L.sideOf(pos)] } : {}) });
  });
  api.focusDice = () => auto(() => { follow = null; setWant({ t: new THREE.Vector3(0, 0, 0), r: fit * 0.62, phi: 0.8 }); });
  // the streets hide only while a game is seen from straight above; the menus' backdrop keeps them
  const showRoads = () => { roads = !tabletop || attracting; city.setRoads(roads); };
  api.setTabletop = on => { tabletop = on; manual = false; showRoads(); overview(); };
  api.recenter = () => { manual = false; overview(); };
  api.setCinematic = on => { cinematic = on; };

  // pointer input: drag to orbit, wheel or pinch to zoom, right-drag or two fingers to pan, tap a square
  const ptrs = new Map();
  let downAt = null, pinch = null;
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(UP, 0), hit = new THREE.Vector3();
  function squareUnder(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(plane, hit)) return -1;
    return L.squareAt(hit.x, hit.z);
  }
  // in tabletop `want` already holds the overhead view, so an input mid-ease carries on from there
  function takeControl() { manual = true; follow = null; lastInput = performance.now(); if (tabletop) return; want.t.copy(cam.t); want.theta = cam.theta; want.phi = cam.phi; want.r = cam.r; }
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey });
    if (ptrs.size === 1) downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: want.r }; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') showHover(squareUnder(e)); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) downAt = null;
    if (downAt) return;
    if (!manual) takeControl();
    // tabletop stays flat and square to the screen: a pinch zooms, a drag pans once zoomed in
    if (tabletop) {
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; want.r = pinch.r * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)); }
      else { const k = 2 * want.r * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / canvas.clientHeight; want.t.x -= dx * k; want.t.z -= dy * k; }
      clampTable();
      return;
    }
    lastInput = performance.now();
    if (ptrs.size === 2 && pinch) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...ptrs.values()];
      want.r = Math.max(3.5, Math.min(fit * 1.5, pinch.r * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))));
      panBy(dx * 0.5, dy * 0.5);
      return;
    }
    p.x = e.clientX; p.y = e.clientY;
    if (p.b === 2 || p.shift) panBy(dx, dy);
    else { want.theta -= dx * 0.006; want.phi = Math.max(0.05, Math.min(1.32, want.phi - dy * 0.005)); }
  });
  // tabletop zoom runs from the whole board to 2.5x closer, and panning stops at the board's edge
  function clampTable() {
    setWant({ theta: table.theta, phi: table.phi });
    want.r = Math.max(table.r * 0.4, Math.min(table.r, want.r));
    const f = want.r / table.r, m = L.W / 2 * (1 - f), cz = table.t.z * f; // a phone's overhead view sits off-centre by table.t.z
    want.t.x = Math.max(table.t.x - m, Math.min(table.t.x + m, want.t.x));
    want.t.z = Math.max(cz - m, Math.min(cz + m, want.t.z));
  }
  function panBy(dx, dy) {
    const k = want.r * 0.0016, c = Math.cos(want.theta), s = Math.sin(want.theta);
    want.t.x = Math.max(-6, Math.min(6, want.t.x - (dx * c + dy * s) * k));
    want.t.z = Math.max(-6, Math.min(6, want.t.z - (-dx * s + dy * c) * k));
  }
  const endPtr = e => {
    const tap = downAt && ptrs.size === 1 && performance.now() - downAt.t < 450;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (tap) {
      const r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      // a finger-sized area around the dice counts as tapping them
      const onPlane = raycaster.ray.intersectPlane(plane, hit) && hit.distanceTo(diceCentre()) < 0.6;
      if (onDice && (onPlane || raycaster.intersectObjects(dice.filter(d => d.visible), false).length)) onDice();
      else { const sq = squareUnder(e); if (sq >= 0 && onSquare) onSquare(sq); }
    }
    downAt = null;
  };
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); downAt = null; pinch = null; });
  canvas.addEventListener('pointerleave', () => showHover(-1));
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (!manual) takeControl();
    if (tabletop) { want.r *= Math.exp(e.deltaY * 0.0012); clampTable(); return; }
    want.r = Math.max(3.5, Math.min(fit * 1.5, want.r * Math.exp(e.deltaY * 0.0012)));
  }, { passive: false });
  function showHover(sq) {
    if (sq < 0) { hover.visible = false; canvas.style.cursor = ''; return; }
    const [w, d] = squareSize(sq), c = at(sq);
    hover.scale.set(w * 0.96, 1, d * 0.96); hover.position.set(c.x, 0.006, c.z); hover.visible = true;
    canvas.style.cursor = 'pointer';
  }

  // a landmark standing between the camera and its square fades, so it never hides the plate behind it
  const _look = new THREE.Vector3();
  function fadeLandmarks(dt) {
    _look.copy(camera.position).sub(cam.t).setY(0).normalize();
    const sight = Math.tan(Math.PI / 2 - cam.phi) * 0.6; // height of the line of sight just past the board edge
    for (const pos of OWNABLE) {
      const lot = lots[pos];
      if (!lot.lm.visible) continue;
      const k = _look.dot(lot.out) > 0.35 && lot.top > sight ? 0.22 : 1;
      lot.fade += (k - lot.fade) * Math.min(1, dt * 6);
      lot.lmMat.opacity = lot.fade;
      if ((lot.fade < 0.99) !== lot.lmMat.transparent) { lot.lmMat.transparent = lot.fade < 0.99; lot.lmMat.needsUpdate = true; } // opaque shaders ignore opacity
    }
  }
  function updateCamera(dt) {
    if (follow && pawns.has(follow) && !manual) {
      const p = pawns.get(follow);
      want.t.copy(p.g.position).setY(0).clamp(new THREE.Vector3(-3.4, 0, -3.4), new THREE.Vector3(3.4, 0, 3.4));
      if (cinematic && p.pos >= 0) setWant({ theta: L.VIEW[L.sideOf(p.pos)] });
    }
    if (orbitSpin) want.theta += orbitSpin * dt;
    const k = 1 - Math.exp(-dt * (manual ? 9 : 2.6));
    cam.theta = lerp(cam.theta, want.theta, k); cam.phi = lerp(cam.phi, want.phi, k); cam.r = lerp(cam.r, want.r, k); cam.t.lerp(want.t, k);
    place(cam);
  }

  // ---------- render loop with adaptive resolution ----------
  let ambient = true, time = 0, last = performance.now(), slowFrames = 0, fpsAcc = [];
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    look.setSize(w, h, dpr);
    camera.aspect = w / h; camera.fov = w / h < 0.8 ? 46 : 36; camera.updateProjectionMatrix();
    fx.setScale(h * dpr / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
    const was = table.r;
    computeFit();
    if (tabletop && manual) { want.r *= table.r / was; clampTable(); } // keep a tabletop zoom across a resize
    else if (!manual && !follow) { overview(); cam.r = want.r; }
  }
  new ResizeObserver(resize).observe(canvas);
  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = (now - last) / 1000, dt = Math.min(0.05, rawDt);
    last = now; time += dt;
    for (const tw of tweens) {
      const t = Math.max(0, Math.min(1, (now - tw.start) / tw.dur)); // rAF time can precede a tween's start
      tw.fn(t, now - tw.start);
      if (t >= 1) { tweens.delete(tw); tw.res(); }
    }
    fx.update(dt);
    if (ambient) {
      city.update(dt, time);
      for (const pos of OWNABLE) {
        const lot = lots[pos];
        if (!lot.lm.visible) continue;
        lot.cloth.rotation.y = Math.sin(time * 3 + lot.ph) * 0.35;
        if (!lot.m) lot.lm.scale.y = LM_K * (1 + Math.sin(time * 2.2 + lot.ph) * 0.012);
      }
      layoutFlags();
      pickMeshes.forEach(m => { m.material.opacity = 0.18 + 0.16 * Math.sin(time * 4 + m.userData.ph); });
    }
    if (turnId && pawns.has(turnId)) {
      const p = pawns.get(turnId);
      // the player whose turn it is bobs gently while waiting
      if (!tweens.has(p.tw) && !p.reacting) p.fig.position.y = 0.05 + Math.max(0, Math.sin(time * 3)) * 0.05;
      ring.visible = !p.out; ring.position.set(p.g.position.x, 0.005, p.g.position.z);
      const k = (p.scale || 1) * (1 + Math.sin(time * 3.2) * 0.06); ring.scale.set(k, k, 1);
      ring.material.opacity = 0.65 + Math.sin(time * 3.2) * 0.25;
    } else ring.visible = false;
    if (gavelPos) gavel.position.y = 0.75 + Math.sin(time * 2) * 0.03;
    updateCamera(dt);
    fadeLandmarks(dt);
    renderer.info.reset();
    look.render();
    // drop resolution when frames run long, never below 1x; then drop the post effects
    if (rawDt > 0.026 && rawDt < 0.25) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    fpsAcc.push(rawDt); if (fpsAcc.length > 60) fpsAcc.shift();
    if (slowFrames > 45) {
      if (dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); } else look.setLevel('low');
      slowFrames = 0;
    }
  }
  resize();
  requestAnimationFrame(frame);

  // ---------- animations the presenter asks for ----------
  const spotOf = (id) => pawns.get(id) && pawns.get(id).g.position.clone();
  Object.assign(api, {
    renderer, camera, scene, wait,
    setSpeed(k) { timeScale = k; },
    setAmbient(on) { ambient = on; },
    setQuality(q) {
      level = q === 'auto' ? (coarse ? 'medium' : 'high') : q; Q = QUALITY[level];
      dpr = Math.min(devicePixelRatio || 1, Q.dpr); renderer.setPixelRatio(dpr);
      renderer.shadowMap.enabled = sun.castShadow = Q.shadow > 0;
      sun.shadow.mapSize.set(Q.shadow || 512, Q.shadow || 512); sun.shadow.map?.dispose(); sun.shadow.map = null;
      look.setLevel(level);
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
      resize();
    },
    fps() { const avg = fpsAcc.reduce((a, b) => a + b, 0) / Math.max(1, fpsAcc.length); return { fps: Math.round(1 / avg), dpr, level, post: look.post, calls: renderer.info.render.calls }; },

    // put everything where the state says, without animation
    sync(view, shown, colorOf) {
      const ids = new Set();
      for (const p of view.players) {
        if (view.phase === 'lobby') continue;
        ids.add(p.id);
        const pw = pawn(p.id, p.tok, colorOf(p.id));
        pw.out = p.out; pw.g.visible = !p.out;
        pw.pos = shown.pos[p.id] ?? p.pos; pw.jail = shown.jail[p.id] ?? p.jail;
      }
      for (const [id, p] of pawns) if (!ids.has(id)) { scene.remove(p.g); pawns.delete(id); }
      const squares = new Set([...pawns.values()].map(p => p.pos));
      squares.forEach(sq => layoutSquare(sq));
      for (const pos of OWNABLE) {
        const pr = (view.props || {})[pos] || { o: null, h: 0, m: false }, lot = lots[pos];
        if (lot.owner !== (pr.o || null)) setOwner(pos, pr.o || null);
        if (lot.m !== !!pr.m) setMortgage(pos, !!pr.m);
        lot.h = pr.h;
      }
      layoutBuildings();
      const anyJail = view.players.some(p => !p.out && (shown.jail[p.id] ?? p.jail));
      if (anyJail !== cageDown) { cageDown = anyJail; cage.visible = anyJail; cage.position.y = anyJail ? 0 : 3; }
      setDice(view.dice && view.dice.length === 3 ? view.dice : [0, 0]);
    },
    setTurn(id) { turnId = id; },

    roll(values, skin) { return roll(values, skin); },
    setTheme,
    get theme() { return themeName; },
    diceCentre,
    // the faces the dice show, read back from their orientation (for tests)
    diceFaces() { return dice.filter(d => d.visible).map(d => { let best = 0, bd = -2; [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach((n, k) => { const v = new THREE.Vector3(...n).applyQuaternion(d.quaternion).y; if (v > bd) { bd = v; best = k; } }); return [3, 4, 1, 6, 2, 5][best]; }); },
    // where a lot's landmark stands and how faded it is (for tests)
    landmark(pos) { const lm = lots[pos].lm; return { at: lm.getWorldPosition(new THREE.Vector3()).toArray(), opacity: lm.material.opacity, visible: lm.visible }; },
    lookAtDice() { manual = true; follow = null; const c = diceCentre(); want.t.copy(c); want.phi = 0.05; want.r = 3; },

    // walk a token square by square along the engine's path
    async hop(id, path, onStep) {
      const p = pawns.get(id); if (!p || !path.length) return;
      kill(p.tw);
      const gait = M.GAIT[p.tok], from0 = p.pos;
      p.pos = -1;
      layoutSquare(from0);
      const fast = path.length > 12, dur = (gait === 'glide' ? 380 : 300) * (fast ? 0.7 : 1), tail = new THREE.Vector3();
      // a crouch before the first jump
      await tween(110, t => { const k = Math.sin(Math.PI * t) * 0.16; p.fig.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5); }).done;
      for (let k = 0; k < path.length; k++) {
        const sq = path[k], last = k === path.length - 1;
        const a = p.g.position.clone(), b = last ? tokenSpot(sq, 0, 1, false) : tokenSpot(sq, 0, 1, false);
        const dir = b.clone().sub(a).setY(0), dist = dir.length(); dir.normalize();
        const axis = new THREE.Vector3(dir.z, 0, -dir.x);
        const h = gait === 'glide' ? 0.55 : gait === 'twirl' ? 0.45 : 0.32;
        const q0 = p.fig.quaternion.clone();
        p.tw = tween(dur, t => {
          p.g.position.lerpVectors(a, b, gait === 'glide' ? easeInOut(t) : t);
          p.g.position.y = Math.sin(Math.PI * t) * h;
          const sq2 = 1 + Math.sin(Math.PI * t) * 0.12;
          p.fig.scale.set(1 / Math.sqrt(sq2), sq2, 1 / Math.sqrt(sq2));
          if (gait === 'spin') p.fig.rotation.y = t * Math.PI;
          else if (gait === 'roll') p.fig.quaternion.copy(q0).premultiply(new THREE.Quaternion().setFromAxisAngle(axis, t * dist * 3));
          else if (gait === 'twirl') p.fig.rotation.y = t * Math.PI * 2;
          else if (gait === 'sway') p.fig.rotation.z = Math.sin(t * Math.PI * 2) * 0.25;
          else if (gait === 'glide') p.fig.rotation.z = Math.sin(t * Math.PI) * 0.15;
          p.g.quaternion.setFromAxisAngle(axis, Math.sin(Math.PI * t) * 0.18); // lean into the jump
          fx.glow(tail.copy(p.g.position).setY(p.g.position.y + 0.12), p.color);
        });
        await p.tw.done;
        p.fig.scale.set(1, 1, 1); p.fig.rotation.set(0, 0, 0); p.fig.quaternion.identity(); p.g.quaternion.identity();
        sfx.step();
        flash(sq, p.color, 420, 0.45);
        if (onStep) onStep(sq, k);
        if (!last) continue;
        // landing squash
        await tween(140, t => { const s = 1 - Math.sin(Math.PI * t) * 0.18; p.fig.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6); }).done;
        p.fig.scale.set(1, 1, 1);
        fx.dust(p.g.position, 0.7, p.color); fx.sparkle(p.g.position.clone().setY(0.25), p.color, 12, 0.9);
      }
      p.pos = path[path.length - 1];
      layoutSquare(p.pos);
    },
    // a big arc, for jail and teleports
    async fly(id, pos, jailed) {
      const p = pawns.get(id); if (!p) return;
      kill(p.tw);
      const from0 = p.pos; p.pos = -1; layoutSquare(from0);
      const a = p.g.position.clone(), b = tokenSpot(pos, 0, 1, jailed);
      sfx.whoosh();
      p.tw = tween(900, t => { const e = easeInOut(t); p.g.position.lerpVectors(a, b, e); p.g.position.y = Math.sin(Math.PI * t) * 2.2; p.fig.rotation.y = e * Math.PI * 4; });
      await p.tw.done;
      p.fig.rotation.set(0, 0, 0);
      p.pos = pos; p.jail = !!jailed;
      fx.dust(b, 0.7);
      layoutSquare(pos);
    },
    async react(id, kind) { // a token's little mood
      const p = pawns.get(id); if (!p) return;
      p.reacting = true;
      if (kind === 'happy') await tween(600, t => { p.fig.position.y = 0.05 + Math.sin(Math.PI * t) * 0.35; p.fig.rotation.y = ease(t) * Math.PI * 2; }).done;
      else if (kind === 'sad') await tween(700, t => { const k = Math.sin(Math.PI * t); p.fig.scale.set(1 + k * 0.1, 1 - k * 0.25, 1 + k * 0.1); p.fig.rotation.z = Math.sin(t * 20) * 0.08 * k; }).done;
      else if (kind === 'shake') await tween(500, t => { p.fig.rotation.z = Math.sin(t * 40) * 0.2 * (1 - t); }).done;
      p.fig.position.y = 0.05; p.fig.rotation.set(0, 0, 0); p.fig.scale.set(1, 1, 1);
      p.reacting = false;
    },
    async buy(pos, id) {
      const lot = lots[pos], a = lot.pa = { y: 1.1, flip: -Math.PI * 2, s: 1 };
      setOwner(pos, id);
      const color = lot.pw ? lot.pw.color : '#ffd166';
      lot.lm.position.y = LM_Y - 0.9; lot.flag.scale.setScalar(0.01);
      sfx.build();
      flash(pos, color, 900, 0.6);
      tween(640, t => { a.y = 1.1 * (1 - ease(t)); a.flip = -Math.PI * 2 * (1 - ease(t)); layoutPlates(); }).done.then(() => {
        if (lot.pa === a) lot.pa = null;
        layoutPlates(); sfx.coin();
        fx.dust(plateAt(lot), 0.9, color); fx.sparkle(plateAt(lot).setY(0.15), color, 26, 1.5);
      });
      await tween(700, t => { lot.lm.position.y = LM_Y - 0.9 + back(t) * 0.9; layoutFlags(); }).done;
      fx.dust(lot.c.clone().addScaledVector(lot.out, LM_Z).setY(LM_Y), 0.8);
      await tween(300, t => { lot.flag.scale.setScalar(FLAG_K * Math.max(0.01, back(t))); layoutFlags(); }).done;
    },
    // rent paid on a square: its owner's plate jumps and rings out
    rentHit(pos) {
      const lot = lots[pos]; if (!lot || !lot.pw) return;
      const a = lot.pa = { y: 0, flip: 0, s: 1 };
      fx.dust(plateAt(lot), 0.8, lot.pw.color);
      tween(520, t => { const k = Math.sin(Math.PI * t); a.s = 1 + k * 0.3; a.y = k * 0.16; layoutPlates(); }).done.then(() => { if (lot.pa === a) lot.pa = null; layoutPlates(); });
    },
    // a ring in the player's colour under their token, as their turn starts
    ripple(id) { const p = pawns.get(id); if (p && !p.out) fx.dust(p.g.position, 1.1, p.color); },
    // houses and hotels: compare with the lot's current count and animate the change
    async build(pos, h) {
      const landSquash = key => tween(170, t => { const k = Math.sin(Math.PI * t), a = hanim[key]; a.sx = 1 + k * 0.16; a.sy = 1 - k * 0.24; layoutBuildings(); }).done.then(() => { delete hanim[key]; layoutBuildings(); });
      const lot = lots[pos], prev = lot.h;
      if (h === prev) return;
      if (h === 5 && prev >= 3) {
        const n = prev;
        for (let i = 0; i < n; i++) hanim[pos + ':' + i] = { y: 0, s: 1 };
        await tween(380, t => { for (let i = 0; i < n; i++) { const a = hanim[pos + ':' + i]; a.s = 1 - ease(t) * 0.99; a.y = Math.sin(Math.PI * t) * 0.25; a.at = houseSlot(pos, i, n).lerp(houseSlot(pos, 0, 1), ease(t)); } layoutBuildings(); }).done;
        for (let i = 0; i < n; i++) delete hanim[pos + ':' + i];
        lot.h = 5; hanim[pos + ':H'] = { y: 1.4, s: 1 };
        sfx.hotel(); fx.beam(houseSlot(pos, 0, 1), '#ffd166', 1.2, 1.1);
        await tween(520, t => { hanim[pos + ':H'].y = 1.4 * (1 - back(Math.min(1, t))) ; layoutBuildings(); }).done;
        await landSquash(pos + ':H');
        fx.dust(houseSlot(pos, 0, 1), 0.9, '#ffd166'); fx.sparkle(houseSlot(pos, 0, 1).setY(0.2), '#ffd166', 28); fx.confetti(houseSlot(pos, 0, 1).setY(1), 40, 1);
        return;
      }
      if (h > prev && h < 5) {
        lot.h = h; const key = pos + ':' + (h - 1);
        hanim[key] = { y: 1.2, s: 1 };
        sfx.build(); fx.beam(houseSlot(pos, h - 1, h), '#ffd166', 0.7);
        await tween(480, t => { hanim[key].y = Math.max(0, 1.2 * (1 - back(t))); layoutBuildings(); }).done;
        await landSquash(key);
        fx.dust(houseSlot(pos, h - 1, h), 0.6, '#ffd166'); fx.sparkle(houseSlot(pos, h - 1, h).setY(0.15), '#ffd166', 12, 1);
        return;
      }
      // selling: the last building shrinks away
      const key = prev === 5 ? pos + ':H' : pos + ':' + (prev - 1);
      hanim[key] = { y: 0, s: 1 };
      await tween(320, t => { hanim[key].s = 1 - ease(t) * 0.99; hanim[key].y = t * 0.3; layoutBuildings(); }).done;
      delete hanim[key];
      lot.h = h; layoutBuildings();
    },
    async mortgage(pos, m) {
      const lot = lots[pos], greyPlate = (l, k) => { if (l.pw) { plates.setColorAt(l.i, plateColor(l, k)); plates.instanceColor.needsUpdate = true; } };
      sfx.stamp();
      if (m) {
        lot.stamp.visible = true; lot.stamp.material.opacity = 0;
        await tween(380, t => { lot.stamp.material.opacity = ease(t); lot.stamp.scale.setScalar(1.8 - ease(t) * 0.8); lot.lm.position.y = LM_Y - 0.06 * t; lot.lmMat.color.lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#8d8f96'), t); greyPlate(lot, t); }).done;
        lot.stamp.scale.setScalar(1);
        setMortgage(pos, true);
      } else {
        await tween(380, t => { lot.stamp.material.opacity = 1 - t; lot.lm.position.y = LM_Y - 0.06 * (1 - t); lot.lmMat.color.lerpColors(new THREE.Color('#8d8f96'), new THREE.Color('#ffffff'), t); greyPlate(lot, 1 - t); }).done;
        lot.stamp.material.opacity = 1;
        setMortgage(pos, false);
        fx.sparkle(lot.c.clone().setY(0.2), '#ffffff', 14);
      }
    },
    // bank notes: from a token (or the bank) to a token (or the bank)
    pay(fromId, toId, amount, fromPos) {
      const bank = new THREE.Vector3(0, 0.6, 0);
      const a = fromId ? spotOf(fromId) : fromPos !== undefined ? at(fromPos) : bank;
      const b = toId ? spotOf(toId) : bank;
      if (!a || !b) return Promise.resolve();
      sfx.cash();
      const n = Math.max(3, Math.min(14, Math.round(Math.sqrt(amount) / 2.5)));
      return Promise.all([fx.notes(a, b, amount), fx.coins(a, b, n, 0.1)]).then(() => fx.dust(b.clone().setY(0.02), 0.6, '#ffd166'));
    },
    // salary: coins spring up from a square
    coinBurst(pos) { fx.fountain(at(pos).setY(0.05), 16); fx.beam(at(pos), '#ffd166', 0.9, 0.7); },
    card, deed,
    async jail(id) {
      if (!cageDown) {
        cageDown = true; cage.visible = true;
        await tween(380, t => { cage.position.y = 3 * (1 - t * t); }).done;
        sfx.jail();
        fx.dust(new THREE.Vector3(L.JAIL_CELL.x, 0, L.JAIL_CELL.z), 1);
        await tween(240, t => { cage.position.y = Math.sin(Math.PI * t) * 0.08; }).done;
        cage.position.y = 0;
      } else sfx.jail();
      if (id) api.react(id, 'shake');
    },
    async freed(stillJailed) {
      if (stillJailed || !cageDown) return;
      cageDown = false;
      await tween(420, t => { cage.position.y = ease(t) * 3; }).done;
      cage.visible = false;
    },
    gavel(pos) {
      gavelPos = pos;
      const c = pos === undefined || pos === null ? new THREE.Vector3(0, 0, 0.6) : at(pos);
      gavel.position.set(c.x + 0.25, 0.75, c.z); gavel.rotation.set(0, cam.theta, -0.5); gavel.visible = true;
      gavel.scale.setScalar(0.01);
      return tween(300, t => gavel.scale.setScalar(Math.max(0.01, back(t)))).done;
    },
    gavelTap() {
      if (!gavel.visible) return Promise.resolve();
      sfx.bid();
      return tween(220, t => { gavel.rotation.z = -0.5 + Math.sin(Math.PI * t) * 0.45; }).done;
    },
    async gavelSlam() {
      if (!gavel.visible) return;
      await tween(160, t => { gavel.rotation.z = -0.5 - t * 0.4; }).done;
      await tween(110, t => { gavel.rotation.z = -0.9 + t * 1.5; }).done;
      sfx.gavel();
      fx.dust(gavel.position.clone().setY(0), 0.8);
      await wait(380);
      await tween(260, t => gavel.scale.setScalar(Math.max(0.01, 1 - t))).done;
      gavel.visible = false; gavelPos = null;
    },
    hideGavel() { gavel.visible = false; gavelPos = null; },
    async crumble(id) {
      const p = pawns.get(id); if (!p) return;
      kill(p.tw);
      sfx.crumble();
      await tween(500, t => { p.fig.rotation.z = Math.sin(t * 50) * 0.15; }).done;
      const c = p.g.position.clone();
      for (let i = 0; i < 4; i++) fx.sparkle(c.clone().setY(0.2 + i * 0.1), '#9aa0a8', 12, 1.2);
      fx.dust(c, 1);
      await tween(600, t => { p.g.scale.setScalar(Math.max(0.01, (p.scale || 1) * (1 - ease(t)))); p.g.position.y = -t * 0.1; }).done;
      p.g.visible = false; p.out = true;
    },
    // property changing hands: deeds slide between tokens
    async swap(fromId, toId, give, get, colorOf) {
      const run = (list, a, b) => Promise.all(list.map((pos, i) => wait(i * 120).then(async () => {
        const pa = spotOf(a), pb = spotOf(b), face = printMat(A.drawDeed(pos)), card = cardObject(deedGeo, face, paperMat);
        card.scale.setScalar(0.6); scene.add(card);
        // face up (the print is on -y), tumbling a little on the way
        await tween(850, t => {
          card.position.lerpVectors(pa, pb, easeInOut(t)); card.position.y = 0.25 + Math.sin(Math.PI * t) * 1.5;
          card.rotation.set(Math.PI + Math.sin(Math.PI * t) * 0.5, t * Math.PI * 2, 0);
          fx.glow(card.position, '#ffe6a3', 0.09, 0.3);
        }).done;
        scene.remove(card); disposeMat(face);
        flipOwner(pos, b); flash(pos, colorOf(b), 600, 0.5);
      })));
      sfx.whoosh();
      await Promise.all([run(give, fromId, toId), run(get, toId, fromId)]);
    },
    flash, pickMode,
    sparkle: (pos, color) => fx.sparkle(at(pos).setY(0.3), color, 24),
    burstAt: (id, color) => { const v = spotOf(id); if (v) fx.sparkle(v.setY(0.4), color, 30, 2); },
    async celebrate(id) {
      const p = pawns.get(id);
      if (!tabletop) { follow = id; manual = false; setWant({ r: fit * 0.6, phi: 0.75 }); orbitSpin = 0.35; }
      fx.confetti(new THREE.Vector3(0, 4, 0), 300, 9);
      const colors = ['#ffd166', '#ff6b8a', '#6be3ff', '#9cff6b', '#c38bff'];
      for (let i = 0; i < 8; i++) {
        const base = new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8), top = base.clone().setY(4 + Math.random() * 2);
        fx.trail(base, top, '#fff3c4', 0.5);
        setTimeout(() => { fx.firework(top, colors[i % colors.length]); sfx.pop(); }, 520 + i * 0);
        await wait(420);
      }
      if (p) await tween(1600, t => { p.fig.position.y = 0.05 + Math.abs(Math.sin(t * Math.PI * 3)) * 0.4; p.fig.rotation.y = t * Math.PI * 4; }).done;
      if (p) { p.fig.position.y = 0.05; p.fig.rotation.set(0, 0, 0); }
    },
    stopCelebrate() { orbitSpin = 0; },
    // slow orbit behind the menus
    attract(on) { manual = false; follow = null; attracting = on; showRoads(); orbitSpin = on ? 0.07 : 0; if (on) setWant({ phi: 0.78, r: fit * 1.08, t: new THREE.Vector3(0, 0, 0) }); else overview(); },
    // where a square or token is on screen, for HUD bubbles
    screenOf(target) {
      const v = typeof target === 'number' ? at(target).setY(0.3) : target === 'dice' ? diceCentre().setY(0.17) : (spotOf(target) || new THREE.Vector3()).setY(0.6);
      v.project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: (v.x + 1) / 2 * r.width + r.left, y: (1 - v.y) / 2 * r.height + r.top, behind: v.z > 1 };
    },
  });
  return api;
}
