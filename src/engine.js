// Tycoon rules engine: pure state transitions, no DOM, no network.
// Shared by the browser (bots, pass & play) and the server (online rooms).

export const BOARD = [
  { t: 'go', n: 'Start' },
  { t: 'prop', n: 'Shimla', g: 0, price: 60, rent: [2, 10, 30, 90, 160, 250], hc: 50 },
  { t: 'treasury', n: 'Group Chat' },
  { t: 'prop', n: 'Ooty', g: 0, price: 60, rent: [4, 20, 60, 180, 320, 450], hc: 50 },
  { t: 'tax', n: 'Adulting Tax', amt: 200 },
  { t: 'station', n: 'Howrah Junction', price: 200 },
  { t: 'prop', n: 'Puri', g: 1, price: 100, rent: [6, 30, 90, 270, 400, 550], hc: 50 },
  { t: 'fortune', n: 'Plot Twist' },
  { t: 'prop', n: 'Panaji', g: 1, price: 100, rent: [6, 30, 90, 270, 400, 550], hc: 50 },
  { t: 'prop', n: 'Puducherry', g: 1, price: 120, rent: [8, 40, 100, 300, 450, 600], hc: 50 },
  { t: 'jail', n: 'Jail' },
  { t: 'prop', n: 'Jodhpur', g: 2, price: 140, rent: [10, 50, 150, 450, 625, 750], hc: 100 },
  { t: 'util', n: 'Wi-Fi Co.', price: 150 },
  { t: 'prop', n: 'Udaipur', g: 2, price: 140, rent: [10, 50, 150, 450, 625, 750], hc: 100 },
  { t: 'prop', n: 'Jaipur', g: 2, price: 160, rent: [12, 60, 180, 500, 700, 900], hc: 100 },
  { t: 'station', n: 'Chennai Central', price: 200 },
  { t: 'prop', n: 'Agra', g: 3, price: 180, rent: [14, 70, 200, 550, 750, 950], hc: 100 },
  { t: 'treasury', n: 'Group Chat' },
  { t: 'prop', n: 'Varanasi', g: 3, price: 180, rent: [14, 70, 200, 550, 750, 950], hc: 100 },
  { t: 'prop', n: 'Lucknow', g: 3, price: 200, rent: [16, 80, 220, 600, 800, 1000], hc: 100 },
  { t: 'parking', n: 'Chill Zone' },
  { t: 'prop', n: 'Guwahati', g: 4, price: 220, rent: [18, 90, 250, 700, 875, 1050], hc: 150 },
  { t: 'fortune', n: 'Plot Twist' },
  { t: 'prop', n: 'Bhubaneswar', g: 4, price: 220, rent: [18, 90, 250, 700, 875, 1050], hc: 150 },
  { t: 'prop', n: 'Kolkata', g: 4, price: 240, rent: [20, 100, 300, 750, 925, 1100], hc: 150 },
  { t: 'station', n: 'Mumbai Central', price: 200 },
  { t: 'prop', n: 'Kochi', g: 5, price: 260, rent: [22, 110, 330, 800, 975, 1150], hc: 150 },
  { t: 'prop', n: 'Chennai', g: 5, price: 260, rent: [22, 110, 330, 800, 975, 1150], hc: 150 },
  { t: 'util', n: 'Hydration Station', price: 150 },
  { t: 'prop', n: 'Hyderabad', g: 5, price: 280, rent: [24, 120, 360, 850, 1025, 1200], hc: 150 },
  { t: 'gotojail', n: 'Go to Jail' },
  { t: 'prop', n: 'Gurugram', g: 6, price: 300, rent: [26, 130, 390, 900, 1100, 1275], hc: 200 },
  { t: 'prop', n: 'Pune', g: 6, price: 300, rent: [26, 130, 390, 900, 1100, 1275], hc: 200 },
  { t: 'treasury', n: 'Group Chat' },
  { t: 'prop', n: 'Bengaluru', g: 6, price: 320, rent: [28, 150, 450, 1000, 1200, 1400], hc: 200 },
  { t: 'station', n: 'New Delhi Station', price: 200 },
  { t: 'fortune', n: 'Plot Twist' },
  { t: 'prop', n: 'Delhi', g: 7, price: 350, rent: [35, 175, 500, 1100, 1300, 1500], hc: 200 },
  { t: 'tax', n: 'Splurge Tax', amt: 100 },
  { t: 'prop', n: 'Mumbai', g: 7, price: 400, rent: [50, 200, 600, 1400, 1700, 2000], hc: 200 },
];

export const GROUPS = [
  { n: 'The Hills', c: '#8a5a3c' }, { n: 'Beach Towns', c: '#9fd4ef' },
  { n: 'Rajasthan', c: '#d13b8e' }, { n: 'Heritage Cities', c: '#f08a24' },
  { n: 'The East', c: '#d92b2b' }, { n: 'The South', c: '#f2d01b' },
  { n: 'Tech Hubs', c: '#1e9a4c' }, { n: 'Metros', c: '#1d4fa3' },
];
GROUPS.forEach((g, i) => { g.pos = BOARD.map((s, p) => (s.t === 'prop' && s.g === i ? p : -1)).filter(p => p >= 0); });

export const OWNABLE = BOARD.map((s, i) => (s.price ? i : -1)).filter(i => i >= 0);
export const STATIONS = [5, 15, 25, 35];
export const UTILS = [12, 28];
export const HOUSES = 32, HOTELS = 12, MAX_PLAYERS = 4, TOKENS = 8;
export const AUC_START = 20000, AUC_RESET = 12000;
// Speed die faces 1-6: three numbers, two Hustle faces, one Bus.
export const SPEED = [1, 2, 3, 'H', 'H', 'B'];
export const BOT_LEVELS = ['easy', 'normal', 'hard'];
const BOT_NAMES = ['Ava', 'Kabir', 'Zoe', 'Arjun', 'Maya', 'Leo', 'Isha', 'Nico'];

