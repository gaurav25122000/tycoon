// Synthesised sound effects (no audio files).
let ctx = null;
const pref = (k, d) => { try { const v = localStorage.getItem('tycoon:' + k); return v === null ? d : v === '1'; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem('tycoon:' + k, v ? '1' : '0'); } catch { /* storage blocked */ } };
let on = pref('sound', true), musicOn = pref('music', true);

export const sound = {
  get on() { return on; },
  set on(v) { on = v; save('sound', v); },
  get music() { return musicOn; },
  set music(v) { musicOn = v; save('music', v); if (v) music.start(); else music.stop(); },
};
export function unlockAudio() { audio(true); if (musicOn) music.start(); }

function audio(force) {
  if (!on && !force) return null;
  if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Gentle generated background music: a jazzy four-chord loop with a soft pentatonic melody.
const CHORDS = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [293.7, 349.2, 440, 523.3], [196, 246.9, 293.7, 349.2]];
const MELODY = [523.3, 587.3, 659.3, 784, 880, 1046.5];
export const music = {
  timer: null, bus: null, beat: 0, next: 0,
  start() {
    const c = audio(true);
    if (!c || this.timer) return;
    this.bus = c.createGain(); this.bus.gain.value = 0.0001; this.bus.connect(c.destination);
    this.bus.gain.linearRampToValueAtTime(0.05, c.currentTime + 2);
    this.next = c.currentTime + 0.1; this.beat = 0;
    this.timer = setInterval(() => this.schedule(), 100);
  },
  stop() {
    if (!this.timer) return;
    clearInterval(this.timer); this.timer = null;
    const b = this.bus; b.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6); setTimeout(() => b.disconnect(), 800);
  },
  schedule() {
    const c = ctx, spb = 60 / 84;
    while (this.next < c.currentTime + 0.4) {
      const t = this.next, bar = Math.floor(this.beat / 4) % 4;
      if (this.beat % 4 === 0) CHORDS[bar].forEach(f => this.voice(f / 2, t, spb * 4, 'triangle', 0.22, 900));
      if (this.beat % 2 === 1 || Math.random() < 0.3) this.voice(MELODY[Math.floor(Math.random() * MELODY.length)], t, spb * 0.9, 'sine', Math.random() < 0.5 ? 0.12 : 0, 2400);
      this.voice(CHORDS[bar][0] / 4, t, spb * 0.8, 'sine', 0.3, 300);
      this.beat++; this.next += spb;
    }
  },
  voice(f, t, d, type, vol, cut) {
    if (!vol) return;
    const c = ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = cut;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(lp).connect(g).connect(this.bus); o.start(t); o.stop(t + d + 0.05);
  },
};
function tone(f, d, type, vol, when = 0, slide) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .05, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .05);
}
function noise(d, vol, when = 0, freq = 2400, q = 1) {
  const c = audio(); if (!c) return;
  const t = c.currentTime + when, n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; s.buffer = buf; g.gain.value = vol;
  s.connect(f).connect(g).connect(c.destination); s.start(t);
}

export const sfx = {
  // one die hitting the table; strength 0..1 from the physics impact
  clack(strength) { noise(.03, .08 + .5 * strength, 0, 1800 + Math.random() * 1600, 2); },
  shake() { for (let i = 0; i < 6; i++) noise(.03, .12, i * .05 + Math.random() * .02, 3000, 3); },
  step() { noise(.025, .12, 0, 900, 4); tone(220, .05, 'sine', .02); },
  coin() { tone(1320, .08, 'sine', .04); tone(1760, .16, 'sine', .04, .07); },
  cash() { for (let i = 0; i < 4; i++) noise(.06, .07, i * .05, 5200, .8); },
  buy() { tone(523, .1, 'triangle', .05); tone(784, .2, 'triangle', .05, .09); },
  stamp() { noise(.08, .5, 0, 300, 1); tone(110, .12, 'sine', .08); },
  build() { noise(.04, .35, 0, 700, 3); tone(330, .06, 'square', .015, .02); },
  hotel() { [523, 659, 784].forEach((f, i) => tone(f, .14, 'triangle', .04, i * .06)); noise(.05, .35, 0, 600, 3); },
  jail() { noise(.12, .5, 0, 220, 2); tone(98, .4, 'sawtooth', .03, .02); tone(73, .5, 'sawtooth', .03, .18); },
  turn() { tone(784, .12, 'sine', .045); tone(1175, .22, 'sine', .045, .1); },
  card() { noise(.16, .15, 0, 4200, .6); },
  bid() { noise(.04, .4, 0, 500, 2); },
  gavel() { noise(.06, .9, 0, 260, 1.5); tone(140, .15, 'sine', .08); noise(.06, .6, .16, 260, 1.5); },
  bad() { tone(220, .22, 'triangle', .05, 0, 150); },
  crumble() { for (let i = 0; i < 10; i++) noise(.05, .2, i * .045 + Math.random() * .03, 400 + Math.random() * 600, 1); },
  whoosh() { noise(.35, .12, 0, 1200, .4); },
  pop() { noise(.05, .3, 0, 1600, 1); tone(600 + Math.random() * 600, .2, 'sine', .02); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .32, 'triangle', .05, i * .11)); },
};
export const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* no haptics */ } };
