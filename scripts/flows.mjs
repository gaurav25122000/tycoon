// Scenarios for scripts/e2e.mjs. Each drives the real UI; state setup and dice go through the local test hooks.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PP = [{ name: 'Gaurav', tok: 0, bot: null }, { name: 'Ava', tok: 1, bot: null }];

// mutate the live state in the page (fn source runs there with s and E)
async function setup(page, fn) {
  await page.evaluate(src => {
    const T = window.__tycoon, c = T.game.ctl, s = structuredClone(c.state);
    (0, eval)('(' + src + ')')(s, T.E);
    c.load(s);
  }, fn.toString());
  await settle(page);
}
const rig = (page, ...faces) => page.evaluate(f => window.__tycoon.game.ctl.rig(...f), faces);
// wait for animations to finish, tapping Ready on the pass-the-device screen when it appears
let passShot = null;
async function settle(page) {
  for (;;) {
    const r = await page.evaluate(() => new Promise(res => {
      const g = window.__tycoon.game;
      if (!g) { res('idle'); return; }
      const t = setInterval(() => { if (document.querySelector('.passto')) { clearInterval(t); res('pass'); } }, 100);
      g.presenter.idle().then(() => { clearInterval(t); res('idle'); });
    }));
    if (r === 'idle') return;
    if (passShot) { await passShot(page); passShot = null; }
    await page.click('.passto [data-act="ready"]');
  }
}
async function tap(page, sel, opts = {}) {
  await page.locator(sel).first().click({ timeout: opts.timeout || 15000, force: true }); // the roll button pulses forever
  if (!opts.noIdle) await settle(page);
}
// End turn, unless the turn already ended itself with nothing left to do on it
async function endTurn(page) {
  await page.evaluate(() => { const b = document.querySelector('[data-act="endTurn"]'); if (b) b.click(); });
  await settle(page);
}
const st = page => page.evaluate(() => window.__tycoon.game.ctl.state);
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const sorted = (s, E) => { s.players.sort((a, b) => a.id.localeCompare(b.id)); s.turn = 0; };

