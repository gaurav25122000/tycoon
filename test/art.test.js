import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ART3D, iconHTML, emoteHTML } from '../src/art.js';

test('HUD icons and emotes are flat until a 3D render is drawn, and fall back when one is not', () => {
  assert.match(iconHTML('menu'), /^<svg [^>]*><path fill-rule="evenodd" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"\/><\/svg>$/);
  assert.equal(emoteHTML('🔥'), '🔥');
  try {
    Object.assign(ART3D, { icon: () => '', emote: () => '' }); // a lost WebGL context draws nothing
    assert.match(iconHTML('menu'), /^<svg /);
    assert.equal(emoteHTML('🔥'), '🔥');
    Object.assign(ART3D, { icon: k => 'blob:' + k, emote: () => 'blob:e' });
    assert.equal(iconHTML('menu'), '<img class="i3d" src="blob:menu" alt="">');
    assert.equal(emoteHTML('🔥'), '<img class="e3d" src="blob:e" alt="🔥">');
  } finally { Object.assign(ART3D, { icon: null, emote: null }); }
});
