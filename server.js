// Tycoon server: serves the built game and runs online rooms over WebSockets.
// Rooms live in memory and are saved to data/rooms.json so a restart keeps games going.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WebSocketServer } from 'ws';
import * as E from './src/engine.js';
import { nextBotMove, botFallback, paceMs } from './src/bots.js';

const PORT = +process.env.PORT || 8080;
const DIST = path.resolve('dist'), DATA = path.resolve(process.env.TYCOON_DATA || 'data'), SAVE = path.join(DATA, 'rooms.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const ROOM_TTL = 3 * 24 * 3600 * 1000;
const BOT_PACE = +(process.env.TYCOON_BOT_PACE || 1); // tests speed bots up
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const EMOTES = ['😀', '😂', '😎', '🤑', '😡', '😭', '👍', '🔥'];

// ---------- static files ----------
const server = http.createServer((req, res) => {
  if (req.url === '/api/rooms') {
    // open games anyone on this server can join
    const open = [...rooms.values()].filter(r => r.public && r.s.phase === 'lobby' && r.s.players.length < E.MAX_PLAYERS && r.clients.size)
      .map(r => ({ code: r.code, host: (E.player(r.s, r.s.host) || {}).name || 'Someone', players: r.s.players.length, quick: !!r.s.settings.quickEnd, theme: r.s.settings.theme }));
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(open));
    return;
  }
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  let file = path.join(DIST, path.normalize(rel));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(500, { 'content-type': 'text/plain' }).end('Run `npm run build` first.'); return; }
  const ext = path.extname(file);
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' });
  fs.createReadStream(file).pipe(res);
});

// ---------- rooms ----------
const rooms = new Map(); // code -> { code, s, keys: { pid: key }, clients: Set<ws>, memos, botT, fxMark, at }
function loadRooms() {
  try {
    const saved = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
    for (const r of saved) {
      if (Date.now() - r.at >= ROOM_TTL) continue;
      r.s = E.upgrade(r.s);
      rooms.set(r.code, { ...r, clients: new Set(), memos: {}, botT: null, fxMark: r.s.fxN, emoteAt: {} });
    }
  } catch { /* first run */ }
}
let saveT = null;
function saveRooms() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    fs.mkdirSync(DATA, { recursive: true });
    const out = [...rooms.values()].map(r => ({ code: r.code, s: r.s, keys: r.keys, at: r.at, public: r.public }));
    fs.writeFile(SAVE + '.tmp', JSON.stringify(out), e => { if (!e) fs.rename(SAVE + '.tmp', SAVE, () => {}); else console.error('save failed', e); });
  }, 1500);
}
function newCode() {
  for (;;) { const c = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); if (!rooms.has(c)) return c; }
}
const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
function broadcast(r, m) { const data = JSON.stringify(m); r.clients.forEach(ws => { if (ws.readyState === 1) ws.send(data); }); }
function peers(r) { broadcast(r, { t: 'peers', online: [...new Set([...r.clients].map(ws => ws.pid))] }); }
function commit(r, s) {
  r.s = s; r.at = Date.now();
  broadcast(r, { t: 'state', s, now: Date.now() });
  saveRooms();
  scheduleBots(r);
}
// bots move one at a time, paced by how long the last move takes to animate
function scheduleBots(r) {
  if (r.botT || r.s.phase !== 'play' || !r.clients.size) return;
  const fresh = r.s.fx.filter(f => f.i > r.fxMark);
  r.fxMark = r.s.fxN;
  const auc = r.s.pend && (r.s.pend.k === 'auc' || r.s.pend.k === 'bauc');
  r.botT = setTimeout(() => {
    r.botT = null;
    if (!r.clients.size) return;
    const mv = nextBotMove(r.s, r.memos);
    if (!mv) return;
    const [id, { a, p }] = mv;
    try { commit(r, E.apply(r.s, id, a, p, Date.now(), Math.random)); }
    catch (e) {
      if (!(e instanceof E.GameError)) { console.error(e); return; }
      const fb = botFallback(r.s, id);
      if (fb) try { commit(r, E.apply(r.s, id, fb.a, fb.p, Date.now(), Math.random)); } catch (e2) { console.error('bot stuck', id, e2.message); }
    }
  }, ((auc ? 700 + Math.random() * 700 : 0) + paceMs(fresh) + 350) * BOT_PACE);
}
setInterval(() => {
  for (const r of rooms.values()) {
    if (r.s.phase !== 'play') continue;
    const t = E.tick(r.s, Date.now(), Math.random);
    if (t) commit(r, t);
  }
}, 250);