async function flows(h, device, tag) {
  const { open, shot, local, wait } = h;
  const page = await open(device, tag);
  await wait(800);
  await shot(page, 'menu');
  expect(await page.evaluate(() => [...document.querySelectorAll('[data-act="mode"], [data-act="online"]')].every(b => { const i = b.querySelector('img.i3d'); return i && i.complete && i.naturalWidth > 0 && !b.querySelector('svg'); })), 'the title buttons show flat icons');
  await page.click('[data-act="mode"][data-v="bots"]');
  await wait(300);
  await shot(page, 'setup');
  // the two land-and-build rules cannot both be on
  await page.evaluate(() => { document.querySelector('[data-act="lrule"][data-k="landBuild"]').click(); document.querySelector('[data-act="lrule"][data-k="landAny"]').click(); });
  expect(await page.evaluate(() => document.querySelector('[data-k="landBuild"]').getAttribute('aria-checked') === 'false' && document.querySelector('[data-k="landAny"]').getAttribute('aria-checked') === 'true'), 'Build Where You Land and Land and Build are both on');
  await page.evaluate(() => document.querySelector('[data-act="lpreset"][data-v="classic"]').click());
  // tokens, dice and boards are 3D renders, not flat icons
  expect(await page.evaluate(() => document.querySelectorAll('.tokrow .ptok img').length >= 8 && document.querySelectorAll('.dicerow img').length >= 4 && document.querySelectorAll('.theme img').length === 5
    && document.querySelectorAll('.menu-card .back img.i3d').length === 1 && document.querySelectorAll('.x img.i3d').length === 4
    && [...document.querySelectorAll('.tokrow img, .dicerow img, .theme img, .menu-card .back img, .x img')].every(i => i.complete && i.naturalWidth > 0)), 'the setup menu shows flat art instead of 3D renders');
  await local(page, PP);
  expect(await page.evaluate(() => document.querySelectorAll('.seat .ptok img').length === 2 && !!document.querySelector('.mascot-art img')), 'seats or the mascot are not 3D renders');
  passShot = pg => shot(pg, 'pass-device');
  await page.evaluate(() => window.__tycoon.scene.setSpeed(3));
  await setup(page, sorted);
  // the HUD buttons, the emote button and the roll button's die are 3D renders
  expect(await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.hud-top .hbtn, .dock .dbtn')], imgs = [...btns.map(b => b.querySelector('img')), document.querySelector('.dock img.pip-die')];
    return btns.length === 8 && !document.querySelector('.hud-top svg, .dock svg') && imgs.every(i => i && i.complete && i.naturalWidth > 0);
  }), 'the HUD shows flat icons');
  expect(await page.evaluate(() => [...document.querySelectorAll('.hud-top .hbtn, .dock .dbtn')].every(b => b.getAttribute('aria-label') || [...b.querySelectorAll('span')].some(t => getComputedStyle(t).display !== 'none' && t.textContent.trim()))), 'a HUD button has no accessible name');
  const soundIcon = () => page.evaluate(() => new Promise(res => { const i = document.querySelector('#soundBtn img.i3d'); if (!i) res(null); else i.decode().then(() => res(i.src), () => res(null)); }));
  const loud = await soundIcon();
  await page.click('[data-act="sound"]');
  const muted = await soundIcon();
  await page.click('[data-act="sound"]');
  expect(loud && muted && loud !== muted && await soundIcon() === loud, 'the sound button does not swap its 3D icon');

  // buy
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]');
  await shot(page, 'buy-panel');
  await tap(page, '[data-act="buy"]', { noIdle: true });
  // the deed panel leaves while the purchase animates, so it never hides the building rising
  await page.waitForFunction(() => window.__tycoon.game.presenter.playing && !document.querySelector('#center .panel'), null, { timeout: 3000 })
    .catch(() => { throw new Error('buy panel stayed up during the purchase animation'); });
  await shot(page, 'buying');
  await settle(page);
  await wait(400);
  await shot(page, 'bought');
  let s = await st(page);
  expect(s.props[3].o === 'p1', 'buy did not take');
  await endTurn(page);

  // rent
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]', { noIdle: true });
  await wait(1700);
  await shot(page, 'rent');
  await settle(page);
  s = await st(page);
  expect(s.players[1].cash === 1496, 'rent not paid: ' + s.players[1].cash);
  await endTurn(page);

  // auction: both bid from their own rows, then one drops out
  await rig(page, 2, 3);
  await tap(page, '[data-act="roll"]');
  await tap(page, '[data-act="decline"]');
  // this one screen shows the auction to both players, so its clock starts at once
  expect(await page.evaluate(() => { const pd = window.__tycoon.game.ctl.state.pend, left = pd.end - Date.now(); return [...(pd.shown || [])].sort().join() === 'p1,p2' && left > 18000 && left <= 20000; }),
    'pass & play did not start the auction clock for both players');
  await tap(page, '[data-act="bid"][data-who="p2"][data-amt="10"]');
  await tap(page, '[data-act="bid"][data-who="p1"][data-amt="60"]');
  await shot(page, 'auction');
  await tap(page, '[data-act="pass"][data-who="p2"]');
  await wait(500);
  s = await st(page);
  expect(s.props[8].o === 'p1' && s.players[0].cash === 1444 - 60, 'auction result wrong: ' + s.players[0].cash);
  await endTurn(page);

  // build up to a hotel, sell one back, mortgage a station
  await setup(page, (s) => { [1, 3].forEach(q => { s.props[q].o = 'p1'; }); s.props[5].o = 'p1'; s.players[0].cash = 2000; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
  await tap(page, '[data-act="manage"]');
  await shot(page, 'properties');
  // a build shows in the sheet at once, while the house is still dropping onto the board
  await page.evaluate(() => window.__tycoon.scene.setSpeed(1));
  await tap(page, '.sheet [data-act="build"][data-pos="1"]', { noIdle: true });
  await page.waitForFunction(() => document.querySelector('.sheet .lot:has([data-pos="1"]) small').textContent === '1 house' && window.__tycoon.game.presenter.playing, null, { timeout: 400 })
    .catch(() => { throw new Error('the Properties sheet lags behind a build'); });
  await settle(page);
  await page.evaluate(() => window.__tycoon.scene.setSpeed(3));
  for (let i = 1; i < 9; i++) await tap(page, `.sheet [data-act="build"][data-pos="${i % 2 ? 3 : 1}"]`);
  s = await st(page);
  expect(s.props[1].h === 5 && s.props[3].h === 4, 'building went wrong ' + s.props[1].h + '/' + s.props[3].h);
  expect(await page.evaluate(() => { const at = q => document.querySelectorAll(`.sheet .lot:has([data-pos="${q}"]) .hcount img`); return at(1).length === 1 && at(1)[0].alt === 'hotel' && at(3).length === 4 && at(3)[0].alt === 'house'; }),
    'the Properties sheet does not show 3D houses and hotels');
  await tap(page, '.sheet [data-act="sell"][data-pos="1"]');
  await tap(page, '.sheet [data-act="mortgage"][data-pos="5"]');
  // only the player whose turn it is can build
  await setup(page, (s) => { [6, 8, 9].forEach(q => { s.props[q].o = 'p2'; }); });
  await tap(page, '.sheet [data-act="manageAs"][data-id="p2"]');
  expect(await page.evaluate(() => { const b = document.querySelector('.sheet [data-act="build"][data-pos="6"]'); return !!b && b.disabled && b.title === 'You can only build on your turn'; }), 'a player can build on someone else’s turn');
  await tap(page, '.sheet [data-act="manageAs"][data-id="p1"]');
  await shot(page, 'properties-built');
  await tap(page, '[data-act="close"]');
  await page.evaluate(() => window.__tycoon.scene.focus(3, 0.4));
  await wait(1500);
  await shot(page, 'houses-closeup');
  // the four green houses on square 3 must still draw once the camera looks away from the board centre
  const green = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => {
    const T = window.__tycoon, gl = T.scene.renderer.domElement, at = T.scene.screenOf(3), k = gl.width / gl.clientWidth;
    const cv = document.createElement('canvas'); cv.width = 400 * k; cv.height = 400 * k;
    const x = cv.getContext('2d'); x.drawImage(gl, (at.x - 200) * k, (at.y - 200) * k, cv.width, cv.height, 0, 0, cv.width, cv.height);
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 90 && d[i + 1] > d[i] * 1.6 && d[i + 1] > d[i + 2] * 1.4) n++;
    res(n);
  })));
  expect(green > 300, 'houses not drawn in the close-up (' + green + ' green pixels)');
  await page.evaluate(() => window.__tycoon.scene.recenter());

  // trade, counter-offer, accept; the receiver lifts nothing (keeps the mortgage)
  await setup(page, (s) => { s.props[6].o = 'p1'; s.props[8].o = 'p2'; s.props[9].o = 'p2'; s.props[9].m = true; });
  await tap(page, '[data-act="tradeNew"]');
  await tap(page, '.sheet [data-act="tradeTo"][data-id="p2"]');
  await tap(page, '.sheet [data-act="tradePick"][data-side="give"][data-pos="6"]');
  await tap(page, '.sheet [data-act="tradePick"][data-side="get"][data-pos="9"]');
  await shot(page, 'trade-sheet');
  await tap(page, '.sheet [data-act="tradeSend"]');
  await shot(page, 'offer-panel');
  await tap(page, '[data-act="counter"]');
  await page.locator('#cash_get').evaluate(el => { el.value = 100; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await tap(page, '.sheet [data-act="tradeSend"]');
  await tap(page, '[data-act="accept"][data-who="p1"]');
  await shot(page, 'lift-panel');
  await tap(page, '[data-act="lift"][data-now="0"]');
  s = await st(page);
  expect(s.props[9].o === 'p1' && s.props[6].o === 'p2' && s.props[9].m, 'trade went wrong');

  // a card
  await setup(page, (s) => { s.players[0].pos = 4; s.decks.F = ['f8', ...s.decks.F.filter(c => c !== 'f8')]; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]', { noIdle: true });
  await page.waitForSelector('[data-hold]', { timeout: 15000 });
  await wait(900);
  await shot(page, 'card');
  await tap(page, '[data-hold]');
  await endTurn(page);

  // jail, then pay out
  await setup(page, (s) => { s.players[0].pos = 27; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]');
  await shot(page, 'jailed');
  await endTurn(page);
  await setup(page, (s) => { s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
  await shot(page, 'jail-dock');
  await tap(page, '[data-act="payJail"]');
  s = await st(page);
  expect(!s.players[0].jail, 'still in jail');

  // speed die: bus, then triples
  await setup(page, (s) => { s.settings.speedDie = true; s.players[0].lap = true; s.players[0].pos = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
  await rig(page, 1, 2, 6);
  await tap(page, '[data-act="roll"]');
  await shot(page, 'bus');
  expect(await page.evaluate(() => { const i = document.querySelector('#center h3 img.i3d'); return i && i.complete && i.naturalWidth > 0; }), 'the bus panel shows a flat icon');
  await tap(page, '[data-act="bus"][data-n="3"]');
  await setup(page, (s) => { s.pend = null; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
  await rig(page, 2, 2, 2);
  await tap(page, '[data-act="roll"]');
  await shot(page, 'triples');
  // to the Chill Zone: no decision follows, so the panel is already empty when the jump ends
  await page.evaluate(() => window.__tycoon.game.hud.onSquare(20));
  await tap(page, '[data-act="confirmYes"]');
  s = await st(page);
  expect(s.players[0].pos === 20, 'warp did not land');
  // the squares stop pulsing once the jump is done
  expect(await page.evaluate(() => { let n = 0; window.__tycoon.scene.scene.traverse(o => { if (o.material && o.material.color && o.material.color.getHexString() === '7cf0c8') n++; }); return n; }) === 0, 'the triples squares keep pulsing after the jump');

  // income tax choice
  await setup(page, (s) => { s.settings.incomeTax = true; s.settings.speedDie = false; s.pend = null; s.players[0].pos = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
  await rig(page, 1, 3);
  await tap(page, '[data-act="roll"]');
  await shot(page, 'tax');
  await tap(page, '[data-act="tax"][data-pick="flat"]');

  // debt: raise it automatically, pay
  await setup(page, (s, E) => {
    s.pend = null; s.settings.speedDie = false;
    E.OWNABLE.forEach(q => { s.props[q] = { o: null, h: 0, m: false }; });
    [6, 8].forEach(q => { s.props[q].o = 'p1'; });
    [37, 39].forEach(q => { s.props[q].o = 'p2'; });
    s.props[39].h = 1;
    s.players[0].cash = 100; s.players[0].pos = 36; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false };
  });
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]');
  await shot(page, 'debt');
  await tap(page, '[data-act="autoRaise"]');
  await tap(page, '[data-act="payDebt"]');
  s = await st(page);
  expect(!s.debts.length, 'debt not paid');

  // bankruptcy ends a two-player game
  await setup(page, (s) => { s.props[39].h = 5; s.players[0].cash = 10; s.players[0].pos = 36; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]');
  await tap(page, '[data-act="bankrupt"]');
  await tap(page, '[data-act="confirmYes"]', { noIdle: true });
  await page.waitForSelector('.win', { timeout: 30000 });
  await wait(600);
  await shot(page, 'win');
  s = await st(page);
  expect(s.phase === 'over' && s.winner === 'p2', 'game did not end');
  expect(await page.evaluate(() => !!document.querySelector('.win .trophy3d')), 'the win screen trophy is not 3D');
  console.log(tag, 'fps', await page.evaluate(() => window.__tycoon.scene.fps()));
  await page.context().close();
}

async function themes(h) {
  const { open, shot, local, wait, DESKTOP } = h;
  const page = await open(DESKTOP, 'theme');
  await page.evaluate(() => window.__tycoon.scene.setQuality('high'));
  for (const t of ['city', 'neon', 'snow', 'forest', 'ocean']) {
    await local(page, PP.map((p, i) => ({ ...p, dice: i + 1 })), { theme: t, speedDie: true });
    await setup(page, sorted);
    await setup(page, (s, E) => { [1, 3, 6, 8, 9].forEach(q => { s.props[q].o = 'p1'; }); [37, 39, 21, 23, 24].forEach(q => { s.props[q].o = 'p2'; }); s.props[37].h = 5; s.props[39].h = 5; s.props[1].h = 2; s.props[3].h = 3; });
    await page.evaluate(() => window.__tycoon.scene.recenter());
    await wait(1800);
    await shot(page, t);
    console.log(t, await page.evaluate(() => window.__tycoon.scene.fps()));
    await page.evaluate(() => window.__tycoon.game.hud.closeSheet());
    await page.evaluate(() => { const g = window.__tycoon.game; g.ctl.destroy(); });
    await page.reload();
    await page.waitForFunction(() => window.__tycoon && window.__tycoon.scene);
  }
  await page.context().close();
}

// one autopilot step for the people on this device, through the real buttons
function step() {
  const g = window.__tycoon.game;
  if (!g) return 'nogame';
  if (document.querySelector('.win')) return 'over';
  const q = sel => document.querySelector(sel), go = el => { if (!el) throw new Error('nothing to click; sheet: ' + (q('#sheet') || {}).className + ' ' + ((q('#sheet') || {}).innerHTML || '').slice(0, 300)); el.click(); return 'clicked'; };
  let b;
  if ((b = q('[data-hold]'))) return go(b);
  if ((b = q('.passto [data-act="ready"]'))) return go(b);
  if (g.presenter.playing) return 'busy';
  if ((b = q('[data-act="confirmYes"]'))) return go(b);
  const s = g.ctl.state;
  if (q('#scrim:not([hidden]) .sheet-manage')) {
    const me = s.players.find(p => p.id === g.ctl.state.players[g.ctl.state.turn].id);
    const builds = [...document.querySelectorAll('.sheet [data-act="build"]:not([disabled])')];
    if (builds.length && me && me.cash > 250) return go(builds[0]);
    return go(q('.sheet [data-act="close"]'));
  }
  if (q('#scrim:not([hidden])')) return go(q('.sheet [data-act="close"]'));
  if ((b = q('[data-act="payDebt"]:not([disabled])'))) return go(b);
  if ((b = q('#center [data-act="autoRaise"]'))) return go(b);
  if ((b = q('#center [data-act="bankrupt"]'))) return go(b);
  if ((b = q('[data-act="lift"][data-now="0"]'))) return go(b);
  if ((b = q('#center [data-act="buy"]:not([disabled])'))) return go(b);
  if ((b = q('#center [data-act="decline"]'))) return go(b);
  const bids = [...document.querySelectorAll('[data-act="bid"]:not([disabled])')];
  if (bids.length && Math.random() < 0.3) return go(bids[0]);
  if ((b = q('[data-act="pass"]:not([disabled])'))) return go(b);
  if ((b = q('[data-act="bus"]'))) return go(b);
  if ((b = q('[data-act="tax"][data-pick="flat"]'))) return go(b);
  if (s.pend && s.pend.k === 'warp' && g.ctl.mine.has(s.pend.p)) { g.hud.onSquare((s.players.find(p => p.id === s.pend.p).pos + 7) % 40); return 'warp'; }
  if ((b = q('#offers [data-act="accept"]')) && Math.random() < 0.5) return go(b);
  if ((b = q('#offers [data-act="reject"]'))) return go(b);
  if ((b = q('[data-act="payJail"]:not([disabled])')) && Math.random() < 0.5) return go(b);
  if ((b = q('[data-act="roll"]'))) return go(b);
  if ((b = q('[data-act="endTurn"]'))) {
    // build whenever a full set allows it, like a sensible player
    const me = s.players[s.turn];
    const canBuild = window.__tycoon.E.OWNABLE.some(pos => !window.__tycoon.E.canBuild(s, me.id, pos)) && me.cash > 250;
    if (canBuild && !window.__built?.[s.turnN] && (b = q('[data-act="manage"]:not([disabled])'))) { (window.__built = window.__built || {})[s.turnN] = 1; return go(b); }
    return go(q('[data-act="endTurn"]'));
  }
  return 'wait';
}
async function autopilot(page, label, ms) {
  const t0 = Date.now();
  await page.evaluate(() => { window.__tycoon.scene.setSpeed(8); window.__tycoon.game.ctl.setSpeed(8); });
  let last = '';
  while (Date.now() - t0 < ms) {
    const r = await page.evaluate(step);
    if (r === 'over') {
      const s = await page.evaluate(() => window.__tycoon.game.ctl.state);
      console.log(`${label}: finished in ${Math.round((Date.now() - t0) / 1000)}s, ${s.turnN} turns, winner ${s.players.find(p => p.id === s.winner)?.name}`);
      return s;
    }
    last = r;
    await new Promise(res => setTimeout(res, r === 'busy' || r === 'wait' ? 120 : 60));
  }
  const s = await page.evaluate(() => window.__tycoon.game.ctl.state);
  throw new Error(`${label}: no winner after ${ms / 1000}s (turn ${s.turnN}, last step ${last})`);
}
async function fullGame(h, label, seats, settings, ms = 520000) {
  const page = await h.open(h.DESKTOP, label);
  await h.local(page, seats, settings);
  const s = await autopilot(page, label, ms);
  await h.shot(page, 'end');
  console.log(label, 'fps', await page.evaluate(() => window.__tycoon.scene.fps()), 'stats', JSON.stringify(s.stats));
  await page.context().close();
}
const BOTS = [{ name: 'Gaurav', tok: 0, bot: null }, { name: 'Ava', tok: 1, bot: 'hard' }, { name: 'Kabir', tok: 2, bot: 'normal' }, { name: 'Zoe', tok: 3, bot: 'easy' }];

async function online(h) {
  const { open, shot, wait } = h;
  const host = await open(h.DESKTOP, 'host'), guest = await open(h.PHONE, 'guest');
  await host.click('[data-act="online"]');
  await host.fill('#oname', 'Gaurav');
  await host.click('[data-act="create"][data-open="1"]');
  await host.waitForSelector('.bigcode');
  const code = (await host.textContent('.bigcode')).trim();
  await guest.click('[data-act="online"]');
  await guest.fill('#oname', 'Ava');
  await guest.waitForSelector(`#openGames [data-v="${code}"]`, { timeout: 10000 });
  await shot(guest, 'open-games');
  await guest.click('[data-act="quick"]');
  await guest.waitForSelector('.bigcode');
  expect((await guest.textContent('.bigcode')).trim() === code, 'quick match joined another room');
  await host.waitForFunction(() => document.querySelectorAll('.lseat:not(.empty)').length === 2);
  await host.click('[data-act="addBot"][data-v="hard"]');
  await host.waitForFunction(() => document.querySelectorAll('.lseat:not(.empty)').length === 3);
  expect(await host.evaluate(() => [...document.querySelectorAll('.lseat .x')].every(b => b.querySelector('img.i3d')) && document.querySelectorAll('.lseat .x').length === 2), 'the lobby remove buttons show flat icons');
  await host.click('[data-act="opreset"][data-v="quick"]');
  await host.click('[data-act="otheme"][data-v="forest"]');
  await guest.waitForFunction(() => document.querySelector('.mode.on b')?.textContent === 'Quick Mode');
  await shot(host, 'lobby');
  await shot(guest, 'lobby');
  await host.click('[data-act="startOnline"]');
  await Promise.all([host, guest].map(p => p.waitForFunction(() => window.__tycoon.game && window.__tycoon.game.presenter.view, null, { timeout: 15000 })));
  // emotes travel through the server
  await guest.click('[data-act="emotes"]');
  await guest.click('[data-act="emote"]');
  await host.waitForSelector('.emote-pop', { timeout: 8000 });
  await shot(host, 'emote');
  // the guest drops out and comes back mid-game
  await wait(4000);
  await guest.reload();
  await guest.waitForFunction(() => window.__tycoon && window.__tycoon.game && window.__tycoon.game.presenter.view, null, { timeout: 20000 });
  console.log('guest rejoined', await guest.evaluate(() => location.hash));
  const [a, b] = await Promise.all([autopilot(host, 'online-host', 520000), autopilot(guest, 'online-guest', 520000)]);
  expect(a.winner === b.winner && a.fxN === b.fxN, 'host and guest disagree on the result');
  await shot(host, 'end');
  await shot(guest, 'end');
}

// two live players (the guest on Fast, its clock 10 minutes ahead) and a bot; the people never bid: both screens show the
// same game clock, and every auction counts down to 0, 20 seconds with no bid, at least 12 after one, even an early bot bid
async function onlineAuction(h) {
  const host = await h.open(h.DESKTOP, 'auc-host'), guest = await h.open(h.PHONE, 'auc-guest');
  await guest.context().addInitScript(() => {
    localStorage.setItem('tycoon:prefs', JSON.stringify({ speed: 'fast' }));
    const now = Date.now; Date.now = () => now() + 600000;
  });
  await guest.reload();
  await guest.waitForFunction(() => window.__tycoon && window.__tycoon.scene, null, { timeout: 60000 });
  await host.click('[data-act="online"]');
  await host.fill('#oname', 'Gaurav');
  await host.click('[data-act="create"][data-open="0"]');
  await host.waitForSelector('.bigcode');
  await guest.click('[data-act="online"]');
  await guest.fill('#oname', 'Ava');
  await guest.fill('#ocode', (await host.textContent('.bigcode')).trim());
  await guest.click('[data-act="join"]');
  await host.waitForFunction(() => document.querySelectorAll('.lseat:not(.empty)').length === 2, null, { timeout: 15000 });
  await host.click('[data-act="addBot"][data-v="normal"]');
  await host.waitForFunction(() => document.querySelectorAll('.lseat:not(.empty)').length === 3, null, { timeout: 15000 });
  await host.evaluate(() => document.querySelector('[data-act="orule"][data-k="auctionOnly"]').click());
  await host.evaluate(() => document.querySelector('[data-act="oset"][data-k="timeLimit"][data-v="180"]').click());
  await host.waitForFunction(() => document.querySelector('[data-k="auctionOnly"]').getAttribute('aria-checked') === 'true' && document.querySelector('[data-k="timeLimit"][data-v="180"]').getAttribute('aria-pressed') === 'true');
  await host.click('[data-act="startOnline"]');
  await Promise.all([host, guest].map(p => p.waitForFunction(() => window.__tycoon.game && window.__tycoon.game.presenter.view, null, { timeout: 15000 })));
  await h.wait(1000);
  const mins = await Promise.all([host, guest].map(p => p.evaluate(() => +document.querySelector('#gameClock').textContent.match(/(\d+):/)[1])));
  expect(mins[0] >= 179 && Math.abs(mins[0] - mins[1]) <= 1, 'the game clocks disagree: ' + mins.join(' vs '));
  // each screen notes how long its auction panel stays up, what its ring showed and how many bids it took
  for (const p of [host, guest]) await p.evaluate(() => {
    window.__aucs = []; let on = null;
    setInterval(() => {
      const el = document.querySelector('#center .auc'), n = +(document.querySelector('#aucN') || {}).textContent || 0, pd = window.__tycoon.game.ctl.state.pend;
      if (el && !on) on = { t0: performance.now(), top: 0, last: n, bids: 0 };
      if (on && el) { on.top = Math.max(on.top, n); on.last = n; on.bids = Math.max(on.bids, (pd && pd.n) || 0); }
      if (on && !el) { window.__aucs.push({ ms: Math.round(performance.now() - on.t0), top: on.top, last: on.last, bids: on.bids }); on = null; }
    }, 50);
  });
  const t0 = Date.now();
  let seen = [[], []];
  while (Math.min(...seen.map(a => a.length)) < 3) {
    expect(Date.now() - t0 < 240000, 'too few auctions in 4 minutes: ' + JSON.stringify(seen));
    // a debt is paid at once; the player whose turn it is rolls and ends the turn; cards are left to time out, like someone reading them
    await Promise.all([host, guest].map(p => p.evaluate(() => {
      const c = window.__tycoon.game.ctl, debt = document.querySelector('[data-act="payDebt"]:not([disabled])');
      if (debt) { debt.click(); return; }
      if (window.__tycoon.game.presenter.playing || c.state.players[c.state.turn].id !== c.me) return;
      const b = ['[data-act="tax"][data-pick="flat"]', '[data-act="bus"]', '[data-act="roll"]', '[data-act="endTurn"]'].map(q => document.querySelector(q)).find(Boolean);
      if (b) b.click();
    })));
    seen = await Promise.all([host, guest].map(p => p.evaluate(() => window.__aucs)));
    await h.wait(150);
  }
  console.log('auction panels (ms on screen, top and last ring): host', JSON.stringify(seen[0]), 'guest', JSON.stringify(seen[1]));
  expect(seen.flat().every(a => a.last <= 1 && (a.bids ? a.ms >= 11500 : a.ms >= 19500 && a.top === 20)), 'an auction closed before its clock ran out on a screen: ' + JSON.stringify(seen));
  expect(seen.flat().some(a => a.bids), 'the bot never bid, so no clock after a bid was checked: ' + JSON.stringify(seen));
}

// incoming offers sit above the dock, newest on top, and stay there while the bots play
async function offers(h) {
  for (const [device, tag] of [[h.DESKTOP, 'offers-desk'], [h.PHONE, 'offers-phone']]) {
    const page = await h.open(device, tag);
    await h.local(page, [{ name: 'Gaurav', tok: 0, bot: null }, { name: 'Ava', tok: 1, bot: 'hard' }, { name: 'Kabir', tok: 2, bot: 'hard' }]);
    const deals = [[90, 'p2', 1, 6], [91, 'p3', 3, 8]].map(([id, from, give, get]) => ({ id, from, to: 'p1', give: { c: 0, j: 0, p: [give] }, get: { c: 0, j: 0, p: [get] } }));
    // Ava rolls onto the unowned station and decides on it while both offers wait
    await page.evaluate(trades => {
      const c = window.__tycoon.game.ctl, s = structuredClone(c.state);
      s.players.sort((a, b) => a.id.localeCompare(b.id));
      s.players.forEach(p => { p.pos = 0; });
      s.turn = 1; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false };
      s.props[1].o = 'p2'; s.props[3].o = 'p3'; s.props[6].o = 'p1'; s.props[8].o = 'p1';
      s.trades = trades; s.tradeN = 91;
      c.rig(2, 3); c.load(s);
    }, deals);
    const seen = await page.evaluate(() => new Promise(res => {
      const g = window.__tycoon.game, out = [], t0 = performance.now();
      const t = setInterval(() => {
        const cards = [...document.querySelectorAll('#offers .offer')], box = document.querySelector('#offers').getBoundingClientRect(), first = cards.length && cards[0].getBoundingClientRect();
        const docked = first && first.top >= box.top && first.bottom <= box.bottom && box.bottom <= document.querySelector('.dock').getBoundingClientRect().top && innerHeight - box.bottom < 200;
        out.push(cards.map(o => o.dataset.offer).join() + (docked ? '' : ' (not docked)'));
        if (g.presenter.view.turn !== 1 || performance.now() - t0 > 20000) { clearInterval(t); res(out); }
      }, 50);
    }));
    expect(seen.length > 20 && seen.every(x => x === '91,90'), 'the offers do not stay stacked while a bot plays: ' + [...new Set(seen)].join(' | '));
    // with a decision of your own up, the panel sits above the offers and the offers stay at the bottom
    await page.evaluate(trades => {
      const c = window.__tycoon.game.ctl, s = structuredClone(c.state);
      Object.assign(s, { turn: 0, pend: { k: 'buy', pos: 39, p: 'p1' }, debts: [], aq: [], mdec: [], trades });
      s.ts = { roll: false, rolled: true, dbl: 0, hustle: false };
      s.players[0].pos = 39; Object.assign(s.props[39], { o: null, h: 0, m: false });
      c.load(s);
    }, deals);
    await page.evaluate(() => window.__tycoon.game.presenter.idle());
    await h.shot(page, 'offers');
    // the panel's buttons and at least the newest offer are fully in view, the stack sits on the dock
    const box = await page.evaluate(() => {
      const r = el => el.getBoundingClientRect(), cards = [...document.querySelectorAll('#offers .offer')], o = r(document.querySelector('#offers')), c = r(cards[0]);
      const p = r(document.querySelector('#center .panel')), buy = r(document.querySelector('#center [data-act="buy"]'));
      return { order: cards.map(x => x.dataset.offer).join(), offers: [o.top, o.bottom], first: [c.top, c.bottom], panel: [p.top, p.bottom], buy: [buy.top, buy.bottom], dock: r(document.querySelector('.dock')).top, vh: innerHeight };
    });
    expect(box.order === '91,90' && box.panel[1] <= box.first[0] && box.buy[1] <= box.panel[1] && box.first[0] >= box.offers[0] && box.first[1] <= box.offers[1]
      && box.offers[1] <= box.dock && box.vh - box.offers[1] < 200, 'the offers overlap the decision panel or leave the bottom: ' + JSON.stringify(box));
    // a double tap on Decline sends it once
    await page.evaluate(() => { const b = document.querySelector('#offers [data-act="reject"][data-tid="91"]'); b.click(); b.click(); });
    await settle(page);
    expect(await page.evaluate(() => [...document.querySelectorAll('#offers .offer')].map(o => o.dataset.offer).join() === '90' && !document.querySelector('.toast.bad')),
      'declining an offer does not take it off the stack, or a double tap declines twice');
    await page.context().close();
  }
}

async function extras(h) {
  const { open, shot, local, wait, DESKTOP } = h;
  const page = await open(DESKTOP, 'extra');
  await page.evaluate(() => localStorage.removeItem('tycoon:stats'));
  await local(page, [{ name: 'Gaurav', tok: 0, bot: null, dice: 2 }, { name: 'Ava', tok: 1, bot: 'normal', dice: 3 }]);
  await setup(page, sorted);
  // tap the dice on the board to roll; the engine says 1 and 2, the dice must show 1 and 2
  await rig(page, 1, 2);
  await page.evaluate(() => window.__tycoon.scene.focusDice());
  await wait(3000);
  const pt = await page.evaluate(() => window.__tycoon.scene.screenOf('dice'));
  await page.mouse.click(pt.x, pt.y);
  await page.waitForFunction(() => window.__tycoon.game.ctl.state.ts.rolled, null, { timeout: 5000 }).catch(() => { throw new Error('tapping the dice did not roll'); });
  await page.waitForFunction(() => !!document.querySelector('.sum-bubble'), null, { timeout: 15000 });
  await page.evaluate(() => { const S = window.__tycoon.scene, c = S.diceCentre(); S.focusDice(); });
  await wait(300);
  await shot(page, 'dice-1-2');
  await settle(page);
  await tap(page, '#center [data-act="buy"]');
  await page.waitForSelector('.ach-pop', { timeout: 8000 });
  await shot(page, 'achievement');
  await tap(page, '[data-act="emotes"]', { noIdle: true });
  expect(await page.evaluate(() => [...document.querySelectorAll('#emotes [data-act="emote"]')].every(b => { const i = b.querySelector('img.e3d'); return i && i.complete && i.naturalWidth > 0 && i.alt === b.dataset.e; })), 'the emote picker shows flat emoji');
  await tap(page, '[data-act="emote"][data-e="🔥"]', { noIdle: true });
  await page.waitForSelector('.emote-pop', { timeout: 4000 });
  expect(await page.evaluate(() => !!document.querySelector('.emote-pop img.e3d[alt="🔥"]')), 'the emote pop is not a 3D render');
  await shot(page, 'emote-local');
  await page.evaluate(() => document.querySelector('[data-act="settings"]').click());
  await wait(500);
  await shot(page, 'settings');
  // in-game rules follow this game's house rules
  const rulesText = async () => {
    await page.evaluate(() => document.querySelector('[data-act="settings"]').click());
    await page.evaluate(() => document.querySelector('.sheet [data-act="rules"]').click());
    return page.evaluate(() => document.querySelector('.sheet-rules').textContent);
  };
  let rules = await rulesText();
  expect(rules.includes('you own every street in a colour set') && rules.includes('a street holds up to 4 houses'), 'in-game rules miss the building rules');
  await shot(page, 'rules');
  await setup(page, s => { s.settings.quickHotels = true; });
  rules = await rulesText();
  expect(rules.includes('a street holds up to 3 houses') && /Quick HotelsHotels after 3 houses instead of 4\.On/.test(rules), 'in-game rules ignore Quick Hotels');
  await setup(page, s => { s.settings.quickHotels = false; });
  await page.evaluate(() => document.querySelector('[data-act="settings"]').click());
  await page.evaluate(() => document.querySelector('[data-act="leave"]').click());
  await page.click('[data-act="help"]');
  const help = await page.evaluate(() => document.querySelector('.help').textContent);
  expect(help.includes('you own every street in a colour set') && help.includes('Speed Die') && help.includes('Quick Mode'), 'how to play misses rules');
  await shot(page, 'how-to-play');
  await page.click('[data-act="title"]');
  await page.click('[data-act="ach"]');
  await shot(page, 'achievements');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#menu')).opacity) === '1', 'achievements screen is see-through');
  expect(await page.evaluate(() => document.querySelectorAll('.ach .trophy3d').length === document.querySelectorAll('.ach').length), 'achievement trophies are not 3D');
  const got = await page.evaluate(() => document.querySelectorAll('.ach.got').length);
  expect(got >= 1, 'no achievement recorded');
  await page.click('[data-act="title"]');
  expect(await page.evaluate(() => !!document.querySelector('[data-act="continue"]')), 'no saved game to continue');
  await page.click('[data-act="continue"]');
  await page.waitForFunction(() => window.__tycoon.game && window.__tycoon.game.presenter.view);
  const s = await st(page);
  expect(s.props[3].o === 'p1', 'saved game lost the purchase');
  await shot(page, 'continued');
  await page.evaluate(() => document.querySelector('[data-act="log"]').click());
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.sheet')).paddingLeft)) > 0, 'log sheet lost its padding');
  await page.evaluate(() => document.querySelector('.sheet [data-act="close"]').click());
  // tokens walk at a readable pace: six squares at normal speed take about two seconds
  const walk = await page.evaluate(async () => {
    const S = window.__tycoon.scene; S.setSpeed(1);
    const t0 = performance.now(); await S.hop('p1', [4, 5, 6, 7, 8, 9]); return performance.now() - t0;
  });
  expect(walk > 1700 && walk < 4000, 'six-square walk took ' + Math.round(walk) + 'ms');
  // a player's property chips open their deeds; Back returns to the player
  await page.evaluate(() => document.querySelector('.seat[data-id="p1"]').click());
  await page.evaluate(() => document.querySelector('.sheet .tags .tag').click());
  expect(await page.evaluate(() => !!document.querySelector('.sheet .deed') && !!document.querySelector('.sheet [data-act="back"]')), 'a property chip did not open its deed');
  // the deed is a tilted card with the square's 3D landmark on its header, under 3D close and Back icons
  const deedTilt = () => page.evaluate(() => { const d = document.querySelector('.sheet .deed'); d.getAnimations({ subtree: true }).forEach(a => a.finish()); return getComputedStyle(d).transform; });
  const rest = await deedTilt();
  // a refresh while it is open does not flip it in again
  const reflip = await page.evaluate(() => new Promise(res => {
    const old = document.querySelector('.sheet .deed'), c = window.__tycoon.game.ctl;
    new MutationObserver((m, o) => { const d = document.querySelector('.sheet .deed'); if (d && d !== old) { o.disconnect(); res(d.getAnimations().some(a => a.animationName === 'deedIn')); } }).observe(document.querySelector('.sheet'), { childList: true, subtree: true });
    setTimeout(() => res('no refresh'), 3000);
    c.load(structuredClone(c.state));
  }));
  expect(reflip === false, 'the open deed flips in again on every refresh: ' + reflip);
  await page.waitForFunction(() => [...document.querySelectorAll('.sheet .deed-h img, .sheet .close img.i3d, .sheet .back img.i3d')].filter(i => i.complete && i.naturalWidth > 0).length === 3, null, { timeout: 3000 }).catch(() => {});
  expect(rest !== 'none' && await page.evaluate(() => [...document.querySelectorAll('.sheet .deed-h img, .sheet .close img.i3d, .sheet .back img.i3d')].filter(i => i.complete && i.naturalWidth > 0).length === 3), 'the deed is flat');
  // it leans toward the pointer and settles back when the pointer leaves
  const box = await page.locator('.sheet .deed').boundingBox();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.3); // inside the card: a tilted card's box corners lie outside it
  await wait(300);
  const leaned = await deedTilt();
  await page.mouse.move(2, box.y + box.height + 120);
  await wait(300);
  expect(leaned !== rest && await deedTilt() === rest, 'the deed does not tilt toward the pointer');
  await shot(page, 'chip-deed');
  await page.evaluate(() => document.querySelector('.sheet [data-act="back"]').click());
  expect(await page.evaluate(() => document.querySelector('.sheet').classList.contains('sheet-player')), 'Back did not return to the player');
  await page.evaluate(() => document.querySelector('.sheet [data-act="close"]').click());
  // Tabletop view, picked in the menu: the whole board from above, holding still while a token walks
  const cam = () => page.evaluate(() => { const c = window.__tycoon.scene.camera; return [c.position.x, c.position.y, c.position.z, -c.matrixWorld.elements[9]]; });
  const moved = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const fresh = s => { s.pend = null; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; };
  await page.evaluate(() => document.querySelector('[data-act="settings"]').click());
  await page.evaluate(() => document.querySelector('.sheet [data-k="view"][data-v="table"]').click());
  expect(await page.evaluate(() => document.querySelector('#topBtn').getAttribute('aria-pressed')) === 'true', 'the top-view button does not show Tabletop');
  await page.evaluate(() => document.querySelector('.sheet [data-act="close"]').click());
  await setup(page, fresh);
  await wait(3500);
  const c0 = await cam();
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]');
  const c1 = await cam();
  await shot(page, 'tabletop');
  expect(c0[3] < -0.99 && moved(c0, c1) < 0.01, `Tabletop camera not overhead or moved: ${c0} -> ${c1}`);
  expect(await page.evaluate(() => [0, 10, 20, 30].every(q => { const p = window.__tycoon.scene.screenOf(q); return p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight; })), 'Tabletop cuts off the board');
  const span = await page.evaluate(() => { const ys = [0, 10, 20, 30].map(q => window.__tycoon.scene.screenOf(q).y); return (Math.max(...ys) - Math.min(...ys)) / innerHeight; });
  expect(span > 0.7, 'Tabletop board too small: corner squares span ' + span.toFixed(2) + ' of the screen height');
  // no streets beside the board: the ring road's grey would sit at the screen's left edge
  const grey = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => {
    const gl = window.__tycoon.scene.renderer.domElement, k = gl.width / gl.clientWidth;
    const cv = document.createElement('canvas'); cv.width = 40 * k; cv.height = 40 * k;
    const x = cv.getContext('2d'); x.drawImage(gl, 105 * k, (innerHeight / 2 - 20) * k, cv.width, cv.height, 0, 0, cv.width, cv.height);
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) < 140 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 25) n++;
    res(n / (d.length / 4));
  })));
  expect(grey < 0.1, 'Tabletop still shows the road beside the board: ' + grey.toFixed(2) + ' road-grey');
  // the wheel zooms in, still straight down; Recentre shows the whole board again
  await page.mouse.move(400, 450); // on the board, clear of the decision panel
  await page.mouse.wheel(0, -800);
  await wait(1200);
  const cz = await cam();
  await page.click('[data-act="camCenter"]');
  await wait(2500);
  const cr = await cam();
  expect(cz[1] < c1[1] * 0.8 && cz[3] < -0.99 && Math.abs(cr[1] - c1[1]) < 0.05, `Tabletop zoom wrong: ${c1[1]} -> ${cz[1]} -> ${cr[1]}`);
  // an owned square carries its owner's plate: Gaurav's red on square 3, between its name and the board edge
  const red = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => {
    const T = window.__tycoon, gl = T.scene.renderer.domElement, at = T.scene.screenOf(3), k = gl.width / gl.clientWidth;
    const cv = document.createElement('canvas'); cv.width = 60 * k; cv.height = 40 * k;
    const x = cv.getContext('2d'); x.drawImage(gl, (at.x - 30) * k, (at.y + 15) * k, cv.width, cv.height, 0, 0, cv.width, cv.height);
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 170 && d[i + 1] < 120 && d[i + 2] < 120) n++;
    res(n);
  })));
  expect(red > 800, 'no owner plate on an owned square (' + red + ' red pixels)');
  const lm = await page.evaluate(() => window.__tycoon.scene.landmark(3));
  expect(lm.visible && Math.max(Math.abs(lm.at[0]), Math.abs(lm.at[2])) > 5.2, 'the landmark stands on the board: ' + lm.at);
  // the top-view button switches back to Follow, which moves with the token again
  await page.click('[data-act="camTop"]');
  await setup(page, fresh);
  await wait(3500);
  const c2 = await cam();
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]');
  expect(moved(c2, await cam()) > 0.5, 'Follow camera did not move');
  // a tall landmark between the camera and its square fades out of the way, and comes back
  // still to roll, so no turn ends by itself and no move pulls the camera away
  await setup(page, s => { s.props[37].o = 'p2'; s.turn = 0; s.pend = null; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
  await page.evaluate(() => window.__tycoon.scene.focus(37, 0.45));
  await wait(2500);
  const faded = (await page.evaluate(() => window.__tycoon.scene.landmark(37))).opacity;
  await page.evaluate(() => window.__tycoon.scene.focus(3, 0.45));
  await wait(2500);
  const back = (await page.evaluate(() => window.__tycoon.scene.landmark(37))).opacity;
  expect(faded < 0.5 && back > 0.95, `landmark fade wrong: ${faded} in front, ${back} aside`);
  // Start Bonus: landing right on Start shows the $400 it pays
  await setup(page, s => { s.pend = null; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; s.settings.doubleGo = true; Object.assign(s.players[0], { pos: 37, jail: false }); });
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]', { noIdle: true });
  await page.waitForFunction(() => [...document.querySelectorAll('.float')].some(e => e.textContent === '+$400'), null, { timeout: 15000 })
    .catch(() => { throw new Error('landing on Start with Start Bonus does not show +$400'); });
  await settle(page);
  // Land and Build: a street of an unfinished set takes one house on the turn you land on it
  await setup(page, s => { s.pend = null; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; Object.assign(s.settings, { landAny: true, landBuild: false }); Object.assign(s.props[3], { o: 'p1', h: 0, m: false }); s.props[1].o = null; Object.assign(s.players[0], { pos: 0, jail: false }); });
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]');
  await tap(page, '[data-act="manage"]');
  expect(await page.evaluate(() => { const b = document.querySelector('.sheet [data-act="build"][data-pos="3"]'); return !!b && !b.disabled; }), 'Land and Build shows no + on a street of an unfinished set');
  await tap(page, '.sheet [data-act="build"][data-pos="3"]');
  expect(await page.evaluate(() => { const b = document.querySelector('.sheet [data-act="build"][data-pos="3"]'); return window.__tycoon.game.ctl.state.props[3].h === 1 && !!b && b.disabled && /Land here again/.test(b.title); }),
    'Land and Build did not take exactly one house on the landed street');
  await tap(page, '.sheet [data-act="close"]');
  // Auction Only with a Hustle: the auction opens on landing, and its clock waits for the walk there to play out
  await setup(page, s => {
    s.pend = null; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false };
    Object.assign(s.settings, { auctionOnly: true, speedDie: true, landAny: false });
    Object.assign(s.players[0], { pos: 36, lap: true, jail: false, cash: 1500 }); // a house to build keeps the turn from ending at once
    s.players[1].cash = 0; // so the bot cannot bid, and the opening clock is what shows
    [37, 39].forEach(q => Object.assign(s.props[q], { o: 'p1', h: 0, m: false }));
    Object.assign(s.props[1], { o: null, h: 0, m: false });
  });
  await rig(page, 1, 2, 4);
  await tap(page, '[data-act="roll"]', { noIdle: true });
  await page.waitForSelector('#center .auc', { timeout: 20000 });
  const aucLeft = await page.evaluate(() => window.__tycoon.game.ctl.state.pend.end - Date.now());
  expect(aucLeft > 18000 && aucLeft <= 20300, `the auction clock does not run 20 seconds from when it shows: ${aucLeft} ms left`);
  await page.waitForFunction(() => !window.__tycoon.game.ctl.state.pend, null, { timeout: 30000 });
  await settle(page);
  // a hidden tab does not count as showing an auction; it reports once it is in view
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await setup(page, s => { s.pend = { k: 'auc', pos: 39, bid: 0, by: null, end: Date.now() + 60000, out: [], n: 0 }; Object.assign(s.props[39], { o: null, h: 0, m: false }); });
  expect(await page.evaluate(() => !!document.querySelector('#center .auc') && !window.__tycoon.game.ctl.state.pend.shown), 'a hidden tab reported the auction as shown');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  expect(await page.evaluate(() => { const pd = window.__tycoon.game.ctl.state.pend; return pd.shown && pd.shown.join() === 'p1' && Math.abs(pd.end - Date.now() - 20000) < 1000; }),
    'the auction was not reported once the tab came into view');
  // the ring and the turn bar show the time really left, not a full countdown from when this screen saw it
  await setup(page, s => { s.settings.turnSec = 30; s.turnEnd = Date.now() + 15000; Object.assign(s.pend, { end: Date.now() + 5000, shown: ['p1'] }); });
  // read both once drawn: a bot dropping out redraws the panel and the dock
  const clocks = await page.waitForFunction(() => {
    const n = document.querySelector('#aucN'), b = document.querySelector('#turnBar');
    return n && n.textContent && b && b.style.transform && [n.textContent, parseFloat(b.style.transform.slice(7))];
  }, null, { timeout: 3000 }).then(r => r.jsonValue(), () => ['', NaN]);
  expect(['4', '5'].includes(clocks[0]) && clocks[1] > 0.4 && clocks[1] < 0.5, `the auction ring or turn bar ignores the deadline: ring ${clocks[0]}, bar ${clocks[1]}`);
  await setup(page, s => { s.pend = null; s.settings.turnSec = 0; });
  // with a house to build, an idle turn ends itself 5 seconds after End turn shows; an open panel holds it, a key press
  // starts the count again, a trade neither holds it nor starts it again; with nothing left to do it ends at once
  const endTurnShows = (s, build) => {
    s.turn = 0; s.debts = []; s.pend = null; s.players[0].jail = false; s.players[0].cash = 1500;
    s.ts = { roll: false, rolled: true, dbl: 0, hustle: false };
    for (const q in s.props) if (s.props[q].o === 'p1') Object.assign(s.props[q], { o: null, h: 0, m: false });
    if (build) [1, 3].forEach(q => Object.assign(s.props[q], { o: 'p1', h: 0, m: false }));
  };
  await setup(page, `s => (${endTurnShows})(s, true)`);
  await tap(page, '[data-act="log"]', { noIdle: true });
  await wait(6000);
  expect(await page.evaluate(() => window.__tycoon.game.ctl.state.turn === 0 && !!document.querySelector('.sheet-log')), 'the turn ended while a panel was open');
  await page.keyboard.press('Escape');
  await wait(3000);
  const label = await page.textContent('[data-act="endTurn"]');
  expect(/End turn · [1-3]/.test(label), 'End turn does not count down: ' + label);
  await page.keyboard.press('Shift');
  const pressed = Date.now();
  await wait(4000);
  expect(await page.evaluate(() => window.__tycoon.game.ctl.state.turn === 0), 'a key press did not start the idle count again');
  const ended = await page.waitForFunction(() => window.__tycoon.game.ctl.state.turn === 1, null, { timeout: 4000 }).then(() => true, () => false);
  expect(ended && Date.now() - pressed < 6500, 'an idle turn did not end itself 5 seconds after a key press: ' + (Date.now() - pressed) + ' ms');
  await setup(page, `s => (${endTurnShows})(s, true)`);
  await tap(page, '[data-act="tradeNew"]', { noIdle: true });
  const traded = Date.now();
  await wait(3000);
  await page.locator('.sheet-trade').dispatchEvent('pointerdown');
  const endedTrading = await page.waitForFunction(() => window.__tycoon.game.ctl.state.turn === 1, null, { timeout: 4500 }).then(() => true, () => false);
  expect(endedTrading && Date.now() - traded < 6500, 'a trade held the idle turn open: ' + (Date.now() - traded) + ' ms');
  await page.keyboard.press('Escape');
  // over a slow connection (each action answered after half a second) the turn still ends once, without an error
  await page.evaluate(() => { const c = window.__tycoon.game.ctl, f = c.act; c.slowAct = f; c.act = (...a) => new Promise(r => setTimeout(() => r(f.apply(c, a)), 500)); });
  await setup(page, `s => (${endTurnShows})(s, false)`);
  const shown = Date.now();
  const endedAtOnce = await page.waitForFunction(() => window.__tycoon.game.ctl.state.turn === 1, null, { timeout: 3000 }).then(() => true, () => false);
  expect(endedAtOnce && Date.now() - shown < 1500, 'a turn with nothing left to do did not end at once: ' + (Date.now() - shown) + ' ms');
  await wait(1000); // a second End turn would be refused just after the first
  expect(!(await page.$('.toast.bad')), 'ending the turn by itself raised an error');
  await page.evaluate(() => { const c = window.__tycoon.game.ctl; c.act = c.slowAct; });
  console.log('extras fps', await page.evaluate(() => window.__tycoon.scene.fps()));
  await page.context().close();
}

