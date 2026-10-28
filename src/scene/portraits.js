// 3D portraits of the tokens, dice, board themes, mascot, trophy, icons, emotes, houses and landmarks, rendered offscreen to images for the menus and HUD.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as M from './models.js';
import { makeDice } from './dice.js';
import { THEMES, DICE_LOOK } from './themes.js';
import { drawBoard } from './art2d.js';
import { emoteModel } from './emotes3d.js';
import { iconModel } from './icons3d.js';
import { TOK, IC } from '../art.js';
import { BOARD } from '../engine.js';

export async function makePortraits() {
  const canvas = document.createElement('canvas');
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.toneMapping = THREE.NeutralToneMapping;
  const gen = new THREE.PMREMGenerator(r), room = new RoomEnvironment();
  const studio = gen.fromScene(room, 0.04).texture;
  gen.dispose(); room.dispose();
  const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 100);

  // frame a sphere from a yaw and pitch and render it
  function frame(scene, sphere, { w = 256, h = 256, yaw = 0.55, pitch = 0.4, pad = 1.08 } = {}) {
    r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const half = THREE.MathUtils.degToRad(cam.fov) / 2, fit = Math.min(half, Math.atan(Math.tan(half) * cam.aspect));
    const d = sphere.radius * pad / Math.sin(fit), c = sphere.center;
    cam.position.set(c.x + d * Math.cos(pitch) * Math.sin(yaw), c.y + d * Math.sin(pitch), c.z + d * Math.cos(pitch) * Math.cos(yaw));
    cam.lookAt(c);
    r.render(scene, cam);
  }
  const blob = () => new Promise(res => canvas.toBlob(b => res(URL.createObjectURL(b)), 'image/png'));
  const bounds = obj => new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
  function stage() { // studio light on a clear background
    const sc = new THREE.Scene();
    sc.environment = studio;
    const key = new THREE.DirectionalLight('#ffffff', 2.4), rim = new THREE.DirectionalLight('#d6e4ff', 1.4);
    key.position.set(2, 4, 3); rim.position.set(-3, 2.5, -2.5);
    sc.add(key, rim, new THREE.AmbientLight('#ffffff', 0.35));
    return sc;
  }
  const clear = sc => sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });

  // tokens: polished metal on an enamelled base in the token's colour, as on the board
  const metal = M.tokenMetal(studio);
  const tok = [];
  for (let i = 0; i < TOK.length; i++) {
    const sc = stage(), fig = new THREE.Mesh(M.tokenGeometry(i), metal);
    fig.position.y = 0.05;
    sc.add(fig, new THREE.Mesh(M.tokenBase(), M.tokenEnamel(TOK[i].c, studio)));
    frame(sc, bounds(sc), { yaw: 0.5, pitch: 0.36 });
    tok.push(await blob());
    sc.remove(fig); fig.geometry.dispose(); clear(sc);
  }

  // dice: each design showing 5, 1 and 3
  const dsc = stage(), dice = makeDice(dsc, 4);
  dice[1].visible = dice[2].visible = false;
  dice[0].position.set(0, 0, 0); dice[0].rotation.set(Math.PI / 2, 0, 0);
  const dieAt = new THREE.Sphere(new THREE.Vector3(), 0.3), diceUrls = [];
  for (let k = 0; k < DICE_LOOK.length; k++) {
    dice.skin(k);
    frame(dsc, dieAt, { yaw: 0.6, pitch: 0.5 });
    diceUrls.push(await blob());
  }
  clear(dsc);

  // board themes: a small diorama of each world around a corner of its board
  const theme = {};
  for (const [k, T] of Object.entries(THEMES)) {
    const sc = new THREE.Scene(), G = T.ground;
    const sky = document.createElement('canvas'); sky.width = 4; sky.height = 64;
    const sg = sky.getContext('2d').createLinearGradient(0, 0, 0, 64);
    sg.addColorStop(0, T.sky[0]); sg.addColorStop(0.6, T.sky[1]); sg.addColorStop(1, T.sky[2]);
    sky.getContext('2d').fillStyle = sg; sky.getContext('2d').fillRect(0, 0, 4, 64);
    sc.background = new THREE.CanvasTexture(sky); sc.background.colorSpace = THREE.SRGBColorSpace;
    sc.environment = studio; sc.environmentIntensity = 0.5;
    const sun = new THREE.DirectionalLight(T.sun[0], T.sun[1]); sun.position.set(3, 6, 2);
    sc.add(sun, new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));
    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.2, 48), std(G.grass)); ground.position.y = -0.24;
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.04, 3.6), std(G.plaza)); plaza.position.y = -0.12;
    const print = new THREE.CanvasTexture(drawBoard(512, T.board)); print.colorSpace = THREE.SRGBColorSpace;
    const edge = std(T.board.edge);
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 2.8), [edge, edge, std('#ffffff', { map: print, roughness: 0.55 }), edge, edge, edge]);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.05, 2.9), std(T.board.trim, { metalness: 0.8, roughness: 0.3 })); trim.position.y = -0.06;
    sc.add(ground, plaza, board, trim);
    const add = (geo, color, x, y, z, s = 1, o) => { const m = new THREE.Mesh(geo, std(color, { vertexColors: true, ...o })); m.position.set(x, y, z); m.scale.setScalar(s); sc.add(m); return m; };
    if (T.mushrooms) { add(M.mushroomStem(), T.buildings[0], -1.9, -0.14, -1.2, 0.6); add(M.mushroomCap(), T.roofs[0], -1.9, 0.46, -1.2, 0.9); }
    else { const b = add(new THREE.BoxGeometry(0.8, 1.6, 0.8), T.buildings[1], -1.95, 0.66, -1.3, 1, { vertexColors: false }); if (T.glow) b.material.emissive = new THREE.Color(T.glow[0]).multiplyScalar(0.25); add(M.crownGeometry(0), T.roofs[0], -1.95, 1.46, -1.3, 0.76, T.glow ? { emissive: T.roofs[0] } : {}); }
    const tree = M.treeParts(), pine = M.pineParts();
    add(tree.trunk, '#ffffff', 1.85, -0.14, -1.6); add(tree.crown, T.leafy[0], 1.85, -0.14, -1.6, 1, T.glow ? { emissive: T.leafy[0], emissiveIntensity: 0.5 } : {});
    add(pine.trunk, '#ffffff', -1.85, -0.14, 1.5, 1.2); add(pine.crown, T.pines[0], -1.85, -0.14, 1.5, 1.2);
    const ride = T.vehicles === 'fish' ? { paint: M.fishGeometry() } : T.vehicles === 'carts' ? M.cartParts() : M.vehicleParts('sedan', T.vehicles !== 'hover');
    const lift = T.vehicles === 'hover' || T.vehicles === 'fish' ? 0.45 : -0.1;
    add(ride.paint, T.carColors[0], 1.95, lift, 1.3, 1.5, { metalness: 0.3, roughness: 0.35 }).rotation.y = -0.4;
    if (ride.detail) add(ride.detail, '#ffffff', 1.95, lift, 1.3, 1.5).rotation.y = -0.4;
    [0, 1].forEach(i => { const f = new THREE.Mesh(M.tokenGeometry(i), metal.clone()); f.position.set(0.7 + i * 0.5, 0.1, 0.9); f.scale.setScalar(1.3); sc.add(f); });
    frame(sc, new THREE.Sphere(new THREE.Vector3(0, 0.2, 0), 2.6), { w: 320, h: 200, yaw: 0.45, pitch: 0.55, pad: 0.92 });
    theme[k] = await blob();
    clear(sc); sc.background.dispose();
  }
  metal.dispose();

  // a gold trophy for wins and achievements
  const gold = new THREE.MeshPhysicalMaterial({ color: '#f2c24e', metalness: 1, roughness: 0.18, clearcoat: 0.5 });
  const trophyModel = () => {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.02, 0], [0.09, 0.02], [0.05, 0.08], [0.04, 0.16], [0.12, 0.22], [0.2, 0.42], [0.22, 0.5], [0.2, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 32), gold);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.26), new THREE.MeshPhysicalMaterial({ color: '#3a2a1c', roughness: 0.35, clearcoat: 1 })); base.position.y = -0.04;
    g.add(cup, base);
    [-1, 1].forEach(s => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 10, 24, Math.PI * 1.2), gold); h.position.set(s * 0.22, 0.36, 0); h.rotation.z = s > 0 ? -Math.PI * 0.6 : Math.PI * 0.4 + Math.PI; g.add(h); });
    return g;
  };
  const tsc = stage(); tsc.add(trophyModel());
  frame(tsc, bounds(tsc), { yaw: 0.35, pitch: 0.25 });
  const trophy = await blob();
  clear(tsc);

  // HUD icons as enamel pins, the emotes, house and hotel pieces and each square's landmark: drawn on first use and kept as blob URLs.
  // Only geometry is freed, since freeing the materials recompiles their shaders on every draw; '' while the context is lost lets callers fall back.
  const drawn = new Map();
  function once(key, view, build) {
    if (!drawn.has(key)) {
      if (r.getContext().isContextLost()) return '';
      const sc = stage(); sc.add(build()); frame(sc, bounds(sc), view);
      const png = atob(canvas.toDataURL('image/png').split(',')[1]);
      drawn.set(key, URL.createObjectURL(new Blob([Uint8Array.from(png, c => c.charCodeAt(0))], { type: 'image/png' })));
      sc.traverse(o => o.geometry && o.geometry.dispose());
    }
    return drawn.get(key);
  }
  const icon = k => once('icon:' + k, { w: 96, h: 96, yaw: 0.26, pitch: 0.2, pad: 0.76 }, () => iconModel(IC[k]));
  const emote = e => once('emote:' + e, { w: 192, h: 192, yaw: 0.22, pitch: 0.14, pad: 0.72 }, () => emoteModel(e));
  const piece = k => once(k, { w: 64, h: 64, yaw: 0.6, pitch: 0.4 }, () => new THREE.Mesh(k === 'hotel' ? M.hotelGeometry() : M.houseGeometry(), M.pieceGloss()));
  const landmark = pos => once('lm:' + pos, { w: 160, h: 160, yaw: 0.55, pitch: 0.3, pad: 1 },
    () => new THREE.Mesh(M.landmarkGeometry(BOARD[pos], pos), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2 })));

  // Penny, the table's money spirit: drawn on demand per mood and prop, wings up and down for a flap
  const spiritCache = new Map();
  function spirit(mood, prop) {
    const key = mood + ':' + prop;
    if (spiritCache.has(key)) return spiritCache.get(key);
    if (r.getContext().isContextLost()) return null;
    const frames = [0.35, 0.95].map(beat => {
      const sc = stage(), g = buildSpirit(mood, prop, beat, gold, trophyModel);
      sc.add(g);
      frame(sc, new THREE.Sphere(new THREE.Vector3(0.04, 0.02, 0), 0.92), { w: 232, h: 268, yaw: 0.22, pitch: 0.12, pad: 1 });
      const url = canvas.toDataURL('image/png');
      sc.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== gold) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      return url;
    });
    spiritCache.set(key, frames);
    return frames;
  }

  return { tok, dice: diceUrls, theme, trophy, mascot: spirit, icon, emote, piece, landmark };
}

