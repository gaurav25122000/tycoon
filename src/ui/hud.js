// The in-game HUD: player seats, turn controls, decision panels, property manager, trades, log, settings.
import * as E from '../engine.js';
import { TOK, svg, esc, inkOn, tokHTML, trophyHTML, iconHTML, emoteHTML, EMOTES, ART3D } from '../art.js';
import { raisePlan } from '../bots.js';
import { sound, sfx, unlockAudio } from '../sound.js';
import { DECK } from '../scene/art2d.js';
import { THEMES } from '../scene/themes.js';

const { BOARD, GROUPS, OWNABLE, money: $ } = E;
const qs = (s, el = document) => el.querySelector(s);
const RULES = [
  ['jackpot', 'Chill Zone Bonus', 'Taxes and fees pile up in the middle. Land on the Chill Zone to take them.'],
  ['skipSpaces', 'Skip Spaces', 'Plot Twist, Group Chat and tax squares are skipped.'],
  ['doubleGo', 'Start Bonus', 'Land exactly on Start to collect $400.'],
  ['noJailRent', 'No Jail Rent', 'Players in jail can’t collect rent.'],
  ['noAuctions', 'No Auctions', 'Property nobody buys stays with the bank.'],
  ['auctionOnly', 'Auction Only', 'Property is only ever sold at auction.'],
  ['quickEnd', 'Quick End', 'The first bankruptcy ends the game. The richest player wins.'],
  ['quickHotels', 'Quick Hotels', 'Hotels after 3 houses instead of 4.'],
  ['quickJail', 'Quick Jail', 'Leave jail after one missed roll.'],
  ['startDeeds', 'Starting Title Deeds', 'Everyone starts with 3 random properties.'],
  ['speedDie', 'Speed Die', 'A third die joins after your first lap. Everyone starts with $1,000 more.'],
  ['even', 'Build Evenly', 'Houses go up and come down evenly across a set.'],
  ['landBuild', 'Build Where You Land', 'With a full set, build only on the street you landed on this turn.'],
  ['landAny', 'Land and Build', 'Land on a street you own to add one house, full set or not.'],
  ['limited', 'Housing Shortage', 'The bank has only 32 houses and 12 hotels; the last of each goes to auction.'],
  ['incomeTax', 'Classic Income Tax', 'Pay $200 or 10% of everything you own on the Adulting Tax.'],
  ['firstLap', 'First Lap', 'Nobody can buy property until they pass Start once.'],
];
// "No X" rules are stored as the positive setting switched off
export const ruleOn = (st, k) => (k === 'noJailRent' ? !st.jailRent : k === 'noAuctions' ? !st.auctions : !!st[k]);
export const ruleSet = (k, v) => (k === 'noJailRent' ? { jailRent: !v } : k === 'noAuctions' ? { auctions: !v } : { [k]: v });
export { RULES };

// The full rules, worded for one game's settings; `live` marks which house rules are on.
export function rulebookHTML(st, live) {
  const top = E.maxHouses({ settings: st }), tries = st.quickJail ? 'once' : 'three times';
  const sec = (t, body, open) => `<details${open ? ' open' : ''}><summary>${t}</summary>${body}</details>`;
  const ul = items => `<ul>${items.filter(Boolean).map(i => `<li>${i}</li>`).join('')}</ul>`;
  return `<div class="help">${[
    sec('Goal', ul([
      'Be the last player with money left. Buy property, build houses and hotels, and collect rent until everyone else goes bankrupt.',
      st.quickEnd && 'Quick End: the first bankruptcy ends the game and the richest player wins.',
      st.timeLimit && `When the ${st.timeLimit}-minute time limit runs out, the richest player wins.`,
      (st.quickEnd || st.timeLimit) && `Richest means cash, plus property at its price (half if mortgaged), plus buildings at cost${st.limited && st.auctions ? ' (what you paid, for one won at auction and not built yet)' : ''}.`,
    ]), true),
    sec('Your turn', ul([
      `Everyone starts with ${$(st.startCash + (st.speedDie ? 1000 : 0))}${st.speedDie ? ' (the Speed Die adds $1,000)' : ''}. The first player is picked at random.`,
      'Roll two dice and move that many squares clockwise.',
      'Doubles: move, then roll again. Three doubles in a row send you straight to jail.',
      `Pass or land on Start to collect $200${st.doubleGo ? '; land exactly on it for $400' : ''}.`,
      'After moving you can build, trade and mortgage, then tap End turn. The turn ends by itself when there is nothing left to build, or after 5 seconds without a tap.',
      st.turnSec && `Each turn has ${st.turnSec} seconds. When time runs out the game rolls for you, passes on property and ends the turn.`,
    ])),
    sec('Buying property', ul([
      st.auctionOnly ? 'Auction Only: unowned property you land on always goes to auction. Nobody pays the printed price.'
        : `Land on an unowned street, station or utility to buy it at its price. ${st.auctions ? 'If you don’t, it goes to auction.' : 'If you don’t, it stays with the bank.'}`,
      st.firstLap && 'First Lap: nobody can buy property until they have passed Start once.',
      st.auctions && `Auctions: everyone can bid, the player who passed too. Bids go up by $10, $50 or $100. The clock starts at ${E.AUC_START / 1000} seconds once every player has the auction on screen, and resets to ${E.AUC_RESET / 1000} after each bid. The top bid when it runs out wins; tap Pass to drop out. Nobody bids and the bank keeps it.`,
    ])),
    sec('Rent', ul([
      'Streets: the rent on the deed. Own the whole colour set and streets without buildings charge double. Houses and hotels charge much more.',
      'Stations: $25, $50, $100 or $200 for owning 1, 2, 3 or all 4.',
      'Utilities: 4 times the dice roll if you own one, 10 times if you own both.',
      'Mortgaged property charges no rent.',
      st.jailRent ? 'Owners in jail still collect rent.' : 'No Jail Rent: owners in jail collect nothing.',
      'Tap any square to see its deed and rents.',
    ])),
    sec('Houses and hotels', ul([
      `<b>When you can build:</b> ${st.landAny ? 'you own the street, full set or not, and none of your streets in its set is mortgaged' : 'you own every street in a colour set and none of them is mortgaged'}. Stations and utilities never get buildings.`,
      st.landAny ? 'Land and Build: land on a street you own, full set or not, and add one house to it. One house per landing, and a street you just bought waits for your next landing. Open Properties and tap + on it.'
        : st.landBuild ? 'Build Where You Land: on your turn, build only on the street you just landed on. A street you just bought waits for your next landing. Open Properties and tap + on it.'
        : 'Build on your own turn, before or after you roll, even from jail. Open Properties and tap + on a street.',
      'Each house costs the house price on the deed: $50 on the first side of the board, $100 on the second, $150 on the third, $200 on the fourth.',
      st.even ? `Build evenly: a street can’t get another house until every street ${st.landAny ? 'you own ' : ''}in its set has as many. With three streets, each gets one house before any gets a second.`
        : 'Build Evenly is off: put houses on any street in the set, in any order.',
      `<b>Hotels:</b> a street holds up to ${top} houses. Once it has ${top}${st.even ? ` and every street ${st.landAny ? 'you own ' : ''}in its set has ${top} or a hotel` : ''}, its next build is a hotel for one more house price. The ${top} houses go back to the bank. One hotel per street is the most.`,
      st.limited ? `Housing Shortage: the bank has only ${E.HOUSES} houses and ${E.HOTELS} hotels. When they run out nobody can build until some are sold back. The bank’s last house and last hotel always go to auction, open to everyone${st.auctions ? '' : ', even with No Auctions'}. A winner keeps the building with their properties and builds it free on one of their turns.`
        : 'The bank never runs out of houses or hotels.',
      `Sell buildings back to the bank any time for half what they cost${st.even ? `, evenly across ${st.landAny ? 'your streets in ' : ''}the set` : ''}. A hotel sells back as ${top} houses${st.limited ? ', or fewer if the bank is short, with the rest paid at half price' : ''}.`,
      'A street can’t be mortgaged or traded while its owner has buildings in its set. Sell the buildings first.',
    ]), true),
    sec('Mortgages', ul([
      'Mortgage any property for half its price. You keep it, but it charges no rent.',
      'Sell your buildings in a colour set before you mortgage one of your streets in it.',
      'Lifting a mortgage costs the mortgage value plus 10%.',
      'Get mortgaged property in a trade or from a bankrupt player and you pay the bank 10% straight away. Then lift it right away for just the mortgage value, or keep it and pay the full 110% later.',
    ])),
    sec('Cards, taxes and corners', ul([
      'Plot Twist and Group Chat: draw a card and do what it says. Get-out-of-jail-free cards can be kept, used or traded.',
      `Adulting Tax: pay $200${st.incomeTax ? ', or 10% of everything you own, your choice (Classic Income Tax)' : ''}. Splurge Tax: pay $100.`,
      st.skipSpaces && 'Skip Spaces: card and tax squares are skipped and don’t count as steps.',
      st.jackpot ? 'Chill Zone Bonus: taxes and fees pile up in the middle; land on the Chill Zone to take them.' : 'Chill Zone: nothing happens.',
      'Jail corner: just visiting if you land on it by a normal move.',
    ])),
    sec('Jail', ul([
      'You go to jail from Go to Jail, from a go-to-jail card, or by rolling doubles three times in a row. You don’t pass Start or collect $200.',
      'Before rolling, pay $50 or use a get-out-of-jail-free card, then roll and move as usual.',
      'Or roll for doubles: doubles let you out and you move by that roll, with no extra roll.',
      `Miss ${tries} and you pay $50 and move by that last roll.`,
      `In jail you can still ${st.landBuild || st.landAny ? '' : 'build on your turn, '}trade and mortgage${st.jailRent ? ', and collect rent' : ''}.`,
    ])),
    sec('Money trouble and bankruptcy', ul([
      'Owe more cash than you have and you must raise the rest: sell buildings, mortgage property or make a trade. “Raise it for me” picks the cheapest way.',
      `Can’t raise enough? Declare bankruptcy and you are out. Your buildings are sold to the bank for half${st.limited && st.auctions ? ', and any you won at auction but haven’t built for half what you paid' : ''}.`,
      `Owe one player and they take your cash, property and cards. Owe the bank and your property goes back to the bank${st.auctions ? ' and is auctioned' : ''}.`,
    ])),
    sec('Trading', ul([
      'Trade property, cash and get-out-of-jail-free cards with anyone, any time, even when it isn’t your turn.',
      'They can accept, decline or send a counter-offer. You can have up to 3 offers open at once.',
      'A street can’t be traded while its owner has buildings in its set. Sell the buildings first.',
    ])),
    (st.speedDie || !live) && sec('Speed Die', ul([
      !live && 'With the Speed Die rule on, everyone starts with $1,000 more.',
      'After your first lap a red third die joins your rolls (not while you are in jail).',
      '1, 2 or 3: add it to your move. It counts towards utility rent too.',
      'Hustle: move as usual and settle that square (buy, pay rent), then go on to the next unowned property. If everything is owned, go to the next square where you owe rent.',
      'Bus: move by one die or by both, your choice.',
      'Triples, all three dice the same: go to any square you like. Your turn then ends.',
    ])),
    sec(live ? 'House rules in this game' : 'House rules', RULES.map(([k, t, d]) => `<div class="rule"><div class="grow"><b>${t}</b><small>${d}</small></div>${live ? `<span class="pill ${ruleOn(st, k) ? 'on' : ''}">${ruleOn(st, k) ? 'On' : 'Off'}</span>` : ''}</div>`).join('')
      + (live ? '' : '<p><b>Quick Mode</b> turns on Skip Spaces, Quick End, Quick Hotels and Quick Jail, for a game in under an hour.</p>')),
    sec('Controls', ul([
      'Roll: tap Roll, tap the dice, or press Space.',
      'Drag to orbit, scroll or pinch to zoom, right-drag to pan.',
      'Camera: Follow moves with the play; Tabletop holds the whole board still, seen from above without the streets, and pinch or scroll zooms in (drag to look around). Pick one in the Menu or with the top-view button.',
      'Tap any square, or any property in a player’s list, to see its deed. The recentre button brings the camera back.',
    ])),
  ].filter(Boolean).join('')}</div>`;
}

