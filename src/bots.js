// Bot players: given a state and a bot's id, pick its next action (or null to wait).
// Pure functions; `memo` is a per-bot scratch object the caller keeps between calls.
import * as E from './engine.js';

const { BOARD, GROUPS, OWNABLE, STATIONS, UTILS } = E;

const LEVELS = {
  easy: { reserve: 40, greed: 0.9, setBonus: 1.4, bidCap: 0.85, margin: 0, setPenalty: 0, propose: false },
  normal: { reserve: 120, greed: 1.1, setBonus: 1.9, bidCap: 1.1, margin: 30, setPenalty: 600, propose: true },
  hard: { reserve: 100, greed: 1.25, setBonus: 2.5, bidCap: 1.3, margin: 60, setPenalty: 2000, propose: true },
};
const act = (a, p) => ({ a, p: p || {} });
// stable 0..1 noise so the same bot makes the same call about the same thing
const noise = (...k) => { let h = 2166136261; for (const c of k.join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; };

function value(s, id, pos, cfg) {
  const sq = BOARD[pos];
  let v = sq.price;
  if (sq.t === 'prop') {
    const others = GROUPS[sq.g].pos.filter(q => q !== pos).map(q => s.props[q].o);
    const mine = others.filter(o => o === id).length, rivals = new Set(others.filter(o => o && o !== id));
    if (mine === others.length) v *= cfg.setBonus;
    else if (mine && !rivals.size) v *= 1.35;
    if (rivals.size === 1 && others.every(o => o && o !== id)) v *= 1.5; // blocks a rival's set
  } else if (sq.t === 'station') v *= 1 + 0.3 * STATIONS.filter(q => q !== pos && s.props[q].o === id).length;
  else v *= UTILS.some(q => q !== pos && s.props[q].o === id) ? 1.2 : 0.85;
  return v;
}
function danger(s, id) {
  let m = 0;
  for (const pos of OWNABLE) { const pr = s.props[pos]; if (pr.o && pr.o !== id && !pr.m) m = Math.max(m, E.rentFor(s, pos, 8)); }
  return m;
}
const reserveOf = (s, id, cfg) => cfg.reserve + (cfg.propose ? Math.min(500, danger(s, id) * 0.6) : 0);
const unowned = s => OWNABLE.filter(pos => !s.props[pos].o).length;
const inFullSet = (s, id, pos) => BOARD[pos].t === 'prop' && E.ownsGroup(s, id, BOARD[pos].g);

// After `who` gains `gain` and loses `lose`, does it own a full colour set it did not own before?
function completesSet(s, who, gain, lose) {
  const owns = pos => (gain.includes(pos) ? true : lose.includes(pos) ? false : s.props[pos].o === who);
  return gain.some(pos => BOARD[pos].t === 'prop' && GROUPS[BOARD[pos].g].pos.every(owns));
}

function landingScore(s, p, pos, cfg) {
  const sq = BOARD[pos], pr = s.props[pos];
  if (pr) {
    if (!pr.o) return p.cash >= sq.price ? value(s, p.id, pos, cfg) - sq.price * 0.5 : 0;
    if (pr.o === p.id) return 5;
    return -E.rentFor(s, pos, 7);
  }
  if (sq.t === 'tax') return -sq.amt;
  if (sq.t === 'gotojail') return unowned(s) > 10 ? -150 : 40;
  if (sq.t === 'parking') return s.pot;
  if (sq.t === 'go') return 200;
  return -10;
}

// Raise cash: mortgage loose property first, then sell buildings, then mortgage sets.
function raise(s, id, cfg) {
  const keep = pos => value(s, id, pos, cfg) + (inFullSet(s, id, pos) ? 1000 : 0);
  const morts = OWNABLE.filter(pos => !E.canMortgage(s, id, pos)).sort((a, b) => keep(a) - keep(b));
  if (morts.length && !inFullSet(s, id, morts[0])) return act('mortgage', { pos: morts[0] });
  const sells = OWNABLE.filter(pos => !E.canSell(s, id, pos)).sort((a, b) => BOARD[a].hc - BOARD[b].hc);
  if (sells.length) return act('sell', { pos: sells[0] });
  if (morts.length) return act('mortgage', { pos: morts[0] });
  return null;
}

function tradeWorth(s, id, t, cfg) {
  const other = t.from;
  let gain = t.give.c - t.get.c + (t.give.j - t.get.j) * 50;
  for (const pos of t.give.p) gain += value(s, id, pos, cfg) - (s.props[pos].m ? BOARD[pos].price / 2 + E.interestOn(pos) : 0);
  for (const pos of t.get.p) gain -= value(s, id, pos, cfg);
  if (completesSet(s, other, t.get.p, t.give.p) && !completesSet(s, id, t.give.p, t.get.p)) gain -= cfg.setPenalty;
  return gain;
}

function proposeTrade(s, p, cfg, memo) {
  if (!cfg.propose || s.trades.some(t => t.from === p.id) || memo.proposed === s.turnN) return null;
  memo.asked = memo.asked || {};
  const spare = p.cash - reserveOf(s, p.id, cfg);
  for (const g of GROUPS) {
    const mine = g.pos.filter(q => s.props[q].o === p.id);
    const missing = g.pos.filter(q => s.props[q].o !== p.id);
    if (!mine.length || !missing.length || missing.some(q => !s.props[q].o)) continue;
    const holders = new Set(missing.map(q => s.props[q].o));
    if (holders.size !== 1) continue;
    const to = [...holders][0], key = to + ':' + g.n;
    if ((memo.asked[key] ?? -99) > s.turnN - 8) continue;
    // a swap that completes a set for them too is the deal most likely to land
    const swap = OWNABLE.filter(pos => s.props[pos].o === p.id && !g.pos.includes(pos) && !E.tradeSideError(s, p.id, { c: 0, j: 0, p: [pos] }))
      .find(pos => completesSet(s, to, [pos], missing) && !inFullSet(s, p.id, pos));
    const price = missing.reduce((t, q) => t + BOARD[q].price, 0);
    let give = { c: 0, p: [], j: 0 };
    if (swap != null) give = { c: Math.max(0, Math.min(spare, price - BOARD[swap].price + 50)), p: [swap], j: 0 };
    else {
      const c = Math.round(price * (cfg === LEVELS.hard ? 1.7 : 1.5) / 10) * 10;
      if (c > spare) continue;
      give.c = c;
    }
    const get = { c: 0, p: missing, j: 0 };
    if (E.tradeSideError(s, p.id, give, to) || E.tradeSideError(s, to, get, p.id)) continue;
    memo.asked[key] = s.turnN; memo.proposed = s.turnN;
    return act('propose', { to, give, get });
  }
  return null;
}

// Unmortgage, build and trade on the bot's own turn.
function manage(s, p, cfg, memo) {
  const reserve = reserveOf(s, p.id, cfg);
  const lifts = OWNABLE.filter(pos => !E.canUnmortgage(s, p.id, pos) && p.cash - E.unmortgageCost(pos) > reserve * 1.5)
    .sort((a, b) => inFullSet(s, p.id, b) - inFullSet(s, p.id, a));
  if (lifts.length) return act('unmortgage', { pos: lifts[0] });
  if (cfg !== LEVELS.easy || noise(p.id, s.turnN) < 0.6) {
    const lots = OWNABLE.filter(pos => !E.canBuild(s, p.id, pos) && (E.spareFor(s, p.id, pos) || p.cash - BOARD[pos].hc >= reserve));
    const gainOf = pos => { const sq = BOARD[pos], h = s.props[pos].h; return (sq.rent[h === E.maxHouses(s) ? 5 : h + 1] - sq.rent[h]) / sq.hc; };
    if (lots.length) return act('build', { pos: lots.sort((a, b) => gainOf(b) - gainOf(a))[0] });
  }
  return proposeTrade(s, p, cfg, memo);
}

function decide(s, p, pd, cfg) {
  switch (pd.k) {
    case 'buy': {
      const sq = BOARD[pd.pos], after = p.cash - sq.price;
      if (after < 0) return act('decline');
      if (completesSet(s, p.id, [pd.pos], [])) return act('buy');
      const early = unowned(s) > 14;
      const ok = cfg === LEVELS.easy ? noise(p.id, pd.pos, s.turnN) < 0.8 && after > cfg.reserve
        : value(s, p.id, pd.pos, cfg) * cfg.greed >= sq.price && after >= reserveOf(s, p.id, cfg) * (early ? 0.3 : 1);
      return act(ok ? 'buy' : 'decline');
    }
    case 'tax': return act('tax', { pick: E.taxWorth(s, p) / 10 < 200 ? 'pct' : 'flat' });
    case 'bus': {
      const best = pd.opts.slice().sort((a, b) => landingScore(s, p, (p.pos + b) % 40, cfg) - landingScore(s, p, (p.pos + a) % 40, cfg));
      return act('bus', { n: best[0] });
    }
    case 'warp': {
      let best = -1, score = -Infinity;
      for (let pos = 0; pos < 40; pos++) {
        if (pos === p.pos) continue;
        const sc = landingScore(s, p, pos, cfg) + (pos < p.pos ? 200 : 0);
        if (sc > score) { score = sc; best = pos; }
      }
      return act('warp', { pos: best });
    }
  }
  return null;
}

function auctionMove(s, p, cfg, pd) {
  if (pd.out.includes(p.id) || pd.by === p.id) return null;
  // a building is worth bidding on only with a street to put it on
  const worth = pd.k === 'auc' ? value(s, p.id, pd.pos, cfg) * cfg.bidCap : E.buildableLots(s, p.id, pd.kind, { anyTurn: true }).length ? 150 * cfg.bidCap : 0;
  const cap = Math.min(worth * (0.9 + 0.2 * noise(p.id, pd.pos, pd.k)), p.cash - cfg.reserve * 0.5);
  const next = pd.bid + (pd.bid < 100 ? 10 : pd.bid < 400 ? 20 : 50);
  return next <= cap ? act('bid', { amt: next }) : act('pass');
}

export function botAction(s, id, memo = {}) {
  if (s.phase !== 'play') return null;
  const p = E.player(s, id);
  if (!p || p.out || !p.bot) return null;
  const cfg = LEVELS[p.bot] || LEVELS.normal, pd = s.pend;

  const owe = s.debts.filter(d => d.p === id).reduce((t, d) => t + d.a, 0);
  if (owe) return p.cash >= owe ? act('payDebt') : raise(s, id, cfg) || act('bankrupt');
  const lift = E.pendingLifts(s, id)[0];
  if (lift) return act('lift', { pos: lift.pos, now: p.cash - BOARD[lift.pos].price / 2 > reserveOf(s, id, cfg) });
  if (pd && pd.p === id) return decide(s, p, pd, cfg);
  if (pd && (pd.k === 'auc' || pd.k === 'bauc')) return auctionMove(s, p, cfg, pd);
  const offer = s.trades.find(t => t.to === id);
  if (offer) {
    const ok = !E.tradeSideError(s, offer.from, offer.give, id) && !E.tradeSideError(s, id, offer.get, offer.from) && tradeWorth(s, id, offer, cfg) > cfg.margin;
    return act(ok ? 'accept' : 'reject', { tid: offer.id });
  }
  if (E.current(s).id !== id || pd || s.debts.length) return null;

  const m = manage(s, p, cfg, memo);
  if (m) return m;
  if (s.ts.roll) {
    if (p.jail && !s.ts.rolled) {
      const wantOut = unowned(s) > 8;
      if (wantOut && p.goojf.length) return act('useCard');
      if (wantOut && p.cash - 50 > reserveOf(s, id, cfg)) return act('payJail');
    }
    return act('roll');
  }
  return act('endTurn');
}

// The mortgages and building sales that would raise `need` cash, cheapest losses first.
export function raisePlan(s, id, need) {
  const steps = [];
  let t = s;
  while (E.player(t, id).cash < need) {
    const step = raise(t, id, LEVELS.hard);
    if (!step) break;
    t = E.apply(t, id, step.a, step.p, 0, Math.random);
    steps.push(step);
  }
  return { steps, cash: E.player(t, id).cash };
}

// Something safe to do when the chosen action was refused.
export function botFallback(s, id) {
  const p = E.player(s, id), pd = s.pend;
  if (!p || p.out || s.phase !== 'play') return null;
  if (s.debts.some(d => d.p === id)) return act('bankrupt');
  if (pd && (pd.k === 'auc' || pd.k === 'bauc') && !pd.out.includes(id) && pd.by !== id) return act('pass');
  if (E.pendingLifts(s, id).length) return act('lift', { pos: E.pendingLifts(s, id)[0].pos, now: false });
  if (pd && pd.p === id) {
    if (pd.k === 'buy') return act('decline');
    if (pd.k === 'bus') return act('bus', { n: pd.opts[0] });
    if (pd.k === 'tax') return act('tax', { pick: 'flat' });
    if (pd.k === 'warp') return act('warp', { pos: (p.pos + 1) % 40 });
  }
  const offer = s.trades.find(t => t.to === id);
  if (offer) return act('reject', { tid: offer.id });
  if (E.current(s).id === id && !pd) return act(s.ts.roll ? 'roll' : 'endTurn');
  return null;
}

// The next bot move at this table: [id, action] or null.
export function nextBotMove(s, memos) {
  if (s.phase !== 'play') return null;
  const n = s.players.length;
  for (let k = 0; k < n; k++) {
    const p = s.players[(s.turn + k) % n];
    if (!p.bot || p.out) continue;
    const memo = memos[p.id] || (memos[p.id] = {});
    const a = botAction(s, p.id, memo);
    if (a) return [p.id, a];
  }
  return null;
}

// How long an action's effects take to animate, in ms, used to pace bots.
export const paceMs = fxList => Math.max(500, E.animMs(fxList));