// The spirit faces +z. beat: wing angle for this frame.
function buildSpirit(mood, prop, beat, gold, trophyModel) {
  const g = new THREE.Group();
  const pearl = new THREE.MeshPhysicalMaterial({ color: '#fff3d6', emissive: '#ffcf6a', emissiveIntensity: 0.18, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15, iridescence: 0.7, iridescenceIOR: 1.6, sheen: 1, sheenColor: '#ffd1f0' });
  const ink = new THREE.MeshPhysicalMaterial({ color: '#1d1530', roughness: 0.15, clearcoat: 1 });
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const blush = new THREE.MeshBasicMaterial({ color: '#ff9fb8', transparent: true, opacity: 0.6 });
  const glowMat = c => new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 1.3, roughness: 0.1, transparent: true, opacity: 0.85, side: THREE.DoubleSide, iridescence: 1, depthWrite: false });
  const add = (geo, mat, x = 0, y = 0, z = 0, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.s) m.scale.set(...o.s); if (o.r) m.rotation.set(...o.r); g.add(m); return m; };

  // a soft aura behind everything
  const aura = document.createElement('canvas'); aura.width = aura.height = 128;
  const ag = aura.getContext('2d').createRadialGradient(64, 64, 0, 64, 64, 64);
  ag.addColorStop(0, 'rgba(255,226,140,.9)'); ag.addColorStop(0.45, 'rgba(255,190,240,.42)'); ag.addColorStop(1, 'rgba(255,190,240,0)');
  aura.getContext('2d').fillStyle = ag; aura.getContext('2d').fillRect(0, 0, 128, 128);
  add(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(aura), transparent: true, depthWrite: false }), 0, 0.05, -0.6);

  // body, wispy genie tail and little arms
  add(new THREE.SphereGeometry(0.42, 48, 32), pearl, 0, 0.08, 0, { s: [1, 0.95, 0.92] });
  add(new THREE.ConeGeometry(0.26, 0.5, 32), pearl, 0.05, -0.38, -0.04, { r: [Math.PI + 0.25, 0, -0.35] });
  add(new THREE.SphereGeometry(0.06, 16, 12), pearl, 0.15, -0.6, -0.12);
  add(new THREE.SphereGeometry(0.08, 16, 12), pearl, -0.4, -0.06, 0.16);
  add(new THREE.SphereGeometry(0.08, 16, 12), pearl, 0.4, -0.04, 0.18);

  // halo and forehead coin
  add(new THREE.TorusGeometry(0.2, 0.024, 14, 48), new THREE.MeshPhysicalMaterial({ color: '#ffd66b', emissive: '#ffb300', emissiveIntensity: 1.1, metalness: 0.6, roughness: 0.2 }), 0, 0.62, -0.02, { r: [Math.PI / 2 - 0.35, 0, 0.1] });
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24), new THREE.MeshPhysicalMaterial({ color: '#ffd45e', emissive: '#ffb21e', emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.2 }), 0, 0.32, 0.37, { r: [Math.PI / 2 - 0.5, 0, 0] });

  // wings: beat swings them open
  const wing = new THREE.Shape(); wing.moveTo(0, 0); wing.bezierCurveTo(0.12, 0.34, 0.5, 0.44, 0.56, 0.2); wing.bezierCurveTo(0.6, 0.02, 0.3, -0.12, 0, 0);
  const wg = new THREE.ShapeGeometry(wing, 16);
  [-1, 1].forEach(s => add(wg, glowMat(s < 0 ? '#6fd6ff' : '#c39bff'), s * 0.3, 0.12, -0.2, { s: [s * 1.35, 1.35, 1], r: [0, s * (0.5 + beat * 0.7), s * 0.2] }));

  // face
  const eye = (x, y) => {
    if (mood === 'happy') return add(new THREE.TorusGeometry(0.06, 0.017, 8, 20, Math.PI), ink, x, y, 0.37, { r: [-0.1, x * 0.6, 0] });
    if (mood === 'shock') { add(new THREE.SphereGeometry(0.075, 20, 16), white, x, y, 0.35); return add(new THREE.SphereGeometry(0.03, 12, 10), ink, x, y, 0.42); }
    if (mood === 'sad') { add(new THREE.BoxGeometry(0.1, 0.018, 0.02), ink, x, y + 0.09, 0.36, { r: [0, 0, x > 0 ? -0.35 : 0.35] }); return add(new THREE.SphereGeometry(0.055, 20, 16), ink, x, y - 0.01, 0.35, { s: [1, 0.7, 0.6] }); }
    add(new THREE.SphereGeometry(0.068, 20, 16), ink, x, y, 0.35, { s: [0.85, 1.15, 0.6] });
    return add(new THREE.SphereGeometry(0.02, 10, 8), white, x + 0.02, y + 0.03, 0.4);
  };
  eye(-0.14, 0.12); eye(0.14, 0.12);
  add(new THREE.SphereGeometry(0.05, 16, 12), blush, -0.25, 0.0, 0.31, { s: [1.2, 0.7, 0.4] });
  add(new THREE.SphereGeometry(0.05, 16, 12), blush, 0.25, 0.0, 0.31, { s: [1.2, 0.7, 0.4] });
  if (mood === 'shock') add(new THREE.SphereGeometry(0.04, 16, 12), ink, 0, -0.06, 0.38, { s: [0.9, 1.2, 0.5] });
  else add(new THREE.TorusGeometry(0.05, 0.013, 8, 20, Math.PI), ink, 0, mood === 'sad' ? -0.1 : -0.03, 0.38, { r: [0, 0, mood === 'sad' ? 0 : Math.PI] });

  // sparkles around the spirit
  const star = new THREE.MeshBasicMaterial({ color: '#fff4c2' });
  [[-0.62, 0.48, 0.1, 0.035], [0.6, 0.55, 0, 0.028], [-0.55, -0.4, 0.2, 0.024], [0.66, -0.2, 0.1, 0.02]].forEach(([x, y, z, k]) => add(new THREE.OctahedronGeometry(k), star, x, y, z, { r: [0.4, beat, 0.2] }));

  // the prop, held in the right hand
  const hand = new THREE.Group(); hand.position.set(0.5, 0, 0.26); g.add(hand);
  const card = edge => {
    hand.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.02), new THREE.MeshPhysicalMaterial({ color: edge, roughness: 0.3, clearcoat: 1 })));
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.31, 0.024), new THREE.MeshPhysicalMaterial({ color: '#fbf8f0', roughness: 0.5 }));
    hand.add(face);
    const mark = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 20), new THREE.MeshPhysicalMaterial({ color: edge, roughness: 0.3 })); mark.position.z = 0.016; hand.add(mark);
    hand.rotation.set(0.1, -0.35, -0.25);
  };
  if (prop === 'card') card('#e0457b');
  if (prop === 'chat') card('#17a39d');
  if (prop === 'coin') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 32), gold); c.rotation.set(Math.PI / 2, 0, 0.3); hand.add(c); hand.rotation.y = -0.4; }
  if (prop === 'gavel') { const gv = new THREE.Mesh(M.gavelGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2 })); gv.scale.setScalar(1.5); gv.rotation.z = -0.6; hand.add(gv); }
  if (prop === 'trophy') { const t = trophyModel(); t.scale.setScalar(0.8); t.position.y = -0.12; hand.add(t); }
  return g;
}
