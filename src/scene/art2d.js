// Canvas artwork for the 3D table: the printed board, deeds, cards, dice faces, bills, wood.
import { BOARD, GROUPS, CARDS, SPEED, money } from '../engine.js';
import { IC, TOK, inkOn } from '../art.js';
import { U, CU, rects, side, ANG, DECK_AT, CARD, W } from './layout.js';

export const FONT = { name: "'Archivo Narrow', 'Arial Narrow', sans-serif", disp: "Limelight, Didot, Georgia, serif", ui: "Manrope, system-ui, sans-serif" };
export const DECK = { F: { n: 'Plot Twist', c: '#e0457b', d: '#8f1747' }, T: { n: 'Group Chat', c: '#17a39d', d: '#0a5c5e' } };
// board print colours; drawBoard sets them from the theme
let PAPER = '#d4e6d1', INK = '#1a1a17', LOGO = '#b3202c';

export const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function icon(ctx, d, size, x, y, color) {
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color; ctx.fill(new Path2D(d), 'evenodd'); ctx.restore();
}
export function wrap(ctx, text, max) {
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function grain(ctx, w, h, alpha) {
  const n = canvas(128), c = n.getContext('2d'), img = c.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) { const v = 90 + Math.random() * 120; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  c.putImageData(img, 0, 0);
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(n, 'repeat'); ctx.fillRect(0, 0, w, h); ctx.restore();
}
const short = n => n.replace(' Station', '');

// ---------- the printed board ----------
function drawEdge(ctx, sq, p, k) {
  const w = k, h = CU * k, top = -h / 2, bot = h / 2, lw = k * 0.012;
  ctx.lineWidth = lw; ctx.strokeStyle = INK;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = INK;
  let y = top + h * 0.07;
  if (sq.t === 'prop') {
    ctx.fillStyle = GROUPS[sq.g].c; ctx.fillRect(-w / 2, top, w, h * 0.22);
    ctx.beginPath(); ctx.moveTo(-w / 2, top + h * 0.22); ctx.lineTo(w / 2, top + h * 0.22); ctx.stroke();
    y = top + h * 0.27;
  }
  const label = (sq.t === 'fortune' || sq.t === 'treasury' ? sq.n : short(sq.n)).toUpperCase();
  // as big as the square allows, so names read on a phone: the longest word fits the width, at most two lines
  let fs = w * 0.22;
  ctx.font = `700 ${fs}px ${FONT.name}`;
  fs = Math.min(fs, fs * w * 0.88 / Math.max(...label.split(' ').map(t => ctx.measureText(t).width)));
  ctx.font = `700 ${fs}px ${FONT.name}`;
  let lines = wrap(ctx, label, w * 0.88);
  if (lines.length > 2) { fs *= 0.8; ctx.font = `700 ${fs}px ${FONT.name}`; lines = wrap(ctx, label, w * 0.88); }
  ctx.fillStyle = INK;
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 0, y + i * fs * 1.04));
  const mid = top + h * 0.64;
  if (sq.t === 'station') icon(ctx, IC.train, w * 0.5, 0, mid, INK);
  if (sq.t === 'util') icon(ctx, p === 12 ? IC.wifi : IC.drop, w * 0.46, 0, mid, p === 12 ? '#2f5d9e' : '#2a8fc9');
  if (sq.t === 'tax') icon(ctx, sq.amt === 200 ? IC.receipt : IC.gem, w * 0.42, 0, mid - h * 0.02, sq.amt === 200 ? INK : '#7a3db8');
  if (sq.t === 'treasury') icon(ctx, IC.chat, w * 0.56, 0, mid, DECK.T.c);
  if (sq.t === 'fortune') { ctx.fillStyle = DECK.F.c; ctx.font = `400 ${w * 0.78}px ${FONT.disp}`; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, mid + h * 0.02); }
  const price = sq.price ? money(sq.price) : sq.t === 'tax' ? 'PAY ' + money(sq.amt) : '';
  if (price) { ctx.fillStyle = INK; ctx.font = `600 ${w * 0.15}px ${FONT.name}`; ctx.textBaseline = 'bottom'; ctx.fillText(price, 0, bot - h * 0.05); }
  ctx.strokeRect(-w / 2, top, w, h);
}