async function diceCheck(h) {
  const { open, shot, local, wait, DESKTOP } = h;
  const page = await open(DESKTOP, 'dice');
  await local(page, [{ name: 'Gaurav', tok: 0, bot: null }, { name: 'Ava', tok: 1, bot: null }], { speedDie: true });
  await setup(page, sorted);
  const cases = [[5, 6], [1, 4], [2, 3, 3], [6, 6, 5], [4, 1, 1]];
  for (const faces of cases) {
    await setup(page, (s) => { s.pend = null; s.debts = []; s.players[0].lap = true; s.players[0].jail = false; s.players[0].pos = 0; s.turn = 0; s.ts = { roll: true, rolled: false, dbl: 0, hustle: false }; });
    await page.evaluate(n => { if (n === 2) { const s = structuredClone(window.__tycoon.game.ctl.state); s.players[0].lap = false; window.__tycoon.game.ctl.load(s); } }, faces.length);
    await rig(page, ...faces);
    await tap(page, '[data-act="roll"]');
    const shown = await page.evaluate(() => window.__tycoon.scene.diceFaces());
    const want = faces.slice(0, 2);
    expect(JSON.stringify(shown.slice(0, 2)) === JSON.stringify(want) && (faces.length < 3 || shown[2] === faces[2]), `dice show ${shown} for ${faces}`);
    await page.evaluate(() => { window.__tycoon.scene.lookAtDice(); document.querySelector('.hud').style.visibility = 'hidden'; });
    await wait(1600);
    await shot(page, 'faces-' + faces.join(''));
    await page.evaluate(() => { window.__tycoon.scene.recenter(); document.querySelector('.hud').style.visibility = ''; });
  }
  await page.context().close();
}

