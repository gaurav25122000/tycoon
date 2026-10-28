import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import { botAction } from '../src/bots.js';

const seeded = (seed = 7) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// rng that yields exactly these die faces, then fails loudly
const dice = (...v) => () => { if (!v.length) throw new Error('rng exhausted'); return (v.shift() - 1) / 6 + 1e-6; };

function game(n = 2, settings = {}) {
  const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, tok: i }));
  const s = E.setupLocal(players, settings, 0, seeded());
  s.players.sort((a, b) => a.id.localeCompare(b.id));
  s.turn = 0;
  return s;
}
const act = (s, id, a, p, rng = seeded(), now = 0) => E.apply(s, id, a, p, now, rng);
const own = (s, id, ...pos) => pos.forEach(q => { s.props[q].o = id; });
const pl = (s, id) => E.player(s, id);
const err = (fn, re) => assert.throws(fn, e => e instanceof E.GameError && re.test(e.message));

test('landing on an unowned property offers it; buying takes the money', () => {
  let s = game();
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').pos, 3);
  assert.deepEqual(s.pend, { k: 'buy', pos: 3, p: 'p0' });
  s = act(s, 'p0', 'buy');
  assert.equal(s.props[3].o, 'p0');
  assert.equal(pl(s, 'p0').cash, 1440);
  err(() => act(s, 'p0', 'roll'), /already rolled/);
  s = act(s, 'p0', 'endTurn');
  assert.equal(E.current(s).id, 'p1');
});

test('declining starts an auction; the last bidder standing wins and pays', () => {
  let s = game();
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'decline');
  assert.equal(s.pend.k, 'auc');
  s = act(s, 'p1', 'bid', { amt: 10 });
  err(() => act(s, 'p1', 'bid', { amt: 20 }), /already hold/);
  err(() => act(s, 'p0', 'bid', { amt: 10 }), /more than/);
  s = act(s, 'p0', 'pass');
  assert.equal(s.pend, null);
  assert.equal(s.props[3].o, 'p1');
  assert.equal(pl(s, 'p1').cash, 1490);
});

test('a screen showing an auction does not count as the player acting for the turn timer', () => {
  let s = game(2, { turnSec: 30 });
  pl(s, 'p1').bot = 'easy'; // a bot has no screen to wait for
  s = act(s, 'p0', 'roll', {}, dice(1, 2), 1000);
  s = act(s, 'p0', 'decline', {}, seeded(), 2000);
  const turnEnd = s.turnEnd;
  s = act(s, 'p0', 'aucShown', {}, seeded(), 3000);
  assert.equal(s.turnEnd, turnEnd);
  assert.equal(s.pend.end, 3000 + E.AUC_START);
});

test('an auction closes on its timer', () => {
  let s = game();
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'decline', {}, seeded(), 0);
  s = act(s, 'p0', 'aucShown', {}, seeded(), 500);
  s = act(s, 'p1', 'aucShown', {}, seeded(), 500);
  s = act(s, 'p0', 'bid', { amt: 5 }, seeded(), 1000);
  assert.equal(E.tick(s, 1000 + E.AUC_RESET - 1, seeded()), null);
  s = E.tick(s, 1000 + E.AUC_RESET, seeded());
  assert.equal(s.props[3].o, 'p0');
  assert.equal(pl(s, 'p0').cash, 1495);
});

test('a bid before every screen shows the auction does not start its clock', () => {
  let s = game(3);
  pl(s, 'p2').bot = 'easy';
  s = act(s, 'p0', 'roll', {}, dice(1, 2), 1000);
  s = act(s, 'p0', 'decline', {}, seeded(), 2000);
  assert.equal(s.pend.end, 22000);
  // the bot bids while both screens are still animating: the clock keeps waiting
  s = act(s, 'p2', 'bid', { amt: 10 }, seeded(), 3000);
  assert.equal(s.pend.end, 22000);
  s = act(s, 'p0', 'aucShown', {}, seeded(), 4000);
  assert.equal(s.pend.end, 22000);
  // the last screen shows it at 15s, with a bid already on it: 12 seconds from there
  s = act(s, 'p1', 'aucShown', {}, seeded(), 15000);
  assert.equal(s.pend.end, 27000);
  s = act(s, 'p0', 'bid', { amt: 20 }, seeded(), 16000);
  assert.equal(s.pend.end, 28000);
});

test('with a screen away, a bid late in the wait still leaves 12 seconds to answer it', () => {
  let s = game(3);
  pl(s, 'p2').bot = 'easy';
  s = act(s, 'p0', 'roll', {}, dice(1, 2), 1000);
  s = act(s, 'p0', 'decline', {}, seeded(), 2000);
  s = act(s, 'p0', 'aucShown', {}, seeded(), 3000);
  // p1 never shows it; the wait runs to 22s, and the bot bids at 21s
  s = act(s, 'p2', 'bid', { amt: 10 }, seeded(), 21000);
  assert.equal(s.pend.end, 33000);
});

test('rent: sets double, houses, stations, utilities, mortgages', () => {
  const s = game();
  own(s, 'p1', 1);
  assert.equal(E.rentFor(s, 1, 7), 2);
  own(s, 'p1', 3);
  assert.equal(E.rentFor(s, 1, 7), 4);
  s.props[1].h = 2;
  assert.equal(E.rentFor(s, 1, 7), 30);
  own(s, 'p1', 5);
  assert.equal(E.rentFor(s, 5, 7), 25);
  own(s, 'p1', 15, 25, 35);
  assert.equal(E.rentFor(s, 5, 7), 200);
  own(s, 'p1', 12);
  assert.equal(E.rentFor(s, 12, 7), 28);
  own(s, 'p1', 28);
  assert.equal(E.rentFor(s, 12, 7), 70);
  s.props[28].m = true;
  assert.equal(E.rentFor(s, 28, 7), 0);
});