function cornerText(ctx, k, x, y, lines, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 4); ctx.fillStyle = color || INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach(([t, f, dy]) => { ctx.font = f; ctx.fillText(t, 0, dy * k); });
  ctx.restore();
}
function drawCorner(ctx, sq, r, k) {
  const x = r.x * k, y = r.y * k, c = CU * k, cx = x + c / 2, cy = y + c / 2;
  ctx.lineWidth = k * 0.012; ctx.strokeStyle = INK;
  if (sq.t === 'go') {
    cornerText(ctx, k, cx - c * 0.12, cy - c * 0.12, [['COLLECT $200', `700 ${k * 0.15}px ${FONT.name}`, -0.32], ['SALARY AS YOU PASS', `700 ${k * 0.12}px ${FONT.name}`, -0.17]]);
    cornerText(ctx, k, cx + c * 0.04, cy + c * 0.04, [['START', `400 ${k * 0.5}px ${FONT.disp}`, 0.05]], '#c8202f');
    icon(ctx, IC.arrow, c * 0.5, cx, y + c * 0.83, '#c8202f');
  } else if (sq.t === 'jail') {
    const s = c * 0.66, jx = x + c - s, jy = y;
    ctx.fillStyle = '#f08a24'; ctx.fillRect(jx, jy, s, s);
    ctx.lineWidth = k * 0.03; ctx.strokeStyle = INK;
    for (let i = 1; i < 5; i++) { const bx = jx + s * 0.18 + i * s * 0.64 / 5; ctx.beginPath(); ctx.moveTo(bx, jy + s * 0.18); ctx.lineTo(bx, jy + s * 0.82); ctx.stroke(); }
    ctx.lineWidth = k * 0.02; ctx.strokeRect(jx + s * 0.18, jy + s * 0.18, s * 0.64, s * 0.64);
    ctx.lineWidth = k * 0.012; ctx.strokeRect(jx, jy, s, s);
    ctx.save(); ctx.translate(jx + s / 2, jy + s / 2); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = PAPER; ctx.fillRect(-s * 0.42, -s * 0.11, s * 0.84, s * 0.22);
    ctx.fillStyle = INK; ctx.font = `700 ${k * 0.17}px ${FONT.name}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('IN JAIL', 0, 2); ctx.restore();
    ctx.fillStyle = INK; ctx.font = `700 ${k * 0.15}px ${FONT.name}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VISITING', x + c * 0.6, y + c * 0.84);
    ctx.save(); ctx.translate(x + c * 0.16, y + c * 0.4); ctx.rotate(Math.PI / 2); ctx.fillText('JUST', 0, 0); ctx.restore();
  } else if (sq.t === 'parking') {
    icon(ctx, IC.cup, c * 0.36, cx + c * 0.02, cy + c * 0.02, '#c8202f');
    cornerText(ctx, k, cx, cy, [['CHILL', `700 ${k * 0.2}px ${FONT.name}`, -0.42], ['ZONE', `700 ${k * 0.2}px ${FONT.name}`, 0.44]]);
  } else {
    icon(ctx, IC.badge, c * 0.4, cx, cy, '#2f5d9e');
    cornerText(ctx, k, cx, cy, [['GO TO', `700 ${k * 0.2}px ${FONT.name}`, -0.42], ['JAIL', `700 ${k * 0.2}px ${FONT.name}`, 0.44]]);
  }
  ctx.lineWidth = k * 0.012; ctx.strokeStyle = INK; ctx.strokeRect(x, y, c, c);
}