// ---------- sockets ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
wss.on('connection', ws => {
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object' || Array.isArray(m)) return;
    if (m.t === 'enter') {
      if (!str(m.pid, 40) || !str(m.key, 64)) { send(ws, { t: 'fatal', m: 'Bad identity' }); return; }
      let r;
      if (m.code === null || m.code === undefined) {
        const code = newCode();
        r = { code, s: E.newGame(m.pid, Date.now()), keys: {}, clients: new Set(), memos: {}, botT: null, fxMark: 0, at: Date.now(), public: m.public === true, emoteAt: {} };
        rooms.set(code, r);
      } else {
        r = str(m.code, 8) && rooms.get(m.code.toUpperCase());
        if (!r) { send(ws, { t: 'fatal', m: 'No game with that code. Check it and try again.' }); return; }
      }
      if (r.keys[m.pid] && r.keys[m.pid] !== m.key) { send(ws, { t: 'fatal', m: 'That seat belongs to someone else.' }); return; }
      r.keys[m.pid] = m.key;
      if (ws.room && ws.room !== r) ws.room.clients.delete(ws);
      ws.room = r; ws.pid = m.pid;
      r.clients.add(ws);
      send(ws, { t: 'room', code: r.code, urls: lanUrls(r.code), public: !!r.public });
      send(ws, { t: 'state', s: r.s, now: Date.now() });
      peers(r);
      saveRooms();
      scheduleBots(r);
      return;
    }
    if (m.t === 'emote') {
      const r = ws.room, now = Date.now();
      if (!r || !EMOTES.includes(m.e) || now - (r.emoteAt[ws.pid] || 0) < 700) return;
      r.emoteAt[ws.pid] = now;
      broadcast(r, { t: 'emote', p: ws.pid, e: m.e });
      return;
    }
    if (m.t === 'public') {
      const r = ws.room;
      if (r && r.s.host === ws.pid) { r.public = m.on === true; broadcast(r, { t: 'room', code: r.code, urls: lanUrls(r.code), public: r.public }); saveRooms(); }
      return;
    }
    if (m.t === 'act') {
      const r = ws.room;
      if (!r || !Number.isInteger(m.rid)) return;
      const p = m.p && typeof m.p === 'object' && !Array.isArray(m.p) ? m.p : {};
      if (!str(m.a, 24)) { send(ws, { t: 'err', rid: m.rid, m: 'Unknown action' }); return; }
      try {
        commit(r, E.apply(r.s, ws.pid, m.a, p, Date.now(), Math.random));
        send(ws, { t: 'ok', rid: m.rid });
      } catch (e) {
        if (!(e instanceof E.GameError)) console.error(e);
        send(ws, { t: 'err', rid: m.rid, m: e instanceof E.GameError ? e.message : 'That move could not be completed' });
      }
    }
  });
  ws.on('close', () => { if (ws.room) { ws.room.clients.delete(ws); peers(ws.room); } });
});

function lanUrls(code) {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${PORT}/#${code}`);
  return out;
}

loadRooms();
server.listen(PORT, () => {
  console.log(`Tycoon is running.\n  On this Mac:  http://localhost:${PORT}`);
  for (const u of lanUrls('').map(u => u.replace('/#', ''))) console.log(`  On your Wi-Fi: ${u}`);
  console.log('  Friends elsewhere: npx cloudflared tunnel --url localhost:' + PORT);
});
