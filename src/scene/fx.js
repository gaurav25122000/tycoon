// Particle effects: sparkles, fireworks, dust rings, light beams, confetti, flying bank notes and gold coins.
import * as THREE from 'three';

const ease = t => 1 - Math.pow(1 - t, 3);

export function makeFX(scene, glowTex, billTex, envMap) {
  // ---------- sparkles and fireworks: one point cloud ----------
  const N = 1600;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), grav = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex }, scale: { value: 400 } },
    vertexShader: `attribute float size; attribute float alpha; varying vec3 vColor; varying float vAlpha; uniform float scale;
      void main() { vColor = color; vAlpha = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  let cursor = 0, live = 0;
  const c = new THREE.Color();
  function emit(at, color, v, sz, lifeS, g) {
    const i = cursor; cursor = (cursor + 1) % N;
    pos.set([at.x, at.y, at.z], i * 3); vel.set([v.x, v.y, v.z], i * 3);
    c.set(color); col.set([c.r, c.g, c.b], i * 3);
    size[i] = sz; alpha[i] = 1; life[i] = lifeS; max[i] = lifeS; grav[i] = g;
    live = Math.max(live, lifeS);
  }
  const rv = (k, up = 0) => { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5 + up, Math.random() - 0.5); return v.normalize().multiplyScalar(k * (0.4 + Math.random() * 0.6)); };
  function sparkle(at, color, n = 24, speed = 1.6) { for (let i = 0; i < n; i++) emit(at, color, rv(speed, 0.6), 0.12 + Math.random() * 0.1, 0.6 + Math.random() * 0.5, -3); }
  function firework(at, color) {
    for (let i = 0; i < 90; i++) emit(at, color, rv(4.2), 0.16, 1.2 + Math.random() * 0.6, -2.2);
    for (let i = 0; i < 20; i++) emit(at, '#ffffff', rv(2), 0.1, 0.8, -1);
  }
  // one short-lived glow, for comet tails behind moving things
  function glow(at, color, sz = 0.11, lifeS = 0.38) { emit(at, color, rv(0.12), sz, lifeS, 0); }
  function trail(from, to, color, dur) { // a rocket climbing
    const n = Math.round(dur * 40);
    for (let i = 0; i < n; i++) setTimeout(() => emit(new THREE.Vector3().lerpVectors(from, to, i / n), color, rv(0.2), 0.08, 0.5, 0), (i / n) * dur * 1000);
  }

  // ---------- dust rings ----------
  const ringGeo = new THREE.RingGeometry(0.1, 0.16, 40);
  const rings = [];
  function dust(at, k = 1, color = '#ffffff') {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(at.x, (at.y || 0) + 0.01, at.z);
    scene.add(m); rings.push({ m, t: 0, k });
    for (let i = 0; i < 8 * k; i++) emit(new THREE.Vector3(at.x, (at.y || 0) + 0.05, at.z), '#d8cbb3', rv(0.9 * k, 0.3), 0.18, 0.5, -0.5);
  }

  // ---------- light beams: a column that flares up and fades ----------
  const fadeUp = document.createElement('canvas'); fadeUp.width = 1; fadeUp.height = 64;
  const fctx = fadeUp.getContext('2d'), fg = fctx.createLinearGradient(0, 0, 0, 64);
  fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(255,255,255,1)'); // alphaMap reads green: bright at the base
  fctx.fillStyle = fg; fctx.fillRect(0, 0, 1, 64);
  const beamAlpha = new THREE.CanvasTexture(fadeUp);
  const beamGeo = new THREE.CylinderGeometry(0.1, 0.16, 2.2, 24, 1, true); beamGeo.translate(0, 1.1, 0);
  const beams = [];
  function beam(at, color, k = 1, dur = 0.9) {
    const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, alphaMap: beamAlpha, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(at); m.scale.setScalar(k);
    scene.add(m); beams.push({ m, t: 0, k, dur });
  }

  // ---------- confetti ----------
  const CN = 360;
  const confGeo = new THREE.PlaneGeometry(0.07, 0.11);
  const conf = new THREE.InstancedMesh(confGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }), CN);
  conf.frustumCulled = false; conf.count = 0;
  scene.add(conf);
  const cp = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const CONF = ['#e5484d', '#f5c542', '#3e63dd', '#30a46c', '#d6409f', '#f76b15', '#ffffff'];
  function confetti(at, n = 160, spread = 5) {
    for (let i = 0; i < n && cp.length < CN; i++) {
      cp.push({ p: new THREE.Vector3(at.x + (Math.random() - 0.5) * spread, at.y + Math.random() * 3, at.z + (Math.random() - 0.5) * spread),
        v: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 2, (Math.random() - 0.5) * 1.5), r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), t: 0, c: CONF[Math.floor(Math.random() * CONF.length)] });
    }
  }

  // ---------- bank notes ----------
  const BN = 48;
  const bills = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: billTex, side: THREE.DoubleSide, roughness: 0.8 }), BN);
  bills.frustumCulled = false; bills.count = 0; bills.castShadow = true;
  scene.add(bills);
  const flying = [];
  const NOTE = { 1: '#f3f0e8', 5: '#f6c1d3', 10: '#f7e98d', 20: '#b9e3a5', 50: '#a9cdf2', 100: '#ecd9b0', 500: '#f5b07a' };
  function notes(from, to, amount, delay = 0) {
    const n = Math.max(2, Math.min(12, Math.round(Math.sqrt(amount) / 2.2)));
    const denom = amount >= 500 ? 500 : amount >= 100 ? 100 : amount >= 50 ? 50 : amount >= 20 ? 20 : 10;
    return new Promise(res => {
      let left = n;
      for (let i = 0; i < n; i++) {
        flying.push({ from: from.clone(), to: to.clone(), t: -(delay + i * 0.06), dur: 0.75, spin: (Math.random() - 0.5) * 8, off: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3), c: NOTE[denom], done: () => { if (--left === 0) res(); } });
      }
    });
  }

  // ---------- gold coins: fly in arcs between two points, or spring up in a fountain ----------
  const KN = 72;
  const coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.014, 20), new THREE.MeshStandardMaterial({ color: '#f5c451', metalness: 1, roughness: 0.2, envMap, envMapIntensity: 1.2 }), KN);
  coinMesh.frustumCulled = false; coinMesh.count = 0; coinMesh.castShadow = true;
  scene.add(coinMesh);
  const coinsLive = [];
  function coins(from, to, n, delay = 0) {
    return new Promise(res => {
      let left = n;
      for (let i = 0; i < n; i++) coinsLive.push({ from: from.clone(), to: to.clone(), t: -(delay + i * 0.045), dur: 0.62, off: new THREE.Vector3((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25), spin: 8 + Math.random() * 8, done: () => { if (--left === 0) res(); } });
    });
  }
  function fountain(at, n = 14) {
    for (let i = 0; i < n; i++) coinsLive.push({ p: at.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 1.6, 2.4 + Math.random() * 1.4, (Math.random() - 0.5) * 1.6), floor: at.y, t: 0, dur: 1.3, spin: 8 + Math.random() * 10 });
  }

  function update(dt) {
    let any = false;
    if (live > 0) {
      live -= dt; any = true;
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) { alpha[i] = 0; continue; }
        life[i] -= dt;
        vel[i * 3 + 1] += grav[i] * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        alpha[i] = Math.max(0, life[i] / max[i]);
      }
      geo.attributes.position.needsUpdate = geo.attributes.alpha.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = true;
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt / 0.5; any = true;
      const k = 1 + ease(Math.min(1, r.t)) * 4 * r.k; r.m.scale.set(k, k, 1); r.m.material.opacity = 0.55 * (1 - r.t);
      if (r.t >= 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); }
    }
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i]; b.t += dt / b.dur; any = true;
      b.m.material.opacity = 0.75 * Math.sin(Math.PI * Math.min(1, b.t));
      const w = b.k * (1 - b.t * 0.6); b.m.scale.set(w, b.k * (0.6 + ease(Math.min(1, b.t * 2)) * 0.4), w);
      if (b.t >= 1) { scene.remove(b.m); b.m.material.dispose(); beams.splice(i, 1); }
    }
    if (coinsLive.length) {
      any = true;
      let n = 0;
      for (let i = coinsLive.length - 1; i >= 0; i--) {
        const f = coinsLive[i]; f.t += dt;
        if (f.t < 0) continue;
        const k = Math.min(1, f.t / f.dur);
        if (f.v) { // fountain: up, fall, bounce once on the floor
          f.v.y -= 9 * dt; f.p.addScaledVector(f.v, dt);
          if (f.p.y < f.floor) { f.p.y = f.floor; f.v.y = Math.abs(f.v.y) * 0.35; f.v.x *= 0.5; f.v.z *= 0.5; }
          p.copy(f.p);
        } else { p.lerpVectors(f.from, f.to, ease(k)).add(f.off); p.y += Math.sin(Math.PI * k) * 0.9 + 0.15; }
        const sc = f.v ? Math.min(1, (1 - k) * 4) : 1;
        if (n < KN) { coinMesh.setMatrixAt(n++, m4.compose(p, q.setFromEuler(e.set(f.t * f.spin, f.t * f.spin * 0.6, 0.4)), s.set(sc, sc, sc))); }
        if (k >= 1) { coinsLive.splice(i, 1); if (f.done) { f.done(); sparkle(f.to.clone().setY(f.to.y + 0.2), '#ffd166', 3, 1); } }
      }
      s.set(1, 1, 1);
      coinMesh.count = n;
      coinMesh.instanceMatrix.needsUpdate = true;
    }
    if (cp.length) {
      any = true;
      for (let i = cp.length - 1; i >= 0; i--) {
        const f = cp[i]; f.t += dt;
        f.v.y -= 2.2 * dt; f.v.multiplyScalar(0.985); f.p.addScaledVector(f.v, dt); f.r.addScaledVector(f.w, dt);
        if (f.p.y < 0.01 || f.t > 6) cp.splice(i, 1);
      }
      conf.count = cp.length;
      cp.forEach((f, i) => { conf.setMatrixAt(i, m4.compose(f.p, q.setFromEuler(e.set(f.r.x, f.r.y, f.r.z)), s)); conf.setColorAt(i, c.set(f.c)); });
      conf.instanceMatrix.needsUpdate = true; if (conf.instanceColor) conf.instanceColor.needsUpdate = true;
    }
    if (flying.length) {
      any = true;
      let n = 0;
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i]; f.t += dt;
        if (f.t < 0) continue;
        const k = Math.min(1, f.t / f.dur), e2 = ease(k);
        p.lerpVectors(f.from, f.to, e2).add(f.off); p.y += Math.sin(Math.PI * k) * 1.1 + 0.2;
        if (n < BN) { bills.setMatrixAt(n, m4.compose(p, q.setFromEuler(e.set(-Math.PI / 2 + Math.sin(k * 9) * 0.5, f.spin * k, Math.cos(k * 7) * 0.4)), s)); bills.setColorAt(n, c.set(f.c)); n++; }
        if (k >= 1) { flying.splice(i, 1); f.done(); }
      }
      bills.count = n;
      bills.instanceMatrix.needsUpdate = true; if (bills.instanceColor) bills.instanceColor.needsUpdate = true;
    }
    return any;
  }
  return { sparkle, glow, firework, trail, dust, beam, confetti, notes, coins, fountain, update, setScale: k => { mat.uniforms.scale.value = k; } };
}