function drawCentre(ctx, S, k) {
  const a = CU * k, b = S - CU * k, mid = S / 2;
  ctx.lineWidth = k * 0.012; ctx.strokeStyle = INK; ctx.strokeRect(a, a, b - a, b - a);
  // logo ribbon on the diagonal
  ctx.save(); ctx.translate(mid, mid); ctx.rotate(-Math.PI / 4);
  const rw = k * 6.2, rh = k * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-rw / 2 + k * 0.05, -rh / 2 + k * 0.07, rw, rh);
  ctx.fillStyle = LOGO; ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
  ctx.strokeStyle = '#f5f0e6'; ctx.lineWidth = k * 0.05; ctx.strokeRect(-rw / 2 + k * 0.12, -rh / 2 + k * 0.12, rw - k * 0.24, rh - k * 0.24);
  ctx.fillStyle = '#f5f0e6'; ctx.font = `400 ${k * 1.05}px ${FONT.disp}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('TYCOON', 0, k * 0.06);
  ctx.fillStyle = INK; ctx.font = `700 ${k * 0.22}px ${FONT.name}`;
  ctx.fillText('BUY IT  ·  FLEX IT  ·  BANKRUPT YOUR FRIENDS', 0, rh / 2 + k * 0.32);
  ctx.restore();
  // deck spots
  for (const dk of ['F', 'T']) {
    const at = DECK_AT[dk], px = (at.x / W + 0.5) * S, pz = (at.z / W + 0.5) * S, w = (CARD.w + 0.16) / W * S, d = (CARD.d + 0.16) / W * S;
    ctx.save(); ctx.translate(px, pz); ctx.rotate(at.r);
    ctx.setLineDash([k * 0.1, k * 0.07]); ctx.strokeStyle = DECK[dk].c; ctx.lineWidth = k * 0.03; ctx.strokeRect(-w / 2, -d / 2, w, d); ctx.setLineDash([]);
    ctx.fillStyle = DECK[dk].c; ctx.font = `700 ${k * 0.2}px ${FONT.name}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(DECK[dk].n.toUpperCase(), 0, d / 2 + k * 0.08);
    ctx.restore();
  }
}

export function drawBoard(S, pal) {
  if (pal) ({ paper: PAPER, ink: INK, logo: LOGO } = pal);
  const cv = canvas(S), ctx = cv.getContext('2d'), k = S / U;
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, S, S);
  drawCentre(ctx, S, k);
  BOARD.forEach((sq, p) => {
    const r = rects[p];
    if (p % 10 === 0) { drawCorner(ctx, sq, r, k); return; }
    ctx.save(); ctx.translate(r.cx * k, r.cy * k); ctx.rotate(ANG[side(p)]); drawEdge(ctx, sq, p, k); ctx.restore();
  });
  ctx.lineWidth = k * 0.035; ctx.strokeStyle = INK; ctx.strokeRect(k * 0.018, k * 0.018, S - k * 0.036, S - k * 0.036);
  grain(ctx, S, S, 0.09);
  // the fold across the middle of a real board
  const g = ctx.createLinearGradient(0, S / 2 - k * 0.06, 0, S / 2 + k * 0.06);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.48, 'rgba(0,0,0,.09)'); g.addColorStop(0.52, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, S / 2 - k * 0.06, S, k * 0.12);
  return cv;
}

