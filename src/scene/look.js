// The finish on every frame: a sky-lit environment for reflections, ambient occlusion, bloom on
// lights and highlights, and a colour grade with vignette. Low quality renders straight to screen.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GRADE = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.1 }, vig: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, vig; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, sat);
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.22);
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vig * dot(d, d) * 1.5;
      c.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; // dither the sky
      gl_FragColor = c;
    }`,
};

// the sky as a light source: gradient dome, ground below the horizon, and a hot sun
function skyDome(T, sunDir) {
  const c = v => new THREE.Color(v), white = new THREE.Color('#ffffff');
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    // a paler zenith and a stone-coloured ground keep gold and chrome from turning blue or olive
    uniforms: { top: { value: c(T.sky[0]).lerp(white, 0.45) }, mid: { value: c(T.sky[1]).lerp(white, 0.3) }, hor: { value: c(T.sky[2]) }, gnd: { value: c(T.ground.plaza).lerp(c(T.sky[2]), 0.4).multiplyScalar(0.8) }, sun: { value: c(T.sun[0]) }, dir: { value: sunDir.clone().normalize() }, k: { value: T.sun[1] } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, hor, gnd, sun, dir; uniform float k; varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 col = y > 0.0 ? mix(hor, mix(mid, top, smoothstep(0.25, 0.9, y)), smoothstep(0.0, 0.25, y)) : mix(hor, gnd, smoothstep(0.0, 0.12, -y));
        float s = max(dot(vDir, dir), 0.0);
        col += sun * (pow(s, 900.0) * 30.0 + pow(s, 12.0) * 0.35) * k;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), mat);
}

export function makeLook(renderer, scene, camera) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, composer = null, bloom = null, level = 'high', night = false;
  let w = 1, h = 1, dpr = 1;

  function setTheme(T, sunDir) {
    const dome = skyDome(T, sunDir), env = new THREE.Scene();
    env.add(dome);
    const old = envRT;
    envRT = pmrem.fromScene(env, 0.015);
    scene.environment = envRT.texture;
    dome.geometry.dispose(); dome.material.dispose();
    if (old) old.dispose();
    night = !!T.glow;
    if (bloom) glowFor(bloom);
  }

  // by day only hot highlights bloom; at night the neon and lit windows do
  const glowFor = b => { b.strength = night ? 0.75 : 0.35; b.threshold = night ? 0.9 : 1.8; };
  function build() {
    if (composer) { composer.passes.forEach(p => p.dispose()); composer.dispose(); composer = bloom = null; }
    if (level === 'low') return;
    // a dense screen hides jaggies well enough to skip MSAA
    const rt = new THREE.WebGLRenderTarget(w * dpr, h * dpr, { type: THREE.HalfFloatType, samples: dpr >= 2 ? 0 : 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    if (level === 'high') {
      const gtao = new GTAOPass(scene, camera, w, h);
      gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12 });
      gtao.updatePdMaterial({ radius: 6, rings: 2, samples: 12 });
      // AO at half resolution once the screen is dense; the denoise hides the difference
      gtao.setSize = (sw, sh) => GTAOPass.prototype.setSize.call(gtao, dpr > 1.25 ? sw / 2 : sw, dpr > 1.25 ? sh / 2 : sh);
      composer.addPass(gtao);
    }
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.55, 1.8);
    glowFor(bloom);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(GRADE));
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
  }

  return {
    setTheme,
    setLevel(l) { if (l !== level || !composer) { level = l; build(); } },
    setSize(nw, nh, ndpr) {
      const msaa = (dpr >= 2) !== (ndpr >= 2);
      w = nw; h = nh; dpr = ndpr;
      if (msaa) build(); else if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
    },
    render() { if (composer) composer.render(); else renderer.render(scene, camera); },
    get post() { return !!composer; },
  };
}