test('rent moves money from the visitor to the owner', () => {
  let s = game();
  own(s, 'p1', 6, 8, 9);
  s = act(s, 'p0', 'roll', {}, dice(2, 4));
  assert.equal(pl(s, 'p0').cash, 1488);
  assert.equal(pl(s, 'p1').cash, 1512);
});

test('houses go up evenly and four make way for a hotel', () => {
  let s = game();
  own(s, 'p0', 1, 3);
  s = act(s, 'p0', 'build', { pos: 1 });
  err(() => act(s, 'p0', 'build', { pos: 1 }), /evenly/);
  for (let i = 0; i < 7; i++) s = act(s, 'p0', 'build', { pos: i % 2 ? 1 : 3 });
  assert.equal(s.props[1].h, 4);
  assert.equal(s.props[3].h, 4);
  assert.equal(E.stock(s).h, 24);
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.equal(s.props[1].h, 5);
  assert.deepEqual(E.stock(s), { h: 28, H: 11 });
  assert.equal(pl(s, 'p0').cash, 1500 - 9 * 50);
  err(() => act(s, 'p0', 'sell', { pos: 3 }), /evenly/);
  err(() => act(s, 'p0', 'mortgage', { pos: 3 }), /Sell the buildings/);
});

// p2 holds `n` houses and has no cash, so only p0 and p1 can build
function shortage(n, players = 3) {
  const s = game(players);
  own(s, 'p0', 1, 3);
  own(s, 'p1', 6, 8, 9);
  const lots = [11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37];
  own(s, 'p2', ...lots);
  let left = n;
  lots.forEach(q => { const h = Math.min(2, left); s.props[q].h = h; left -= h; });
  pl(s, 'p2').cash = 0;
  return s;
}

test('housing shortage: a rival can win the bank’s last house, keeps it and builds it free on their turn', () => {
  let s = shortage(31);
  assert.equal(E.stock(s).h, 1);
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.equal(s.pend.k, 'bauc');
  s = act(s, 'p1', 'bid', { amt: 60 });
  s = act(s, 'p0', 'pass');
  s = act(s, 'p2', 'pass');
  assert.equal(s.pend, null);
  assert.deepEqual(pl(s, 'p1').inv, { h: [60], H: [] });
  assert.equal(pl(s, 'p1').cash, 1440);
  assert.equal(E.netWorth(s, pl(s, 'p1')), 1440 + 60 + 100 + 100 + 120);
  assert.equal(E.taxWorth(s, pl(s, 'p1')), 1440 + 60 + 100 + 100 + 120);
  // the won house is spoken for: the bank has none left to sell
  assert.equal(E.stock(s).h, 0);
  err(() => act(s, 'p0', 'build', { pos: 1 }), /out of houses/);
  err(() => act(s, 'p1', 'build', { pos: 6 }), /your turn/);
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'endTurn');
  pl(s, 'p1').cash = 0;
  s = act(s, 'p1', 'build', { pos: 6 });
  assert.equal(s.props[6].h, 1);
  assert.equal(pl(s, 'p1').cash, 0);
  assert.deepEqual(pl(s, 'p1').inv, { h: [], H: [] });
  assert.equal(E.stock(s).h, 0);
  assert.equal(s.pend, null);
});

test('the shortage sale is off if the bank runs out before the auction ends', () => {
  let s = shortage(31);
  s = act(s, 'p0', 'build', { pos: 1 });
  s = act(s, 'p1', 'bid', { amt: 60 });
  s.props[11].h = 3; // someone else got the last house meanwhile
  s = act(s, 'p0', 'pass');
  s = act(s, 'p2', 'pass');
  assert.equal(s.pend, null);
  assert.equal(pl(s, 'p1').inv, null);
  assert.equal(pl(s, 'p1').cash, 1500);
});

test('the bank’s last house goes to auction even with No Auctions, and anyone may win it', () => {
  let s = shortage(31);
  s.settings.auctions = false;
  pl(s, 'p2').cash = 500;
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.equal(s.pend.k, 'bauc');
  s = act(s, 'p2', 'bid', { amt: 10 });
  s = act(s, 'p0', 'pass');
  s = act(s, 'p1', 'pass');
  assert.deepEqual(pl(s, 'p2').inv, { h: [10], H: [] });
});

test('building a held house starts no shortage auction, even with the bank down to its last house', () => {
  let s = shortage(30, 4);
  own(s, 'p3', 37, 39);
  pl(s, 'p0').inv = { h: [40], H: [] };
  assert.equal(E.stock(s).h, 1);
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.equal(s.pend, null);
  assert.equal(s.props[1].h, 1);
  assert.equal(pl(s, 'p0').cash, 1500);
  assert.equal(E.stock(s).h, 1);
});

test('a held hotel builds free on a street ready for one; a held house does not pay for a hotel', () => {
  let s = game();
  own(s, 'p0', 1, 3);
  s.props[1].h = 4; s.props[3].h = 4;
  pl(s, 'p0').inv = { h: [50], H: [100] };
  assert.equal(E.stock(s).H, 11);
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.equal(s.props[1].h, 5);
  assert.equal(pl(s, 'p0').cash, 1500);
  assert.deepEqual(pl(s, 'p0').inv, { h: [50], H: [] });
  assert.equal(E.stock(s).H, 11);
  s = act(s, 'p0', 'build', { pos: 3 });
  assert.equal(s.props[3].h, 5);
  assert.equal(pl(s, 'p0').cash, 1450);
  assert.deepEqual(pl(s, 'p0').inv, { h: [50], H: [] });
});