// a slow device: frames run long, so the renderer should step its resolution down
async function adaptive(h) {
  const { open, local, wait, DESKTOP } = h;
  const page = await open(DESKTOP, 'slow');
  await local(page, [{ name: 'Gaurav', tok: 0, bot: null }, { name: 'Ava', tok: 1, bot: 'normal' }]);
  const before = await page.evaluate(() => window.__tycoon.scene.fps());
  await wait(3000);
  // burn 30 ms of every frame, like a weak GPU would
  await page.evaluate(() => { const burn = () => { const t = performance.now(); while (performance.now() - t < 30); if (!window.__stopBurn) requestAnimationFrame(burn); }; requestAnimationFrame(burn); });
  await wait(8000);
  const after = await page.evaluate(() => window.__tycoon.scene.fps());
  console.log('before', before, 'throttled', after);
  expect(after.dpr < before.dpr, 'resolution did not adapt');
  // still slow at 1x: the post effects go too
  await page.waitForFunction(() => !window.__tycoon.scene.fps().post, null, { timeout: 25000 }).catch(() => { throw new Error('post effects stayed on at 1x'); });
  console.log('at the floor', await page.evaluate(() => window.__tycoon.scene.fps()));
  await page.evaluate(() => { window.__stopBurn = true; });
  await page.context().close();
}

