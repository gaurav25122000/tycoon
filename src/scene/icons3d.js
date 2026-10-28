// HUD icons as enamel pins: an IC glyph extruded in ink lacquer with a polished gold bevel.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const loader = new SVGLoader();
// viewBox units; the bevel eats inward so strokes and holes keep their size
const EXT = { depth: 2, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.28, bevelOffset: -0.28, bevelSegments: 3 };
// y-up about the viewBox centre, wound as ExtrudeGeometry expects (outer clockwise, holes not);
// near-duplicate points where SVG arcs meet would spike the bevel, so they are dropped
const pts = (p, cw) => {
  const v = [];
  for (const q of p) { const w = new THREE.Vector2(q.x - 12, 12 - q.y); if (!v.length || w.distanceTo(v[v.length - 1]) > 0.01) v.push(w); }
  if (v[0].distanceTo(v[v.length - 1]) <= 0.01) v.pop();
  return THREE.ShapeUtils.isClockWise(v) === cw ? v : v.reverse();
};

export function iconModel(d) {
  const shapes = [];
  for (const path of loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="evenodd" d="${d}"/></svg>`).paths) {
    for (const s of path.toShapes()) {
      const { shape, holes } = s.extractPoints(8);
      const sh = new THREE.Shape(pts(shape, true));
      sh.holes = holes.map(h => new THREE.Path(pts(h, false)));
      shapes.push(sh);
    }
  }
  const geo = new THREE.ExtrudeGeometry(shapes, EXT).translate(0, 0, -EXT.depth / 2).scale(1 / 24, 1 / 24, 1 / 24);
  const face = new THREE.MeshPhysicalMaterial({ color: '#1d2433', roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.3 });
  const gilt = new THREE.MeshPhysicalMaterial({ color: '#f2c24e', metalness: 1, roughness: 0.25, emissive: '#6a4a10', emissiveIntensity: 0.18 });
  // invisible viewBox square: every icon gets the same bounds, so sizes match the flat set
  const box = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  box.visible = false;
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, [face, gilt]), box);
  return g;
}