export const CARDS = {
  f1: { tx: 'Main character moment. Advance to Start and collect $200.', fx: { k: 'to', to: 0 } },
  f2: { tx: 'Manifesting luxury. Advance to Mumbai.', fx: { k: 'to', to: 39 } },
  f3: { tx: 'Brunch reservation you can’t miss. Advance to Kolkata. Collect $200 if you pass Start.', fx: { k: 'to', to: 24 } },
  f4: { tx: 'Content day. Advance to Jodhpur. Collect $200 if you pass Start.', fx: { k: 'to', to: 11 } },
  f5: { tx: 'Running late, as usual. Advance to the nearest station. If it’s owned, pay the owner double.', fx: { k: 'near', w: 'station' } },
  f6: { tx: 'Running late, as usual. Advance to the nearest station. If it’s owned, pay the owner double.', fx: { k: 'near', w: 'station' } },
  f7: { tx: 'Phone at 1%. Advance to the nearest utility. If it’s owned, roll and pay the owner ten times the roll.', fx: { k: 'near', w: 'util' } },
  f8: { tx: 'Your crypto actually went up. Collect $50.', fx: { k: 'cash', a: 50 } },
  f9: { tx: 'You know a guy. Keep this card to get out of jail free.', fx: { k: 'goojf' } },
  f10: { tx: 'Wrong group chat. Go back 3 spaces.', fx: { k: 'back', n: 3 } },
  f11: { tx: 'Caught slipping. Go directly to jail. Do not pass Start.', fx: { k: 'jail' } },
  f12: { tx: 'Your properties need a glow-up. Pay $25 per house and $100 per hotel.', fx: { k: 'rep', h: 25, H: 100 } },
  f13: { tx: 'Parking ticket, bestie. Pay $15.', fx: { k: 'cash', a: -15 } },
  f14: { tx: 'Catch the next train. Advance to Howrah Junction. Collect $200 if you pass Start.', fx: { k: 'to', to: 5 } },
  f15: { tx: 'You picked up the dinner bill. Pay each player $50.', fx: { k: 'each', a: -50 } },
  f16: { tx: 'Your side hustle paid off. Collect $150.', fx: { k: 'cash', a: 150 } },
  t1: { tx: 'Advance to Start and collect $200. Period.', fx: { k: 'to', to: 0 } },
  t2: { tx: 'Bank error in your favour. We don’t ask questions. Collect $200.', fx: { k: 'cash', a: 200 } },
  t3: { tx: 'Your dentist says floss more. Pay $50.', fx: { k: 'cash', a: -50 } },
  t4: { tx: 'You sold your old sneakers online. Collect $50.', fx: { k: 'cash', a: 50 } },
  t5: { tx: 'Your ex owes you one. Keep this card to get out of jail free.', fx: { k: 'goojf' } },
  t6: { tx: 'Someone screenshotted the receipts. Go directly to jail. Do not pass Start.', fx: { k: 'jail' } },
  t7: { tx: 'Your vacation fund matured. Collect $100.', fx: { k: 'cash', a: 100 } },
  t8: { tx: 'That tax refund hit different. Collect $20.', fx: { k: 'cash', a: 20 } },
  t9: { tx: 'It’s your birthday, so everyone pays up. Collect $10 from every player.', fx: { k: 'each', a: 10 } },
  t10: { tx: 'Insurance finally paid out. Collect $100.', fx: { k: 'cash', a: 100 } },
  t11: { tx: 'Hospital bill. Ouch. Pay $100.', fx: { k: 'cash', a: -100 } },
  t12: { tx: 'Tuition is due. Again. Pay $50.', fx: { k: 'cash', a: -50 } },
  t13: { tx: 'Consulting gig, very LinkedIn. Collect $25.', fx: { k: 'cash', a: 25 } },
  t14: { tx: 'Street repairs are your problem now. Pay $40 per house and $115 per hotel.', fx: { k: 'rep', h: 40, H: 115 } },
  t15: { tx: 'Runner-up in a glow-up contest. Collect $10.', fx: { k: 'cash', a: 10 } },
  t16: { tx: 'A rich aunt remembered you. Collect $100.', fx: { k: 'cash', a: 100 } },
};

export const DEFAULTS = {
  auctions: true, auctionOnly: false, even: true, limited: true, landBuild: false, landAny: false, jailRent: true, jackpot: false, doubleGo: false,
  skipSpaces: false, quickEnd: false, quickHotels: false, quickJail: false, startDeeds: false,
  firstLap: false, incomeTax: false, speedDie: false, startCash: 1500, turnSec: 0, timeLimit: 0, theme: 'city',
};
export const THEMES = ['city', 'neon', 'snow', 'forest', 'ocean'];
export const DICE_SKINS = 4;
// Quick Mode is a preset of house rules
export const QUICK_MODE = { skipSpaces: true, quickEnd: true, quickHotels: true, quickJail: true, jackpot: false };
export const SETTING_CHOICES = {
  startCash: [500, 1000, 1500, 2000, 2500, 3000],
  turnSec: [0, 30, 60, 90, 120],
  timeLimit: [0, 30, 60, 90, 120, 180],
  theme: THEMES,
};
const LOBBY_ONLY = new Set(['startCash', 'speedDie', 'startDeeds', 'quickHotels', 'theme']);

// States saved by older versions: fill in newer fields, and a building won before held pieces existed is held.
export function upgrade(s0) {
  const s = { stats: {}, ...s0, settings: { ...DEFAULTS, ...s0.settings } }, pd = s.pend;
  if (pd && pd.k === 'place') { const p = P(s, pd.p); if (p) (p.inv ||= { h: [], H: [] })[pd.kind].push(pd.paid); s.pend = null; }
  return s;
}

export class GameError extends Error {}
const fail = m => { throw new GameError(m); };
const clone = x => structuredClone(x);
export const money = n => '$' + n.toLocaleString('en-US');
const $ = money;

export function newGame(host, now) {
  return {
    v: 2, game: 1, phase: 'lobby', host, settings: { ...DEFAULTS },
    players: [], turn: 0, turnN: 0, props: {}, pot: 0, decks: { F: [], T: [] }, ts: null, dice: [3, 4],
    pend: null, aq: [], debts: [], mdec: [], trades: [], tradeN: 0, botN: 0, log: [], logN: 0, fx: [], fxN: 0,
    stats: {}, started: 0, deadline: 0, turnEnd: 0, winner: null, created: now,
  };
}

// ---------- helpers ----------
export const player = (s, id) => s.players.find(p => p.id === id);
const P = player;
export const current = s => s.players[s.turn];
const cur = current;
export const alive = s => s.players.filter(p => !p.out);
const die = rng => 1 + Math.floor(rng() * 6);

// per-player tallies for the end-of-game summary
function stat(s, id, k, n = 1) { const t = s.stats[id] || (s.stats[id] = {}); t[k] = (t[k] || 0) + n; }
function log(s, m) { s.logN++; s.log.push({ i: s.logN, m }); if (s.log.length > 80) s.log.shift(); }
function fx(s, o) { s.fxN++; o.i = s.fxN; s.fx.push(o); if (s.fx.length > 60) s.fx.shift(); }
function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function stock(s) {
  let h = 0, H = 0;
  for (const k in s.props) { const x = s.props[k].h; if (x === 5) H++; else h += x; }
  for (const p of s.players) { h += spare(p, 'h'); H += spare(p, 'H'); }
  return { h: HOUSES - h, H: HOTELS - H };
}
// Houses ('h') and hotels ('H') a player won at a shortage auction and has not built yet; inv lists what each one cost.
export const spare = (p, k) => (p.inv ? p.inv[k].length : 0);
const heldCost = p => (p.inv ? [...p.inv.h, ...p.inv.H].reduce((t, b) => t + b, 0) : 0);
// Whether the player holds a won piece of the kind the next build on this lot needs.
export const spareFor = (s, id, pos) => spare(P(s, id), s.props[pos].h === maxHouses(s) ? 'H' : 'h') > 0;
// Houses before a hotel: 4, or 3 with Quick Hotels. A hotel is stored as h = 5.
export const maxHouses = s => (s.settings.quickHotels ? 3 : 4);
// Buildings bought for a lot (a hotel counts its houses too).
export const builds = (s, h) => (h === 5 ? maxHouses(s) + 1 : h);
export function ownsGroup(s, id, g) { return GROUPS[g].pos.every(p => s.props[p].o === id); }
// One owner's streets in a set: a set has one owner unless Land and Build lets several build in it.
const ownStreets = (s, g, id) => GROUPS[g].pos.filter(p => s.props[p].o === id);
function groupBuilt(s, g, id) { return ownStreets(s, g, id).some(p => s.props[p].h > 0); }
// integer math: 50 * 1.1 is 55.000000000000014 in floating point
export const interestOn = pos => Math.ceil(BOARD[pos].price / 20);
export const unmortgageCost = pos => Math.ceil(BOARD[pos].price * 11 / 20);
export const pendingLifts = (s, id) => s.mdec.filter(x => x.p === id);
// utility rent counts the speed die's number; Bus and Hustle count as zero
export const diceTotal = s => s.dice[0] + s.dice[1] + (typeof SPEED[s.dice[2] - 1] === 'number' ? SPEED[s.dice[2] - 1] : 0);
// squares the Skip Spaces rule takes out of play
export const skipped = (s, pos) => s.settings.skipSpaces && ['fortune', 'treasury', 'tax'].includes(BOARD[pos].t);
// squares a token passes through moving n counted steps (negative = backwards)
export function stepPath(s, from, n) {
  const path = [], dir = Math.sign(n);
  let pos = from, left = Math.abs(n);
  while (left > 0) { pos = (pos + dir + 40) % 40; path.push(pos); if (!skipped(s, pos)) left--; }
  return path;
}