// ---------- deeds, cards, dice, money ----------
// ---------- deeds and cards: printed sheets with gold foil ----------
// Each sheet comes with a surface map (cv.surface): green = roughness, blue = metal.
const FOIL_SURF = 'rgb(0,80,200)';
function sheet(w, h, rough) {
  const cv = canvas(w, h), sf = canvas(w, h), s = sf.getContext('2d');
  s.fillStyle = `rgb(0,${rough},0)`; s.fillRect(0, 0, w, h);
  cv.surface = sf;
  return [cv, cv.getContext('2d'), s];
}
function foilPaint(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  [[0, '#f8e7a8'], [0.3, '#d6aa48'], [0.48, '#fff1c2'], [0.62, '#b8892c'], [1, '#ecca72']].forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
// draw the same shapes in gold on the print and as foil on the surface map
function foil(ctx, s, draw) {
  ctx.save(); ctx.fillStyle = ctx.strokeStyle = foilPaint(ctx, ctx.canvas.width, ctx.canvas.height); draw(ctx); ctx.restore();
  s.save(); s.fillStyle = s.strokeStyle = FOIL_SURF; draw(s); s.restore();
}
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const diamond = (c, x, y, r) => { c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); };
function paper(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, h * 0.75);
  g.addColorStop(0, '#fffdf6'); g.addColorStop(1, '#ede2c6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
function frames(ctx, s, w, h, r) {
  foil(ctx, s, c => { c.lineWidth = 8; rr(c, 22, 22, w - 44, h - 44, r); c.stroke(); c.lineWidth = 3; rr(c, 42, 42, w - 84, h - 84, r - 12); c.stroke(); });
}
function caps(c, text, x, y, size, spacing) { c.font = `800 ${size}px ${FONT.ui}`; c.letterSpacing = spacing + 'px'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y); c.letterSpacing = '0px'; }
function rows(ctx, list, x0, x1, y, step, size) {
  ctx.font = `600 ${size}px ${FONT.ui}`; ctx.textBaseline = 'middle';
  list.forEach(([l, v], i) => {
    const yy = y + i * step;
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.fillText(l, x0, yy); ctx.textAlign = 'right'; ctx.fillText(v, x1, yy);
    const a = x0 + ctx.measureText(l).width + 14, b = x1 - ctx.measureText(v).width - 14;
    ctx.fillStyle = 'rgba(40,34,24,.35)'; for (let x = a; x < b; x += 12) ctx.fillRect(x, yy + size * 0.28, 4, 4);
  });
}

export function drawDeed(pos) {
  const sq = BOARD[pos], W = 600, H = 840, [cv, ctx, s] = sheet(W, H, 140);
  paper(ctx, W, H); frames(ctx, s, W, H, 30);
  ctx.textAlign = 'center';
  if (sq.t === 'prop') {
    const gc = GROUPS[sq.g].c, ink = inkOn(gc);
    ctx.save(); rr(ctx, 58, 58, W - 116, 206, 14); ctx.clip();
    ctx.fillStyle = gc; ctx.fillRect(58, 58, W - 116, 206);
    const sh = ctx.createLinearGradient(0, 58, 0, 264); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.14)');
    ctx.fillStyle = sh; ctx.fillRect(58, 58, W - 116, 206); ctx.restore();
    foil(ctx, s, c => { c.lineWidth = 3; rr(c, 58, 58, W - 116, 206, 14); c.stroke(); });
    ctx.fillStyle = ink; caps(ctx, 'TITLE DEED', W / 2, 100, 24, 8);
    ctx.font = `700 50px ${FONT.name}`; ctx.textBaseline = 'middle';
    const name = wrap(ctx, sq.n.toUpperCase(), W - 170).slice(0, 2);
    name.forEach((l, i) => ctx.fillText(l, W / 2, 168 + (i - (name.length - 1) / 2) * 52));
    const list = [['Rent', money(sq.rent[0])], ['With 1 house', money(sq.rent[1])], ['With 2 houses', money(sq.rent[2])], ['With 3 houses', money(sq.rent[3])], ['With 4 houses', money(sq.rent[4])], ['With a hotel', money(sq.rent[5])]];
    rows(ctx, list, 84, W - 84, 318, 56, 30);
    foil(ctx, s, c => { c.fillRect(120, 662, W / 2 - 140, 2); diamond(c, W / 2, 663, 9); c.fillRect(W / 2 + 20, 662, W / 2 - 140, 2); });
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = `600 27px ${FONT.ui}`;
    ctx.fillText(`Houses cost ${money(sq.hc)} each`, W / 2, 714); ctx.fillText(`Mortgage value ${money(sq.price / 2)}`, W / 2, 756);
  } else {
    ctx.fillStyle = 'rgba(40,34,24,.07)'; ctx.beginPath(); ctx.arc(W / 2, 176, 86, 0, Math.PI * 2); ctx.fill();
    foil(ctx, s, c => { c.lineWidth = 5; c.beginPath(); c.arc(W / 2, 176, 86, 0, Math.PI * 2); c.stroke(); });
    icon(ctx, sq.t === 'station' ? IC.train : pos === 12 ? IC.wifi : IC.drop, 110, W / 2, 176, INK);
    ctx.fillStyle = INK; ctx.font = `700 50px ${FONT.name}`; ctx.textBaseline = 'middle';
    wrap(ctx, sq.n.toUpperCase(), W - 170).slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, 322 + i * 52));
    const list = sq.t === 'station' ? [['1 station', '$25'], ['2 stations', '$50'], ['3 stations', '$100'], ['4 stations', '$200']] : [['One utility', '4 × roll'], ['Both utilities', '10 × roll']];
    rows(ctx, list, 84, W - 84, 450, 56, 30);
    foil(ctx, s, c => { c.fillRect(120, 704, W / 2 - 140, 2); diamond(c, W / 2, 705, 9); c.fillRect(W / 2 + 20, 704, W / 2 - 140, 2); });
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = `600 27px ${FONT.ui}`; ctx.fillText(`Mortgage value ${money(sq.price / 2)}`, W / 2, 756);
  }
  grain(ctx, W, H, 0.05);
  return cv;
}

