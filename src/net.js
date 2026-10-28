// Game controllers: the same interface for a local table and an online room.
//   state, mine (ids this device plays), act(actor, action, payload) -> Promise<{ ok, error }>, subscribe(fn), now() (the server's clock)
import * as E from './engine.js';
import { nextBotMove, botFallback } from './bots.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function localGame({ state, mine, save }) {
  let s = state, idle = () => Promise.resolve(), botBusy = false, alive = true, speed = 1;
  const subs = new Set(), memos = {}, rigged = [];
  // tests can queue die faces; everything else is Math.random
  const rng = () => (rigged.length ? (rigged.shift() - 1) / 6 + 1e-6 : Math.random());
  function set(ns) { s = ns; subs.forEach(f => f(s)); if (save) save(s); runBots(); }
  function apply(actor, a, p) {
    try { set(E.apply(s, actor, a, p, Date.now(), rng)); return { ok: true }; }
    catch (e) { if (e instanceof E.GameError) return { ok: false, error: e.message }; throw e; }
  }
  const timer = setInterval(() => { const t = E.tick(s, Date.now(), Math.random); if (t) set(t); }, 250);
  // bots wait for the animations, then take one move at a time
  async function runBots() {
    if (botBusy || !alive) return;
    botBusy = true;
    try {
      while (alive && s.phase === 'play') {
        await idle();
        const auc = s.pend && (s.pend.k === 'auc' || s.pend.k === 'bauc');
        await sleep((auc ? 650 + Math.random() * 700 : 420) / speed);
        await idle();
        const mv = nextBotMove(s, memos);
        if (!mv) break;
        const [id, { a, p }] = mv;
        if (!apply(id, a, p).ok) {
          const fb = botFallback(s, id);
          if (!fb || !apply(id, fb.a, fb.p).ok) break;
        }
      }
    } finally { botBusy = false; }
  }
  return {
    mode: 'local', mine,
    get state() { return s; },
    now: () => Date.now(),
    act: (actor, a, p) => Promise.resolve(apply(actor, a, p)),
    subscribe(f) { subs.add(f); f(s); return () => subs.delete(f); },
    setIdle(fn) { idle = fn; runBots(); },
    setSpeed(k) { speed = k; },
    destroy() { alive = false; clearInterval(timer); subs.clear(); },
    // test hooks
    load(ns) { set(ns); },
    rig(...faces) { rigged.push(...faces); },
  };
}

// Identity for online rooms: a public id and a secret key that proves it on reconnect.
export function identity() {
  const get = k => { try { return localStorage.getItem('tycoon:' + k); } catch { return null; } };
  const put = (k, v) => { try { localStorage.setItem('tycoon:' + k, v); } catch { /* private mode: identity lasts this tab */ } };
  let pid = get('pid'), key = get('key');
  // getRandomValues works on plain-http LAN pages, where randomUUID does not
  const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
  if (!pid || !key) { pid = 'p' + hex(6); key = hex(16); put('pid', pid); put('key', key); }
  return { pid, key };
}

export function onlineGame({ code, open, onFatal }) {
  const { pid, key } = identity();
  const subs = new Set(), peerSubs = new Set(), emoteSubs = new Set(), roomSubs = new Set(), waiting = new Map();
  let s = null, ws = null, rid = 0, alive = true, tries = 0, roomCode = code || null, urls = [], isPublic = false, skew = 0;
  let ready, readyFail;
  const first = new Promise((res, rej) => { ready = res; readyFail = rej; });
  function connect() {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => { tries = 0; ws.send(JSON.stringify({ t: 'enter', code: roomCode, pid, key, public: !!open })); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'room') { roomCode = m.code; urls = m.urls || []; isPublic = !!m.public; roomSubs.forEach(f => f()); }
      else if (m.t === 'emote') emoteSubs.forEach(f => f(m.p, m.e));
      else if (m.t === 'state') { if (typeof m.now === 'number') skew = m.now - Date.now(); s = m.s; subs.forEach(f => f(s)); ready(ctl); }
      else if (m.t === 'peers') peerSubs.forEach(f => f(new Set(m.online)));
      else if (m.t === 'ok' || m.t === 'err') { const w = waiting.get(m.rid); if (w) { waiting.delete(m.rid); w(m.t === 'ok' ? { ok: true } : { ok: false, error: m.m }); } }
      else if (m.t === 'fatal') { alive = false; readyFail(new Error(m.m)); if (onFatal) onFatal(m.m); ws.close(); }
    };
    ws.onclose = () => {
      waiting.forEach(w => w({ ok: false, error: 'Connection lost. Reconnecting…' })); waiting.clear();
      if (!alive) return;
      if (!s && tries > 3) { readyFail(new Error('Could not reach the game server')); return; }
      setTimeout(connect, Math.min(5000, 500 * 2 ** tries++));
    };
  }
  const ctl = {
    mode: 'online', mine: new Set([pid]), me: pid,
    get state() { return s; }, get code() { return roomCode; }, now: () => Date.now() + skew, get urls() { return urls; }, get isPublic() { return isPublic; },
    emote(e) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'emote', e })); },
    onEmote(f) { emoteSubs.add(f); return () => emoteSubs.delete(f); },
    onRoom(f) { roomSubs.add(f); return () => roomSubs.delete(f); },
    setPublic(on) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'public', on })); },
    act(actor, a, p) {
      if (!ws || ws.readyState !== 1) return Promise.resolve({ ok: false, error: 'Not connected. Reconnecting…' });
      const id = ++rid;
      ws.send(JSON.stringify({ t: 'act', rid: id, a, p: p || {} }));
      return new Promise(res => { waiting.set(id, res); setTimeout(() => { if (waiting.delete(id)) res({ ok: false, error: 'The server did not answer' }); }, 8000); });
    },
    subscribe(f) { subs.add(f); if (s) f(s); return () => subs.delete(f); },
    onPeers(f) { peerSubs.add(f); return () => peerSubs.delete(f); },
    setIdle() {}, setSpeed() {},
    destroy() { alive = false; if (ws) ws.close(); subs.clear(); },
  };
  connect();
  return first;
}