export function deedHTML(pos, s) {
  const sq = BOARD[pos], pr = s && s.props[pos];
  const gc = sq.t === 'prop' ? GROUPS[sq.g].c : '#3b3f4a';
  const h = pr ? pr.h : 0, has = pr && pr.o;
  let rows;
  if (sq.t === 'prop') {
    const full = has && E.ownsGroup(s, pr.o, sq.g);
    rows = [['Rent', $(sq.rent[0]), has && h === 0 && !full], ['With full set', $(sq.rent[0] * 2), has && h === 0 && full],
      ['1 house', $(sq.rent[1]), h === 1], ['2 houses', $(sq.rent[2]), h === 2], ['3 houses', $(sq.rent[3]), h === 3]];
    if (!s || !s.settings.quickHotels) rows.push(['4 houses', $(sq.rent[4]), h === 4]);
    rows.push(['Hotel', $(sq.rent[5]), h === 5], ['Houses cost', $(sq.hc) + ' each']);
  } else if (sq.t === 'station') {
    const n = has ? E.STATIONS.filter(p => s.props[p].o === pr.o).length : 0;
    rows = [['1 station', '$25', n === 1], ['2 stations', '$50', n === 2], ['3 stations', '$100', n === 3], ['4 stations', '$200', n === 4]];
  } else {
    const n = has ? E.UTILS.filter(p => s.props[p].o === pr.o).length : 0;
    rows = [['One utility', '4 × roll', n === 1], ['Both utilities', '10 × roll', n === 2]];
  }
  rows.push(['Mortgage value', $(sq.price / 2)]);
  const lm = ART3D.landmark && ART3D.landmark(pos);
  return `<div class="deed"><div class="deed-h" style="background:${gc};color:${sq.t === 'prop' ? inkOn(gc) : '#fff'}">${lm ? `<img src="${lm}" alt="">` : ''}<div><small>${sq.t === 'prop' ? esc(GROUPS[sq.g].n) : sq.t === 'station' ? 'Station' : 'Utility'}</small><b>${esc(sq.n)}</b></div></div>
    <table>${rows.map(r => `<tr class="${r[2] ? 'now' : ''}"><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>
    <div class="deed-price">Price ${$(sq.price)}</div></div>`;
}
const swatch = pos => (BOARD[pos].t === 'prop' ? GROUPS[BOARD[pos].g].c : BOARD[pos].t === 'station' ? '#3b3f4a' : '#7a8794');

export function makeHUD({ root, scene, ctl, mascot, onLeave, onAgain, settings }) {
  const ui = { view: null, shown: null, sheet: null, trade: null, actAs: null, busy: false, picking: false, holdDone: null, online: new Set(), idleFrom: 0 };
  root.innerHTML = `
    <div class="hud-top">
      <button class="hbtn" data-act="settings" aria-label="Menu and settings">${iconHTML('menu')}</button>
      <div class="status" id="status" aria-live="polite"></div>
      <div class="tools">
        <button class="hbtn" data-act="camTop" id="topBtn" aria-label="Tabletop view" title="Tabletop view">${iconHTML('top')}</button>
        <button class="hbtn" data-act="camCenter" aria-label="Recentre camera" title="Recentre">${iconHTML('center')}</button>
        <button class="hbtn" data-act="sound" id="soundBtn" aria-label="Sound"></button>
      </div>
    </div>
    <div class="seats" id="seats"></div>
    <div class="bottom"><div class="center" id="center"></div><div class="offers" id="offers"></div></div>
    <div class="dock" id="dock"></div>
    <div class="fxlayer" id="fxlayer"></div>
    <div class="banner-host" id="banner"></div>
    <div class="toasts" id="toasts"></div>
    <div class="scrim" id="scrim" hidden><div class="sheet" id="sheet" role="dialog" aria-modal="true"></div></div>`;
  const $seats = qs('#seats', root), $center = qs('#center', root), $offers = qs('#offers', root), $dock = qs('#dock', root), $sheet = qs('#sheet', root), $scrim = qs('#scrim', root);
  if (ctl.onPeers) ctl.onPeers(set => { ui.online = set; if (ui.view) renderSeats(); });
  const P = id => ui.view && E.player(ui.view, id);
  const human = id => ctl.mine.has(id) && P(id) && !P(id).bot;
  const locals = () => ui.view.players.filter(p => human(p.id) && !p.out);
  const nm = id => { const p = P(id); return p ? (ctl.mine.size === 1 && ctl.mine.has(id) ? 'You' : p.name) : 'Someone'; };
  function actor() {
    const s = ui.view, c = s.phase === 'play' && E.current(s);
    if (c && human(c.id) && !c.out) return c.id;
    const l = locals();
    return (l.find(p => p.id === ui.actAs) || l[0] || {}).id || null;
  }
  async function act(a, p, who) {
    unlockAudio();
    const id = who || actor();
    if (!id) return;
    const r = await ctl.act(id, a, p || {});
    if (!r.ok) { toast(r.error, true); sfx.bad(); }
    return r;
  }

  // ---------- seats ----------
  function renderSeats() {
    const s = ui.view, cur = s.phase === 'play' ? E.current(s).id : null;
    $seats.innerHTML = s.players.map((p, i) => {
      const owned = OWNABLE.filter(q => s.props[q] && s.props[q].o === p.id);
      const pips = GROUPS.map((g, gi) => { const n = owned.filter(q => BOARD[q].t === 'prop' && BOARD[q].g === gi).length; return n ? `<i style="background:${g.c};opacity:${n === g.pos.length ? 1 : 0.45}"></i>` : ''; }).join('');
      const rr = owned.filter(q => BOARD[q].t !== 'prop').length;
      const off = ctl.mode === 'online' && !p.bot && ui.online.size && !ui.online.has(p.id);
      const tag = p.out ? 'Bankrupt' : p.jail ? 'In jail' : p.bot ? (p.bot === 'normal' ? 'Medium' : p.bot[0].toUpperCase() + p.bot.slice(1)) + ' bot' : off ? 'Offline' : human(p.id) && ctl.mine.size === 1 ? 'You' : '';
      return `<button class="seat s${i} ${p.id === cur ? 'turn' : ''} ${p.out ? 'out' : ''} ${human(p.id) ? 'mine' : ''}" data-act="player" data-id="${esc(p.id)}" style="--c:${TOK[p.tok].c}">
        <span class="seat-tok">${tokHTML(p.tok)}</span>
        <span class="seat-body"><span class="seat-name">${esc(p.name)}</span><span class="seat-cash" data-cash="${esc(p.id)}">${$(Math.max(0, ui.shown.cash[p.id] ?? p.cash))}</span>
        <span class="seat-pips">${pips}${rr ? `<em>+${rr}</em>` : ''}</span></span>
        ${tag ? `<span class="seat-tag">${tag}</span>` : ''}${p.goojf.length ? `<span class="seat-card" title="Get out of jail free">${p.goojf.length}</span>` : ''}</button>`;
    }).join('');
  }
  // cash counters roll to their new value
  const counting = new Map();
  function float(id, a) {
    const el = qs(`[data-cash="${CSS.escape(id)}"]`, $seats);
    if (!el) return;
    el.classList.remove('up', 'down'); void el.offsetWidth; el.classList.add(a > 0 ? 'up' : 'down'); // restart the glow
    const target = Math.max(0, ui.shown.cash[id]), from = counting.get(id) ?? (target - a), t0 = performance.now();
    counting.set(id, from);
    const step = now => {
      const k = Math.min(1, (now - t0) / 600), v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      el.textContent = $(Math.max(0, v)); counting.set(id, v);
      if (k < 1) requestAnimationFrame(step); else counting.delete(id);
    };
    requestAnimationFrame(step);
    const seat = el.closest('.seat'), r = seat.getBoundingClientRect();
    floatAt({ x: r.left + r.width / 2, y: r.bottom }, (a > 0 ? '+' : '−') + $(Math.abs(a)), a > 0 ? 'up' : 'down');
  }
  function floatAt(pt, text, cls) {
    const el = document.createElement('div');
    el.className = 'float ' + (cls || ''); el.textContent = text;
    el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px';
    qs('#fxlayer', root).appendChild(el); setTimeout(() => el.remove(), 1500);
  }
  function bubble(text, pt) {
    if (!pt || pt.behind) return;
    const el = document.createElement('div');
    el.className = 'sum-bubble'; el.textContent = text; el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px';
    qs('#fxlayer', root).appendChild(el); setTimeout(() => el.remove(), 1400);
  }
  function stamp(text) {
    const el = document.createElement('div');
    el.className = 'stamp'; el.textContent = text;
    qs('#fxlayer', root).appendChild(el); setTimeout(() => el.remove(), 1500);
    sfx.stamp();
  }
  function banner(text, kind) {
    const host = qs('#banner', root);
    host.innerHTML = `<div class="banner ${kind || ''}">${esc(text)}</div>`;
  }
  function toast(msg, bad) {
    const box = qs('#toasts', root), t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg;
    box.appendChild(t); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.remove(), 3600);
  }
  function rent(payer, owner, a, pos) {
    const el = document.createElement('div');
    el.className = 'rent-pop';
    el.innerHTML = `<i style="background:${swatch(pos)}"></i><b>${esc(payer)}</b> paid <b>${esc(owner)}</b> <span>${$(a)}</span>`;
    qs('#fxlayer', root).appendChild(el); setTimeout(() => el.remove(), 2600);
  }
  function bidFlash(id, a) {
    const el = qs('#bidbig', root);
    if (el) { el.textContent = $(a); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    const who = qs('#bidwho', root); if (who) who.textContent = `${nm(id)} lead${ctl.mine.has(id) && ctl.mine.size === 1 ? '' : 's'}`;
  }
  // card text for screen readers and a tap to carry on; the 3D card holds until this resolves
  function cardHold(dk, id, local) {
    return () => new Promise(res => {
      const el = document.createElement('div');
      el.className = 'card-read';
      el.innerHTML = `<div class="sr">${esc(DECK[dk].n)}: ${esc(E.CARDS[id].tx)}</div>${local ? '<button class="btn primary" data-hold>OK</button>' : ''}`;
      qs('#fxlayer', root).appendChild(el);
      let done = false;
      const finish = () => { if (done) return; done = true; el.remove(); ui.holdDone = null; res(); };
      ui.holdDone = finish;
      el.addEventListener('click', finish);
      setTimeout(finish, local ? 7000 : 2900);
    });
  }

  // ---------- status, dock and decision panels ----------
  function renderStatus() {
    const s = ui.view, el = qs('#status', root);
    if (s.phase !== 'play') { el.innerHTML = s.phase === 'over' ? '<b>Game over</b>' : ''; return; }
    const c = E.current(s);
    const clock = s.settings.timeLimit && s.deadline ? `<span class="clock" id="gameClock"></span>` : '';
    el.innerHTML = `${human(c.id) ? `<b>${ctl.mine.size > 1 ? esc(c.name) + '’s turn' : 'Your turn'}</b>` : `<b>${esc(c.name)}</b> is playing`}${clock}`;
  }
  const bigBtn = (a, label, icon, extra = '') => `<button class="btn big primary turn-btn" data-act="${a}" ${extra}>${icon ? svg(icon) : ''}<span>${label}</span></button>`;
  function renderDock() {
    const s = ui.view;
    if (s.phase !== 'play') { $dock.innerHTML = ''; return; }
    const c = E.current(s), me = human(c.id), ts = s.ts;
    let main = '';
    const blocked = s.pend || s.debts.length || E.pendingLifts(s, c.id).length;
    if (me && !blocked) {
      if (c.jail && !ts.rolled) {
        main = `<div class="dock-row">${bigBtn('roll', 'Roll for doubles', null)}
          <button class="btn turn-btn" data-act="payJail" ${c.cash >= 50 ? '' : 'disabled'}>Pay $50</button>
          ${c.goojf.length ? '<button class="btn turn-btn" data-act="useCard">Use card</button>' : ''}</div>
          <p class="hint">Attempt ${c.jt + 1} of ${s.settings.quickJail ? 1 : 3}</p>`;
      } else if (ts.roll) main = `<button class="roll turn-btn" data-act="roll" aria-label="Roll the dice">${ART3D.dice[c.dice] ? `<img class="pip-die" src="${ART3D.dice[c.dice]}" alt="">` : '<span class="pip-die"></span>'}<b>${ts.dbl ? 'Roll again' : 'Roll'}</b></button>`;
      else main = bigBtn('endTurn', 'End turn', null);
    } else if (!me) main = `<div class="waiting">${tokHTML(c.tok)}<span>${esc(c.name)} ${c.bot ? 'is thinking…' : 'is playing'}</span></div>`;
    const timer = s.settings.turnSec ? '<div class="timer"><i id="turnBar"></i></div>' : '';
    const l = locals().length;
    $dock.innerHTML = `${timer}<div class="dock-main">${main}</div>
      <div class="dock-side">
        <button class="dbtn" data-act="manage" ${l ? '' : 'disabled'}>${iconHTML('receipt')}<span>Properties</span></button>
        <button class="dbtn" data-act="tradeNew" ${l ? '' : 'disabled'}>${iconHTML('arrow')}<span>Trade</span>${incoming() ? `<em>${incoming()}</em>` : ''}</button>
        <button class="dbtn" data-act="log">${iconHTML('chat')}<span>Log</span></button>
        <button class="dbtn emo" data-act="emotes" aria-label="Emotes" ${l ? '' : 'disabled'}>${emoteHTML('😀')}</button>
      </div>
      <div class="emotes" id="emotes" hidden>${EMOTES.map(e => `<button data-act="emote" data-e="${e}">${emoteHTML(e)}</button>`).join('')}</div>`;
  }
  const incoming = () => ui.view.trades.filter(t => human(t.to)).length;

  function renderCenter() {
    const s = ui.view, pd = s.pend;
    // before the unchanged-panel check: the panel can already be empty when the jump ends, and the squares must stop pulsing
    const picking = !!(s.phase === 'play' && pd && pd.k === 'warp' && human(pd.p));
    if (picking !== ui.picking) { ui.picking = picking; scene.pickMode(picking ? [...Array(40).keys()].filter(q => q !== P(pd.p).pos) : null); }
    const html = s.phase === 'play' ? centerHTML(s) : '';
    const key = html.replace(/\s+/g, ' ');
    if ($center.dataset.key === key) return;
    $center.dataset.key = key;
    $center.innerHTML = html ? `<div class="panel pop">${html}</div>` : '';
    reportAuction();
  }
  // the auction is on this screen now (a hidden tab does not count); its clock waits for every player's screen
  function reportAuction() {
    const pd = ui.view && ui.view.phase === 'play' && ui.view.pend;
    if (!pd || (pd.k !== 'auc' && pd.k !== 'bauc') || document.hidden) return;
    for (const p of locals()) if (!(pd.shown || []).includes(p.id)) ctl.act(p.id, 'aucShown', {});
  }
  document.addEventListener('visibilitychange', reportAuction);
  function centerHTML(s) {
    const pd = s.pend;
    // debts first: nothing moves until they are settled
    const debtor = locals().find(p => s.debts.some(d => d.p === p.id));
    if (debtor) return debtHTML(s, debtor);
    const lift = locals().map(p => E.pendingLifts(s, p.id)[0]).find(Boolean);
    if (lift) {
      const p = P(lift.p), cost = BOARD[lift.pos].price / 2;
      return `<h3>${esc(nm(p.id))} got mortgaged property</h3>${deedHTML(lift.pos, s)}
        <p>The 10% interest is paid. Lift the mortgage now for ${$(cost)}, or keep it and pay ${$(E.unmortgageCost(lift.pos))} later.</p>
        <div class="row"><button class="btn primary" data-act="lift" data-pos="${lift.pos}" data-now="1" data-who="${esc(p.id)}" ${p.cash >= cost ? '' : 'disabled'}>Lift now</button>
        <button class="btn" data-act="lift" data-pos="${lift.pos}" data-now="0" data-who="${esc(p.id)}">Keep mortgaged</button></div>`;
    }
    if (pd && pd.k === 'buy') {
      const sq = BOARD[pd.pos], p = P(pd.p);
      if (!human(pd.p)) return `<div class="mini-deed">${deedHTML(pd.pos, s)}</div><p class="hint">${esc(p.name)} is deciding…</p>`;
      const can = p.cash >= sq.price;
      return `${deedHTML(pd.pos, s)}
        <div class="row"><button class="btn primary big" data-act="buy" ${can ? '' : 'disabled'}>Buy ${$(sq.price)}</button>
        <button class="btn big" data-act="decline">${s.settings.auctions ? 'Auction' : 'Pass'}</button></div>
        ${can ? '' : `<p class="err">You have ${$(p.cash)}. Mortgage or sell to raise money, or ${s.settings.auctions ? 'auction it' : 'pass'}.</p><button class="btn sm" data-act="manage">Manage properties</button>`}`;
    }
    if (pd && (pd.k === 'auc' || pd.k === 'bauc')) return auctionHTML(s, pd);
    if (pd && pd.k === 'bus') {
      const p = P(pd.p);
      if (!human(pd.p)) return `<p class="hint">${esc(p.name)} is choosing a bus stop…</p>`;
      return `<h3>${iconHTML('bus')} Bus</h3><p>Move by one die or both.</p><div class="col">${pd.opts.map(n => {
        const to = E.stepPath(s, p.pos, n).at(-1);
        return `<button class="btn opt" data-act="bus" data-n="${n}" data-to="${to}"><b>${n}</b><span>${esc(BOARD[to].n)}</span></button>`;
      }).join('')}</div>`;
    }
    if (pd && pd.k === 'warp') return human(pd.p) ? `<h3>Triples!</h3><p>Tap any square on the board to jump there.</p>` : `<p class="hint">${esc(P(pd.p).name)} is picking a square…</p>`;
    if (pd && pd.k === 'tax') {
      const p = P(pd.p), pct = Math.floor(E.taxWorth(s, p) / 10);
      if (!human(pd.p)) return `<p class="hint">${esc(p.name)} is doing their taxes…</p>`;
      return `<h3>Adulting Tax</h3><p>Pay $200, or 10% of everything you own.</p><div class="row">
        <button class="btn primary" data-act="tax" data-pick="flat">Pay $200</button><button class="btn" data-act="tax" data-pick="pct">Pay 10% (${$(pct)})</button></div>`;
    }
    return '';
  }
  // incoming offers stack above the dock, newest on top; other players' turns leave them alone
  let offerIds = new Set();
  function renderOffers() {
    const s = ctl.state || ui.view, list = s.phase === 'play' ? s.trades.filter(t => human(t.to)).reverse() : []; // latest state: an answered offer goes at once
    const html = list.map(offerHTML).join('');
    if ($offers.dataset.key === html) return;
    $offers.dataset.key = html;
    $offers.innerHTML = html;
    list.forEach(t => { if (!offerIds.has(t.id)) qs(`[data-offer="${t.id}"]`, $offers).classList.add('pop'); });
    offerIds = new Set(list.map(t => t.id));
  }
  function offerHTML(t) {
    const from = P(t.from), to = ctl.mine.size > 1 ? esc(P(t.to).name) : null;
    return `<div class="offer" data-offer="${t.id}">${tokHTML(from.tok)}
      <div class="offer-deal"><b>${esc(from.name)}</b> offers${to ? ' ' + to : ''}: <small>${to ? to + ' gets' : 'You get'}</small>${sideTags(t.give)}<small>${to ? to + ' gives' : 'You give'}</small>${sideTags(t.get)}</div>
      <div class="row"><button class="btn sm primary" data-act="accept" data-tid="${t.id}" data-who="${esc(t.to)}">Accept</button>
      <button class="btn sm" data-act="counter" data-tid="${t.id}">Counter</button>
      <button class="btn sm ghost" data-act="reject" data-tid="${t.id}" data-who="${esc(t.to)}">Decline</button></div></div>`;
  }
  function debtHTML(s, p) {
    const mine = s.debts.filter(d => d.p === p.id), total = mine.reduce((t, d) => t + d.a, 0), short = total - p.cash;
    const to = mine[0].to, toName = to === 'bank' || to === 'pot' ? 'the bank' : nm(to);
    const plan = short > 0 ? raisePlan(s, p.id, total) : null;
    const planText = plan && plan.steps.length ? plan.steps.map(st => `${st.a === 'sell' ? 'Sell a building on' : 'Mortgage'} ${BOARD[st.p.pos].n}`).join(', ') : '';
    return `<h3>${ctl.mine.size > 1 ? esc(p.name) + ' owes' : 'You owe'} ${$(total)}</h3>
      <p>${short > 0 ? `Raise ${$(short)} more to pay ${esc(toName)}.` : `You have enough. Pay ${esc(toName)} to carry on.`}</p>
      ${short > 0 && plan && plan.cash >= total ? `<button class="btn primary" data-act="autoRaise" data-who="${esc(p.id)}">Raise it for me</button><p class="hint">${esc(planText)}</p>` : ''}
      ${short > 0 && plan && plan.cash < total ? `<p class="err">Even selling everything only reaches ${$(plan.cash)}. Try a trade, or declare bankruptcy.</p>` : ''}
      <div class="row"><button class="btn ${short > 0 ? '' : 'primary'}" data-act="payDebt" data-who="${esc(p.id)}" ${short > 0 ? 'disabled' : ''}>Pay ${$(total)}</button>
      <button class="btn" data-act="manage">Manage</button>
      <button class="btn danger" data-act="bankrupt" data-who="${esc(p.id)}">Bankrupt</button></div>`;
  }
  function auctionHTML(s, a) {
    const top = a.by ? P(a.by) : null, total = a.n ? E.AUC_RESET : E.AUC_START;
    const pool = s.players.filter(p => !p.out && human(p.id));
    const rows = pool.map(p => {
      const out = a.out.includes(p.id), lead = a.by === p.id;
      const incs = [10, 50, 100].map(n => `<button class="btn sm" data-act="bid" data-amt="${a.bid + n}" data-who="${esc(p.id)}" ${!out && !lead && a.bid + n <= p.cash ? '' : 'disabled'}>+${$(n)}</button>`).join('');
      return `<div class="bidrow">${tokHTML(p.tok)}<span class="bn">${esc(ctl.mine.size > 1 ? p.name : 'You')}${lead ? ' · leading' : out ? ' · out' : ''}</span>${incs}<button class="btn sm ghost" data-act="pass" data-who="${esc(p.id)}" ${out || lead ? 'disabled' : ''}>Drop</button></div>`;
    }).join('');
    const what = a.k === 'auc' ? `<div class="mini-deed">${deedHTML(a.pos, s)}</div>` : `<p>One ${a.kind === 'H' ? 'hotel' : 'house'} for whoever bids most. The winner keeps it in Properties and builds it free on their turn.</p>`;
    const outNames = a.out.map(id => esc(P(id) ? P(id).name : '?')).join(', ');
    return `<div class="auc"><div class="auc-head"><div class="ringwrap"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="3"/><circle id="aucRing" cx="18" cy="18" r="15.5" fill="none" stroke="#ffd166" stroke-width="3" stroke-linecap="round" stroke-dasharray="97.4"/></svg><b id="aucN"></b></div>
      <div><div class="hint">${a.k === 'auc' ? 'Auction · ' + esc(BOARD[a.pos].n) : 'Building auction'}</div><div class="bidbig" id="bidbig">${a.by ? $(a.bid) : 'No bids yet'}</div><div class="hint" id="bidwho">${top ? esc(nm(top.id)) + (ctl.mine.has(top.id) && ctl.mine.size === 1 ? ' lead' : ' leads') : 'Any opening bid'}</div></div></div>
      ${what}${rows || '<p class="hint">You’re not in this auction.</p>'}${outNames ? `<p class="hint">Dropped out: ${outNames}</p>` : ''}</div>`;
  }
  const sideTags = side => {
    const parts = [];
    if (side.c) parts.push(`<span class="tag cash">${$(side.c)}</span>`);
    side.p.forEach(p => parts.push(`<span class="tag"><i style="background:${swatch(p)}"></i>${esc(BOARD[p].n)}${ui.view.props[p].m ? ' (mortgaged)' : ''}</span>`));
    if (side.j) parts.push(`<span class="tag">${side.j} jail card${side.j > 1 ? 's' : ''}</span>`);
    return parts.join('') || '<span class="hint">Nothing</span>';
  };

  // countdowns read the server's clock (ctl.now), so a screen still catching up shows the time really left
  const clockT = setInterval(() => {
    const s = ui.view; if (!s || s.phase !== 'play') return;
    // a turn ends itself: at once with nothing left to do on it (trading can wait), else after 5 seconds without a tap,
    // key or scroll, held while a panel other than a trade is open
    const end = qs('[data-act="endTurn"]', root);
    if (!end || ui.busy || ui.holdDone) ui.idleFrom = 0;
    else if (!E.OWNABLE.some(pos => !E.canBuild(s, E.current(s).id, pos))) { if (ui.idleFrom !== -1) { ui.idleFrom = -1; end.click(); } }
    else if (ui.sheet && ui.sheet.k !== 'trade') ui.idleFrom = 0;
    else {
      if (ui.idleFrom <= 0) ui.idleFrom = Date.now();
      const left = 5000 - (Date.now() - ui.idleFrom);
      end.querySelector('span').textContent = `End turn · ${Math.max(1, Math.ceil(left / 1000))}`;
      if (left <= 0) { ui.idleFrom = Date.now(); end.click(); }
    }
    const a = s.pend;
    if (a && (a.k === 'auc' || a.k === 'bauc')) {
      // the ring stays full while the clock waits for every screen
      const total = a.n ? E.AUC_RESET : E.AUC_START, left = Math.max(0, Math.min(total, a.end - ctl.now()));
      const ring = qs('#aucRing', root), n = qs('#aucN', root);
      if (ring) ring.setAttribute('stroke-dashoffset', String(97.4 * (1 - left / total)));
      if (n) n.textContent = Math.ceil(left / 1000);
    }
    const bar = qs('#turnBar', root);
    if (bar && s.settings.turnSec) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, (s.turnEnd - ctl.now()) / (s.settings.turnSec * 1000)))})`;
    const clock = qs('#gameClock', root);
    if (clock && s.deadline) { const left = Math.max(0, s.deadline - ctl.now()); clock.textContent = ` · ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} left`; }
  }, 200);

  // ---------- sheets: square, player, properties, trade, log, settings ----------
  function openSheet(sh) { ui.sheet = sh; renderSheet(true); $sheet.classList.add('opening'); }
  function closeSheet() { ui.sheet = null; ui.trade = null; $scrim.hidden = true; $sheet.innerHTML = ''; $sheet.className = 'sheet'; }
  function renderSheet(force) {
    const sh = ui.sheet;
    if (!sh || !ui.view) { $scrim.hidden = true; return; }
    if (sh.k === 'trade' && !force) return; // keep the draft's inputs stable
    $scrim.hidden = false;
    $sheet.className = 'sheet sheet-' + sh.k; // prefixed: bare names like .log are content styles
    // the latest state, not the one still animating, so a build or sale shows at once; the log waits for its animation
    const s = sh.k === 'log' ? ui.view : ctl.state || ui.view;
    $sheet.innerHTML = `<button class="close" data-act="close" aria-label="Close">${iconHTML('close')}</button>`
      + (sh.back ? `<button class="back" data-act="back">${iconHTML('arrow')} Back</button>` : '') + sheetHTML(sh, s);
  }
  function sheetHTML(sh, s) {
    if (sh.k === 'sq') return squareHTML(sh.pos, s);
    if (sh.k === 'player') return playerHTML(sh.id, s);
    if (sh.k === 'manage') return manageHTML(s);
    if (sh.k === 'trade') return tradeHTML(s);
    if (sh.k === 'log') return `<h3>Game log</h3><ul class="log">${s.log.slice().reverse().map(l => `<li>${esc(l.m)}</li>`).join('')}</ul>`;
    if (sh.k === 'settings') return settingsHTML(s);
    if (sh.k === 'rules') return `<h3>Rules</h3>${rulebookHTML(s.settings, true)}`;
    if (sh.k === 'confirm') return `<h3>${esc(sh.title)}</h3><p>${esc(sh.body)}</p><div class="row"><button class="btn ${sh.danger ? 'danger' : 'primary'}" data-act="confirmYes">${esc(sh.yes)}</button><button class="btn" data-act="close">Cancel</button></div>`;
    return '';
  }
  function squareHTML(pos, s) {
    const sq = BOARD[pos], pr = s.props[pos];
    if (sq.price) {
      const ow = pr && pr.o && E.player(s, pr.o);
      let h = `${deedHTML(pos, s)}<p class="hint">${ow ? `Owned by ${esc(nm(ow.id))}${pr.m ? ', mortgaged' : ''}${pr.h ? `, ${pr.h === 5 ? 'with a hotel' : pr.h + ' house' + (pr.h > 1 ? 's' : '')}` : ''}.` : 'For sale. Land here to buy it.'}</p>`;
      if (ow && human(ow.id) && s.phase === 'play') h += `<div class="list">${lotRow(s, pos, ow.id)}</div>`;
      return h;
    }
    const about = {
      go: 'Collect $200 each time you pass or land on Start.' + (s.settings.doubleGo ? ' Land exactly on it to collect $400.' : ''),
      jail: `Just visiting if you land here. In jail you can still ${s.settings.landBuild || s.settings.landAny ? '' : s.settings.jailRent ? 'build on your turn, ' : 'build on your turn and '}trade${s.settings.jailRent ? ' and collect rent' : ''}. Roll doubles, pay $50 or use a card to get out.`,
      parking: s.settings.jackpot ? `Taxes and fees pile up here. Land on the Chill Zone to collect the bonus, now ${$(s.pot)}.` : 'Nothing happens here. No drama, just vibes.',
      gotojail: 'Go straight to jail. You do not pass Start or collect $200.',
      tax: s.settings.skipSpaces ? 'Skipped with the Skip Spaces rule.' : `Pay ${$(sq.amt || 0)}${sq.amt === 200 && s.settings.incomeTax ? ' or 10% of everything you own' : ''}.`,
      fortune: s.settings.skipSpaces ? 'Skipped with the Skip Spaces rule.' : 'Draw a Plot Twist card and do what it says.',
      treasury: s.settings.skipSpaces ? 'Skipped with the Skip Spaces rule.' : 'Draw a Group Chat card and do what it says.',
    }[sq.t];
    return `<h3>${esc(sq.n)}</h3><p>${esc(about)}</p>`;
  }
  function playerHTML(id, s) {
    const p = E.player(s, id); if (!p) return '';
    const owned = OWNABLE.filter(q => s.props[q] && s.props[q].o === p.id);
    let h = `<div class="ph">${tokHTML(p.tok, 'big')}<div><h3>${esc(p.name)}</h3><div class="hint">${s.phase === 'lobby' ? 'Seated' : p.out ? 'Bankrupt' : `Cash ${$(p.cash)} · Net worth ${$(E.netWorth(s, p))}`}${p.jail ? ' · in jail' : ''}</div></div></div>`;
    h += owned.length ? `<div class="tags">${owned.map(q => `<button class="tag" data-act="sq" data-pos="${q}"><i style="background:${swatch(q)}"></i>${esc(BOARD[q].n)}${s.props[q].h ? (s.props[q].h === 5 ? ' · hotel' : ` · ${s.props[q].h}`) : ''}${s.props[q].m ? ' · mortgaged' : ''}</button>`).join('')}</div>` : '<p class="hint">No property yet.</p>';
    if (s.phase === 'play' && !human(p.id) && !p.out && locals().length) h += `<button class="btn primary" data-act="tradeNew" data-to="${esc(p.id)}">Propose a trade</button>`;
    if (ctl.mode === 'online' && s.host === ctl.me && p.id !== ctl.me && !p.out && s.phase !== 'over') h += `<button class="btn danger" data-act="kick" data-id="${esc(p.id)}">Remove from game</button>`;
    return h;
  }
  function lotRow(s, pos, who) {
    const sq = BOARD[pos], pr = s.props[pos];
    const status = pr.m ? 'Mortgaged' : pr.h === 5 ? 'Hotel' : pr.h ? `${pr.h} house${pr.h > 1 ? 's' : ''}` : `Rent ${sq.t === 'util' ? (E.UTILS.every(u => s.props[u].o === who) ? '10×' : '4×') + ' roll' : $(E.rentFor(s, pos, 7))}`;
    const b = (a, label, err, cls = '') => `<button class="btn sm ${cls}" data-act="${a}" data-pos="${pos}" data-who="${esc(who)}" ${err ? `disabled title="${esc(err)}"` : ''}>${label}</button>`;
    let acts = '';
    if (sq.t === 'prop' && (E.ownsGroup(s, who, sq.g) || s.settings.landAny) && !pr.m) {
      acts += b('sell', '−', pr.h ? E.canSell(s, who, pos) : 'Nothing to sell');
      const piece = k => { const u = ART3D.piece && ART3D.piece(k); return u ? `<img src="${u}" alt="${k}">` : k === 'hotel' ? '🏨' : '⌂'; };
      acts += `<span class="hcount">${pr.h === 5 ? piece('hotel') : piece('house').repeat(pr.h) || '0'}</span>`;
      acts += b('build', '+', E.canBuild(s, who, pos), 'primary');
    }
    acts += pr.m ? b('unmortgage', `Lift ${$(E.unmortgageCost(pos))}`, E.canUnmortgage(s, who, pos)) : b('mortgage', `Mortgage +${$(sq.price / 2)}`, E.canMortgage(s, who, pos));
    return `<div class="lot ${pr.m ? 'm' : ''}"><i class="sw" style="background:${swatch(pos)}"></i><div class="grow" data-act="sq" data-pos="${pos}"><b>${esc(sq.n)}</b><small>${status}</small></div><div class="acts">${acts}</div></div>`;
  }
  function manageHTML(s) {
    const l = locals();
    if (!l.length) return '<p>You have nothing to manage.</p>';
    const who = (l.find(p => p.id === (ui.sheet.who || actor())) || l[0]).id, me = E.player(s, who);
    const owned = OWNABLE.filter(q => s.props[q].o === who);
    let h = `<h3>Properties</h3>`;
    if (l.length > 1) h += `<div class="seg">${l.map(p => `<button data-act="manageAs" data-id="${esc(p.id)}" aria-pressed="${p.id === who}">${tokHTML(p.tok)}${esc(p.name)}</button>`).join('')}</div>`;
    h += `<div class="two"><div class="kv"><small>Cash</small><b>${$(me.cash)}</b></div><div class="kv"><small>Net worth</small><b>${$(E.netWorth(s, me))}</b></div></div>`;
    const won = [[E.spare(me, 'h'), 'house'], [E.spare(me, 'H'), 'hotel']].filter(([n]) => n).map(([n, k]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(' and ');
    if (won) h += `<p class="hint">Won at auction: ${won}. On your turn, + on ${s.settings.landBuild || s.settings.landAny ? 'the street you landed on' : 'a street'} that is ready for it builds it free.</p>`;
    if (!owned.length) return h + '<p class="hint">No property yet. Land on an unowned square to buy it.</p>';
    const groups = {};
    owned.forEach(q => { const k = BOARD[q].t === 'prop' ? 'g' + BOARD[q].g : BOARD[q].t; (groups[k] = groups[k] || []).push(q); });
    Object.keys(groups).sort().forEach(k => {
      const label = k[0] === 'g' ? GROUPS[+k.slice(1)].n + (E.ownsGroup(s, who, +k.slice(1)) ? ' · full set' : ` · ${groups[k].length} of ${GROUPS[+k.slice(1)].pos.length}`) : k === 'station' ? 'Stations' : 'Utilities';
      h += `<div class="group-h">${esc(label)}</div><div class="list">${groups[k].map(q => lotRow(s, q, who)).join('')}</div>`;
    });
    return h;
  }

  // ---------- trading ----------
  function newTrade(from, to, counter) {
    ui.trade = { from, to: to || null, give: { c: 0, p: [], j: 0 }, get: { c: 0, p: [], j: 0 }, counter: counter || null };
    openSheet({ k: 'trade' });
  }
  const tradable = (s, pid) => OWNABLE.filter(q => s.props[q].o === pid).map(q => ({ q, ok: !(BOARD[q].t === 'prop' && GROUPS[BOARD[q].g].pos.some(x => s.props[x].o === pid && s.props[x].h > 0)) }));
  function tradeHTML(s) {
    const t = ui.trade, me = E.player(s, t.from);
    if (!t.to) {
      const others = s.players.filter(p => p.id !== t.from && !p.out);
      return `<h3>Trade with…</h3><div class="col">${others.map(p => `<button class="btn opt" data-act="tradeTo" data-id="${esc(p.id)}">${tokHTML(p.tok)}<span><b>${esc(p.name)}</b> · ${$(p.cash)}</span></button>`).join('')}</div>`;
    }
    const them = E.player(s, t.to);
    const col = (who, side, label) => {
      const list = tradable(s, who.id);
      return `<div class="tcol"><div class="tcol-h">${tokHTML(who.tok)}<b>${label}</b></div>
        <div class="chips">${list.length ? list.map(x => `<button class="chip" data-act="tradePick" data-side="${side}" data-pos="${x.q}" aria-pressed="${t[side].p.includes(x.q)}" ${x.ok ? '' : 'disabled title="Sell the buildings in this set first"'}><i style="background:${swatch(x.q)}"></i>${esc(BOARD[x.q].n)}${s.props[x.q].m ? ' (M)' : ''}</button>`).join('') : '<span class="hint">No property</span>'}</div>
        <label class="field">Cash <output id="out_${side}">${$(t[side].c)}</output><input type="range" id="cash_${side}" data-side="${side}" min="0" max="${who.cash}" step="10" value="${t[side].c}"></label>
        ${who.goojf.length ? `<div class="seg">${Array.from({ length: who.goojf.length + 1 }, (_, i) => `<button data-act="tradeJ" data-side="${side}" data-v="${i}" aria-pressed="${t[side].j === i}">${i} jail card${i === 1 ? '' : 's'}</button>`).join('')}</div>` : ''}
      </div>`;
    };
    return `<h3>${t.counter ? 'Counter-offer to' : 'Offer to'} ${esc(them.name)}</h3>
      <div class="tcols">${col(me, 'give', ctl.mine.size > 1 ? me.name + ' gives' : 'You give')}${col(them, 'get', ctl.mine.size > 1 ? me.name + ' gets' : 'You get')}</div>
      <p class="hint">Whoever takes mortgaged property pays the bank 10% interest straight away.</p>
      <div class="row"><button class="btn primary big" data-act="tradeSend">${t.counter ? 'Send counter-offer' : 'Send offer'}</button><button class="btn big" data-act="close">Cancel</button></div>`;
  }

  // ---------- settings ----------
  function settingsHTML(s) {
    const host = ctl.mode === 'online' ? s.host === ctl.me : true;
    const tog = (k, label, on) => `<div class="rule"><div class="grow"><b>${label}</b></div><button class="switch" role="switch" aria-checked="${on}" data-act="pref" data-k="${k}"></button></div>`;
    return `<h3>Menu</h3>
      <button class="btn big" data-act="rules">Rules: how to play, build and win</button>
      ${tog('sound', 'Sound effects', sound.on)}${tog('music', 'Music', sound.music)}
      <div class="rule"><div class="grow"><b>Camera</b></div><div class="seg">${[['follow', 'Follow'], ['table', 'Tabletop']].map(([v, l]) => `<button data-act="pref" data-k="view" data-v="${v}" aria-pressed="${settings.view === v}">${l}</button>`).join('')}</div></div>
      ${tog('cinematic', 'Cinematic camera', settings.cinematic)}${tog('ambient', 'City life', settings.ambient)}
      <div class="rule"><div class="grow"><b>Animation speed</b></div><div class="seg">${['normal', 'fast'].map(v => `<button data-act="pref" data-k="speed" data-v="${v}" aria-pressed="${settings.speed === v}">${v === 'normal' ? 'Normal' : 'Fast'}</button>`).join('')}</div></div>
      <div class="rule"><div class="grow"><b>Graphics</b><small id="fpsInfo"></small></div><div class="seg">${['auto', 'high', 'medium', 'low'].map(v => `<button data-act="pref" data-k="quality" data-v="${v}" aria-pressed="${settings.quality === v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
      <div class="rule"><div class="grow"><b>Board</b></div><span class="pill on">${esc((THEMES[s.settings.theme] || THEMES.city).name)}</span></div>
      <div class="row">${ctl.mode === 'online' && host && s.phase === 'play' ? '<button class="btn" data-act="endNow">End game now</button>' : ''}
      <button class="btn danger" data-act="leave">${ctl.mode === 'online' ? 'Leave room' : 'Save and quit'}</button></div>
      <p class="hint">Tip: drag to orbit, scroll or pinch to zoom, right-drag to pan. Tap any square for its deed.</p>`;
  }

  function confirm(title, body, yes, fn, danger) { ui.confirmFn = fn; openSheet({ k: 'confirm', title, body, yes, danger }); }

  // ---------- clicks ----------
  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) { if (e.target === $scrim) closeSheet(); return; }
    unlockAudio();
    const d = t.dataset, s = ui.view, a = d.act, who = d.who;
    switch (a) {
      case 'close': closeSheet(); return;
      case 'settings': openSheet({ k: 'settings' }); setTimeout(() => { const el = qs('#fpsInfo', root); if (el) { const f = scene.fps(); el.textContent = `${f.fps} fps · ${f.level} · ${f.dpr}x · ${f.calls} draw calls`; } }, 300); return;
      case 'rules': openSheet({ k: 'rules' }); return;
      case 'camTop': settings.set('view', settings.view === 'table' ? 'follow' : 'table'); renderTools(); return;
      case 'camCenter': scene.recenter(); return;
      case 'sound': sound.on = !sound.on; renderTools(); if (sound.on) sfx.coin(); return;
      case 'pref': settings.set(d.k, d.v ?? (d.k === 'sound' ? !sound.on : d.k === 'music' ? !sound.music : !settings[d.k])); renderTools(); renderSheet(true); return;
      case 'log': openSheet({ k: 'log' }); return;
      case 'emotes': { const box = qs('#emotes', root); box.hidden = !box.hidden; return; }
      case 'emote': {
        qs('#emotes', root).hidden = true;
        const who = actor(); if (!who) return;
        if (ctl.emote) ctl.emote(d.e); else showEmote(who, d.e);
        return;
      }
      case 'ready': return;
      case 'manage': openSheet({ k: 'manage', who: actor() }); return;
      case 'manageAs': ui.actAs = d.id; ui.sheet.who = d.id; renderSheet(true); return;
      case 'player': if (s) openSheet({ k: 'player', id: d.id }); return;
      case 'sq': if (s) openSheet({ k: 'sq', pos: +d.pos, back: ui.sheet && (ui.sheet.k === 'sq' ? ui.sheet.back : ui.sheet) }); return;
      case 'back': openSheet(ui.sheet.back); return;
      case 'roll': t.disabled = true; sfx.shake(); act('roll'); return;
      case 'buy': case 'decline': case 'endTurn': case 'payJail': case 'useCard': act(a); return;
      case 'payDebt': act('payDebt', {}, who); return;
      case 'bid': act('bid', { amt: +d.amt }, who); return;
      case 'pass': act('pass', {}, who); return;
      case 'bus': act('bus', { n: +d.n }); return;
      case 'tax': act('tax', { pick: d.pick }); return;
      case 'lift': act('lift', { pos: +d.pos, now: d.now === '1' }, who); return;
      case 'build': case 'sell': case 'mortgage': case 'unmortgage': t.disabled = true; await act(a, { pos: +d.pos }, who); renderSheet(true); return;
      case 'autoRaise': {
        const owe = s.debts.filter(x => x.p === who).reduce((x, y) => x + y.a, 0);
        for (const st of raisePlan(s, who, owe).steps) { const r = await act(st.a, st.p, who); if (!r || !r.ok) break; }
        return;
      }
      case 'bankrupt': confirm('Declare bankruptcy?', 'You leave the game and your property goes to whoever you owe. This can’t be undone.', 'Declare bankruptcy', () => act('bankrupt', {}, who), true); return;
      case 'accept': case 'reject': { t.disabled = true; const r = await act(a, { tid: +d.tid }, who); if (r && r.ok) renderOffers(); else t.disabled = false; return; }
      case 'counter': { const o = s.trades.find(x => x.id === +d.tid); if (o) { newTrade(o.to, o.from, o.id); ui.trade.give = { ...o.get, p: [...o.get.p] }; ui.trade.get = { ...o.give, p: [...o.give.p] }; renderSheet(true); } return; }
      case 'tradeNew': { const from = actor(); if (from) newTrade(from, d.to); return; }
      case 'tradeTo': ui.trade.to = d.id; renderSheet(true); return;
      case 'tradePick': { const arr = ui.trade[d.side].p, pos = +d.pos, i = arr.indexOf(pos); if (i >= 0) arr.splice(i, 1); else arr.push(pos); t.setAttribute('aria-pressed', String(i < 0)); return; }
      case 'tradeJ': ui.trade[d.side].j = +d.v; [...t.parentNode.children].forEach(b => b.setAttribute('aria-pressed', String(b === t))); return;
      case 'tradeSend': {
        const tr = ui.trade;
        const err = E.tradeSideError(s, tr.from, tr.give, tr.to) || E.tradeSideError(s, tr.to, tr.get, tr.from);
        if (err) { toast(err, true); return; }
        if (!tr.give.c && !tr.give.p.length && !tr.give.j && !tr.get.c && !tr.get.p.length && !tr.get.j) { toast('Add something to the deal', true); return; }
        const r = tr.counter ? await act('counter', { tid: tr.counter, give: tr.give, get: tr.get }, tr.from) : await act('propose', { to: tr.to, give: tr.give, get: tr.get }, tr.from);
        if (r && r.ok) { closeSheet(); renderOffers(); toast(tr.counter ? 'Counter-offer sent' : 'Offer sent'); }
        return;
      }
      case 'kick': { const p = P(d.id); confirm(`Remove ${p ? p.name : 'player'}?`, 'Their property goes back to the bank.', 'Remove', () => act('kick', { p: d.id }, ctl.me), true); return; }
      case 'endNow': confirm('End the game now?', 'The richest player wins.', 'End game', () => act('endNow', {}, ctl.me)); return;
      case 'leave': closeSheet(); onLeave(); return;
      case 'again': qs('.win', root)?.remove(); onAgain(); return;
      case 'confirmYes': { const fn = ui.confirmFn; ui.confirmFn = null; closeSheet(); if (fn) fn(); return; }
    }
  });
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.type === 'range' && ui.trade) { ui.trade[el.dataset.side].c = +el.value; const o = qs('#out_' + el.dataset.side, root); if (o) o.textContent = $(+el.value); }
  });
  root.addEventListener('pointerover', e => { const b = e.target.closest('[data-to]'); if (b && b.dataset.act === 'bus') scene.flash(+b.dataset.to, '#7cf0c8', 700, 0.6); });
  // a deed tilts toward the pointer like a card in the hand
  root.addEventListener('pointermove', e => {
    const d = e.target.closest('.deed'); if (!d) return;
    const b = d.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
    d.style.cssText = `--rx:${(4 - y * 8).toFixed(1)}deg;--ry:${(x * 12).toFixed(1)}deg;--sx:${Math.round(50 - x * 100)}%`;
  });
  root.addEventListener('pointerout', e => { const d = e.target.closest('.deed'); if (d && !d.contains(e.relatedTarget)) d.style.cssText = ''; });
  const onKey = e => {
    if (e.key === 'Escape' && ui.sheet) closeSheet();
    if ((e.key === ' ' || e.key === 'Enter') && ui.holdDone) { e.preventDefault(); ui.holdDone(); }
    if (e.key === ' ' && !ui.sheet && !ui.holdDone && document.activeElement === document.body) { const b = qs('[data-act="roll"]:not([disabled]), [data-act="endTurn"]:not([disabled])', root); if (b) { e.preventDefault(); b.click(); } }
  };
  document.addEventListener('keydown', onKey);
  // a tap, key or scroll starts the idle count again; trading does not
  const onInput = e => { if (ui.idleFrom > 0 && !e.target.closest?.('.sheet-trade, #offers, [data-act="tradeNew"]')) ui.idleFrom = Date.now(); };
  const INPUTS = ['pointerdown', 'keydown', 'wheel'];
  INPUTS.forEach(t => document.addEventListener(t, onInput, true));
  function renderTools() {
    const b = qs('#soundBtn', root); if (b) b.innerHTML = iconHTML(sound.on ? 'sound' : 'mute');
    qs('#topBtn', root).setAttribute('aria-pressed', String(settings.view === 'table'));
  }
  renderTools();

  function win(s) {
    const ranked = s.players.slice().sort((a, b) => (b.id === s.winner) - (a.id === s.winner) || (a.out - b.out) || E.netWorth(s, b) - E.netWorth(s, a));
    const w = P(s.winner), st = id => (s.stats || {})[id] || {};
    const best = (k, label, fmt) => {
      const top = s.players.slice().sort((a, b) => (st(b.id)[k] || 0) - (st(a.id)[k] || 0))[0];
      return top && st(top.id)[k] ? `<div class="award"><small>${label}</small>${tokHTML(top.tok)}<b>${esc(top.name)}</b><span>${fmt(st(top.id)[k])}</span></div>` : '';
    };
    const el = document.createElement('div');
    el.className = 'win';
    el.innerHTML = `<div class="win-card"><div class="trophy">${trophyHTML()}</div><h2>${w ? (ctl.mine.size === 1 && ctl.mine.has(w.id) ? 'You win!' : esc(w.name) + ' wins!') : 'Game over'}</h2>
      <ol>${ranked.map(p => `<li>${tokHTML(p.tok)}<span class="wn">${esc(p.name)}</span><b>${p.out ? 'Bankrupt' : $(E.netWorth(s, p))}</b></li>`).join('')}</ol>
      <div class="awards">${best('rentIn', 'Top landlord', $)}${best('bought', 'Most deeds', n => n + ' bought')}${best('built', 'Builder', n => n + ' buildings')}${best('jail', 'Jailbird', n => n + '× jail')}${best('laps', 'Most laps', n => n + ' laps')}${best('doubles', 'Lucky dice', n => n + ' doubles')}</div>
      <details class="summary"><summary>Game summary</summary><table><tr><th></th><th>Rent in</th><th>Rent out</th><th>Bought</th><th>Built</th><th>Laps</th><th>Jail</th><th>Trades</th></tr>
        ${s.players.map(p => { const t = st(p.id); return `<tr><td>${esc(p.name)}</td><td>${$(t.rentIn || 0)}</td><td>${$(t.rentOut || 0)}</td><td>${t.bought || 0}</td><td>${t.built || 0}</td><td>${t.laps || 0}</td><td>${t.jail || 0}</td><td>${t.trades || 0}</td></tr>`; }).join('')}</table></details>
      <div class="row">${ctl.mode === 'local' || s.host === ctl.me ? '<button class="btn primary big" data-act="again">Play again</button>' : ''}<button class="btn big" data-act="leave">Menu</button></div></div>`;
    root.appendChild(el);
  }
  function passTo(p) {
    return new Promise(res => {
      const el = document.createElement('div');
      el.className = 'passto';
      el.innerHTML = `<div class="passto-card">${tokHTML(p.tok, 'big')}<h2>Pass to ${esc(p.name)}</h2><p>Hand the device over, then tap Ready.</p><button class="btn primary big" data-act="ready">Ready</button></div>`;
      root.appendChild(el);
      el.querySelector('[data-act="ready"]').addEventListener('click', () => { el.remove(); res(); });
    });
  }
  function showEmote(id, e) {
    if (!EMOTES.includes(e)) return;
    const pt = scene.screenOf(id);
    if (!pt || pt.behind) return;
    const el = document.createElement('div');
    el.className = 'emote-pop'; el.innerHTML = emoteHTML(e);
    el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px';
    qs('#fxlayer', root).appendChild(el); setTimeout(() => el.remove(), 2600);
    sfx.pop();
  }
  function achievement([, name, desc]) {
    const el = document.createElement('div');
    el.className = 'ach-pop';
    el.innerHTML = `<span>${trophyHTML()}</span><div><small>Achievement unlocked</small><b>${esc(name)}</b><em>${esc(desc)}</em></div>`;
    qs('#fxlayer', root).appendChild(el); setTimeout(() => el.remove(), 4200);
    sfx.win();
  }
  if (ctl.onEmote) ctl.onEmote((id, e) => showEmote(id, e));

  return {
    render(view, shown) {
      ui.view = view; ui.shown = shown;
      root.classList.toggle('lobby', view.phase === 'lobby');
      renderSeats(); renderStatus(); renderDock(); renderCenter(); renderOffers(); renderSheet(false);
    },
    busy(on, next) {
      ui.busy = on; root.classList.toggle('busy', on);
      // a decision the next state settles leaves the screen now, so its animation (a building rising) is not hidden
      const key = pd => (pd ? `${pd.k}:${pd.pos}:${pd.p}` : '');
      if (on && next && ui.view && key(next.pend) !== key(ui.view.pend)) { $center.innerHTML = ''; $center.dataset.key = ''; }
    },
    onSquare(pos) {
      const s = ui.view; if (!s) return;
      if (ui.picking && s.pend && s.pend.k === 'warp' && pos !== P(s.pend.p).pos) {
        confirm(`Jump to ${BOARD[pos].n}?`, 'Your token goes straight there.', 'Go there', () => act('warp', { pos }, s.pend.p));
        return;
      }
      openSheet({ k: 'sq', pos });
    },
    float, floatAt, bubble, stamp, banner, toast, rent, bidFlash, cardHold, win, passTo, showEmote, achievement,
    roll() { const b = qs('[data-act="roll"]:not([disabled])', root); if (b && !ui.busy) b.click(); },
    closeSheet,
    destroy() { clearInterval(clockT); document.removeEventListener('keydown', onKey); INPUTS.forEach(t => document.removeEventListener(t, onInput, true)); document.removeEventListener('visibilitychange', reportAuction); scene.pickMode(null); },
  };
}