export function drawCardBack(dk) {
  const D = DECK[dk], W = 640, H = 976, cx = W / 2, cy = H * 0.43, [cv, ctx, s] = sheet(W, H, 110);
  const g = ctx.createRadialGradient(cx, cy, 40, cx, H / 2, H * 0.75); g.addColorStop(0, D.c); g.addColorStop(1, D.d);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 2;
  for (let i = 0; i < 48; i++) { ctx.rotate(Math.PI / 48); ctx.beginPath(); ctx.ellipse(0, 0, 330, 120, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  frames(ctx, s, W, H, 36);
  foil(ctx, s, c => { for (const [x, y] of [[70, 70], [W - 70, 70], [70, H - 70], [W - 70, H - 70]]) diamond(c, x, y, 14); });
  ctx.fillStyle = D.d; ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI * 2); ctx.fill();
  foil(ctx, s, c => {
    c.lineWidth = 9; c.beginPath(); c.arc(cx, cy, 150, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 2.5; c.beginPath(); c.arc(cx, cy, 128, 0, Math.PI * 2); c.stroke();
    if (dk === 'T') { c.save(); c.translate(cx - 100, cy - 100); c.scale(200 / 24, 200 / 24); c.fill(new Path2D(IC.chat), 'evenodd'); c.restore(); }
    else { c.font = `400 230px ${FONT.disp}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', cx, cy + 12); }
    c.font = `400 72px ${FONT.disp}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(D.n, cx, H * 0.72);
    caps(c, 'TYCOON', cx, H * 0.8, 26, 12);
  });
  grain(ctx, W, H, 0.08);
  return cv;
}
// the medallion picture on a card face says what kind of card it is
function cardIcon(ctx, fx, x, y, color) {
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (fx.k === 'cash' || fx.k === 'each') { ctx.font = `400 104px ${FONT.disp}`; ctx.fillText('$', x, y + 6); return; }
  if (fx.k === 'to') { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); icon(ctx, IC.arrow, 96, 0, 0, color); ctx.restore(); return; }
  const d = { back: IC.arrow, jail: IC.bars, goojf: IC.badge, rep: IC.gear, near: fx.w === 'station' ? IC.train : IC.drop }[fx.k] || IC.gem;
  icon(ctx, d, 96, x, y, color);
}
export function drawCardFace(dk, id) {
  const D = DECK[dk], W = 640, H = 976, [cv, ctx, s] = sheet(W, H, 140);
  paper(ctx, W, H);
  ctx.save(); rr(ctx, 42, 42, W - 84, 236, [24, 24, 0, 0]); ctx.clip();
  const hg = ctx.createLinearGradient(0, 42, 0, 278); hg.addColorStop(0, D.c); hg.addColorStop(1, D.d);
  ctx.fillStyle = hg; ctx.fillRect(42, 42, W - 84, 236);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 4;
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(W / 2, 168); ctx.lineTo(W / 2 + Math.cos(a) * 520, 168 + Math.sin(a) * 520); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
  ctx.font = `400 86px ${FONT.disp}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(D.n, W / 2, 178); ctx.restore();
  frames(ctx, s, W, H, 36);
  foil(ctx, s, c => { c.fillRect(42, 276, W - 84, 5); caps(c, 'TYCOON', W / 2, 92, 22, 10); });
  ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = D.c; ctx.beginPath(); ctx.arc(W / 2, 392, 78, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  foil(ctx, s, c => { c.lineWidth = 5; c.beginPath(); c.arc(W / 2, 392, 78, 0, Math.PI * 2); c.stroke(); });
  cardIcon(ctx, CARDS[id].fx, W / 2, 392, D.d);
  ctx.fillStyle = '#26221b'; ctx.font = `600 40px ${FONT.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = wrap(ctx, CARDS[id].tx, 500);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 650 + (i - (lines.length - 1) / 2) * 54));
  foil(ctx, s, c => { c.fillRect(140, 862, W / 2 - 164, 2); diamond(c, W / 2, 863, 10); c.fillRect(W / 2 + 24, 862, W / 2 - 164, 2); });
  ctx.fillStyle = D.d; caps(ctx, D.n.toUpperCase(), W / 2, 906, 22, 6);
  grain(ctx, W, H, 0.05);
  return cv;
}

const PIPS = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]] };
// raw face 1-6; the speed die shows 1, 2, 3, Hustle, Hustle, Bus
export function drawDieFace(v, speed, look) {
  const cv = canvas(128), ctx = cv.getContext('2d');
  ctx.fillStyle = speed ? '#c62835' : look.body; ctx.fillRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 92); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.12)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const face = speed ? SPEED[v - 1] : v, ink = speed ? '#fff' : look.pip;
  if (typeof face === 'number') {
    for (const [x, y] of PIPS[face]) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(x * 128, y * 128 + 1.5, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = !speed && face === 1 ? look.one : ink; ctx.beginPath(); ctx.arc(x * 128, y * 128, 10.5, 0, Math.PI * 2); ctx.fill();
    }
  } else icon(ctx, face === 'B' ? IC.bus : IC.run, 84, 64, 64, ink);
  return cv;
}