// The game keeps itself on a phone: with the network hanging, then gone, it loads and plays Pass & Play for three
async function offline(h) {
  const { open, shot, wait, PHONE } = h;
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  let hang = false;
  // dist on a server of its own, so the test can take the network away
  const srv = http.createServer((req, res) => {
    if (hang) return;
    const rel = new URL(req.url, 'http://x').pathname.slice(1) || 'index.html';
    fs.readFile(path.join('dist', rel), (e, b) => (e ? res.writeHead(404).end() : res.writeHead(200, { 'content-type': TYPES[path.extname(rel)] }).end(b)));
  });
  await new Promise(r => srv.listen(0, r));
  const page = await open(PHONE, 'offline');
  const booted = () => page.waitForFunction(() => window.__tycoon && window.__tycoon.scene, null, { timeout: 60000 });
  await page.goto(`http://localhost:${srv.address().port}/`);
  await page.waitForFunction(() => navigator.serviceWorker.controller && window.__tycoon && window.__tycoon.scene, null, { timeout: 60000 });
  const kept = await page.evaluate(async () => { const k = (await caches.keys()).find(n => n.startsWith('tycoon-')); return (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname); });
  console.log('kept on the device', kept);
  expect(kept.includes('/') && kept.includes('/icon.png') && kept.includes('/manifest.webmanifest') && ['.js', '.css'].every(x => kept.some(f => f.endsWith(x))) && kept.filter(f => f.endsWith('.woff2')).length === 3, 'the device does not keep every file of the game');
  // a plane's Wi-Fi that never answers: the saved game opens anyway
  hang = true;
  const t0 = Date.now();
  await page.reload({ timeout: 20000 }).catch(() => { throw new Error('the game did not open on a network that never answers'); });
  await booted();
  console.log('opened on a hanging network in', Date.now() - t0, 'ms');
  // and with no network at all
  srv.closeAllConnections();
  await new Promise(r => srv.close(r));
  await page.reload();
  await booted();
  expect(await page.evaluate(async () => {
    await document.fonts.ready;
    return ['Limelight', 'Manrope', 'Archivo Narrow'].every(f => [...document.fonts].some(ff => ff.family.replace(/['"]/g, '') === f && ff.status === 'loaded'));
  }), 'a font did not load with the network gone');
  expect(await page.evaluate(async () => {
    const m = await (await fetch('manifest.webmanifest')).json(), icon = await fetch(m.icons[0].src);
    return m.display === 'fullscreen' && icon.ok && (await icon.blob()).type === 'image/png';
  }), 'the home screen manifest or icon is not kept offline');
  await page.click('[data-act="mode"][data-v="pass"]');
  await page.click('[data-act="addSeat"]');
  await page.click('[data-act="startLocal"]');
  await page.waitForFunction(() => window.__tycoon.game && window.__tycoon.game.presenter.view);
  await settle(page);
  expect((await st(page)).players.length === 3, 'Pass & Play did not seat three players');
  await rig(page, 1, 2);
  await tap(page, '[data-act="roll"]');
  await shot(page, 'pass-and-play');
  const played = await st(page);
  expect(played.players.some(p => p.pos === 3), 'the roll did not move the player');
  // the phone closes the app mid-game: it reopens offline and carries on
  await wait(1000);
  await page.reload();
  await booted();
  await page.click('[data-act="continue"]');
  await page.waitForFunction(() => window.__tycoon.game && window.__tycoon.game.presenter.view);
  const back = await st(page);
  expect(back.players.length === 3 && back.players.every(p => p.pos === played.players.find(q => q.id === p.id).pos), 'the saved game did not come back offline');
  await shot(page, 'continued');
  await page.context().close();
}

export default {
  adaptive,
  diceCheck,
  extras,
  offers,
  offline,
  online,
  onlineAuction,
  gameBots: h => fullGame(h, 'bots', BOTS, {}),
  gamePass: h => fullGame(h, 'pass', [{ name: 'Gaurav', tok: 0, bot: null }, { name: 'Ava', tok: 1, bot: null }, { name: 'Kabir', tok: 4, bot: null }], { quickEnd: true }),
  gameQuick: h => fullGame(h, 'quick', BOTS, { skipSpaces: true, quickEnd: true, quickHotels: true, quickJail: true, theme: 'neon' }),
  gameSpeed: h => fullGame(h, 'speed', BOTS, { speedDie: true, theme: 'snow' }),
  themes,
  flowsDesktop: h => flows(h, h.DESKTOP, 'desk'),
  flowsPhone: h => flows(h, h.PHONE, 'phone'),
};
