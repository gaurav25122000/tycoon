// Board geometry: squares in layout units (board = 12.2 units, corners 1.6) and world units.
import { BOARD } from '../engine.js';

export const W = 10;            // board width in world units
export const U = 12.2;          // board width in layout units
export const CU = 1.6;          // corner size in layout units
export const EW = W / U;        // edge square width, world
export const CW = CU * W / U;   // square depth, world

function gridPos(p) {
  if (p <= 10) return [11, 11 - p];
  if (p <= 20) return [11 - (p - 10), 1];
  if (p <= 30) return [1, 1 + (p - 20)];
  return [1 + (p - 30), 11];
}
export const side = p => (p % 10 === 0 ? 'c' : p < 10 ? 'b' : p < 20 ? 'l' : p < 30 ? 't' : 'r');
// canvas rotation that turns a square's "up" towards the board centre
export const ANG = { b: 0, l: Math.PI / 2, t: Math.PI, r: -Math.PI / 2 };
// world direction from a square towards the board centre
export const IN = { b: [0, -1], l: [1, 0], t: [0, 1], r: [-1, 0] };
// camera azimuth that reads a side's text upright
export const VIEW = { b: 0, l: -Math.PI / 2, t: Math.PI, r: Math.PI / 2 };
export const sideOf = p => (p % 10 === 0 ? ['b', 'l', 't', 'r'][p / 10] : side(p));

export const rects = BOARD.map((_, p) => {
  const [r, c] = gridPos(p);
  const x = c === 1 ? 0 : c === 11 ? U - CU : CU + (c - 2), y = r === 1 ? 0 : r === 11 ? U - CU : CU + (r - 2);
  const w = c === 1 || c === 11 ? CU : 1, h = r === 1 || r === 11 ? CU : 1;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
});
const toW = u => (u / U - 0.5) * W;
export const toU = w => (w / W + 0.5) * U;
export const centreOf = p => ({ x: toW(rects[p].cx), z: toW(rects[p].cy) });
// jail corner: the cell sits towards the board centre, visitors on the outer L
export const JAIL_CELL = { x: toW(rects[10].x + CU * 0.62), z: toW(rects[10].y + CU * 0.38) };
export const JAIL_VISIT = { x: toW(rects[10].x + CU * 0.2), z: toW(rects[10].y + CU * 0.8) };
export const squareAt = (x, z) => {
  const u = toU(x), v = toU(z);
  return rects.findIndex(r => u >= r.x && u <= r.x + r.w && v >= r.y && v <= r.y + r.h);
};
// card decks sit on the centre diagonals, as on a classic board
export const DECK_AT = { T: { x: -1.75, z: -1.75, r: -Math.PI / 4 }, F: { x: 1.75, z: 1.75, r: -Math.PI / 4 } };
export const CARD = { w: 1.05, d: 1.6 };
