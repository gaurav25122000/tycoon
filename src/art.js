// Token names, colours and SVG icons shared by the HUD and the board artwork.
export const TOK = [
  { n: 'Skyscraper', c: '#e5484d', d: 'M9 2h6v3h2v17H7V5h2zM9.5 8v2h1.5V8zm3.5 0v2h1.5V8zm-3.5 4v2h1.5v-2zm3.5 0v2h1.5v-2zm-3.5 4v2h1.5v-2zm3.5 0v2h1.5v-2z' },
  { n: 'Gramophone', c: '#3e63dd', d: 'M3 18h12v3H3zm5-5h2v5H8zm1 0L18.5 3c1.6.6 2.9 2 3.5 3.5L11 14.5z' },
  { n: 'Pocket watch', c: '#30a46c', d: 'M12 6a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm0 2.2a5.3 5.3 0 1 0 0 10.6 5.3 5.3 0 0 0 0-10.6zM11 9.5h2v3.6l2.4 1.4-1 1.7L11 14.2zM11 3h2v2.4h-2zM9.5 1h5v2h-5z' },
  { n: 'Key', c: '#e79d13', d: 'M7 6a5 5 0 1 1 0 10A5 5 0 0 1 7 6zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm4.5.5H22V12h-2v3h-2.5v-3H16v2h-2.5v-2h-2z' },
  { n: 'Fountain pen', c: '#8e4ec6', d: 'M18.5 2 22 5.5 11 16.5l-4.2 1 1-4.2zM6.2 18.6 2 22l3.4-4.2z' },
  { n: 'Saxophone', c: '#12a594', d: 'M13 2h4v2h-1v9.5a6.5 6.5 0 0 1-6.5 6.5H8.5A4.5 4.5 0 0 1 4 15.5V14h3.2v1.5c0 .8.6 1.3 1.3 1.3h1a3.3 3.3 0 0 0 3.3-3.3V4H13z' },
  { n: 'Camera', c: '#f76b15', d: 'M3 7h4.2l2-2.5h5.6l2 2.5H21v13H3zm9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z' },
  { n: 'Umbrella', c: '#d6409f', d: 'M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2zm-1 10h2v7a3 3 0 0 1-6 0h2a1 1 0 0 0 2 0z' },
];

export const IC = {
  train: 'M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3l2 3h-2.5l-2-3h-5l-2 3H5l2-3a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 3v4h10V6zm1.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  drop: 'M12 2.5S5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z',
  receipt: 'M6 2h12v20l-3-2-3 2-3-2-3 2zm3 5h6v1.6H9zm0 4h6v1.6H9zm0 4h4v1.6H9z',
  wifi: 'M12 17.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zm-5.3-3.2a7.5 7.5 0 0 1 10.6 0l-1.6 1.6a5.2 5.2 0 0 0-7.4 0zM3.4 11a12.2 12.2 0 0 1 17.2 0L19 12.6a9.9 9.9 0 0 0-14 0zM.2 7.7a16.8 16.8 0 0 1 23.6 0l-1.6 1.6a14.5 14.5 0 0 0-20.4 0z',
  chat: 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 4.5V17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 6.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm5 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm5 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z',
  gem: 'M6 3h12l4 6-10 12L2 9z',
  arrow: 'M20 11H8.8l4.6-4.6L12 5l-7 7 7 7 1.4-1.4L8.8 13H20z',
  bars: 'M3 3h18v2H3zm0 16h18v2H3zM5 5h2v14H5zm4 0h2v14H9zm4 0h2v14h-2zm4 0h2v14h-2z',
  cup: 'M4 5h13v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zm13 2h1.5a2.5 2.5 0 0 1 0 5H17v-2h1.5a.5.5 0 0 0 0-1H17zM5 19h12v2H5z',
  badge: 'M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 15.3l-5.2 2.8 1-5.8L3.5 8.2l5.9-.9z',
  gear: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  sound: 'M4 9h4l5-4v14l-5-4H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z',
  mute: 'M4 9h4l5-4v14l-5-4H4zm11.6.2 1.4-1.4 2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2z',
  eye: 'M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  top: 'M3 3h18v18H3zm2 2v14h14V5zm3 3h8v8H8z',
  center: 'M11 2h2v4h-2zm0 16h2v4h-2zM2 11h4v2H2zm16 0h4v2h-4zm-6-4a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
  close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z',
  bus: 'M5 3h14a2 2 0 0 1 2 2v12a2 2 0 0 1-1 1.7V21h-3v-2H7v2H4v-2.3A2 2 0 0 1 3 17V5a2 2 0 0 1 2-2zm0 3v5h14V6zm2 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  run: 'M14 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM9.8 8.4l3.7-1 3.3 3.3H20v2h-4.1l-1.6-1.6-1.2 3.6 2.9 2.7V22h-2v-4.6l-3.1-2.8-1.1 3.4H4v-2h3.4l2.4-7.3-2.4.7V12H5.4V8z',
};

export const svg = (d, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${d}"/></svg>`;
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// readable ink on a colour swatch
export const inkOn = hex => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  return .2126 * ch[0] + .7152 * ch[1] + .0722 * ch[2] > .3 ? '#1b2033' : '#ffffff';
};
// the emotes players send; server.js keeps its own copy of this list
export const EMOTES = ['😀', '😂', '😎', '🤑', '😡', '😭', '👍', '🔥'];
// 3D renders from scene/portraits.js: tokens, dice, boards and trophy drawn at start-up; mascot, icons, emotes, pieces and landmarks drawn on first use.
// Flat art stands in if WebGL fails.
export const ART3D = { tok: [], dice: [], theme: {}, trophy: '', mascot: null, icon: null, emote: null, piece: null, landmark: null };
export const iconHTML = k => { const u = ART3D.icon && ART3D.icon(k); return u ? `<img class="i3d" src="${u}" alt="">` : svg(IC[k]); };
export const emoteHTML = e => { const u = ART3D.emote && ART3D.emote(e); return u ? `<img class="e3d" src="${u}" alt="${e}">` : e; };
export const tokHTML = (tok, extra) => `<span class="ptok ${extra || ''}${ART3D.tok[tok] ? ' p3d' : ''}" style="--c:${TOK[tok].c}">${ART3D.tok[tok] ? `<img src="${ART3D.tok[tok]}" alt="">` : svg(TOK[tok].d)}</span>`;
export const trophyHTML = () => (ART3D.trophy ? `<img class="trophy3d" src="${ART3D.trophy}" alt="">` : '🏆');