test('a house won at auction is sold back for half its bid if its holder goes bankrupt', () => {
  let s = game(3);
  pl(s, 'p1').inv = { h: [60], H: [] };
  assert.equal(E.stock(s).h, 31);
  s.debts.push({ p: 'p1', a: 9999, to: 'p0', why: 'rent' });
  s = act(s, 'p1', 'bankrupt');
  assert.equal(pl(s, 'p1').inv, null);
  assert.equal(E.stock(s).h, 32);
  assert.equal(pl(s, 'p0').cash, 1500 + 1500 + 30);
});

test('a save from before held pieces turns a pending placement into a held piece', () => {
  const s = game();
  s.pend = { k: 'place', p: 'p1', kind: 'h', paid: 60 };
  delete s.settings.landBuild; delete s.stats;
  const u = E.upgrade(s);
  assert.equal(u.pend, null);
  assert.deepEqual(pl(u, 'p1').inv, { h: [60], H: [] });
  assert.equal(u.settings.landBuild, false);
  assert.deepEqual(u.stats, {});
});

test('a bot with nowhere to put the bank’s last house does not bid on it', () => {
  let s = shortage(31, 4);
  pl(s, 'p3').bot = 'hard';
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.equal(botAction(s, 'p3').a, 'pass');
});

test('a bot builds a house it won at auction even with no cash to spare', () => {
  const s = game();
  pl(s, 'p0').bot = 'hard';
  own(s, 'p0', 1, 3);
  pl(s, 'p0').cash = 0; pl(s, 'p0').inv = { h: [50], H: [] };
  assert.equal(botAction(s, 'p0').a, 'build');
});

test('everyone builds on their own turn only', () => {
  let s = game();
  own(s, 'p0', 1, 3);
  own(s, 'p1', 6, 8, 9);
  err(() => act(s, 'p1', 'build', { pos: 6 }), /your turn/);
  s = act(s, 'p0', 'build', { pos: 1 });
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'endTurn');
  err(() => act(s, 'p0', 'build', { pos: 3 }), /your turn/);
  s = act(s, 'p1', 'build', { pos: 6 });
  assert.equal(s.props[6].h, 1);
});

test('Build Where You Land: only on streets landed on this turn', () => {
  let s = game(2, { landBuild: true });
  own(s, 'p0', 1, 3);
  err(() => act(s, 'p0', 'build', { pos: 3 }), /where you landed/);
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').pos, 3);
  err(() => act(s, 'p0', 'build', { pos: 1 }), /where you landed/);
  s = act(s, 'p0', 'build', { pos: 3 });
  assert.equal(s.props[3].h, 1);
  s = act(s, 'p0', 'endTurn');
  s = act(s, 'p1', 'roll', {}, dice(1, 3));
  s = act(s, 'p1', 'endTurn');
  // still standing there next turn is not landing there
  err(() => act(s, 'p0', 'build', { pos: 3 }), /where you landed/);
});

test('Build Where You Land: every landing of a doubles turn counts, and it limits held pieces too', () => {
  let s = game(2, { landBuild: true });
  own(s, 'p0', 6, 8, 9);
  pl(s, 'p0').inv = { h: [50], H: [] };
  s = act(s, 'p0', 'roll', {}, dice(3, 3));
  s = act(s, 'p0', 'roll', {}, dice(1, 1));
  assert.equal(pl(s, 'p0').pos, 8);
  err(() => act(s, 'p0', 'build', { pos: 9 }), /where you landed/);
  s = act(s, 'p0', 'build', { pos: 6 });
  assert.deepEqual(pl(s, 'p0').inv, { h: [], H: [] });
  s = act(s, 'p0', 'build', { pos: 8 });
  assert.equal(s.props[6].h + s.props[8].h, 2);
  assert.equal(pl(s, 'p0').cash, 1450);
});

test('Build Where You Land: the landing that buys a street does not build on it', () => {
  let s = game(2, { landBuild: true });
  own(s, 'p0', 3);
  pl(s, 'p0').pos = 38;
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'buy');
  assert.ok(E.ownsGroup(s, 'p0', 0));
  err(() => act(s, 'p0', 'build', { pos: 1 }), /Land here again/);
});

test('Land and Build: one house per landing on any street you own, full set or not', () => {
  let s = game(2, { landAny: true });
  own(s, 'p0', 3);
  err(() => act(s, 'p0', 'build', { pos: 3 }), /where you landed/);
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'build', { pos: 3 });
  assert.equal(s.props[3].h, 1);
  err(() => act(s, 'p0', 'build', { pos: 3 }), /Land here again/);
  s = act(s, 'p0', 'endTurn');
  s = act(s, 'p1', 'roll', {}, dice(1, 3));
  s = act(s, 'p1', 'endTurn');
  pl(s, 'p0').pos = 0;
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'build', { pos: 3 });
  assert.equal(s.props[3].h, 2);
  assert.equal(pl(s, 'p0').cash, 1500 - 100);
});

test('Land and Build: buying a street uses up that landing', () => {
  let s = game(2, { landAny: true });
  pl(s, 'p0').pos = 38;
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'buy');
  err(() => act(s, 'p0', 'build', { pos: 1 }), /Land here again/);
});