export function rentFor(s, pos, roll) {
  const sq = BOARD[pos], pr = s.props[pos];
  if (!pr || !pr.o || pr.m) return 0;
  if (sq.t === 'prop') return pr.h > 0 ? sq.rent[pr.h] : sq.rent[0] * (ownsGroup(s, pr.o, sq.g) ? 2 : 1);
  if (sq.t === 'station') return 25 * Math.pow(2, STATIONS.filter(p => s.props[p].o === pr.o).length - 1);
  if (sq.t === 'util') return (UTILS.every(p => s.props[p].o === pr.o) ? 10 : 4) * roll;
  return 0;
}

export function netWorth(s, p) {
  let w = p.cash + heldCost(p);
  for (const k in s.props) {
    const pr = s.props[k], sq = BOARD[k];
    if (pr.o !== p.id) continue;
    w += pr.m ? sq.price / 2 : sq.price;
    w += builds(s, pr.h) * (sq.hc || 0);
  }
  return w;
}
// Classic income tax worth: cash, printed prices (mortgaged or not) and buildings at cost.
export function taxWorth(s, p) {
  let w = p.cash + heldCost(p);
  for (const k in s.props) {
    const pr = s.props[k], sq = BOARD[k];
    if (pr.o === p.id) w += sq.price + builds(s, pr.h) * (sq.hc || 0);
  }
  return w;
}

// ---------- validation shared with the UI and bots ----------
export function canBuild(s, id, pos, o = {}) {
  const sq = BOARD[pos], pr = s.props[pos], p = P(s, id);
  if (!pr || sq.t !== 'prop') return 'Only streets can have houses';
  if (pr.o !== id) return 'You do not own this';
  if (!s.settings.landAny && !ownsGroup(s, id, sq.g)) return 'Own the full color set first';
  const mine = ownStreets(s, sq.g, id);
  if (mine.some(q => s.props[q].m)) return 'Lift every mortgage in this set first';
  if (pr.h === 5) return 'Already has a hotel';
  // anyTurn: could they compete for the bank's stock at a shortage auction, held on someone else's turn
  if (!o.anyTurn && cur(s).id !== id) return 'You can only build on your turn';
  if (!o.anyTurn && (s.settings.landBuild || s.settings.landAny)) {
    if (!(s.ts.lands || []).includes(pos)) return 'You can only build where you landed this turn';
    if ((s.ts.done || []).includes(pos)) return 'You bought or built here on this landing. Land here again to build';
  }
  if (s.settings.even && builds(s, pr.h) > Math.min(...mine.map(q => builds(s, s.props[q].h)))) return 'Build evenly across the set';
  const hotel = pr.h === maxHouses(s), won = !o.anyTurn && spareFor(s, id, pos);
  if (s.settings.limited && !won) {
    const st = stock(s);
    if (!hotel && st.h < 1) return 'The bank is out of houses';
    if (hotel && st.H < 1) return 'The bank is out of hotels';
  }
  if (!won && p.cash < sq.hc) return 'Not enough cash';
  return '';
}
// Lots where a player could put a house ('h') or hotel ('H') right now.
export function buildableLots(s, id, kind, o) {
  const top = maxHouses(s);
  return GROUPS.flatMap(g => g.pos).filter(pos => {
    const pr = s.props[pos];
    if (!pr || pr.o !== id || (kind === 'H') !== (pr.h === top)) return false;
    return !canBuild(s, id, pos, o);
  });
}
export function canSell(s, id, pos) {
  const sq = BOARD[pos], pr = s.props[pos];
  if (!pr || sq.t !== 'prop' || pr.o !== id) return 'You do not own this';
  if (pr.h < 1) return 'Nothing to sell';
  if (s.settings.even && builds(s, pr.h) < Math.max(...ownStreets(s, sq.g, id).map(q => builds(s, s.props[q].h)))) return 'Sell evenly across the set';
  return '';
}
export function canMortgage(s, id, pos) {
  const sq = BOARD[pos], pr = s.props[pos];
  if (!pr || pr.o !== id) return 'You do not own this';
  if (pr.m) return 'Already mortgaged';
  if (sq.t === 'prop' && groupBuilt(s, sq.g, id)) return 'Sell the buildings in this set first';
  return '';
}
export function canUnmortgage(s, id, pos) {
  const pr = s.props[pos];
  if (!pr || pr.o !== id) return 'You do not own this';
  if (!pr.m) return 'Not mortgaged';
  if (P(s, id).cash < unmortgageCost(pos)) return 'Not enough cash';
  return '';
}
// to: who receives this side; under Land and Build they may already have buildings in a street's set
export function tradeSideError(s, pid, side, to) {
  const p = P(s, pid);
  if (!p || p.out) return 'Player is no longer in the game';
  if (p.cash < side.c) return p.name + ' does not have ' + $(side.c);
  if (p.goojf.length < side.j) return p.name + ' does not have that card';
  for (const pos of side.p) {
    const pr = s.props[pos];
    if (!pr || pr.o !== pid) return p.name + ' no longer owns ' + (BOARD[pos] ? BOARD[pos].n : 'that');
    if (BOARD[pos].t === 'prop' && groupBuilt(s, BOARD[pos].g, pid)) return 'Sell the buildings in the ' + GROUPS[BOARD[pos].g].n + ' set first';
    if (to && pr.m && BOARD[pos].t === 'prop' && groupBuilt(s, BOARD[pos].g, to)) return 'Lift the mortgage on ' + BOARD[pos].n + ' first: ' + P(s, to).name + ' has buildings in its set';
  }
  return '';
}

// ---------- money ----------
function addCash(s, p, a) { if (!a) return; p.cash += a; fx(s, { t: 'cash', p: p.id, a }); }
function settle(s, p, amt, to) {
  addCash(s, p, -amt);
  if (to === 'pot') { if (s.settings.jackpot) s.pot += amt; }
  else if (to !== 'bank') { const q = P(s, to); if (q && !q.out) addCash(s, q, amt); }
}
function pay(s, p, amt, to, why) {
  if (amt <= 0) return;
  if (p.cash >= amt) { settle(s, p, amt, to); return; }
  s.debts.push({ p: p.id, a: amt, to, why });
  fx(s, { t: 'debt', p: p.id, a: amt });
  log(s, `${p.name} owes ${$(amt)} for ${why} and must raise funds`);
}

// ---------- movement ----------
function passStart(s, p, exact) {
  p.lap = true;
  stat(s, p.id, 'laps');
  addCash(s, p, 200);
  if (exact && s.settings.doubleGo) { addCash(s, p, 200); log(s, `${p.name} lands right on Start and collects ${$(400)}`); }
  else log(s, `${p.name} passes Start and collects ${$(200)}`);
}
function walk(s, p, path, forward, rng, opt) {
  const from = p.pos, to = path[path.length - 1];
  // a new landing: that square's one action (buy or build) is fresh again
  p.pos = to; (s.ts.lands ||= []).push(to); if (s.ts.done) s.ts.done = s.ts.done.filter(q => q !== to);
  fx(s, { t: 'move', p: p.id, from, path });
  if (forward && path.includes(0)) passStart(s, p, to === 0);
  land(s, p, rng, opt || {});
}
function moveSteps(s, p, n, rng, opt) { walk(s, p, stepPath(s, p.pos, n), n > 0, rng, opt); }
function moveTo(s, p, to, rng, opt) {
  const n = ((to - p.pos) + 40) % 40 || 40;
  walk(s, p, Array.from({ length: n }, (_, i) => (p.pos + i + 1) % 40), true, rng, opt);
}
function sendJail(s, p) {
  fx(s, { t: 'jail', p: p.id, from: p.pos });
  p.pos = 10; p.jail = true; p.jt = 0;
  stat(s, p.id, 'jail');
  if (cur(s) && cur(s).id === p.id) { s.ts.roll = false; s.ts.dbl = 0; s.ts.hustle = false; s.ts.lands = []; }
  log(s, `${p.name} goes to jail`);
}

