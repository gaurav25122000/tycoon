// Plays the engine's effect log as animation, one state at a time, then hands the new state to the HUD.
import * as E from './engine.js';
import { TOK } from './art.js';
import { drawCardFace, drawDeed } from './scene/art2d.js';
import { sfx, buzz } from './sound.js';
import { LINES, pick } from './ui/mascot.js';

const { BOARD, GROUPS } = E;

export function makePresenter({ scene, hud, mascot, ctl, stats }) {
  let view = null, lastFx = 0, playing = false, game = null, lastHuman = null;
  const queue = [], waiters = [], shown = { pos: {}, jail: {}, cash: {} };
  const players = new Map();
  const colorOf = id => { const p = players.get(id); return p ? TOK[p.tok].c : '#999999'; };
  const nameOf = id => { const p = players.get(id); return p ? (ctl.mine.has(id) && ctl.mine.size === 1 ? 'You' : p.name) : 'Someone'; };
  const isLocal = id => ctl.mine.has(id);

  function syncShown(s) {
    s.players.forEach(p => { shown.pos[p.id] = p.pos; shown.jail[p.id] = !!p.jail; shown.cash[p.id] = p.cash; });
  }
  function snap(s) {
    view = s; lastFx = s.fxN; game = s.game;
    s.players.forEach(p => players.set(p.id, p));
    syncShown(s);
    scene.setTheme(s.settings.theme);
    scene.sync(s, shown, colorOf);
    scene.setTurn(s.phase === 'play' ? E.current(s).id : null);
    hud.render(s, shown);
    if (s.phase === 'play') lastHuman = E.current(s).id;
  }
  function push(s) { queue.push(s); if (!playing) play(); }
  async function play() {
    playing = true;
    while (queue.length) {
      const target = queue.shift();
      target.players.forEach(p => players.set(p.id, p));
      if (!view || target.game !== game || target.fxN < lastFx) { snap(target); continue; }
      const list = target.fx.filter(f => f.i > lastFx);
      const fast = queue.length > 3 || document.hidden;
      hud.busy(true, target);
      for (let i = 0; i < list.length; i++) {
        try { await playFx(list[i], target, fast, list, i); } catch (e) { console.error('fx', list[i], e); }
        lastFx = list[i].i;
      }
      lastFx = Math.max(lastFx, target.fxN);
      view = target;
      syncShown(target);
      scene.setTheme(target.settings.theme);
      scene.sync(target, shown, colorOf);
      scene.setTurn(target.phase === 'play' ? E.current(target).id : null);
      hud.busy(false);
      hud.render(target, shown);
    }
    playing = false;
    waiters.splice(0).forEach(r => r());
  }
  const idle = () => (playing || queue.length ? new Promise(r => waiters.push(r)) : Promise.resolve());

  // cash moving between two players arrives as a -x/+x pair; anything else is the bank
  const skip = new Set();
  function cashFlow(f, list, i) {
    if (skip.has(f.i)) { skip.delete(f.i); return null; }
    if (f.a < 0) {
      const mate = list.slice(i + 1, i + 4).find(g => g.t === 'cash' && g.a === -f.a && g.p !== f.p);
      if (mate) { skip.add(mate.i); return [f.p, mate.p, -f.a]; }
      return [f.p, null, -f.a];
    }
    return [null, f.p, f.a];
  }

  async function playFx(f, s, fast, list, i) {
    const wait = ms => (fast ? Promise.resolve() : scene.wait(ms));
    switch (f.t) {
      case 'start':
        scene.overview();
        if (!fast) { hud.banner('Game on!'); sfx.turn(); }
        break;
      case 'turn': {
        scene.setTurn(f.p);
        if (fast) break;
        scene.follow(f.p);
        const human = isLocal(f.p) && !players.get(f.p).bot;
        // pass & play: hand the device over before a different person's turn
        if (human && ctl.mine.size > 1 && lastHuman && lastHuman !== f.p) await hud.passTo(players.get(f.p));
        if (human) lastHuman = f.p;
        scene.ripple(f.p);
        if (human) { hud.banner(ctl.mine.size > 1 ? `${players.get(f.p).name}’s turn` : 'Your turn', 'mine'); sfx.turn(); buzz(30); }
        else hud.banner(`${nameOf(f.p)}’s turn`, 'quiet');
        await wait(500);
        break;
      }
      case 'dice': {
        if (fast) break;
        scene.focusDice();
        const roller = players.get(f.p);
        await scene.roll(f.d, roller ? roller.dice : 0);
        if (shown.jail[f.p] && f.d[0] === f.d[1] && stats.is(f.p)) stats.unlock('escape');
        const sum = f.d[0] + f.d[1], sp = f.d.length > 2 ? E.SPEED[f.d[2] - 1] : null;
        hud.bubble(typeof sp === 'number' ? `${sum + sp}` : String(sum), scene.screenOf('dice'));
        if (sp === 'H') hud.banner('Hustle!', 'quiet');
        if (sp === 'B') { hud.banner('Bus!', 'quiet'); mascot.say(pick(LINES.bus), 'happy', 'none', 1800); }
        if (f.d[0] === f.d[1] && !(sp === f.d[0])) {
          const p = players.get(f.p);
          if (!p || !p.jail) { hud.banner('Doubles!'); mascot.say(pick(LINES.doubles), 'happy', 'none', 1600); }
        }
        await wait(450);
        break;
      }
      case 'triple': if (stats.is(f.p)) stats.unlock('triples'); if (!fast) { hud.banner('Triples!'); mascot.say(pick(LINES.triples), 'shock', 'none', 2600); await wait(600); } break;
      case 'hustle': if (!fast) { mascot.say(pick(LINES.hustle), 'happy', 'none', 1600); await wait(300); } break;
      case 'move': {
        if (shown.jail[f.p]) { shown.jail[f.p] = false; scene.freed(Object.entries(shown.jail).some(([id, j]) => j && id !== f.p)); }
        if (fast) { shown.pos[f.p] = f.path[f.path.length - 1]; scene.sync(view, shown, colorOf); break; }
        scene.follow(f.p);
        const forward = f.path[f.path.length - 1] !== (f.from - f.path.length + 40) % 40 || f.path.length > 3;
        const salary = f.path[f.path.length - 1] === 0 && s.settings.doubleGo ? '+$400' : '+$200'; // Start Bonus: landing right on it
        await scene.hop(f.p, f.path, (sq) => {
          shown.pos[f.p] = sq;
          if (sq === 0 && forward) { hud.floatAt(scene.screenOf(0), salary, 'gold'); sfx.coin(); scene.coinBurst(0); }
        });
        break;
      }
      case 'jail':
        shown.pos[f.p] = 10; shown.jail[f.p] = true;
        if (stats.is(f.p)) stats.unlock('jail');
        if (fast) { scene.sync(view, shown, colorOf); break; }
        mascot.say(pick(LINES.jail), 'shock', 'none', 2200);
        hud.banner(isLocal(f.p) && ctl.mine.size === 1 ? 'Busted!' : `${nameOf(f.p)}: busted!`);
        buzz([60, 40, 60]);
        scene.follow(f.p);
        await scene.fly(f.p, 10, true);
        await scene.jail(f.p);
        break;
      case 'free':
        shown.jail[f.p] = false;
        if (fast) break;
        mascot.say(f.card ? 'Get out of jail free!' : pick(LINES.free), 'happy', f.card ? 'card' : 'coin', 1800);
        await scene.freed(Object.entries(shown.jail).some(([id, j]) => j && id !== f.p));
        break;
      case 'cash': {
        shown.cash[f.p] = (shown.cash[f.p] || 0) + f.a;
        hud.float(f.p, f.a);
        const flow = cashFlow(f, list, i);
        if (!fast && flow) { const [from, to, amt] = flow; await Promise.race([scene.pay(from, to, amt), wait(450)]); }
        break;
      }
      case 'card': {
        if (fast) break;
        const local = isLocal(f.p) && !players.get(f.p).bot;
        mascot.say(pick(LINES[f.dk]), 'happy', f.dk === 'F' ? 'card' : 'chat', 3200);
        const hold = hud.cardHold(f.dk, f.c, local);
        await scene.card(f.dk, drawCardFace(f.dk, f.c), hold);
        break;
      }
      case 'buy': {
        const p = players.get(f.p);
        if (f.deal) { scene.sync(s, shown, colorOf); if (!fast) scene.sparkle(f.pos, colorOf(f.p)); break; }
        stats.owned(s, f.p);
        if (f.auc && stats.is(f.p)) stats.unlock('auction');
        if (fast) break;
        if (f.auc) { await scene.gavelSlam(); hud.stamp(`Sold to ${nameOf(f.p)}`); mascot.say(pick(LINES.sold), 'happy', 'gavel', 1500); }
        else { hud.stamp('Sold!'); sfx.buy(); }
        scene.focus(f.pos, 0.5, true);
        await scene.buy(f.pos, f.p);
        scene.react(f.p, 'happy');
        if (isLocal(f.p) && !p.bot) await scene.deed(f.pos, drawDeed(f.pos), () => scene.wait(900), f.p);
        stats.bought(f.p);
        const sq = BOARD[f.pos];
        if (sq.t === 'prop' && GROUPS[sq.g].pos.every(q => (q === f.pos ? f.p : s.props[q].o) === f.p)) { mascot.say(pick(LINES.set), 'happy', 'none', 2200); hud.banner(`${GROUPS[sq.g].n} complete!`, 'quiet'); }
        break;
      }
      case 'build': case 'sell': {
        if (fast) break;
        scene.focus(f.pos, 0.42);
        const h = s.props[f.pos].h;
        if (f.t === 'build' && stats.is(f.p)) stats.unlock(h === 5 ? 'first-hotel' : 'first-house');
        await scene.build(f.pos, h);
        if (h === 5 && f.t === 'build') mascot.say(pick(LINES.hotel), 'happy', 'none', 1600);
        break;
      }
      case 'mort': if (!fast) { scene.focus(f.pos, 0.45); await scene.mortgage(f.pos, f.m); } break;
      case 'rent':
        if (fast) break;
        stats.rent(f.o, f.a);
        scene.flash(f.pos, '#ff5d6c', 900, 0.5);
        scene.rentHit(f.pos);
        hud.rent(nameOf(f.p), nameOf(f.o), f.a, f.pos);
        if (f.a >= 300) mascot.say(pick(LINES.ouch), 'shock', 'coin', 1800);
        scene.react(f.p, 'sad');
        break;
      case 'auc':
        if (fast) break;
        if (f.kind) mascot.say(pick(LINES.shortage), 'shock', 'gavel', 2200);
        else { scene.focus(f.pos, 0.45); mascot.say(pick(LINES.auction), 'happy', 'gavel', 2200); }
        hud.banner(f.kind ? 'Building auction' : 'Auction!', 'quiet');
        await scene.gavel(f.kind ? null : f.pos);
        break;
      case 'bid': if (!fast) { scene.gavelTap(); hud.bidFlash(f.p, f.a); } break;
      case 'aucEnd':
        if (fast) { scene.hideGavel(); break; }
        await scene.gavelSlam();
        if (!f.kind) hud.toast(`No bids on ${BOARD[f.pos].n}`);
        else if (!f.p) hud.toast('Building auction closed');
        else hud.toast(`${nameOf(f.p)} won the ${f.kind === 'H' ? 'hotel' : 'house'}${isLocal(f.p) && !players.get(f.p).bot ? '. Build it free from Properties on your turn' : ''}`);
        break;
      case 'debt': if (isLocal(f.p) && !players.get(f.p).bot && !fast) { hud.toast(`${nameOf(f.p)} need${ctl.mine.size === 1 ? '' : 's'} to raise ${E.money(f.a)}`, true); buzz(80); } break;
      case 'bust':
        stats.bust(f.p, f.heir);
        if (fast) break;
        mascot.say(pick(LINES.bust), 'sad', 'none', 2600);
        hud.banner(`${nameOf(f.p)} ${isLocal(f.p) && ctl.mine.size === 1 ? 'are' : 'is'} bankrupt`);
        sfx.bad();
        scene.follow(f.p);
        await scene.crumble(f.p);
        if (f.heir && f.props.length) await scene.swap(f.p, f.heir, f.props, [], colorOf);
        break;
      case 'offer': if (!fast && isLocal(f.to) && !players.get(f.to).bot) { hud.toast(`${nameOf(f.p)} sent ${ctl.mine.size > 1 ? players.get(f.to).name : 'you'} a trade offer`); sfx.turn(); } break;
      case 'rejected': if (!fast && players.get(f.p) && !isLocal(f.p)) hud.toast(`${nameOf(f.p)} turned down the offer`); break;
      case 'deal':
        if (stats.is(f.p) || stats.is(f.to)) stats.unlock('trade');
        stats.owned(s, f.p); stats.owned(s, f.to);
        if (fast) break;
        hud.toast('Trade complete');
        sfx.buy();
        await scene.swap(f.p, f.to, f.give, f.get, colorOf);
        scene.react(f.p, 'happy'); scene.react(f.to, 'happy');
        break;
      case 'jackpot': if (stats.is(f.p)) stats.unlock('jackpot'); if (!fast) { mascot.say(pick(LINES.jackpot), 'shock', 'coin', 2000); hud.banner(`Jackpot! +${E.money(f.a)}`); scene.burstAt(f.p, '#ffd166'); } break;
      case 'win':
        view = s; hud.render(s, shown);
        stats.finish(s, ctl);
        mascot.say(pick(LINES.win), 'happy', 'trophy', 4000);
        sfx.win();
        if (!fast && f.p) await scene.celebrate(f.p);
        hud.win(s);
        break;
    }
  }

  return {
    push, idle,
    get view() { return view; },
    get playing() { return playing; },
  };
}