test('Land and Build: one owner’s buildings do not block another owner of the same set', () => {
  let s = game(2, { landAny: true });
  own(s, 'p0', 1);
  own(s, 'p1', 3);
  s.props[1].h = 2;
  err(() => act(s, 'p0', 'mortgage', { pos: 1 }), /Sell the buildings/);
  s = act(s, 'p1', 'mortgage', { pos: 3 });
  assert.equal(s.props[3].m, true);
  assert.equal(E.tradeSideError(s, 'p1', { c: 0, j: 0, p: [3] }), '');
});

test('Build Where You Land and Land and Build: switching one on switches the other off', () => {
  let s = E.newGame('h', 0);
  s = act(s, 'h', 'settings', { landBuild: true });
  s = act(s, 'h', 'settings', { landAny: true });
  assert.deepEqual([s.settings.landBuild, s.settings.landAny], [false, true]);
  s = act(s, 'h', 'settings', { landBuild: true });
  assert.deepEqual([s.settings.landBuild, s.settings.landAny], [true, false]);
});

test('speed die: Hustle pays rent first, then moves on and collects $200 passing Start', () => {
  let s = game(2, { speedDie: true });
  pl(s, 'p0').lap = true;
  pl(s, 'p0').pos = 36;
  own(s, 'p1', 37, 39);
  s = act(s, 'p0', 'roll', {}, dice(1, 2, 4));
  assert.equal(pl(s, 'p0').pos, 1);
  assert.deepEqual(s.pend, { k: 'buy', pos: 1, p: 'p0' });
  // Speed Die games start with $2,500
  assert.equal(pl(s, 'p0').cash, 2500 - 100 + 200);
  assert.equal(pl(s, 'p1').cash, 2500 + 100);
});

test('an auction opened by a move starts its clock once that move has played on every screen', () => {
  let s = game(2, { speedDie: true, auctionOnly: true });
  pl(s, 'p0').lap = true;
  pl(s, 'p0').pos = 36;
  own(s, 'p1', 37, 39);
  s = act(s, 'p0', 'roll', {}, dice(1, 2, 4), 5000);
  assert.deepEqual([s.pend.k, s.pend.pos], ['auc', 1]);
  // until a screen shows it: twice the dice 1.5s, the walk to Mumbai 1.35s, its rent 1.4s, the Hustle walk past Start 1.05s
  assert.equal(s.pend.end, 5000 + E.AUC_START + 2 * (1500 + 1350 + 1400 + 1050));
  // one screen shows it at 14s, the other at 15s: from the last one it runs its usual 20 seconds
  s = act(s, 'p1', 'aucShown', {}, seeded(), 14000);
  assert.equal(s.pend.end, 5000 + E.AUC_START + 2 * (1500 + 1350 + 1400 + 1050));
  s = act(s, 'p0', 'aucShown', {}, seeded(), 15000);
  assert.equal(s.pend.end, 15000 + E.AUC_START);
  s = act(s, 'p1', 'aucShown', {}, seeded(), 16000);
  assert.equal(s.pend.end, 15000 + E.AUC_START);
});

test('speed die: Hustle with nowhere to go stays put and plays no Hustle', () => {
  let s = game(2, { speedDie: true });
  pl(s, 'p0').lap = true;
  E.OWNABLE.forEach(q => { s.props[q].o = 'p1'; s.props[q].m = true; });
  s = act(s, 'p0', 'roll', {}, dice(1, 2, 4));
  assert.equal(pl(s, 'p0').pos, 3);
  assert.ok(!s.fx.some(f => f.t === 'hustle'));
});

test('the land-and-build rules: winning a street at auction uses up that landing too', () => {
  for (const rule of ['landBuild', 'landAny']) {
    let s = game(2, { [rule]: true });
    own(s, 'p0', 3);
    pl(s, 'p0').pos = 38;
    s = act(s, 'p0', 'roll', {}, dice(1, 2));
    s = act(s, 'p0', 'decline');
    s = act(s, 'p0', 'bid', { amt: 10 });
    s = act(s, 'p1', 'pass');
    assert.equal(s.props[1].o, 'p0');
    err(() => act(s, 'p0', 'build', { pos: 1 }), /Land here again/);
  }
});

test('the land-and-build rules: a street traded to you where you landed waits for the next landing', () => {
  for (const rule of ['landBuild', 'landAny']) {
    let s = game(2, { [rule]: true });
    own(s, 'p0', 1);
    own(s, 'p1', 3);
    s = act(s, 'p0', 'roll', {}, dice(1, 2));
    s = act(s, 'p0', 'propose', { to: 'p1', give: { c: 200 }, get: { p: [3] } });
    s = act(s, 'p1', 'accept', { tid: s.tradeN });
    err(() => act(s, 'p0', 'build', { pos: 3 }), /Land here again/);
  }
});

test('Land and Build: landing on the same street again in one turn allows another house', () => {
  let s = game(2, { landAny: true });
  own(s, 'p0', 39);
  pl(s, 'p0').pos = 31;
  s.decks.F = ['f2'];
  s = act(s, 'p0', 'roll', {}, dice(4, 4));
  s = act(s, 'p0', 'build', { pos: 39 });
  s = act(s, 'p0', 'roll', {}, dice(4, 4));
  assert.equal(pl(s, 'p0').pos, 39);
  s = act(s, 'p0', 'build', { pos: 39 });
  assert.equal(s.props[39].h, 2);
});

test('Land and Build: going to jail ends that turn’s landings', () => {
  let s = game(2, { landAny: true });
  own(s, 'p0', 6, 8);
  s = act(s, 'p0', 'roll', {}, dice(3, 3));
  s = act(s, 'p0', 'roll', {}, dice(1, 1));
  s = act(s, 'p0', 'roll', {}, dice(1, 1));
  assert.equal(pl(s, 'p0').jail, true);
  err(() => act(s, 'p0', 'build', { pos: 6 }), /where you landed/);
});

