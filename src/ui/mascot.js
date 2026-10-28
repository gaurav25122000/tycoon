// Penny, the table's money spirit: floats up to present cards, auctions and big moments.
// Her 3D portraits come from scene/portraits.js, two wing beats each, stacked to flap.
import { esc, ART3D } from '../art.js';

export function makeMascot(host) {
  let hideT = null, seq = 0;
  host.innerHTML = '<div class="mascot-wrap"><div class="mascot-bubble"></div><div class="mascot-art"></div></div>';
  const wrap = host.firstChild, bubble = wrap.querySelector('.mascot-bubble'), art = wrap.querySelector('.mascot-art');
  return {
    say(line, mood = 'happy', prop = 'none', ms = 2400) {
      const n = ++seq, f = ART3D.mascot ? ART3D.mascot(mood, prop) : null;
      art.innerHTML = f ? `<img src="${f[0]}" alt=""><img class="flap" src="${f[1]}" alt="">` : '';
      bubble.innerHTML = esc(line);
      wrap.className = 'mascot-wrap in ' + mood;
      clearTimeout(hideT);
      hideT = setTimeout(() => { if (n === seq) wrap.className = 'mascot-wrap out'; }, ms);
    },
    hide() { clearTimeout(hideT); wrap.className = 'mascot-wrap out'; },
  };
}

export const LINES = {
  F: ['Plot twist!', 'Ooh, let’s see…', 'Didn’t see that coming!'],
  T: ['New message in the group chat!', 'The group chat is buzzing!', 'Someone sent a voice note…'],
  jail: ['Busted!', 'Off to the slammer!', 'Do not pass Start!'],
  auction: ['Going once…', 'Who wants it?', 'Place your bids!'],
  sold: ['Sold!', 'Going, going, gone!'],
  payday: ['Payday!', 'Ka-ching!'],
  ouch: ['Ouch!', 'That’s gotta hurt.', 'Landlord vibes.'],
  bust: ['That’s rough.', 'Bankrupt!', 'Game over for them.'],
  win: ['We have a tycoon!', 'Champion!', 'Absolute legend.'],
  doubles: ['Doubles! Roll again!'],
  triples: ['Triples! Go anywhere!'],
  hustle: ['Hustle!', 'On the move!'],
  bus: ['All aboard the bus!'],
  hotel: ['A hotel! Fancy.', 'Five stars!'],
  set: ['Full set! Time to build.', 'That’s a monopoly on vibes.'],
  jackpot: ['Jackpot!'],
  free: ['Free at last!'],
  shortage: ['The bank is short on buildings!'],
};
export const pick = list => list[Math.floor(Math.random() * list.length)];
