import './style.css';
import * as E from './engine.js';
import { createScene } from './scene/index.js';
import { makeHUD } from './ui/hud.js';
import { makeMenu } from './ui/menu.js';
import { makeMascot } from './ui/mascot.js';
import { makePresenter } from './present.js';
import { localGame, onlineGame } from './net.js';
import { makeStats } from './stats.js';
import { sound } from './sound.js';
import { ART3D, IC, EMOTES } from './art.js';
import { makePortraits } from './scene/portraits.js';

// keeps the game on this device so it plays with no network (browsers allow this on https and localhost only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('offline play unavailable', e));
const app = document.getElementById('app');
const PREFS = 'tycoon:prefs', SAVE = 'tycoon:save';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const prefs = { quality: 'auto', speed: 'normal', view: 'follow', cinematic: true, ambient: true, theme: 'city', ...read(PREFS, {}) };
const savePrefs = () => write(PREFS, prefs);
const speedOf = v => (v === 'fast' ? 1.8 : 1);

let game = null, lastSetup = null;
const scene = await createScene({
  canvas: document.getElementById('gl'),
  onSquare: p => game && game.hud.onSquare(p),
  onDice: () => game && game.hud.roll(),
  theme: prefs.theme,
  quality: prefs.quality,
  speed: speedOf(prefs.speed),
});
scene.setCinematic(prefs.cinematic);
scene.setTabletop(prefs.view === 'table');
scene.setAmbient(prefs.ambient);
try { Object.assign(ART3D, await makePortraits()); } catch (e) { console.error('3D portraits failed, using flat icons', e); }
// draw the icons, emotes, pieces, landmarks and mascot poses while the menu is up, ahead of the game needing them
if (ART3D.mascot) {
  const idle = f => (window.requestIdleCallback ? requestIdleCallback(f) : setTimeout(f, 50));
  const todo = [...Object.keys(IC).map(k => () => ART3D.icon(k)), ...EMOTES.map(e => () => ART3D.emote(e)), () => ART3D.piece('house'), () => ART3D.piece('hotel'),
    ...E.OWNABLE.map(pos => () => ART3D.landmark(pos)), ...['happy', 'shock', 'sad'].flatMap(m => ['none', 'card', 'chat', 'coin', 'gavel', 'trophy'].map(p => () => ART3D.mascot(m, p)))];
  const next = () => { const f = todo.shift(); if (f) { f(); idle(next); } };
  idle(next);
}
document.getElementById('boot').remove();

const mascot = makeMascot(document.getElementById('mascot'));
const settings = {
  get cinematic() { return prefs.cinematic; }, get ambient() { return prefs.ambient; }, get speed() { return prefs.speed; }, get quality() { return prefs.quality; }, get view() { return prefs.view; },
  set(k, v) {
    if (k === 'sound') { sound.on = v; return; }
    if (k === 'music') { sound.music = v; return; }
    prefs[k] = v; savePrefs();
    if (k === 'cinematic') scene.setCinematic(v);
    if (k === 'view') scene.setTabletop(v === 'table');
    if (k === 'ambient') scene.setAmbient(v);
    if (k === 'speed') { scene.setSpeed(speedOf(v)); if (game) game.ctl.setSpeed(speedOf(v)); }
    if (k === 'quality') scene.setQuality(v);
  },
};

const empty = { players: [], props: {}, phase: 'lobby', dice: [3, 4] };
function endView() {
  if (!game) return;
  game.unsub(); game.hud.destroy(); game.root.remove();
  game = null;
  mascot.hide();
  scene.stopCelebrate();
  scene.sync(empty, { pos: {}, jail: {}, cash: {} }, () => '#000');
  scene.attract(true);
}
function startGame(ctl) {
  if (game) return;
  const root = document.createElement('div');
  root.className = 'hud';
  app.appendChild(root);
  const hud = makeHUD({ root, scene, ctl, mascot, settings, onLeave: leave, onAgain: again });
  const presenter = makePresenter({ scene, hud, mascot, ctl, stats: makeStats(ctl, a => hud.achievement(a)) });
  ctl.setIdle(presenter.idle);
  ctl.setSpeed(speedOf(prefs.speed));
  game = { ctl, hud, presenter, root, unsub: () => {} };
  menu.hide();
  scene.attract(false);
  game.unsub = ctl.subscribe(s => { if (s.phase !== 'lobby') presenter.push(s); });
  const s = ctl.state;
  if (s && s.phase === 'play' && s.turnN <= 1 && !s.ts.rolled) mascot.say('Welcome to Tycoon! Roll to start.', 'happy', 'coin', 3200);
}
function leave() {
  const ctl = game && game.ctl;
  endView();
  if (ctl) ctl.destroy();
  history.replaceState(null, '', location.pathname);
  menu.show('title');
}
function again() {
  const ctl = game.ctl;
  if (ctl.mode === 'online') { ctl.act(ctl.me, 'reset', {}); return; }
  endView(); ctl.destroy();
  if (lastSetup) startLocal(lastSetup); else menu.show('title');
}

// ---------- local games ----------
let saveT = null;
const saveLocal = mine => s => {
  clearTimeout(saveT);
  saveT = setTimeout(() => write(SAVE, s.phase === 'over' ? null : { s, mine: [...mine] }), 600);
};
function startLocal(setup) {
  lastSetup = setup;
  const players = setup.seats.map((seat, i) => ({ id: 'p' + (i + 1), name: seat.name.trim() || 'Player ' + (i + 1), tok: seat.tok, bot: seat.bot || null, dice: seat.dice || 0 }));
  const mine = new Set(players.filter(p => !p.bot).map(p => p.id));
  const s = E.setupLocal(players, setup.settings, Date.now(), Math.random);
  startGame(localGame({ state: s, mine, save: saveLocal(mine) }));
}
function continueLocal() {
  const saved = read(SAVE, null);
  if (!saved) { menu.show('title'); return; }
  const mine = new Set(saved.mine);
  const s = E.upgrade(saved.s);
  startGame(localGame({ state: s, mine, save: saveLocal(mine) }));
}

// ---------- online rooms ----------
async function joinOnline(code, open) {
  try {
    const ctl = await onlineGame({ code, open, onFatal: m => { if (game) leave(); menu.error(m); } });
    history.replaceState(null, '', '#' + ctl.code);
    ctl.subscribe(s => {
      if (s.phase === 'lobby') { if (game) endView(); menu.lobby(ctl, s); }
      else if (!game) startGame(ctl);
    });
  } catch (e) { menu.error(e.message); }
}

const menu = makeMenu({
  root: document.getElementById('menu'), prefs, savePrefs,
  onLocal: startLocal, onOnline: joinOnline, onContinue: continueLocal,
  hasSave: () => !!read(SAVE, null),
  onTheme: t => { scene.setTheme(t); prefs.theme = t; savePrefs(); },
});
scene.attract(true);
// a room link (or a reload mid-game) goes straight back to that room
if (/^#[A-Z]{4}$/.test(location.hash) && prefs.name) { menu.show('online'); joinOnline(location.hash.slice(1)); }
else if (/^#[A-Z]{4}$/.test(location.hash)) menu.show('online');
else menu.show('title');
window.__tycoon = { scene, get game() { return game; }, E, startLocal, joinOnline, menu, mascot }; // for the e2e script and the console
