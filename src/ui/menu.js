// Title screen, local game setup, online games and lobby, stats, achievements and how-to-play.
import * as E from '../engine.js';
import { TOK, esc, tokHTML, trophyHTML, iconHTML, ART3D } from '../art.js';
import { RULES, ruleOn, ruleSet, rulebookHTML } from './hud.js';
import { loadStats, ACHIEVEMENTS } from '../stats.js';
import { unlockAudio, sfx } from '../sound.js';
import { THEMES, DICE_LOOK } from '../scene/themes.js';

const { money: $ } = E;
const qs = (s, el = document) => el.querySelector(s);
const LEVEL = { easy: 'Easy bot', normal: 'Medium bot', hard: 'Hard bot' };
const NAMES = ['Ava', 'Kabir', 'Zoe', 'Arjun'];
const RULE_KEYS = Object.keys(E.DEFAULTS).filter(k => k !== 'theme');
const sameRules = (a, b) => RULE_KEYS.every(k => a[k] === b[k]);

function themePicker(st, editable, prefix) {
  return `<div class="field">Board<div class="themes">${E.THEMES.map(k => `<button class="theme t-${k} ${st.theme === k ? 'on' : ''}" data-act="${prefix}theme" data-v="${k}" ${editable ? '' : 'disabled'}>${ART3D.theme[k] ? `<img src="${ART3D.theme[k]}" alt="">` : `<i style="background:linear-gradient(160deg, ${THEMES[k].sky[0]}, ${THEMES[k].sky[2]} 55%, ${THEMES[k].ground.grass} 56%)"></i>`}<b>${esc(THEMES[k].name)}</b><small>${esc(THEMES[k].blurb)}</small></button>`).join('')}</div></div>`;
}
function rulesEditor(st, editable, prefix, open) {
  const isClassic = sameRules(st, E.DEFAULTS), isQuick = sameRules(st, { ...E.DEFAULTS, ...E.QUICK_MODE });
  const dis = editable ? '' : 'disabled';
  const seg = (k, opts, fmt) => `<div class="seg">${opts.map(v => `<button data-act="${prefix}set" data-k="${k}" data-v="${v}" aria-pressed="${st[k] === v}" ${dis}>${fmt(v)}</button>`).join('')}</div>`;
  return `${themePicker(st, editable, prefix)}<div class="modes">
      <button class="mode ${isClassic ? 'on' : ''}" data-act="${prefix}preset" data-v="classic" ${dis}><b>Classic</b><small>Official rules, building on your turn</small></button>
      <button class="mode ${isQuick ? 'on' : ''}" data-act="${prefix}preset" data-v="quick" ${dis}><b>Quick Mode</b><small>Skip Spaces, Quick End, Quick Hotels, Quick Jail</small></button>
      <button class="mode ${!isClassic && !isQuick ? 'on' : ''}" data-act="${prefix}preset" data-v="custom" ${dis}><b>House Rules</b><small>Pick your own</small></button>
    </div>
    <details ${open || (!isClassic && !isQuick) ? 'open' : ''}><summary>House rules</summary>
      ${RULES.map(([k, t, d]) => `<div class="rule"><div class="grow"><b>${t}</b><small>${d}</small></div><button class="switch" role="switch" aria-checked="${ruleOn(st, k)}" data-act="${prefix}rule" data-k="${k}" ${dis}></button></div>`).join('')}
      <div class="rule col"><b>Starting cash</b>${seg('startCash', E.SETTING_CHOICES.startCash, v => $(v))}</div>
      <div class="rule col"><b>Turn timer</b>${seg('turnSec', E.SETTING_CHOICES.turnSec, v => (v ? v + 's' : 'Off'))}</div>
      <div class="rule col"><b>Time limit</b><small>When it runs out, the richest player wins.</small>${seg('timeLimit', E.SETTING_CHOICES.timeLimit, v => (v ? v + ' min' : 'Off'))}</div>
    </details>`;
}
// apply a rules click to a settings object, resolving conflicts the way the engine does
export function applyRuleClick(st, act, k, v) {
  if (act === 'theme') return { ...st, theme: v };
  if (act === 'preset') return v === 'classic' ? { ...E.DEFAULTS, theme: st.theme } : v === 'quick' ? { ...E.DEFAULTS, ...E.QUICK_MODE, theme: st.theme } : st;
  const patch = act === 'rule' ? ruleSet(k, !ruleOn(st, k)) : { [k]: +v };
  const next = { ...st, ...patch };
  if (next.jackpot && next.skipSpaces) next[patch.jackpot ? 'skipSpaces' : 'jackpot'] = false;
  if (next.auctionOnly && !next.auctions) { if (patch.auctionOnly) next.auctions = true; else next.auctionOnly = false; }
  if (next.landBuild && next.landAny) next[patch.landAny ? 'landBuild' : 'landAny'] = false;
  return next;
}
const diceRow = (seat, sel) => `<div class="dicerow">${DICE_LOOK.map((l, k) => `<button data-act="dice" data-seat="${seat}" data-v="${k}" aria-pressed="${sel === k}" title="${l.name} dice" style="--b:${l.body};--p:${l.pip}" ${ART3D.dice[k] ? 'class="d3d"' : ''}>${ART3D.dice[k] ? `<img src="${ART3D.dice[k]}" alt="">` : '<i></i>'}</button>`).join('')}</div>`;