test('Land and Build: selling and building look only at your own streets in a set', () => {
  let s = game(2, { landAny: true });
  own(s, 'p0', 1);
  own(s, 'p1', 3);
  s.props[1].h = 1; s.props[3].h = 3;
  s = act(s, 'p0', 'sell', { pos: 1 });
  assert.equal(s.props[1].h, 0);
  s.props[1].h = 1; Object.assign(s.props[3], { h: 0, m: true });
  pl(s, 'p0').pos = 38;
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.equal(s.props[1].h, 2);
});

test('Land and Build: a mortgaged street cannot be traded to a player with buildings in its set', () => {
  const s = game(2, { landAny: true });
  own(s, 'p0', 1);
  own(s, 'p1', 3);
  s.props[1].h = 2; s.props[3].m = true;
  err(() => act(s, 'p0', 'propose', { to: 'p1', give: { c: 10 }, get: { p: [3] } }), /Lift the mortgage on/);
});

test('only the bank’s last house goes to auction, however many players could build', () => {
  let s = shortage(30);
  pl(s, 'p2').cash = 1500; // all three can build and the bank has two houses left
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.equal(s.pend, null);
  assert.equal(s.props[1].h, 1);
  s = act(s, 'p0', 'build', { pos: 3 });
  assert.equal(s.pend.k, 'bauc');
  assert.equal(s.props[3].h, 0);
});

test('selling a hotel when the bank is short of houses pays for what cannot come back', () => {
  let s = game();
  own(s, 'p0', 37, 39);
  s.props[37].h = 5; s.props[39].h = 4;
  own(s, 'p1', 1, 3, 6, 8, 9, 11, 13, 14);
  [1, 3, 6, 8, 9, 11, 13].forEach(q => { s.props[q].h = 4; });
  assert.equal(E.stock(s).h, 0);
  s = act(s, 'p0', 'sell', { pos: 37 });
  assert.equal(s.props[37].h, 0);
  assert.equal(pl(s, 'p0').cash, 1500 + 5 * 100);
});

test('mortgages: half the price, no rent, 110% to lift', () => {
  let s = game();
  own(s, 'p1', 1);
  s = act(s, 'p1', 'mortgage', { pos: 1 });
  assert.equal(pl(s, 'p1').cash, 1530);
  assert.equal(E.rentFor(s, 1, 7), 0);
  s = act(s, 'p1', 'unmortgage', { pos: 1 });
  assert.equal(pl(s, 'p1').cash, 1497);
});

test('trading away mortgaged property: the receiver pays 10% now and may lift it for the mortgage value', () => {
  let s = game();
  own(s, 'p0', 6);
  s.props[6].m = true;
  s = act(s, 'p0', 'propose', { to: 'p1', give: { p: [6] }, get: { c: 10 } });
  s = act(s, 'p1', 'accept', { tid: 1 });
  assert.equal(s.props[6].o, 'p1');
  assert.equal(pl(s, 'p1').cash, 1485);
  assert.equal(pl(s, 'p0').cash, 1510);
  assert.deepEqual(s.mdec, [{ p: 'p1', pos: 6 }]);
  s.turn = 1;
  err(() => act(s, 'p1', 'roll'), /mortgaged property/);
  s = act(s, 'p1', 'lift', { pos: 6, now: true });
  assert.equal(s.props[6].m, false);
  assert.equal(pl(s, 'p1').cash, 1435);
  assert.deepEqual(s.mdec, []);
});

test('keeping a received mortgage means paying the full 110% later', () => {
  let s = game();
  own(s, 'p0', 6);
  s.props[6].m = true;
  s = act(s, 'p0', 'propose', { to: 'p1', give: { p: [6] }, get: {} });
  s = act(s, 'p1', 'accept', { tid: 1 });
  s = act(s, 'p1', 'lift', { pos: 6, now: false });
  assert.equal(s.props[6].m, true);
  s = act(s, 'p1', 'unmortgage', { pos: 6 });
  assert.equal(pl(s, 'p1').cash, 1500 - 5 - 55);
});

test('trades swap cash, property and jail cards, but not property in a built set', () => {
  let s = game();
  own(s, 'p0', 1, 3, 5);
  s.props[1].h = 1;
  pl(s, 'p0').goojf = ['F'];
  err(() => act(s, 'p0', 'propose', { to: 'p1', give: { p: [3] }, get: {} }), /Sell the buildings/);
  s = act(s, 'p0', 'propose', { to: 'p1', give: { p: [5], j: 1 }, get: { c: 250 } });
  s = act(s, 'p1', 'accept', { tid: 1 });
  assert.equal(s.props[5].o, 'p1');
  assert.deepEqual(pl(s, 'p1').goojf, ['F']);
  assert.equal(pl(s, 'p0').cash, 1750);
  assert.equal(pl(s, 'p1').cash, 1250);
});

test('bankruptcy to a player hands over everything, buildings sold at half, mortgages with 10%', () => {
  let s = game(3);
  own(s, 'p0', 1, 3, 5);
  s.props[1].h = 2; s.props[3].h = 2;
  s.props[5].m = true;
  pl(s, 'p0').cash = 10;
  pl(s, 'p0').goojf = ['T'];
  s.debts.push({ p: 'p0', a: 500, to: 'p1', why: 'rent' });
  s = act(s, 'p0', 'bankrupt');
  const p1 = pl(s, 'p1');
  assert.equal(pl(s, 'p0').out, true);
  assert.equal(p1.cash, 1500 + 10 + 4 * 25 - 10);
  assert.deepEqual([1, 3, 5].map(q => s.props[q].o), ['p1', 'p1', 'p1']);
  assert.equal(s.props[1].h, 0);
  assert.deepEqual(p1.goojf, ['T']);
  assert.deepEqual(s.mdec, [{ p: 'p1', pos: 5 }]);
  assert.equal(s.phase, 'play');
});