export function drawBill() {
  const cv = canvas(256, 128), ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, 240, 112);
  ctx.beginPath(); ctx.ellipse(128, 64, 34, 40, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = `400 46px ${FONT.disp}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 128, 68);
  ctx.font = `700 22px ${FONT.name}`; ctx.fillText('TYCOON', 56, 36); ctx.fillText('TYCOON', 200, 94);
  grain(ctx, 256, 128, 0.15);
  return cv;
}

// owner plates: a cell per token with its emblem, a gilt keyline and a sheen on a clear ground; the owner's colour shows through
export function drawPlates() {
  const w = 256, h = 128, cv = canvas(w * TOK.length, h), ctx = cv.getContext('2d');
  TOK.forEach((t, i) => {
    ctx.save(); ctx.translate(i * w, 0);
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.32)'); g.addColorStop(0.45, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; rr(ctx, 6, 6, w - 12, h - 12, 18); ctx.fill();
    ctx.strokeStyle = '#ffe6a3'; ctx.lineWidth = 5; rr(ctx, 12, 12, w - 24, h - 24, 14); ctx.stroke();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    icon(ctx, t.d, h * 0.62, w / 2, h / 2, '#ffffff');
    ctx.restore();
  });
  return cv;
}

export function drawMortgage() {
  const cv = canvas(256), ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(20,16,10,.42)'; ctx.fillRect(0, 0, 256, 256);
  ctx.save(); ctx.translate(128, 128); ctx.rotate(-Math.PI / 5);
  ctx.strokeStyle = '#d6303c'; ctx.lineWidth = 7; ctx.strokeRect(-112, -30, 224, 60);
  ctx.fillStyle = '#e8434f'; ctx.font = `700 40px ${FONT.name}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MORTGAGED', 0, 3);
  ctx.restore();
  return cv;
}

export function drawGlow() {
  const S = 128, cv = canvas(S), ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return cv;
}