function land(s, p, rng, opt) {
  const sq = BOARD[p.pos];
  if (skipped(s, p.pos)) return;
  switch (sq.t) {
    case 'prop': case 'station': case 'util': {
      const pr = s.props[p.pos];
      if (!pr.o) {
        if (s.settings.firstLap && !p.lap) { log(s, `${p.name} can't buy until passing Start once`); return; }
        if (s.settings.auctionOnly) { s.aq.push(p.pos); return; }
        s.pend = { k: 'buy', pos: p.pos, p: p.id };
        return;
      }
      if (pr.o === p.id) return;
      const ow = P(s, pr.o);
      if (pr.m) { log(s, `${sq.n} is mortgaged, so no rent is due`); return; }
      if (ow.jail && !s.settings.jailRent) { log(s, `${ow.name} is in jail, so no rent is due`); return; }
      let r;
      if (sq.t === 'util' && opt.util10) {
        const d = [die(rng), die(rng)];
        s.dice = d; fx(s, { t: 'dice', p: p.id, d });
        r = 10 * (d[0] + d[1]);
      } else r = rentFor(s, p.pos, diceTotal(s));
      if (opt.station2) r *= 2;
      fx(s, { t: 'rent', p: p.id, o: ow.id, a: r, pos: p.pos });
      stat(s, p.id, 'rentOut', r); stat(s, ow.id, 'rentIn', r);
      log(s, `${p.name} pays ${ow.name} ${$(r)} rent on ${sq.n}`);
      pay(s, p, r, ow.id, 'rent');
      return;
    }
    case 'tax':
      if (sq.amt === 200 && s.settings.incomeTax) { s.pend = { k: 'tax', p: p.id }; return; }
      log(s, `${p.name} pays ${$(sq.amt)} ${sq.n.toLowerCase()}`);
      pay(s, p, sq.amt, 'pot', sq.n.toLowerCase());
      return;
    case 'fortune': case 'treasury': draw(s, p, sq.t === 'fortune' ? 'F' : 'T', rng); return;
    case 'gotojail': sendJail(s, p); return;
    case 'parking':
      if (s.settings.jackpot && s.pot > 0) { log(s, `${p.name} scoops the ${$(s.pot)} jackpot`); fx(s, { t: 'jackpot', p: p.id, a: s.pot }); addCash(s, p, s.pot); s.pot = 0; }
      return;
  }
}

function draw(s, p, dk, rng) {
  const id = s.decks[dk].shift(), c = CARDS[id];
  if (c.fx.k !== 'goojf') s.decks[dk].push(id);
  fx(s, { t: 'card', p: p.id, dk, c: id });
  stat(s, p.id, 'cards');
  log(s, `${p.name} draws ${dk === 'F' ? 'Plot Twist' : 'Group Chat'}: ${c.tx}`);
  const e = c.fx;
  switch (e.k) {
    case 'to': moveTo(s, p, e.to, rng); break;
    case 'near': {
      const list = e.w === 'station' ? STATIONS : UTILS;
      const target = list.find(q => q > p.pos) ?? list[0];
      moveTo(s, p, target, rng, e.w === 'station' ? { station2: true } : { util10: true });
      break;
    }
    case 'cash': if (e.a > 0) addCash(s, p, e.a); else pay(s, p, -e.a, 'pot', 'a card'); break;
    case 'goojf': p.goojf.push(dk); break;
    case 'back': moveSteps(s, p, -e.n, rng); break;
    case 'jail': sendJail(s, p); break;
    case 'rep': {
      let n = 0;
      for (const k in s.props) { const pr = s.props[k]; if (pr.o === p.id && pr.h) n += pr.h === 5 ? e.H : pr.h * e.h; }
      if (n) pay(s, p, n, 'pot', 'repairs'); else log(s, `${p.name} has no buildings to repair`);
      break;
    }
    case 'each':
      for (const q of alive(s)) {
        if (q.id === p.id) continue;
        if (e.a < 0) pay(s, p, -e.a, q.id, 'a card'); else pay(s, q, e.a, p.id, 'a card');
      }
      break;
  }
}

// Hustle face: the next unowned property, else the next one where rent is due.
function hustleTarget(s, p) {
  for (let k = 1; k < 40; k++) { const q = (p.pos + k) % 40; if (s.props[q] && !s.props[q].o) return q; }
  for (let k = 1; k < 40; k++) {
    const q = (p.pos + k) % 40, pr = s.props[q];
    if (pr && pr.o && pr.o !== p.id && !pr.m && !(P(s, pr.o).jail && !s.settings.jailRent)) return q;
  }
  return -1;
}

// ---------- turn flow ----------
function nextTurn(s, now) {
  let i = s.turn;
  do { i = (i + 1) % s.players.length; } while (s.players[i].out);
  s.turn = i; s.turnN++;
  s.ts = { roll: true, rolled: false, dbl: 0, hustle: false };
  s.turnEnd = s.settings.turnSec ? now + s.settings.turnSec * 1000 : 0;
  fx(s, { t: 'turn', p: s.players[i].id });
}
function endGame(s, winner) {
  if (!winner) {
    const ranked = alive(s).sort((a, b) => netWorth(s, b) - netWorth(s, a));
    winner = ranked[0] && ranked[0].id;
  }
  s.phase = 'over'; s.winner = winner || null; s.pend = null; s.debts = []; s.trades = []; s.aq = []; s.mdec = [];
  const w = P(s, winner);
  fx(s, { t: 'win', p: winner });
  log(s, w ? `${w.name} wins the game` : 'Game over');
}
const tradeStale = (s, t) => [t.from, t.to].some(id => !P(s, id) || P(s, id).out)
  || t.give.p.some(pos => s.props[pos].o !== t.from) || t.get.p.some(pos => s.props[pos].o !== t.to);