test('bankruptcy to the bank sends property back for auction', () => {
  let s = game(3);
  own(s, 'p0', 1, 3);
  s.debts.push({ p: 'p0', a: 5000, to: 'bank', why: 'tax' });
  s = act(s, 'p0', 'bankrupt');
  assert.equal(s.props[1].o, null);
  assert.equal(s.pend.k, 'auc');
  assert.equal(s.pend.pos, 1);
  assert.deepEqual(s.aq, [3]);
});

test('jail: doubles walk out without another roll; three misses pay $50 and move', () => {
  let s = game();
  Object.assign(pl(s, 'p0'), { jail: true, pos: 10 });
  own(s, 'p1', 16);
  s = act(s, 'p0', 'roll', {}, dice(3, 3));
  assert.equal(pl(s, 'p0').jail, false);
  assert.equal(pl(s, 'p0').pos, 16);
  assert.equal(s.ts.roll, false);

  s = game();
  Object.assign(pl(s, 'p0'), { jail: true, pos: 10, jt: 1 });
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').jail, true);
  assert.equal(pl(s, 'p0').jt, 2);

  s = game();
  Object.assign(pl(s, 'p0'), { jail: true, pos: 10, jt: 2 });
  own(s, 'p1', 13);
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').jail, false);
  assert.equal(pl(s, 'p0').pos, 13);
  assert.equal(pl(s, 'p0').cash, 1500 - 50 - 10);
});

test('jail: pay the fine or use a card before rolling', () => {
  let s = game();
  Object.assign(pl(s, 'p0'), { jail: true, pos: 10, goojf: ['F'] });
  s = act(s, 'p0', 'payJail');
  assert.equal(pl(s, 'p0').jail, false);
  assert.equal(pl(s, 'p0').cash, 1450);

  s = game();
  s.decks.F = s.decks.F.filter(c => c !== 'f9');
  Object.assign(pl(s, 'p0'), { jail: true, pos: 10, goojf: ['F'] });
  s = act(s, 'p0', 'useCard');
  assert.equal(pl(s, 'p0').jail, false);
  assert.equal(s.decks.F.at(-1), 'f9');
});

test('three doubles in a row go to jail', () => {
  let s = game();
  E.OWNABLE.forEach(q => { s.props[q].o = 'p0'; });
  s.decks.T = ['t15', 't15'];
  s = act(s, 'p0', 'roll', {}, dice(1, 1));
  s = act(s, 'p0', 'roll', {}, dice(2, 2));
  s = act(s, 'p0', 'roll', {}, dice(3, 3));
  assert.equal(pl(s, 'p0').jail, true);
  assert.equal(pl(s, 'p0').pos, 10);
  assert.equal(s.ts.roll, false);
});

test('Start pays $200 when passed, $400 on the double salary rule, nothing on the way to jail', () => {
  let s = game();
  own(s, 'p0', 1);
  pl(s, 'p0').pos = 38;
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').cash, 1700);

  s = game(2, { doubleGo: true });
  pl(s, 'p0').pos = 37;
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').cash, 1900);

  s = game();
  pl(s, 'p0').pos = 27;
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').pos, 10);
  assert.equal(pl(s, 'p0').cash, 1500);
});

test('a card that sends you to a square names it', () => {
  for (const [id, c] of Object.entries(E.CARDS)) if (c.fx.k === 'to') assert.ok(c.tx.includes(E.BOARD[c.fx.to].n), `${id}: ${c.tx}`);
});

test('doubles into a debt: once it is paid, the extra roll waits for the player', () => {
  let s = game();
  s.props[6].o = 'p1'; s.props[6].h = 2;
  own(s, 'p0', 5);
  pl(s, 'p0').cash = 20;
  s = act(s, 'p0', 'roll', {}, dice(3, 3));
  assert.equal(s.debts.length, 1);
  s = act(s, 'p0', 'mortgage', { pos: 5 });
  s = act(s, 'p0', 'payDebt');
  assert.deepEqual([pl(s, 'p0').cash, pl(s, 'p1').cash, s.ts.roll, E.current(s).id], [30, 1590, true, 'p0']);
  assert.equal(E.tick(s, 3600000, seeded()), null); // no turn timer, so nothing rolls for them
});

test('cards: nearest station at double rent, nearest utility at 10x a new roll, back three, repairs, birthdays', () => {
  let s = game();
  own(s, 'p1', 15);
  pl(s, 'p0').pos = 4;
  s.decks.F = ['f5'];
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').pos, 15);
  assert.equal(pl(s, 'p0').cash, 1450);

  s = game();
  own(s, 'p1', 12);
  pl(s, 'p0').pos = 4;
  s.decks.F = ['f7'];
  s = act(s, 'p0', 'roll', {}, dice(1, 2, 3, 4));
  assert.equal(pl(s, 'p0').cash, 1430);

  s = game();
  pl(s, 'p0').pos = 4;
  s.decks.F = ['f10'];
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').pos, 4);
  assert.equal(pl(s, 'p0').cash, 1300);

  s = game();
  own(s, 'p0', 1, 3, 37, 39);
  s.props[1].h = 2; s.props[3].h = 2; s.props[37].h = 5;
  pl(s, 'p0').pos = 4;
  s.decks.F = ['f12'];
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').cash, 1500 - 4 * 25 - 100);

  s = game(3);
  s.decks.T = ['t9'];
  s = act(s, 'p0', 'roll', {}, dice(1, 1));
  assert.equal(pl(s, 'p0').cash, 1520);
  assert.equal(pl(s, 'p2').cash, 1490);
});

