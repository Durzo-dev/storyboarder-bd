/**
 * src/crops-3d.js: FIELD CROPS IN RELIEF (#481c): wheat, maize, sunflowers, rape standing on their fields, drawn at
 * render time as cards (two crossed planes, a drawn picture of a clump of plants), copies of one card, in the
 * field's rows: tens of thousands in one draw.
 *
 * A field is a Zone with `crop` ({ kind, angle }: farm-plots.js, from the RPG's crop group). Its plants are not
 * Elements. The pictures are DRAWN here (no licence): a clump each, in high summer (wheat ripe, maize in tassel,
 * sunflowers in flower, rape in yellow). Geometries and materials are SHARED (`userData.shared`): never disposed
 * with a Zone (scene3d.js).
 */
import { domCanvas } from './tree-species.js';
import { opaqueCutout } from './ez-trees.js';
import { vineStocks } from './vineyard.js';

/**
 * The crops: their rows `gap` apart and a card every `step` (m), a card `width` wide and `height` high (m), at most
 * `max` cards a field (the step along the rows widened beyond), and its picture.
 */
export const CROP_KINDS = Object.freeze({
  wheat: { gap: 0.9, step: 0.9, width: 1.3, height: 0.95, max: 40000 },
  maize: { gap: 0.8, step: 1.3, width: 1.5, height: 2.4, max: 25000 },
  sunflower: { gap: 0.8, step: 1.0, width: 1.2, height: 1.75, max: 25000 },
  rape: { gap: 0.9, step: 0.9, width: 1.3, height: 1.3, max: 40000 },
});

/** The crop standing on a field of an RPG crop group (`code_group`), or null: cereals, maize, rape, sunflower. */
export function cropOfGroup(group) {
  const g = parseInt(group, 10);
  return g === 2 ? 'maize' : g === 5 ? 'rape' : g === 6 ? 'sunflower' : [1, 3, 4].includes(g) ? 'wheat' : null;
}

/** A number in [0, 1) from integers and a salt. */
function hash(i, j, salt) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The cards of a field Zone: in its rows, on its cells, off `avoid`; each turned and sized a little. PURE. */
export function cropCards(o, { avoid = null } = {}) {
  const c = o && o.crop, kind = c && CROP_KINDS[c.kind];
  if (!kind) return [];
  return vineStocks(o.world && o.world.masque, { angle: c.angle || 0, gap: kind.gap, step: kind.step }, { max: kind.max, avoid, variants: 1 })
    .map(t => ({ x: t.x, z: t.z, rotY: Math.round((-(c.angle || 0) + (hash(t.row, t.col, 0x41c7) - 0.5) * 0.5) * 1000) / 1000,
      scale: Math.round((0.85 + 0.3 * hash(t.row, t.col, 0x1f3d)) * 100) / 100 }));
}

/** A clump's card: two crossed planes `w` wide, `h` high, its foot at the origin. PURE ({ position, uv, index }). */
export function cropCardGeometry(w, h) {
  const position = [], uv = [], index = [];
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const b = position.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      position.push((u - 0.5) * w * ax, v * h, (u - 0.5) * w * az);
      uv.push(u, v);
    }
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { position, uv, index };
}