function normalize(s, now, rng) {
  if (s.phase !== 'play') return;
  s.mdec = s.mdec.filter(x => s.props[x.pos].o === x.p && s.props[x.pos].m);
  s.trades = s.trades.filter(t => !tradeStale(s, t));
  if (alive(s).length <= 1) { endGame(s, alive(s)[0] && alive(s)[0].id); return; }
  if (s.pend || s.debts.length) return;
  if (s.aq.length) { startAuction(s, s.aq.shift(), now); return; }
  const c = cur(s);
  if (c.out) { nextTurn(s, now); return; }
  if (s.ts.hustle) {
    s.ts.hustle = false;
    const to = hustleTarget(s, c);
    if (to < 0) log(s, `${c.name} hustles, but there is nowhere to go`);
    else { fx(s, { t: 'hustle', p: c.id }); log(s, `${c.name} hustles to ${BOARD[to].n}`); moveTo(s, c, to, rng); }
    normalize(s, now, rng);
  }
}
function startAuction(s, pos, now) {
  s.pend = { k: 'auc', pos, bid: 0, by: null, end: now + AUC_START, out: [], n: 0 };
  fx(s, { t: 'auc', pos });
  log(s, `${BOARD[pos].n} goes to auction`);
}
// an auction's clock runs only once every human player still in has it on screen (aucShown); a bid before that leaves it waiting
const onAllScreens = (s, au) => alive(s).every(p => p.bot || (au.shown || []).includes(p.id));
function resolveAuction(s) {
  const a = s.pend; s.pend = null;
  if (a.k === 'bauc') { resolveBuildAuction(s, a); return; }
  if (!a.by) { log(s, `Nobody bid on ${BOARD[a.pos].n}`); fx(s, { t: 'aucEnd', pos: a.pos }); return; }
  const b = P(s, a.by);
  if (!b || b.out) { log(s, `Auction for ${BOARD[a.pos].n} cancelled`); return; }
  s.props[a.pos].o = b.id;
  (s.ts.done ||= []).push(a.pos);
  fx(s, { t: 'buy', p: b.id, pos: a.pos, a: a.bid, auc: 1 });
  stat(s, b.id, 'bought'); stat(s, b.id, 'auc');
  log(s, `${b.name} wins ${BOARD[a.pos].n} at auction for ${$(a.bid)}`);
  pay(s, b, a.bid, 'bank', 'the auction');
}
function resolveBuildAuction(s, a) {
  const what = a.kind === 'H' ? 'hotel' : 'house', b = a.by && P(s, a.by);
  if (!b || b.out) { fx(s, { t: 'aucEnd', kind: a.kind }); log(s, `Nobody bid on the ${what}`); return; }
  // the bank can run out during the auction, e.g. a hotel sold back takes its houses
  if (s.settings.limited && stock(s)[a.kind] < 1) { fx(s, { t: 'aucEnd', kind: a.kind }); log(s, `The bank has no ${what} left, so the sale is off`); return; }
  fx(s, { t: 'aucEnd', kind: a.kind, p: b.id });
  log(s, `${b.name} wins the ${what} for ${$(a.bid)} and can build it free on their turn`);
  pay(s, b, a.bid, 'bank', 'the building auction');
  (b.inv ||= { h: [], H: [] })[a.kind].push(a.bid);
}
function returnToBank(s, pos) { const pr = s.props[pos]; pr.o = null; pr.h = 0; pr.m = false; }

function removePlayerAssets(s, p, heir) {
  // buildings go back to the bank at half price, unbuilt ones won at auction at half their bid
  p.cash += Math.floor(heldCost(p) / 2); p.inv = null;
  for (const k in s.props) {
    const pr = s.props[k];
    if (pr.o === p.id && pr.h) { p.cash += builds(s, pr.h) * BOARD[k].hc / 2; pr.h = 0; }
  }
  if (heir) {
    if (p.cash > 0) addCash(s, heir, p.cash);
    for (const k in s.props) {
      const pr = s.props[k];
      if (pr.o !== p.id) continue;
      pr.o = heir.id;
      if (pr.m) { pay(s, heir, interestOn(+k), 'bank', 'mortgage interest'); s.mdec.push({ p: heir.id, pos: +k }); }
    }
    heir.goojf.push(...p.goojf);
  } else {
    for (const k in s.props) {
      if (s.props[k].o === p.id) { returnToBank(s, +k); if (s.settings.auctions && s.phase === 'play') s.aq.push(+k); }
    }
    for (const dk of p.goojf) s.decks[dk].push(dk === 'F' ? 'f9' : 't5');
  }
  p.cash = 0; p.goojf = []; p.out = true; p.jail = false;
  s.debts = s.debts.filter(d => d.p !== p.id);
  s.debts.forEach(d => { if (d.to === p.id) d.to = 'bank'; });
  s.trades = s.trades.filter(t => t.from !== p.id && t.to !== p.id);
  if (s.pend && (s.pend.k === 'auc' || s.pend.k === 'bauc') && s.pend.by === p.id) { s.pend.by = null; s.pend.bid = 0; }
  if (s.pend && s.pend.p === p.id) s.pend = null;
}

// ---------- actions ----------
function mustPlayer(s, id) {
  const p = P(s, id);
  if (s.phase !== 'play') fail('The game is not running');
  if (!p || p.out) fail('You are not in this game');
  return p;
}
function mustTurn(s, id) {
  const p = mustPlayer(s, id);
  if (cur(s).id !== id) fail('It is not your turn');
  return p;
}
function mustHost(s, id) { if (s.host !== id) fail('Only the host can do that'); }
function mustPend(s, id, k) {
  const pd = s.pend;
  if (!pd || pd.k !== k || pd.p !== id) fail('Nothing to decide');
  return pd;
}
function blank(id, name, tok, bot, dice) {
  return { id, name, tok, bot: bot || null, dice: Math.max(0, Math.min(DICE_SKINS - 1, dice | 0)), cash: 0, pos: 0, jail: false, jt: 0, goojf: [], out: false, lap: false };
}