test('classic income tax: pick $200 or 10% of everything you own', () => {
  let s = game(2, { incomeTax: true });
  own(s, 'p0', 39);
  s = act(s, 'p0', 'roll', {}, dice(1, 3));
  assert.deepEqual(s.pend, { k: 'tax', p: 'p0' });
  s = act(s, 'p0', 'tax', { pick: 'pct' });
  assert.equal(pl(s, 'p0').cash, 1500 - 190);
  assert.equal(s.pend, null);
});

test('speed die: off before the first lap, numbers add, triples go anywhere', () => {
  let s = game(2, { speedDie: true });
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(s.dice.length, 2);

  s = game(2, { speedDie: true });
  pl(s, 'p0').lap = true;
  own(s, 'p0', 6);
  s = act(s, 'p0', 'roll', {}, dice(1, 2, 3));
  assert.equal(pl(s, 'p0').pos, 6);

  s = game(2, { speedDie: true });
  pl(s, 'p0').lap = true;
  s = act(s, 'p0', 'roll', {}, dice(2, 2, 2));
  assert.deepEqual(s.pend, { k: 'warp', p: 'p0' });
  s = act(s, 'p0', 'warp', { pos: 39 });
  assert.equal(pl(s, 'p0').pos, 39);
  assert.equal(s.pend.k, 'buy');
  assert.equal(s.ts.roll, false);
});

test('speed die: Hustle moves on to the next unowned property, Bus picks a die or the sum', () => {
  let s = game(2, { speedDie: true });
  pl(s, 'p0').lap = true;
  own(s, 'p0', 3);
  s = act(s, 'p0', 'roll', {}, dice(1, 2, 4));
  assert.equal(pl(s, 'p0').pos, 5);
  assert.deepEqual(s.pend, { k: 'buy', pos: 5, p: 'p0' });

  s = game(2, { speedDie: true });
  pl(s, 'p0').lap = true;
  s.decks.T = ['t15'];
  s = act(s, 'p0', 'roll', {}, dice(1, 2, 6));
  assert.deepEqual(s.pend, { k: 'bus', p: 'p0', opts: [1, 2, 3] });
  err(() => act(s, 'p0', 'bus', { n: 4 }), /bus options/);
  s = act(s, 'p0', 'bus', { n: 2 });
  assert.equal(pl(s, 'p0').pos, 2);
});

test('Quick Hotels and Quick End: hotels after three houses, first bankruptcy ends the game', () => {
  let s = game(3, { quickHotels: true, quickEnd: true });
  own(s, 'p0', 1, 3);
  for (let i = 0; i < 6; i++) s = act(s, 'p0', 'build', { pos: i % 2 ? 3 : 1 });
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.equal(s.props[1].h, 5);
  s = act(s, 'p0', 'sell', { pos: 1 });
  assert.equal(s.props[1].h, 3);
  assert.equal(pl(s, 'p0').cash, 1500 - 7 * 50 + 25);
  s.debts.push({ p: 'p2', a: 9999, to: 'bank', why: 'tax' });
  s = act(s, 'p2', 'bankrupt');
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 'p0');
});

test('Starting Title Deeds: three random deeds each, free', () => {
  const s = game(4, { startDeeds: true });
  for (const p of s.players) {
    assert.equal(E.OWNABLE.filter(q => s.props[q].o === p.id).length, 3);
    assert.equal(p.cash, 1500);
  }
});

test('Quick Jail: the first missed roll pays the fine and moves', () => {
  let s = game(2, { quickJail: true });
  Object.assign(pl(s, 'p0'), { jail: true, pos: 10 });
  own(s, 'p0', 13);
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').jail, false);
  assert.equal(pl(s, 'p0').pos, 13);
  assert.equal(pl(s, 'p0').cash, 1450);
});

test('Skip Spaces: card and tax squares are hopped over and never landed on', () => {
  let s = game(2, { skipSpaces: true });
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').pos, 5);
  assert.deepEqual(s.fx.findLast(f => f.t === 'move').path, [1, 2, 3, 4, 5]);
  assert.equal(pl(s, 'p0').cash, 1500);
});

test('Auction Only: unowned property goes straight to auction', () => {
  let s = game(2, { auctionOnly: true });
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(s.pend.k, 'auc');
  assert.equal(s.pend.pos, 3);
});

test('conflicting house rules: the one switched on last wins', () => {
  let s = E.newGame('h', 0);
  s = act(s, 'h', 'settings', { jackpot: true });
  s = act(s, 'h', 'settings', { skipSpaces: true });
  assert.equal(s.settings.jackpot, false);
  s = act(s, 'h', 'settings', { auctions: false });
  s = act(s, 'h', 'settings', { auctionOnly: true });
  assert.equal(s.settings.auctions, true);
  s = act(s, 'h', 'settings', { auctions: false });
  assert.equal(s.settings.auctionOnly, false);
});

test('Speed Die: an extra $1,000 to start and its number counts toward utility rent', () => {
  let s = game(2, { speedDie: true });
  assert.equal(pl(s, 'p0').cash, 2500);
  own(s, 'p1', 12);
  Object.assign(pl(s, 'p0'), { pos: 6, lap: true });
  s = act(s, 'p0', 'roll', {}, dice(1, 2, 3));
  assert.equal(pl(s, 'p0').pos, 12);
  assert.equal(pl(s, 'p0').cash, 2500 - 4 * 6);
});

