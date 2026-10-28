// Lifetime stats and achievements for the person on this device, kept in the browser.
import * as E from './engine.js';

const KEY = 'tycoon:stats';
export const ACHIEVEMENTS = [
  ['first-buy', 'First Deed', 'Buy your first property'],
  ['full-set', 'Collector', 'Own a full colour set'],
  ['first-house', 'Homeowner', 'Build a house'],
  ['first-hotel', 'Hotelier', 'Build a hotel'],
  ['big-rent', 'Landlord', 'Collect $500 or more rent in one go'],
  ['stations', 'All Aboard', 'Own all four stations'],
  ['utilities', 'Utility Bill', 'Own both utilities'],
  ['mogul', 'Mogul', 'Own 10 properties at once'],
  ['jail', 'Jailbird', 'Go to jail'],
  ['escape', 'Great Escape', 'Roll doubles to get out of jail'],
  ['auction', 'Going, Going, Gone', 'Win an auction'],
  ['trade', 'Dealmaker', 'Complete a trade'],
  ['jackpot', 'Jackpot', 'Collect the Chill Zone bonus'],
  ['triples', 'Teleporter', 'Roll triples with the Speed Die'],
  ['shark', 'Shark', 'Bankrupt another player'],
  ['win', 'Tycoon', 'Win a game'],
  ['win-quick', 'Speed Run', 'Win a game with Quick End on'],
  ['win-speed', 'Need for Speed', 'Win a game with the Speed Die'],
];
const blank = () => ({ played: 0, won: 0, bankrupted: 0, bought: 0, rent: 0, biggestRent: 0, tokens: {}, ach: {} });
export function loadStats() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); }
}
function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* storage blocked */ } }

// counts only when one person plays on this device (vs bots or online)
export function makeStats(ctl, onUnlock) {
  const me = () => (ctl.mine.size === 1 ? [...ctl.mine][0] : null);
  const bump = fn => { const st = loadStats(); fn(st); save(st); };
  let finished = null;
  function unlock(key) {
    const st = loadStats();
    if (st.ach[key]) return;
    st.ach[key] = Date.now(); save(st);
    const a = ACHIEVEMENTS.find(x => x[0] === key);
    if (a && onUnlock) onUnlock(a);
  }
  // property milestones after anything that changes ownership
  function owned(s, id) {
    if (id !== me()) return;
    const mine = E.OWNABLE.filter(q => s.props[q] && s.props[q].o === id);
    if (mine.length) unlock('first-buy');
    if (mine.length >= 10) unlock('mogul');
    if (E.GROUPS.some((g, i) => E.ownsGroup(s, id, i))) unlock('full-set');
    if (E.STATIONS.every(q => s.props[q].o === id)) unlock('stations');
    if (E.UTILS.every(q => s.props[q].o === id)) unlock('utilities');
  }
  return {
    me, unlock, owned,
    is: id => id === me(),
    rent(owner, a) { if (owner === me()) { bump(st => { st.rent += a; st.biggestRent = Math.max(st.biggestRent, a); }); if (a >= 500) unlock('big-rent'); } },
    bought(id) { if (id === me()) bump(st => { st.bought++; }); },
    bust(id, heir) { if (heir && heir === me()) { bump(st => { st.bankrupted++; }); unlock('shark'); } },
    finish(s) {
      const id = me(), p = id && E.player(s, id);
      if (!p || finished === s.game) return;
      finished = s.game;
      bump(st => { st.played++; if (s.winner === id) st.won++; st.tokens[p.tok] = (st.tokens[p.tok] || 0) + 1; });
      if (s.winner === id) { unlock('win'); if (s.settings.quickEnd) unlock('win-quick'); if (s.settings.speedDie) unlock('win-speed'); }
    },
  };
}
