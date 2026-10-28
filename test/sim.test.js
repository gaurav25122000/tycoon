// Bot-only games: every game must finish without a stall, a crash or a broken invariant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import { nextBotMove, botFallback } from '../src/bots.js';

const GAMES = +(process.env.SIM_GAMES || 1000);
const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function check(s) {
  const ids = new Set(E.alive(s).map(p => p.id));
  for (const p of s.players) {
    assert.ok(p.cash >= 0, `${p.id} has negative cash ${p.cash}`);
    if (p.out) assert.equal(p.cash, 0);
  }
  for (const pos of E.OWNABLE) {
    const pr = s.props[pos], sq = E.BOARD[pos];
    if (pr.o) assert.ok(ids.has(pr.o), `square ${pos} owned by ${pr.o} who is out`);
    else assert.equal(pr.h, 0);
    if (pr.h) assert.ok(sq.t === 'prop' && (s.settings.landAny || E.ownsGroup(s, pr.o, sq.g)), `buildings on ${pos} without the full set`);
    // under Land and Build an heir can inherit a mortgaged street beside their own buildings (they build there once it is lifted)
    if (pr.m && !s.settings.landAny) assert.ok(E.GROUPS[sq.g] === undefined || E.GROUPS[sq.g].pos.every(q => !s.props[q].h), `mortgage on ${pos} beside buildings`);
  }
  if (s.settings.limited) { const st = E.stock(s); assert.ok(st.h >= 0 && st.H >= 0, `bank stock ${JSON.stringify(st)}`); }
  // under Land and Build a street gained by trade or inheritance arrives below its owner's built ones
  if (s.settings.even && !s.settings.limited && !s.settings.landAny) {
    for (const g of E.GROUPS) {
      const b = g.pos.map(q => E.builds(s, s.props[q].h));
      assert.ok(Math.max(...b) - Math.min(...b) <= 1, `uneven ${g.n}: ${b}`);
    }
  }
}

const LEVELS = ['easy', 'normal', 'hard'];
const VARIANTS = [{}, E.QUICK_MODE, { speedDie: true }, { limited: false }, { jackpot: true, doubleGo: true, incomeTax: true },
  { auctions: false }, { auctionOnly: true, startDeeds: true }, { speedDie: true, firstLap: true, ...E.QUICK_MODE }, { startCash: 500 }, { landBuild: true }, { landAny: true }];

function play(seed) {
  const rng = seeded(seed);
  const n = 2 + (seed % 3);
  const players = Array.from({ length: n }, (_, i) => ({ id: 'b' + i, name: 'B' + i, tok: i, bot: LEVELS[(seed + i) % 3] }));
  const settings = VARIANTS[seed % VARIANTS.length];
  let s = E.setupLocal(players, settings, 0, rng);
  const memos = {};
  let now = 0, steps = 0, refusals = 0, noSet = 0;
  while (s.phase === 'play') {
    assert.ok(++steps < 60000, `game ${seed} ran away`);
    now += 1000;
    const t = E.tick(s, now, rng);
    if (t) { s = t; check(s); continue; }
    const mv = nextBotMove(s, memos);
    if (!mv) {
      assert.ok(s.pend && (s.pend.k === 'auc' || s.pend.k === 'bauc'), `game ${seed} stalled: ${JSON.stringify({ pend: s.pend, debts: s.debts, ts: s.ts })}`);
      now = s.pend.end;
      continue;
    }
    const [id, { a, p }] = mv;
    try {
      s = E.apply(s, id, a, p, now, rng);
      if (a === 'build' && !E.ownsGroup(s, id, E.BOARD[p.pos].g)) noSet++;
    }
    catch (e) {
      if (!(e instanceof E.GameError)) throw e;
      refusals++;
      const fb = botFallback(s, id);
      assert.ok(fb, `game ${seed}: ${id} ${a} refused (${e.message}) with no fallback`);
      s = E.apply(s, id, fb.a, fb.p, now, rng);
    }
    check(s);
    if (s.turnN > 500 && s.phase === 'play') s = E.apply(s, s.host, 'endNow', {}, now, rng);
  }
  return { turns: s.turnN, refusals, bust: s.players.some(p => p.out), built: Object.values(s.stats).reduce((t, x) => t + (x.built || 0), 0), land: settings.landBuild ? 'landBuild' : settings.landAny ? 'landAny' : '', noSet };
}

test(`${GAMES} bot-only games finish cleanly`, () => {
  const res = [];
  for (let i = 1; i <= GAMES; i++) res.push(play(i));
  const bust = res.filter(r => r.bust).length, refusals = res.reduce((t, r) => t + r.refusals, 0);
  const capped = res.filter(r => r.turns > 500).length;
  const med = res.map(r => r.turns).sort((a, b) => a - b)[res.length >> 1];
  console.log(`games ${GAMES}, someone bankrupted in ${bust}, hit the 500-turn cap ${capped}, median turns ${med}, refused bot moves ${refusals}`);
  assert.ok(capped / GAMES < 0.25, `${capped} games never ended`);
  // bots still build when they may only build where they land
  const la = res.filter(r => r.land === 'landAny');
  assert.ok(!la.length || la.filter(r => r.noSet).length >= la.length * 0.5, `bots built without a full set in only ${la.filter(r => r.noSet).length} of ${la.length} landAny games`);
  for (const k of ['landBuild', 'landAny']) {
    const lb = res.filter(r => r.land === k);
    assert.ok(!lb.length || lb.filter(r => r.built).length >= lb.length * 0.9, `bots built in only ${lb.filter(r => r.built).length} of ${lb.length} ${k} games`);
  }
});