test('counter-offers replace the offer with one going the other way', () => {
  let s = game();
  own(s, 'p0', 1);
  own(s, 'p1', 3);
  s = act(s, 'p0', 'propose', { to: 'p1', give: { c: 50 }, get: { p: [3] } });
  s = act(s, 'p1', 'counter', { tid: 1, give: { p: [3] }, get: { c: 120 } });
  assert.equal(s.trades.length, 1);
  assert.deepEqual(s.trades[0], { id: 2, from: 'p1', to: 'p0', give: { c: 0, j: 0, p: [3] }, get: { c: 120, j: 0, p: [] } });
  s = act(s, 'p0', 'accept', { tid: 2 });
  assert.equal(s.props[3].o, 'p0');
  assert.equal(pl(s, 'p1').cash, 1620);
});

test('tables seat at most four', () => {
  const five = Array.from({ length: 5 }, (_, i) => ({ id: 'p' + i, name: 'P' + i, tok: i }));
  err(() => E.setupLocal(five, {}, 0, seeded()), /2 to 4/);
  let s = E.newGame('p0', 0);
  for (let i = 0; i < 4; i++) s = act(s, 'p' + i, 'join', { name: 'P' + i, tok: i });
  err(() => act(s, 'p4', 'join', { name: 'P4', tok: 4 }), /full/);
});

test('house rules: no rent from jail, jackpot, first lap', () => {
  let s = game(2, { jailRent: false });
  own(s, 'p1', 3);
  pl(s, 'p1').jail = true;
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p0').cash, 1500);

  s = game(2, { jackpot: true });
  s = act(s, 'p0', 'roll', {}, dice(1, 3));
  assert.equal(s.pot, 200);
  s = act(s, 'p0', 'endTurn');
  pl(s, 'p1').pos = 17;
  s = act(s, 'p1', 'roll', {}, dice(1, 2));
  assert.equal(pl(s, 'p1').cash, 1700);
  assert.equal(s.pot, 0);

  s = game(2, { firstLap: true });
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  assert.equal(s.pend, null);
});

test('timers: the turn timer plays for an idle player, the time limit crowns the richest', () => {
  let s = game(2, { turnSec: 30 });
  s.turnEnd = 30000;
  assert.equal(E.tick(s, 29999, seeded()), null);
  s = E.tick(s, 30000, dice(1, 2));
  assert.equal(s.ts.rolled, true);
  assert.equal(pl(s, 'p0').pos, 3);
  s = E.tick(s, 60000, seeded());
  assert.equal(s.pend.k, 'auc');

  s = game(2, { timeLimit: 30 });
  s.deadline = 1000;
  pl(s, 'p1').cash = 2000;
  s = E.tick(s, 1000, seeded());
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 'p1');
});

test('lobby: join, bots, host-only settings, start', () => {
  let s = E.newGame('h', 0);
  s = act(s, 'h', 'join', { name: 'Host', tok: 2 });
  err(() => act(s, 'x', 'join', { name: 'X', tok: 2 }), /taken/);
  err(() => act(s, 'x', 'addBot', {}), /host/);
  s = act(s, 'h', 'addBot', { level: 'hard' });
  assert.equal(s.players[1].bot, 'hard');
  assert.notEqual(s.players[1].tok, 2);
  s = act(s, 'h', 'settings', { speedDie: true, startCash: 2000, nope: 1 });
  assert.equal(s.settings.startCash, 2000);
  assert.equal('nope' in s.settings, false);
  s = act(s, 'h', 'start');
  assert.equal(s.phase, 'play');
  s = act(s, 'h', 'settings', { startCash: 500, speedDie: false });
  assert.equal(s.settings.startCash, 2000);
  assert.equal(s.settings.speedDie, true);
});

test('unknown and inherited action names are refused', () => {
  const s = game();
  for (const a of ['constructor', 'toString', '__proto__', 'nope']) err(() => act(s, 'p0', a), /Unknown action/);
});

test('game stats count rent, buys, buildings, jail, laps, doubles, cards and trades', () => {
  let s = game();
  own(s, 'p1', 3);
  s = act(s, 'p0', 'roll', {}, dice(1, 2));
  s = act(s, 'p0', 'endTurn');
  pl(s, 'p1').pos = 27;
  s = act(s, 'p1', 'roll', {}, dice(1, 2));
  s = act(s, 'p1', 'endTurn');
  pl(s, 'p0').pos = 37;
  s = act(s, 'p0', 'roll', {}, dice(2, 2));
  s = act(s, 'p0', 'buy');
  s = act(s, 'p0', 'propose', { to: 'p1', give: { c: 10 }, get: { p: [3] } });
  s = act(s, 'p1', 'accept', { tid: 1 });
  s = act(s, 'p0', 'build', { pos: 1 });
  assert.deepEqual(s.stats.p0, { rentOut: 4, laps: 1, doubles: 1, bought: 1, built: 1, trades: 1 });
  assert.deepEqual(s.stats.p1, { rentIn: 4, jail: 1, trades: 1 });
});

test('players keep a dice design; themes are a lobby setting', () => {
  let s = E.newGame('h', 0);
  s = act(s, 'h', 'join', { name: 'Host', tok: 0, dice: 2 });
  s = act(s, 'h', 'join', { name: 'Host', tok: 0, dice: 99 });
  assert.equal(s.players[0].dice, 3);
  s = act(s, 'h', 'settings', { theme: 'snow' });
  assert.equal(s.settings.theme, 'snow');
  s = act(s, 'h', 'settings', { theme: 'mars' });
  assert.equal(s.settings.theme, 'snow');
});