const A = {
  join(s, id, a) {
    if (s.phase !== 'lobby') fail('This game has already started');
    const name = String(a.name || '').trim().slice(0, 16);
    if (!name) fail('Enter a name');
    const tok = a.tok | 0;
    if (tok < 0 || tok >= TOKENS) fail('Pick a token');
    if (s.players.some(p => p.id !== id && p.tok === tok)) fail('That token is taken');
    const me = P(s, id);
    if (me) { me.name = name; me.tok = tok; me.dice = blank(id, name, tok, null, a.dice).dice; return; }
    if (s.players.length >= MAX_PLAYERS) fail('The table is full');
    s.players.push(blank(id, name, tok, null, a.dice));
    log(s, `${name} joins the table`);
  },
  addBot(s, id, a) {
    mustHost(s, id);
    if (s.phase !== 'lobby') fail('Add bots before the game starts');
    if (s.players.length >= MAX_PLAYERS) fail('The table is full');
    const used = new Set(s.players.map(p => p.tok)), names = new Set(s.players.map(p => p.name));
    const tok = [...Array(TOKENS).keys()].find(t => !used.has(t));
    s.botN++;
    const name = BOT_NAMES.find(n => !names.has(n)) || 'Bot ' + s.botN;
    s.players.push(blank('bot' + s.botN, name, tok, BOT_LEVELS.includes(a.level) ? a.level : 'normal', s.botN % DICE_SKINS));
    log(s, `${name} (bot) joins the table`);
  },
  leave(s, id) {
    if (s.phase !== 'lobby') fail('You can only leave from the lobby');
    s.players = s.players.filter(p => p.id !== id);
  },
  settings(s, id, a) {
    mustHost(s, id);
    for (const k in a) {
      if (!Object.hasOwn(DEFAULTS, k)) continue;
      if (LOBBY_ONLY.has(k) && s.phase !== 'lobby') continue;
      const v = a[k];
      if (typeof DEFAULTS[k] === 'boolean') s.settings[k] = !!v;
      else if (SETTING_CHOICES[k].includes(v)) {
        s.settings[k] = v;
        if (s.phase === 'play' && k === 'timeLimit') s.deadline = v ? a._now + v * 60000 : 0;
        if (s.phase === 'play' && k === 'turnSec') s.turnEnd = v ? a._now + v * 1000 : 0;
      }
    }
    // rules that cannot both be on: the one just switched on wins
    if (s.settings.jackpot && s.settings.skipSpaces) s.settings[a.jackpot ? 'skipSpaces' : 'jackpot'] = false;
    if (s.settings.auctionOnly && !s.settings.auctions) { if (a.auctionOnly) s.settings.auctions = true; else s.settings.auctionOnly = false; }
    if (s.settings.landBuild && s.settings.landAny) s.settings[a.landAny ? 'landBuild' : 'landAny'] = false;
    if (!s.settings.jackpot && s.pot) s.pot = 0;
    log(s, 'The host updated the house rules');
  },
  start(s, id, a, now, rng) {
    mustHost(s, id);
    if (s.phase !== 'lobby') fail('Already started');
    if (s.players.length < 2) fail('You need at least 2 players');
    shuffle(s.players, rng);
    const cash = s.settings.startCash + (s.settings.speedDie ? 1000 : 0);
    s.players.forEach(p => Object.assign(p, { cash, pos: 0, jail: false, jt: 0, goojf: [], out: false, lap: false, inv: null }));
    s.props = {}; OWNABLE.forEach(p => { s.props[p] = { o: null, h: 0, m: false }; });
    s.decks = { F: shuffle(Object.keys(CARDS).filter(k => k[0] === 'f'), rng), T: shuffle(Object.keys(CARDS).filter(k => k[0] === 't'), rng) };
    Object.assign(s, { pot: 0, pend: null, aq: [], debts: [], mdec: [], trades: [], stats: {}, winner: null, turn: 0, turnN: 1, phase: 'play', started: now });
    s.ts = { roll: true, rolled: false, dbl: 0, hustle: false };
    s.deadline = s.settings.timeLimit ? now + s.settings.timeLimit * 60000 : 0;
    s.turnEnd = s.settings.turnSec ? now + s.settings.turnSec * 1000 : 0;
    fx(s, { t: 'start' });
    if (s.settings.startDeeds) {
      const deeds = shuffle(OWNABLE.slice(), rng);
      s.players.forEach(p => deeds.splice(0, 3).forEach(pos => { s.props[pos].o = p.id; fx(s, { t: 'buy', p: p.id, pos, a: 0, deal: 1 }); }));
      log(s, 'Everyone is dealt three title deeds');
    }
    fx(s, { t: 'turn', p: cur(s).id });
    log(s, `Game on. ${cur(s).name} rolls first`);
  },
  roll(s, id, a, now, rng) {
    const p = mustTurn(s, id);
    if (s.pend || s.debts.length) fail('Finish the current step first');
    if (pendingLifts(s, id).length) fail('Decide on your mortgaged property first');
    if (!s.ts.roll) fail('You already rolled');
    const speed = s.settings.speedDie && p.lap && !p.jail;
    const d = [die(rng), die(rng)];
    if (speed) d.push(die(rng));
    const sum = d[0] + d[1], dbl = d[0] === d[1], sp = speed ? SPEED[d[2] - 1] : null;
    s.dice = d; s.ts.rolled = true;
    fx(s, { t: 'dice', p: id, d });
    if (p.jail) {
      s.ts.roll = false;
      if (dbl) { p.jail = false; p.jt = 0; log(s, `${p.name} rolls doubles and walks out of jail`); moveSteps(s, p, sum, rng); return; }
      p.jt++;
      if (p.jt >= (s.settings.quickJail ? 1 : 3)) {
        p.jail = false; p.jt = 0;
        log(s, `${p.name} has to leave jail and pays the ${$(50)} fine`);
        pay(s, p, 50, 'pot', 'the jail fine');
        moveSteps(s, p, sum, rng);
        return;
      }
      log(s, `${p.name} stays in jail`);
      return;
    }
    if (dbl && sp === d[0]) {
      s.ts.roll = false; s.ts.dbl = 0;
      s.pend = { k: 'warp', p: id };
      fx(s, { t: 'triple', p: id });
      log(s, `${p.name} rolls triples and can go anywhere`);
      return;
    }
    if (dbl) {
      stat(s, id, 'doubles');
      s.ts.dbl++;
      if (s.ts.dbl === 3) { log(s, `${p.name} rolls doubles three times in a row`); sendJail(s, p); return; }
      s.ts.roll = true;
    } else s.ts.roll = false;
    if (sp === 'B') { s.pend = { k: 'bus', p: id, opts: [...new Set([d[0], d[1], sum])] }; return; }
    if (sp === 'H') s.ts.hustle = true;
    moveSteps(s, p, sum + (typeof sp === 'number' ? sp : 0), rng);
  },
  bus(s, id, a, now, rng) {
    const pd = mustPend(s, id, 'bus'), n = a.n | 0;
    if (!pd.opts.includes(n)) fail('Pick one of the bus options');
    s.pend = null;
    moveSteps(s, P(s, id), n, rng);
  },
  warp(s, id, a, now, rng) {
    mustPend(s, id, 'warp');
    const p = P(s, id), pos = a.pos | 0;
    if (pos < 0 || pos > 39 || pos === p.pos) fail('Pick another square');
    s.pend = null;
    log(s, `${p.name} jumps to ${BOARD[pos].n}`);
    moveTo(s, p, pos, rng);
  },
  tax(s, id, a) {
    mustPend(s, id, 'tax');
    const p = P(s, id), pct = Math.floor(taxWorth(s, p) / 10), amt = a.pick === 'pct' ? pct : 200;
    s.pend = null;
    log(s, `${p.name} pays ${$(amt)} adulting tax`);
    pay(s, p, amt, 'pot', 'adulting tax');
  },
  payJail(s, id) {
    const p = mustTurn(s, id);
    if (!p.jail || s.ts.rolled) fail('You can only pay before rolling');
    if (p.cash < 50) fail('Not enough cash');
    settle(s, p, 50, 'pot'); p.jail = false; p.jt = 0;
    fx(s, { t: 'free', p: id });
    log(s, `${p.name} pays ${$(50)} to leave jail`);
  },
  useCard(s, id) {
    const p = mustTurn(s, id);
    if (!p.jail || s.ts.rolled) fail('You can only use it before rolling');
    if (!p.goojf.length) fail('You have no card');
    const dk = p.goojf.pop();
    s.decks[dk].push(dk === 'F' ? 'f9' : 't5');
    p.jail = false; p.jt = 0;
    fx(s, { t: 'free', p: id, card: 1 });
    log(s, `${p.name} uses a get-out-of-jail card`);
  },
  buy(s, id) {
    const p = mustTurn(s, id);
    if (!s.pend || s.pend.k !== 'buy' || s.pend.p !== id) fail('Nothing to buy');
    const sq = BOARD[s.pend.pos];
    if (p.cash < sq.price) fail('Not enough cash. Raise funds or send it to auction');
    addCash(s, p, -sq.price);
    s.props[s.pend.pos].o = id;
    stat(s, id, 'bought');
    fx(s, { t: 'buy', p: id, pos: s.pend.pos, a: sq.price });
    log(s, `${p.name} buys ${sq.n} for ${$(sq.price)}`);
    (s.ts.done ||= []).push(s.pend.pos); // buying uses up this landing for the land-and-build rules
    s.pend = null;
  },
  decline(s, id, a, now) {
    const p = mustTurn(s, id);
    if (!s.pend || s.pend.k !== 'buy' || s.pend.p !== id) fail('Nothing to decline');
    const pos = s.pend.pos;
    s.pend = null;
    if (s.settings.auctions) startAuction(s, pos, now);
    else log(s, `${p.name} passes on ${BOARD[pos].n}`);
  },
  bid(s, id, a, now) {
    const p = mustPlayer(s, id), au = s.pend;
    if (!au || (au.k !== 'auc' && au.k !== 'bauc')) fail('No auction running');
    if (au.out.includes(id)) fail('You already dropped out');
    if (au.by === id) fail('You already hold the top bid');
    const amt = Math.floor(+a.amt);
    if (!(amt > au.bid)) fail('Bid more than ' + $(au.bid));
    if (amt > p.cash) fail('You only have ' + $(p.cash));
    au.bid = amt; au.by = id; au.n++;
    // while a screen has yet to show it, a bid never shortens the wait but always leaves time to answer
    au.end = onAllScreens(s, au) ? now + AUC_RESET : Math.max(au.end, now + AUC_RESET);
    fx(s, { t: 'bid', p: id, a: amt });
  },
  pass(s, id) {
    mustPlayer(s, id);
    const au = s.pend;
    if (!au || (au.k !== 'auc' && au.k !== 'bauc')) fail('No auction running');
    if (au.by === id) fail('You hold the top bid');
    if (!au.out.includes(id)) au.out.push(id);
    const left = alive(s).filter(p => !au.out.includes(p.id));
    if (left.length === 0 || (left.length === 1 && left[0].id === au.by)) resolveAuction(s);
  },
  // a player's screen now shows the auction; its clock starts once every human player still in has it on screen
  aucShown(s, id, a, now) {
    mustPlayer(s, id);
    const au = s.pend;
    if (!au || (au.k !== 'auc' && au.k !== 'bauc') || (au.shown ||= []).includes(id)) return;
    au.shown.push(id);
    if (onAllScreens(s, au)) au.end = now + (au.n ? AUC_RESET : AUC_START);
  },
  build(s, id, a, now) {
    const p = mustPlayer(s, id), pos = a.pos | 0;
    const e = canBuild(s, id, pos); if (e) fail(e);
    const pr = s.props[pos], top = maxHouses(s), kind = pr.h === top ? 'H' : 'h', won = spareFor(s, id, pos);
    if (!won && s.settings.limited) {
      // housing shortage: the bank's last house or hotel always goes to auction, open to everyone
      if (stock(s)[kind] === 1) {
        if (s.pend) fail('Buildings are short. Wait for the current step, then they go to auction');
        s.pend = { k: 'bauc', kind, bid: 0, by: null, end: now + AUC_START, out: [], n: 0 };
        fx(s, { t: 'auc', kind });
        log(s, `The bank's last ${kind === 'H' ? 'hotel' : 'house'} goes to auction`);
        return;
      }
    }
    if (won) p.inv[kind].pop(); else addCash(s, p, -BOARD[pos].hc);
    if (s.settings.landAny) (s.ts.done ||= []).push(pos); // one house per landing
    pr.h = kind === 'H' ? 5 : pr.h + 1;
    stat(s, id, 'built');
    fx(s, { t: 'build', p: id, pos });
    log(s, `${p.name} builds ${pr.h === 5 ? 'a hotel' : 'a house'} on ${BOARD[pos].n}`);
  },
  sell(s, id, a) {
    const p = mustPlayer(s, id), pos = a.pos | 0;
    const e = canSell(s, id, pos); if (e) fail(e);
    const pr = s.props[pos], half = BOARD[pos].hc / 2, top = maxHouses(s);
    if (pr.h === 5) {
      const k = s.settings.limited ? Math.min(top, stock(s).h) : top;
      pr.h = k; addCash(s, p, (top + 1 - k) * half);
    } else { pr.h--; addCash(s, p, half); }
    fx(s, { t: 'sell', p: id, pos });
    log(s, `${p.name} sells a building on ${BOARD[pos].n}`);
  },
  mortgage(s, id, a) {
    const p = mustPlayer(s, id), pos = a.pos | 0;
    const e = canMortgage(s, id, pos); if (e) fail(e);
    s.props[pos].m = true; addCash(s, p, BOARD[pos].price / 2);
    fx(s, { t: 'mort', p: id, pos, m: true });
    log(s, `${p.name} mortgages ${BOARD[pos].n}`);
  },
  unmortgage(s, id, a) {
    const p = mustPlayer(s, id), pos = a.pos | 0;
    const e = canUnmortgage(s, id, pos); if (e) fail(e);
    s.props[pos].m = false; addCash(s, p, -unmortgageCost(pos));
    fx(s, { t: 'mort', p: id, pos, m: false });
    log(s, `${p.name} lifts the mortgage on ${BOARD[pos].n}`);
  },
  // Mortgaged property received from someone else: the 10% is already paid,
  // so lifting it right away costs only the mortgage value.
  lift(s, id, a) {
    const p = mustPlayer(s, id), pos = a.pos | 0;
    const i = s.mdec.findIndex(x => x.p === id && x.pos === pos);
    if (i < 0) fail('Nothing to decide');
    if (a.now) {
      const c = BOARD[pos].price / 2;
      if (p.cash < c) fail('Not enough cash');
      addCash(s, p, -c); s.props[pos].m = false;
      fx(s, { t: 'mort', p: id, pos, m: false });
      log(s, `${p.name} lifts the mortgage on ${BOARD[pos].n}`);
    }
    s.mdec.splice(i, 1);
  },
  payDebt(s, id) {
    const p = mustPlayer(s, id);
    const mine = s.debts.filter(d => d.p === id);
    if (!mine.length) fail('You owe nothing');
    const total = mine.reduce((t, d) => t + d.a, 0);
    if (p.cash < total) fail('You still need ' + $(total - p.cash));
    s.debts = s.debts.filter(d => d.p !== id);
    mine.forEach(d => settle(s, p, d.a, d.to));
    log(s, `${p.name} pays off ${$(total)}`);
  },
  bankrupt(s, id) {
    const p = mustPlayer(s, id);
    const mine = s.debts.filter(d => d.p === id);
    if (!mine.length) fail('You can only declare bankruptcy while in debt');
    const tos = [...new Set(mine.map(d => d.to))];
    const heir = tos.length === 1 && tos[0] !== 'bank' && tos[0] !== 'pot' ? P(s, tos[0]) : null;
    const props = OWNABLE.filter(pos => s.props[pos].o === id);
    removePlayerAssets(s, p, heir && !heir.out ? heir : null);
    fx(s, { t: 'bust', p: id, heir: heir ? heir.id : null, props });
    log(s, `${p.name} is bankrupt${heir ? ' and everything goes to ' + heir.name : ''}`);
    if (s.settings.quickEnd && alive(s).length > 1) { log(s, 'Quick End: the first bankruptcy ends the game'); endGame(s, null); }
  },
  endTurn(s, id, a, now) {
    mustTurn(s, id);
    if (s.pend || s.debts.length) fail('Finish the current step first');
    if (pendingLifts(s, id).length) fail('Decide on your mortgaged property first');
    if (s.ts.roll) fail('Roll first');
    nextTurn(s, now);
  },
  propose(s, id, a) {
    mustPlayer(s, id);
    const to = P(s, a.to);
    if (!to || to.out || to.id === id) fail('Pick another player');
    const side = x => ({ c: Math.max(0, Math.floor(+(x && x.c) || 0)), j: Math.max(0, Math.floor(+(x && x.j) || 0)), p: [...new Set(((x && Array.isArray(x.p) && x.p) || []).slice(0, 28).map(n => n | 0))] });
    const give = side(a.give), get = side(a.get);
    if (!give.c && !give.j && !give.p.length && !get.c && !get.j && !get.p.length) fail('Add something to the deal');
    const e = tradeSideError(s, id, give, to.id) || tradeSideError(s, to.id, get, id); if (e) fail(e);
    if (s.trades.filter(t => t.from === id).length >= 3) fail('You have 3 open offers already');
    s.tradeN++;
    s.trades.push({ id: s.tradeN, from: id, to: to.id, give, get });
    fx(s, { t: 'offer', p: id, to: to.id, tid: s.tradeN });
    log(s, `${P(s, id).name} sends ${to.name} a trade offer`);
  },
  accept(s, id, a) {
    mustPlayer(s, id);
    const t = s.trades.find(x => x.id === a.tid);
    if (!t || t.to !== id) fail('That offer is gone');
    const e = tradeSideError(s, t.from, t.give, t.to) || tradeSideError(s, t.to, t.get, t.from);
    if (e) { s.trades = s.trades.filter(x => x !== t); fail('Offer no longer valid: ' + e); }
    const A1 = P(s, t.from), B1 = P(s, t.to);
    const fee = list => list.reduce((f, pos) => f + (s.props[pos].m ? interestOn(pos) : 0), 0);
    const feeA = fee(t.get.p), feeB = fee(t.give.p);
    if (A1.cash - t.give.c + t.get.c < feeA) fail(A1.name + ' cannot cover the 10% interest on mortgaged property');
    if (B1.cash - t.get.c + t.give.c < feeB) fail('You cannot cover the 10% interest on mortgaged property');
    const net = t.get.c - t.give.c;
    addCash(s, A1, net); addCash(s, B1, -net);
    t.give.p.forEach(pos => { s.props[pos].o = B1.id; if (s.props[pos].m) s.mdec.push({ p: B1.id, pos }); });
    t.get.p.forEach(pos => { s.props[pos].o = A1.id; if (s.props[pos].m) s.mdec.push({ p: A1.id, pos }); });
    // a street the player gets on a square they landed on this turn counts as that landing's buy
    for (const pos of [...t.give.p, ...t.get.p]) if (s.props[pos].o === cur(s).id && (s.ts.lands || []).includes(pos)) (s.ts.done ||= []).push(pos);
    for (let i = 0; i < t.give.j; i++) B1.goojf.push(A1.goojf.pop());
    for (let i = 0; i < t.get.j; i++) A1.goojf.push(B1.goojf.pop());
    if (feeA) addCash(s, A1, -feeA);
    if (feeB) addCash(s, B1, -feeB);
    s.trades = s.trades.filter(x => x !== t);
    stat(s, A1.id, 'trades'); stat(s, B1.id, 'trades');
    fx(s, { t: 'deal', p: A1.id, to: B1.id, give: t.give.p, get: t.get.p });
    log(s, `${B1.name} accepts ${A1.name}'s trade`);
  },
  counter(s, id, a) {
    mustPlayer(s, id);
    const t = s.trades.find(x => x.id === a.tid);
    if (!t || t.to !== id) fail('That offer is gone');
    s.trades = s.trades.filter(x => x !== t);
    A.propose(s, id, { to: t.from, give: a.give, get: a.get });
  },
  reject(s, id, a) {
    const t = s.trades.find(x => x.id === a.tid);
    if (!t || (t.to !== id && t.from !== id)) fail('That offer is gone');
    s.trades = s.trades.filter(x => x !== t);
    fx(s, { t: 'rejected', p: id, tid: t.id });
    log(s, t.from === id ? `${P(s, id).name} withdraws a trade offer` : `${P(s, id).name} declines a trade offer`);
  },
  kick(s, id, a) {
    mustHost(s, id);
    const p = P(s, a.p);
    if (!p) fail('No such player');
    if (s.phase === 'lobby') { s.players = s.players.filter(x => x !== p); return; }
    if (p.out) fail('Already out');
    for (const k in s.props) if (s.props[k].o === p.id) returnToBank(s, +k);
    removePlayerAssets(s, p, null);
    fx(s, { t: 'bust', p: p.id, heir: null, props: [] });
    log(s, `The host removed ${p.name} from the game`);
  },
  endNow(s, id) {
    mustHost(s, id);
    if (s.phase !== 'play') fail('The game is not running');
    endGame(s, null);
  },
  reset(s, id, a, now) {
    mustHost(s, id);
    const keep = s.players.map(p => blank(p.id, p.name, p.tok, p.bot, p.dice));
    const fresh = newGame(s.host, now);
    Object.assign(s, fresh, { players: keep, settings: s.settings, game: s.game + 1, fxN: s.fxN, logN: s.logN, botN: s.botN });
    log(s, 'Back to the lobby for a new game');
  },
};