export function makeMenu({ root, prefs, savePrefs, onLocal, onOnline, onContinue, hasSave, onTheme }) {
  let screen = 'title', setup = null, lobby = null, sitting = false, rulesOpen = false, openGames = [], pollT = null;
  const show = (name, data) => {
    screen = name; if (name === 'setup') setup = data;
    root.hidden = false; render();
    clearInterval(pollT);
    if (name === 'online') { pollOpen(); pollT = setInterval(pollOpen, 3000); }
  };
  async function pollOpen() {
    try { const r = await fetch('/api/rooms'); openGames = r.ok ? await r.json() : []; } catch { openGames = []; }
    if (screen === 'online') { const el = qs('#openGames', root); if (el) el.innerHTML = openHTML(); }
  }
  function seatsFor(mode) {
    const n = mode === 'bots' ? 4 : 2, toks = [prefs.tok ?? 0];
    for (let t = 0; toks.length < 4; t++) if (!toks.includes(t)) toks.push(t);
    return Array.from({ length: n }, (_, i) => ({ name: i === 0 ? prefs.name || 'You' : mode === 'bots' ? NAMES[i] : 'Player ' + (i + 1), tok: toks[i], bot: mode === 'bots' && i ? 'normal' : null, dice: i ? i % DICE_LOOK.length : prefs.dice || 0 }));
  }
  function render() {
    root.className = 'menu screen-' + screen; // prefixed: bare names like .ach are item styles
    root.innerHTML = { title: titleHTML, setup: setupHTML, online: onlineHTML, lobby: lobbyHTML, stats: statsHTML, ach: achHTML, help: helpHTML }[screen]?.() ?? `<div class="menu-card"><h2>${esc(lobby && lobby.msg || 'Connecting…')}</h2></div>`;
  }
  function titleHTML() {
    return `<div class="title-wrap"><h1 class="logo">Tycoon</h1><p class="tag">Buy it. Flex it. Bankrupt your friends.</p>
      <div class="menu-buttons">
        ${hasSave() ? '<button class="btn primary big" data-act="continue">Continue game</button>' : ''}
        <button class="btn ${hasSave() ? '' : 'primary'} big" data-act="mode" data-v="bots">${iconHTML('badge')} Play vs bots</button>
        <button class="btn big" data-act="mode" data-v="pass">${iconHTML('chat')} Pass &amp; Play</button>
        <button class="btn big" data-act="online">${iconHTML('wifi')} Online</button>
        <div class="row"><button class="btn" data-act="stats">Stats</button><button class="btn" data-act="ach">Achievements</button><button class="btn" data-act="help">How to play</button></div>
      </div></div>`;
  }
  function tokenRow(i, taken, sel) {
    return `<div class="tokrow">${TOK.map((t, k) => `<button data-act="tok" data-seat="${i}" data-v="${k}" aria-pressed="${sel === k}" aria-label="${t.n}" ${taken.has(k) && sel !== k ? 'disabled' : ''}>${tokHTML(k)}</button>`).join('')}</div>`;
  }
  function setupHTML() {
    const taken = new Set(setup.seats.map(s => s.tok));
    return `<div class="menu-card wide"><button class="back" data-act="title">${iconHTML('arrow')} Back</button>
      <h2>${setup.mode === 'bots' ? 'Play vs bots' : 'Pass & Play'}</h2>
      <div class="seat-setup">${setup.seats.map((s, i) => `<div class="seatcard" style="--c:${TOK[s.tok].c}">
        <div class="seatcard-top">${tokHTML(s.tok, 'big')}<input class="name" data-seat="${i}" maxlength="14" value="${esc(s.name)}" aria-label="Name">
          <select data-seat="${i}" aria-label="Player type">${[['human', 'Human'], ['easy', LEVEL.easy], ['normal', LEVEL.normal], ['hard', LEVEL.hard]].map(([v, l]) => `<option value="${v}" ${(s.bot || 'human') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          ${setup.seats.length > 2 ? `<button class="x" data-act="rmSeat" data-seat="${i}" aria-label="Remove">${iconHTML('close')}</button>` : ''}</div>
        ${tokenRow(i, taken, s.tok)}${diceRow(i, s.dice || 0)}</div>`).join('')}
        ${setup.seats.length < E.MAX_PLAYERS ? '<button class="addseat" data-act="addSeat">+ Add player</button>' : ''}</div>
      ${rulesEditor(setup.settings, true, 'l', rulesOpen)}
      <button class="btn primary big" data-act="startLocal">Start game</button></div>`;
  }
  function openHTML() {
    if (!openGames.length) return '<p class="hint">No open games on this server right now.</p>';
    return openGames.map(g => `<button class="btn opt" data-act="joinCode" data-v="${esc(g.code)}"><b>${esc(g.code)}</b><span>${esc(g.host)}’s game · ${g.players}/${E.MAX_PLAYERS}${g.quick ? ' · Quick' : ''} · ${esc((THEMES[g.theme] || THEMES.city).name)}</span></button>`).join('');
  }
  function onlineHTML() {
    return `<div class="menu-card"><button class="back" data-act="title">${iconHTML('arrow')} Back</button><h2>Online</h2>
      <label class="field">Your name<input id="oname" maxlength="14" value="${esc(prefs.name || '')}" placeholder="Name at the table"></label>
      <div class="field">Your token${tokenRow(0, new Set(), prefs.tok ?? 0)}</div>
      <div class="field">Your dice${diceRow(0, prefs.dice || 0)}</div>
      <button class="btn primary big" data-act="quick">Quick match</button>
      <div class="row"><button class="btn big" data-act="create" data-open="0">Private game</button><button class="btn big" data-act="create" data-open="1">Open game</button></div>
      <div class="or">join with a code</div>
      <div class="row"><input id="ocode" class="code" maxlength="4" placeholder="CODE" autocapitalize="characters" value="${esc((location.hash || '').slice(1, 5).toUpperCase())}"><button class="btn big" data-act="join">Join</button></div>
      <div class="field">Open games on this server<div class="col" id="openGames">${openHTML()}</div></div>
      <p class="hint">Everyone plays through this server: friends on the same Wi-Fi, or anywhere with the tunnel link from the server window.</p></div>`;
  }
  function lobbyHTML() {
    const { ctl, s } = lobby, host = s.host === ctl.me, me = E.player(s, ctl.me);
    const links = (ctl.urls || []).map(u => `<div class="link"><code>${esc(u)}</code><button class="btn sm" data-act="copy" data-v="${esc(u)}">Copy</button></div>`).join('');
    return `<div class="menu-card wide"><button class="back" data-act="leaveRoom">${iconHTML('arrow')} Leave</button>
      <h2>Game code <span class="bigcode">${esc(ctl.code)}</span></h2>${links ? `<div class="links">${links}</div>` : ''}
      ${host ? `<div class="rule"><div class="grow"><b>Open game</b><small>Anyone on this server can find and join it.</small></div><button class="switch" role="switch" aria-checked="${!!ctl.isPublic}" data-act="public"></button></div>` : ''}
      <div class="lobby-seats">${s.players.map(p => `<div class="lseat" style="--c:${TOK[p.tok].c}">${tokHTML(p.tok, 'big')}<b>${esc(p.name)}</b><small>${p.bot ? LEVEL[p.bot] : p.id === s.host ? 'Host' : 'Player'}${p.id === ctl.me ? ' · you' : ''}</small>${host && p.id !== ctl.me ? `<button class="x" data-act="kick" data-id="${esc(p.id)}" aria-label="Remove">${iconHTML('close')}</button>` : ''}</div>`).join('')}
        ${Array.from({ length: E.MAX_PLAYERS - s.players.length }, () => '<div class="lseat empty">Open seat</div>').join('')}</div>
      ${me ? '' : `<p class="hint">${s.players.length >= E.MAX_PLAYERS ? 'The table is full. You can watch.' : 'Taking your seat…'}</p>`}
      ${host && s.players.length < E.MAX_PLAYERS ? `<div class="row">${['easy', 'normal', 'hard'].map(l => `<button class="btn" data-act="addBot" data-v="${l}">+ ${LEVEL[l]}</button>`).join('')}</div>` : ''}
      ${rulesEditor(s.settings, host, 'o', rulesOpen)}
      ${host ? `<button class="btn primary big" data-act="startOnline" ${s.players.length < 2 ? 'disabled' : ''}>Start game</button>` : '<p class="hint">The host starts the game when everyone is in.</p>'}</div>`;
  }
  function statsHTML() {
    const st = loadStats(), fav = Object.entries(st.tokens).sort((a, b) => b[1] - a[1])[0];
    const row = (l, v) => `<div class="kv"><small>${l}</small><b>${v}</b></div>`;
    return `<div class="menu-card"><button class="back" data-act="title">${iconHTML('arrow')} Back</button><h2>Your stats</h2>
      <div class="grid2">${row('Games played', st.played)}${row('Games won', st.won)}${row('Win rate', st.played ? Math.round(st.won / st.played * 100) + '%' : '–')}
      ${row('Players bankrupted', st.bankrupted)}${row('Properties bought', st.bought)}${row('Rent collected', $(st.rent))}${row('Biggest rent', $(st.biggestRent))}
      ${row('Favourite token', fav ? TOK[fav[0]].n : '–')}</div><p class="hint">Counted for games you play alone against bots or online.</p></div>`;
  }
  function achHTML() {
    const st = loadStats(), got = ACHIEVEMENTS.filter(a => st.ach[a[0]]).length;
    return `<div class="menu-card"><button class="back" data-act="title">${iconHTML('arrow')} Back</button><h2>Achievements <span class="pill on">${got} / ${ACHIEVEMENTS.length}</span></h2>
      <div class="achs">${ACHIEVEMENTS.map(([k, n, d]) => `<div class="ach ${st.ach[k] ? 'got' : ''}"><span>${ART3D.trophy ? trophyHTML() : st.ach[k] ? '🏆' : '🔒'}</span><div><b>${esc(n)}</b><small>${esc(d)}</small></div></div>`).join('')}</div></div>`;
  }
  function helpHTML() {
    return `<div class="menu-card"><button class="back" data-act="title">${iconHTML('arrow')} Back</button><h2>How to play</h2>${rulebookHTML(E.DEFAULTS, false)}</div>`;
  }

  async function go(code, open) {
    const name = (qs('#oname', root) || {}).value?.trim() || prefs.name;
    if (!name) { alertBox('Enter your name first'); qs('#oname', root)?.focus(); return; }
    prefs.name = name; savePrefs();
    lobby = { msg: 'Connecting…' }; show('loading');
    onOnline(code, open);
  }
  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
    unlockAudio(); sfx.step();
    const d = t.dataset;
    switch (d.act) {
      case 'title': show('title'); return;
      case 'stats': case 'ach': case 'help': show(d.act); return;
      case 'continue': onContinue(); return;
      case 'mode': {
        const last = prefs.setups && prefs.setups[d.v];
        // setups saved before a rule existed get its default
        show('setup', last ? { mode: d.v, ...structuredClone(last), settings: { ...E.DEFAULTS, ...structuredClone(last.settings) } } : { mode: d.v, seats: seatsFor(d.v), settings: { ...E.DEFAULTS } });
        if (onTheme) onTheme(setup.settings.theme);
        return;
      }
      case 'tok': {
        if (screen === 'online') { prefs.tok = +d.v; savePrefs(); render(); return; }
        setup.seats[+d.seat].tok = +d.v; render(); return;
      }
      case 'dice': {
        if (screen === 'online') { prefs.dice = +d.v; savePrefs(); render(); return; }
        setup.seats[+d.seat].dice = +d.v; render(); return;
      }
      case 'addSeat': {
        const used = new Set(setup.seats.map(s => s.tok)), tok = [...Array(8).keys()].find(k => !used.has(k));
        const i = setup.seats.length;
        setup.seats.push({ name: setup.mode === 'bots' ? NAMES[i] : 'Player ' + (i + 1), tok, bot: setup.mode === 'bots' ? 'normal' : null, dice: i % DICE_LOOK.length });
        render(); return;
      }
      case 'rmSeat': setup.seats.splice(+d.seat, 1); render(); return;
      case 'lpreset': case 'lrule': case 'lset': case 'ltheme':
        rulesOpen = d.v === 'custom' || d.act === 'lrule' || d.act === 'lset';
        setup.settings = applyRuleClick(setup.settings, d.act.slice(1), d.k, d.v);
        if (d.act === 'ltheme' && onTheme) onTheme(d.v);
        render(); return;
      case 'opreset': case 'orule': case 'oset': case 'otheme': {
        rulesOpen = d.v === 'custom' || d.act === 'orule' || d.act === 'oset';
        if (d.v === 'custom') { render(); return; }
        const next = applyRuleClick(lobby.s.settings, d.act.slice(1), d.k, d.v);
        const r = await lobby.ctl.act(lobby.ctl.me, 'settings', next);
        if (!r.ok) alertBox(r.error);
        return;
      }
      case 'startLocal': {
        if (!setup.seats.some(s => !s.bot)) { alertBox('Add at least one human player'); return; }
        prefs.name = setup.seats[0].name; prefs.tok = setup.seats[0].tok; prefs.dice = setup.seats[0].dice;
        prefs.setups = { ...(prefs.setups || {}), [setup.mode]: { seats: setup.seats, settings: setup.settings } };
        savePrefs();
        onLocal(setup);
        return;
      }
      case 'online': show('online'); return;
      case 'create': go(null, d.open === '1'); return;
      case 'join': {
        const code = qs('#ocode', root).value.trim().toUpperCase();
        if (!/^[A-Z]{4}$/.test(code)) { alertBox('Codes are four letters'); return; }
        go(code); return;
      }
      case 'joinCode': go(d.v); return;
      case 'quick': { await pollOpen(); go(openGames[0] ? openGames[0].code : null, true); return; }
      case 'public': lobby.ctl.setPublic(!lobby.ctl.isPublic); return;
      case 'addBot': lobby.ctl.act(lobby.ctl.me, 'addBot', { level: d.v }); return;
      case 'kick': lobby.ctl.act(lobby.ctl.me, 'kick', { p: d.id }); return;
      case 'startOnline': { const r = await lobby.ctl.act(lobby.ctl.me, 'start', {}); if (!r.ok) alertBox(r.error); return; }
      case 'copy': try { await navigator.clipboard.writeText(d.v); t.textContent = 'Copied'; } catch { t.textContent = 'Select and copy'; } return;
      case 'leaveRoom': lobby.ctl.destroy(); lobby = null; history.replaceState(null, '', location.pathname); show('title'); return;
    }
  });
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.tagName === 'SELECT' && setup) { const v = el.value; setup.seats[+el.dataset.seat].bot = v === 'human' ? null : v; render(); }
  });
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.classList.contains('name') && setup) setup.seats[+el.dataset.seat].name = el.value;
    if (el.id === 'ocode') el.value = el.value.toUpperCase().replace(/[^A-Z]/g, '');
  });
  function alertBox(msg) {
    const el = document.createElement('div'); el.className = 'toast bad menu-toast'; el.textContent = msg;
    root.appendChild(el); setTimeout(() => el.remove(), 3000); sfx.bad();
  }

  return {
    show, hide() { root.hidden = true; root.innerHTML = ''; screen = null; clearInterval(pollT); },
    get screen() { return screen; },
    lobby(ctl, s) {
      const first = !lobby || lobby.ctl !== ctl;
      lobby = { ctl, s };
      if (first && ctl.onRoom) ctl.onRoom(() => { if (screen === 'lobby') render(); });
      if (onTheme) onTheme(s.settings.theme);
      // sit down automatically with the remembered name, dice and a free token
      if (!E.player(s, ctl.me) && s.players.length < E.MAX_PLAYERS && !sitting) {
        sitting = true;
        const used = new Set(s.players.map(p => p.tok));
        const tok = used.has(prefs.tok ?? 0) ? [...Array(8).keys()].find(k => !used.has(k)) : prefs.tok ?? 0;
        ctl.act(ctl.me, 'join', { name: prefs.name || 'Player', tok, dice: prefs.dice || 0 }).then(r => { sitting = false; if (!r.ok) alertBox(r.error); });
      }
      show('lobby');
    },
    error(msg) { show('online'); alertBox(msg); },
  };
}