/** A random generator from a seed. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** The pictures: a clump of plants on a transparent 256 × 512 canvas, its foot at the bottom. */
const PICTURES = {
  wheat(ctx, r) {
    for (let k = 0; k < 110; k++) {
      const x = 6 + r() * 244, top = 60 + r() * 100, lean = (r() - 0.5) * 30;
      ctx.strokeStyle = r() < 0.5 ? '#c9a752' : '#b8953f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 512); ctx.quadraticCurveTo(x + lean * 0.3, 300, x + lean, top); ctx.stroke();
      // The ear: a tight spindle, its awns.
      ctx.fillStyle = r() < 0.5 ? '#d8b660' : '#c49e4a';
      ctx.beginPath(); ctx.ellipse(x + lean, top - 18, 3, 20, lean / 200, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e2c983'; ctx.lineWidth = 1;
      for (let a = 0; a < 4; a++) { const y = top - 34 + a * 8; ctx.beginPath(); ctx.moveTo(x + lean, y); ctx.lineTo(x + lean + (r() - 0.5) * 16, y - 22); ctx.stroke(); }
    }
  },
  maize(ctx, r) {
    for (let k = 0; k < 3; k++) {
      const x = 50 + k * 75 + (r() - 0.5) * 20;
      ctx.strokeStyle = '#6f8f3a'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x, 512); ctx.lineTo(x + (r() - 0.5) * 8, 40); ctx.stroke();
      // Long arching leaves both sides, the tassel at the top, a cob in its sheath.
      for (let j = 0; j < 9; j++) {
        const y = 470 - j * 46, s = j % 2 ? 1 : -1, len = 70 + r() * 50;
        ctx.strokeStyle = j % 3 ? '#5f8a2e' : '#7aa03e'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * len * 0.6, y - 60, x + s * len, y - 10 + r() * 30); ctx.stroke();
      }
      ctx.strokeStyle = '#c8b46a'; ctx.lineWidth = 3;
      for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x + (a - 2.5) * 9, 6 + r() * 12); ctx.stroke(); }
      ctx.fillStyle = '#9dbb5a'; ctx.beginPath(); ctx.ellipse(x + 10, 300, 9, 30, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  },
  sunflower(ctx, r) {
    for (let k = 0; k < 3; k++) {
      const x = 45 + k * 80 + (r() - 0.5) * 20, top = 90 + r() * 60;
      ctx.strokeStyle = '#6a8a35'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x, 512); ctx.lineTo(x, top + 30); ctx.stroke();
      for (let j = 0; j < 5; j++) {
        const y = 470 - j * 70, s = j % 2 ? 1 : -1;
        ctx.fillStyle = j % 2 ? '#5f8a2e' : '#6e9a36';
        ctx.beginPath(); ctx.ellipse(x + s * 34, y - 18, 34, 20, s * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      // The head, facing the same way as its neighbours (east, as sunflowers in flower do): petals, then the disc.
      ctx.fillStyle = '#f2c21a';
      for (let a = 0; a < 18; a++) { const t = a / 18 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(t) * 30, top + Math.sin(t) * 30, 12, 6, t, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.arc(x, top, 22, 0, Math.PI * 2); ctx.fill();
    }
  },
  rape(ctx, r) {
    for (let k = 0; k < 40; k++) {
      const x = 10 + r() * 236, top = 60 + r() * 120;
      ctx.strokeStyle = '#6f9440'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 512); ctx.lineTo(x + (r() - 0.5) * 20, top); ctx.stroke();
      ctx.fillStyle = r() < 0.5 ? '#f3d72a' : '#e8c81e';
      for (let f = 0; f < 7; f++) { ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 24, top + (r() - 0.3) * 24, 5 + r() * 4, 0, Math.PI * 2); ctx.fill(); }
    }
    // Leaves at the foot.
    for (let k = 0; k < 14; k++) { ctx.fillStyle = '#5e8a34'; ctx.beginPath(); ctx.ellipse(r() * 256, 470 + r() * 30, 22, 10, r(), 0, Math.PI * 2); ctx.fill(); }
  },
};

/** A crop's picture, drawn once. `makeCanvas(w, h)`: a canvas (the DOM's in the application). */
export function drawCropPicture(kind, makeCanvas = (w, h) => { const c = domCanvas(w); c.height = h; return c; }) {
  const c = makeCanvas(256, 512);
  PICTURES[kind](c.getContext('2d'), rng(0x5eed + kind.length));
  return c;
}

/** Each crop's geometry and material, made once. */
const made = new Map();
function cropModel(kind) {
  if (!made.has(kind)) {
    const k = CROP_KINDS[kind], g = cropCardGeometry(k.width, k.height);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(g.position, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geometry.setIndex(g.index);
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(g.position.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const map = new THREE.CanvasTexture(drawCropPicture(kind));
    // Lit from above like the ground they grow on, not by the planes' own normals (edge-on, a card went black).
    const material = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.35, roughness: 0.95, metalness: 0 });
    opaqueCutout(material);
    made.set(kind, { geometry, material });
  }
  return made.get(kind);
}

/** The crop of a field Zone, the ground's height at (x, z) by `heightAt`, off `avoid`: an InstancedMesh, or null. */
export function crops3D(o, heightAt = () => 0, { avoid = null } = {}) {
  const cards = cropCards(o, { avoid });
  if (!cards.length) return null;
  const { geometry, material } = cropModel(o.crop.kind);
  const mesh = new THREE.InstancedMesh(geometry, material, cards.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  cards.forEach((t, i) => {
    q.setFromAxisAngle(up, t.rotY);
    s.set(t.scale, t.scale, t.scale);
    p.set(t.x, heightAt(t.x, t.z), t.z);
    mesh.setMatrixAt(i, m.compose(p, q, s));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData.shared = true;
  mesh.userData.crop = cards.length;
  return mesh;
}