// Roughly how long these effects take to play on screen, in ms.
export function animMs(fx) {
  let ms = 0;
  for (const f of fx) {
    if (f.t === 'dice') ms += 1500;
    else if (f.t === 'move') ms += Math.min(f.path.length, 12) * 300 + 450;
    else if (f.t === 'card') ms += 2600;
    else if (f.t === 'rent' || f.t === 'jail' || f.t === 'bust') ms += 1400;
    else if (f.t === 'buy' || f.t === 'build' || f.t === 'deal' || f.t === 'turn' || f.t === 'mort') ms += 700;
  }
  return ms;
}
// A new auction's clock runs from when every player's screen shows it (aucShown). Until then this backstop allows twice
// the estimated animation of the moves that led to it (Auction Only, Hustle), for a player who is away.
function auctionClock(s0, s, now) {
  const a = s.pend, b = s0.pend;
  if (!a || (a.k !== 'auc' && a.k !== 'bauc') || (b && b.k === a.k && b.pos === a.pos && b.kind === a.kind)) return;
  a.end = now + AUC_START + 2 * animMs(s.fx.filter(f => f.i > s0.fxN));
}

export function apply(s0, actor, action, payload, now, rng) {
  if (!Object.hasOwn(A, action)) fail('Unknown action');
  const s = clone(s0);
  const p = Object.assign({}, payload || {}, { _now: now });
  const wasCur = s.phase === 'play' && cur(s) && cur(s).id === actor;
  A[action](s, actor, p, now, rng);
  if (wasCur && action !== 'aucShown' && s.phase === 'play' && s.settings.turnSec && cur(s).id === actor) s.turnEnd = now + s.settings.turnSec * 1000;
  normalize(s, now, rng);
  auctionClock(s0, s, now);
  return s;
}

// Clock-driven events. Returns a new state, or null when nothing changed.
export function tick(s0, now, rng) {
  if (s0.phase !== 'play') return null;
  const auc = s0.pend && (s0.pend.k === 'auc' || s0.pend.k === 'bauc');
  const timeUp = s0.settings.timeLimit && s0.deadline && now >= s0.deadline;
  const aucDone = auc && now >= s0.pend.end;
  const turnOver = s0.settings.turnSec && s0.turnEnd && now >= s0.turnEnd && !s0.debts.length && !auc;
  if (!timeUp && !aucDone && !turnOver) return null;
  const s = clone(s0);
  if (timeUp) { log(s, 'Time is up'); endGame(s, null); return s; }
  if (aucDone) { resolveAuction(s); normalize(s, now, rng); auctionClock(s0, s, now); return s; }
  const c = cur(s), pd = s.pend;
  log(s, `${(pd && P(s, pd.p) || c).name} ran out of time`);
  try {
    if (pd && pd.k === 'buy') A.decline(s, c.id, {}, now);
    else if (pd && pd.k === 'bus') A.bus(s, pd.p, { n: Math.max(...pd.opts) }, now, rng);
    else if (pd && pd.k === 'tax') A.tax(s, pd.p, { pick: taxWorth(s, P(s, pd.p)) / 10 < 200 ? 'pct' : 'flat' });
    else if (pd && pd.k === 'warp') A.warp(s, pd.p, { pos: (P(s, pd.p).pos + 1) % 40 }, now, rng);
    else {
      s.mdec = s.mdec.filter(x => x.p !== c.id);
      if (s.ts.roll) A.roll(s, c.id, {}, now, rng); else nextTurn(s, now);
    }
  } catch (e) {
    if (!(e instanceof GameError)) throw e;
    nextTurn(s, now);
  }
  s.turnEnd = now + s.settings.turnSec * 1000;
  normalize(s, now, rng);
  auctionClock(s0, s, now);
  return s;
}

// A local game (bots or pass & play) skips the lobby.
export function setupLocal(players, settings, now, rng) {
  if (players.length < 2 || players.length > MAX_PLAYERS) fail(`Pick 2 to ${MAX_PLAYERS} players`);
  const s = newGame((players.find(p => !p.bot) || players[0]).id, now);
  Object.assign(s.settings, settings);
  s.players = players.map(p => blank(p.id, p.name, p.tok, p.bot, p.dice));
  return apply(s, s.host, 'start', {}, now, rng);
}
