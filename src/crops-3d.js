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
import { opaqueCutout } from './opaque-cutout.js';
import { vineStocks } from './vineyard.js';

/**
 * The crops: their rows `gap` apart and a card every `step` (m), a card `width` wide and `height` high (m), at most
 * `max` cards a field (the step along the rows widened beyond), and its picture.
 */
/**
 * Near the camera (asked by Durzo on 17 Nov. 2026: fine from afar, too coarse close up), a stand has a second level
 * of detail (`near`): small cards of a few plants each, drawn larger (each stalk, grain, petal seen), many more of
 * them, and no level card (close, it read as ears lying flat). A field is cut into CROP_TILE_M squares, each a THREE.LOD: its near cards are made the first time the camera
 * comes within NEAR_M of it, never for the tiles it never nears.
 */
export const CROP_TILE_M = 30;
export const NEAR_M = 40;

export const CROP_KINDS = Object.freeze({
  // A cereal or rape: a closed stand, no rows seen; its cards scattered (`scatter`) and three planes each, so that
  // no square of bare earth shows between them (seen with two planes on a grid); and a level card at the ears' or
  // flowers' height (`canopy`, its share of the height): seen from above, a stand is its ears, not its stems' edges.
  wheat: { gap: 0.75, step: 0.75, width: 1.2, height: 0.95, planes: 3, scatter: true, canopy: 0.86, max: 45000,
    near: { gap: 0.26, step: 0.26, width: 0.42, height: 0.95, planes: 3, scatter: true, max: 16000 } },
  maize: { gap: 0.8, step: 1.3, width: 1.5, height: 2.4, planes: 2, max: 25000 },
  sunflower: { gap: 0.8, step: 1.0, width: 1.2, height: 1.75, planes: 2, max: 25000 },
  rape: { gap: 0.8, step: 0.8, width: 1.2, height: 1.3, planes: 3, scatter: true, canopy: 0.9, max: 45000,
    near: { gap: 0.3, step: 0.3, width: 0.48, height: 1.3, planes: 3, scatter: true, max: 16000 } },
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
export function cropCards(o, { avoid = null, near = false, masque = null } = {}) {
  const c = o && o.crop, base = c && CROP_KINDS[c.kind], kind = base && (near ? base.near : base);
  if (!kind) return [];
  return vineStocks(masque || (o.world && o.world.masque), { angle: c.angle || 0, gap: kind.gap, step: kind.step }, { max: kind.max, avoid, variants: 1 })
    .map(t => {
      if (!kind.scatter) return { x: t.x, z: t.z, rotY: Math.round((-(c.angle || 0) + (hash(t.row, t.col, 0x41c7) - 0.5) * 0.5) * 1000) / 1000,
        scale: Math.round((0.85 + 0.3 * hash(t.row, t.col, 0x1f3d)) * 100) / 100 };
      // Scattered: moved within its place, turned any way.
      const dx = (hash(t.row, t.col, 0x6b2a) - 0.5) * kind.step * 0.9, dz = (hash(t.row, t.col, 0x2f91) - 0.5) * kind.gap * 0.9;
      return { x: Math.round((t.x + dx) * 100) / 100, z: Math.round((t.z + dz) * 100) / 100,
        rotY: Math.round(hash(t.row, t.col, 0x41c7) * Math.PI * 2000) / 1000, scale: Math.round((0.85 + 0.3 * hash(t.row, t.col, 0x1f3d)) * 100) / 100 };
    })
    .filter(t => !avoid || !avoid(t.x, t.z));
}

/** The part of a mask within [x0, x1) × [z0, z1) (whole cells), or null. PURE. */
export function cropMask(m, x0, z0, x1, z1) {
  const i0 = Math.max(0, Math.floor((x0 - m.x0) / m.pas)), i1 = Math.min(m.nx, Math.ceil((x1 - m.x0) / m.pas));
  const j0 = Math.max(0, Math.floor((z0 - m.z0) / m.pas)), j1 = Math.min(m.nz, Math.ceil((z1 - m.z0) / m.pas));
  if (i1 <= i0 || j1 <= j0) return null;
  let plein = '';
  for (let j = j0; j < j1; j++) plein += m.plein.slice(j * m.nx + i0, j * m.nx + i1);
  return plein.includes('1') ? { pas: m.pas, x0: m.x0 + i0 * m.pas, z0: m.z0 + j0 * m.pas, nx: i1 - i0, nz: j1 - j0, plein } : null;
}

/** A clump's card: `planes` crossed planes `w` wide, `h` high, its foot at the origin. PURE ({ position, uv, index }). */
export function cropCardGeometry(w, h, planes = 2) {
  const position = [], uv = [], index = [];
  for (let n = 0; n < planes; n++) {
    const ax = Math.cos(n * Math.PI / planes), az = Math.sin(n * Math.PI / planes);
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

/** The pictures: a clump of plants on a transparent 512 × 1024 canvas, its foot at the bottom. */
const W = 512, H = 1024;
const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
const PICTURES = {
  wheat(ctx, r) {
    // A few dry leaves low down, then the stems, each with its ear: grains in two rows, awns, the ear nodding.
    for (let k = 0; k < 40; k++) {
      const x = r() * W, y = H - r() * 300, len = 80 + r() * 120, s = r() < 0.5 ? -1 : 1;
      ctx.strokeStyle = mix('#a8863e', '#c9a85a', r()); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * len * 0.5, y - len * 0.6, x + s * len, y - len * 0.3); ctx.stroke();
    }
    for (let k = 0; k < 150; k++) {
      const x = 6 + r() * (W - 12), top = 70 + r() * 240, lean = (r() - 0.5) * 50, nod = (r() - 0.3) * 0.5;
      const tone = r();
      ctx.strokeStyle = mix('#a5843a', '#d6b765', tone); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + lean * 0.2, H * 0.55, x + lean, top); ctx.stroke();
      // The ear, from `top` up along its tilt: grains alternating left and right.
      const ex = x + lean, ang = nod + lean / 300, ca = Math.sin(ang), sa = Math.cos(ang);
      for (let g = 0; g < 11; g++) {
        const d = g * 7, gx = ex + ca * d, gy = top - sa * d, side = g % 2 ? 1 : -1;
        ctx.fillStyle = mix('#c99f45', '#ecd38a', (tone + r() * 0.4) / 1.4);
        ctx.beginPath(); ctx.ellipse(gx + side * 4 * sa, gy + side * 4 * ca, 4.2, 7, ang + side * 0.35, 0, Math.PI * 2); ctx.fill();
        // Its awn, long and fine, upwards.
        ctx.strokeStyle = 'rgba(226,205,140,0.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gx + side * 6 * sa, gy); ctx.lineTo(gx + side * 6 * sa + ca * 30 + side * 6, gy - sa * 34); ctx.stroke();
      }
    }
  },
  maize(ctx, r) {
    for (let k = 0; k < 3; k++) {
      const x = 100 + k * 150 + (r() - 0.5) * 40;
      const stalk = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
      stalk.addColorStop(0, '#5e7f2e'); stalk.addColorStop(0.5, '#8aaa48'); stalk.addColorStop(1, '#5a7a2a');
      ctx.strokeStyle = stalk; ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + (r() - 0.5) * 14, 80); ctx.stroke();
      // Its leaves: long blades arching out and down, a pale midrib.
      for (let j = 0; j < 11; j++) {
        const y = 930 - j * 78, s = j % 2 ? 1 : -1, len = 130 + r() * 110, droop = 40 + r() * 80;
        const tipX = x + s * len, tipY = y - 40 + droop;
        ctx.fillStyle = j % 3 ? '#5d8a2c' : '#78a23c';
        ctx.beginPath(); ctx.moveTo(x, y - 6);
        ctx.quadraticCurveTo(x + s * len * 0.55, y - 110, tipX, tipY);
        ctx.quadraticCurveTo(x + s * len * 0.5, y - 70, x, y + 10); ctx.fill();
        ctx.strokeStyle = 'rgba(214,230,160,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * len * 0.55, y - 95, tipX, tipY); ctx.stroke();
      }
      // The tassel: branches spreading from the top, pale gold.
      ctx.strokeStyle = '#d6c27a'; ctx.lineWidth = 3;
      for (let a = 0; a < 9; a++) { ctx.beginPath(); ctx.moveTo(x, 90); ctx.quadraticCurveTo(x + (a - 4) * 10, 50, x + (a - 4) * 22, 20 + r() * 40); ctx.stroke(); }
      // A cob in its husk, its silk.
      ctx.fillStyle = '#a7c46a'; ctx.beginPath(); ctx.ellipse(x + 18, 560, 15, 55, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9a6a3a'; ctx.lineWidth = 1.5;
      for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(x + 32, 510); ctx.lineTo(x + 42 + a * 3, 470 + r() * 20); ctx.stroke(); }
    }
  },
  sunflower(ctx, r) {
    for (let k = 0; k < 3; k++) {
      const x = 90 + k * 165 + (r() - 0.5) * 40, top = 170 + r() * 120;
      ctx.strokeStyle = '#6a8a35'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + 10, top + 200, x + 6, top + 50); ctx.stroke();
      // Broad heart-shaped leaves, veined.
      for (let j = 0; j < 6; j++) {
        const y = 940 - j * 115, s = j % 2 ? 1 : -1, cx = x + s * 70, cy = y - 30;
        ctx.fillStyle = j % 2 ? '#5f8a2e' : '#6e9a36';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + s * 30, y - 90, cx + s * 70, cy - 50, cx + s * 40, cy + 20);
        ctx.bezierCurveTo(cx + s * 10, cy + 50, x + s * 20, y + 20, x, y); ctx.fill();
        ctx.strokeStyle = 'rgba(200,220,150,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx + s * 40, cy + 10); ctx.stroke();
      }
      // The head, nodding a little: two rings of petals, then the disc and its seeds in spirals.
      for (const [n, rr, col] of [[22, 66, '#e9b40f'], [20, 56, '#f7cd1c']]) {
        for (let a = 0; a < n; a++) { const t = a / n * Math.PI * 2 + rr; ctx.fillStyle = col;
          ctx.beginPath(); ctx.ellipse(x + Math.cos(t) * rr * 0.75, top + Math.sin(t) * rr * 0.75, 24, 9, t, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.fillStyle = '#4a2e14'; ctx.beginPath(); ctx.arc(x, top, 42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b4520';
      for (let a = 0; a < 140; a++) { const t = a * 2.39996, d = 3.4 * Math.sqrt(a); ctx.beginPath(); ctx.arc(x + Math.cos(t) * d, top + Math.sin(t) * d, 1.6, 0, Math.PI * 2); ctx.fill(); }
    }
  },
  rape(ctx, r) {
    // Blue-green lobed leaves at the foot, then branching stems, their pods below, flowers in domes at their tips.
    for (let k = 0; k < 24; k++) {
      const x = r() * W, y = H - 20 - r() * 160, s = r() < 0.5 ? -1 : 1;
      ctx.fillStyle = mix('#4e7a3e', '#6f9a52', r());
      ctx.beginPath(); ctx.ellipse(x + s * 30, y, 44, 16, s * (0.3 + r() * 0.4), 0, Math.PI * 2); ctx.fill();
    }
    for (let k = 0; k < 46; k++) {
      const x = 10 + r() * (W - 20), top = 60 + r() * 260, lean = (r() - 0.5) * 60;
      ctx.strokeStyle = mix('#5e8a36', '#7fa648', r()); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + lean * 0.3, H * 0.6, x + lean, top); ctx.stroke();
      const fx = x + lean;
      // Its pods, thin, along the stem under the flowers.
      ctx.strokeStyle = '#7fa648'; ctx.lineWidth = 2;
      for (let p = 0; p < 6; p++) { const y = top + 50 + p * 22, s = p % 2 ? 1 : -1; ctx.beginPath(); ctx.moveTo(fx - lean * 0.02 * p, y); ctx.lineTo(fx + s * 20, y - 18); ctx.stroke(); }
      // The flowers: four petals each, in a dome.
      for (let f = 0; f < 16; f++) {
        const a = r() * Math.PI, d = r() * 26, cx = fx + Math.cos(a) * d * 1.3, cy = top + 10 - Math.sin(a) * d;
        ctx.fillStyle = r() < 0.6 ? '#f6dc1a' : '#e8c40c';
        for (let q = 0; q < 4; q++) { const t = q * Math.PI / 2 + f; ctx.beginPath(); ctx.arc(cx + Math.cos(t) * 3.5, cy + Math.sin(t) * 3.5, 3.4, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.fillStyle = '#c9b24a'; for (let b = 0; b < 4; b++) { ctx.beginPath(); ctx.arc(fx + (r() - 0.5) * 10, top - 4 - r() * 8, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
  },
};

/** The stands seen from above (`canopy`): ears or flowers packed, on a transparent 512 × 512 canvas. */
const TOP_PICTURES = {
  wheat(ctx, r) {
    for (let k = 0; k < 420; k++) {
      const x = r() * 512, y = r() * 512, a = r() * Math.PI * 2, tone = r();
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      for (let g = 0; g < 7; g++) { ctx.fillStyle = mix('#c49b42', '#ecd38a', (tone + r() * 0.3) / 1.3);
        ctx.beginPath(); ctx.ellipse((g % 2 ? 3 : -3), -g * 5, 3.2, 5.5, (g % 2 ? 0.35 : -0.35), 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = 'rgba(226,205,140,0.8)'; ctx.lineWidth = 1;
      for (let g = 0; g < 4; g++) { ctx.beginPath(); ctx.moveTo(0, -g * 8); ctx.lineTo((r() - 0.5) * 20, -g * 8 - 22); ctx.stroke(); }
      ctx.restore();
    }
  },
  rape(ctx, r) {
    for (let k = 0; k < 160; k++) {
      const x = r() * 512, y = r() * 512;
      for (let f = 0; f < 14; f++) {
        const a = r() * Math.PI * 2, d = r() * 18, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
        ctx.fillStyle = r() < 0.6 ? '#f6dc1a' : '#e8c40c';
        for (let q = 0; q < 4; q++) { const t = q * Math.PI / 2 + f; ctx.beginPath(); ctx.arc(cx + Math.cos(t) * 3, cy + Math.sin(t) * 3, 3, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  },
};

/**
 * The near pictures: a FEW plants on the same 512 × 1024 canvas (a card 0.4 to 0.5 m wide), so that each is drawn
 * large: a wheat ear's grains shaded one by one, its awns; rape's flowers petal by petal, its buds, pods and leaves.
 */
const NEAR_PICTURES = {
  wheat(ctx, r) {
    for (let k = 0; k < 6; k++) {
      const x = r() * W, y = H - r() * 260, len = 120 + r() * 140, s = r() < 0.5 ? -1 : 1;
      ctx.fillStyle = mix('#9c7c38', '#c4a258', r());
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * len * 0.5, y - len * 0.8, x + s * len, y - len * 0.35);
      ctx.quadraticCurveTo(x + s * len * 0.45, y - len * 0.55, x + 4, y); ctx.fill();
    }
    for (let k = 0; k < 11; k++) {
      const x = 30 + r() * (W - 60), top = 120 + r() * 220, lean = (r() - 0.5) * 80, nod = (r() - 0.3) * 0.45, tone = r();
      // The stem: a light side and a shaded one, its nodes.
      ctx.strokeStyle = mix('#9d7c34', '#cfae5c', tone); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + lean * 0.2, H * 0.55, x + lean, top + 6); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,222,160,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 1.5, H); ctx.quadraticCurveTo(x + lean * 0.2 - 1.5, H * 0.55, x + lean - 1.5, top + 6); ctx.stroke();
      for (let n = 1; n <= 3; n++) { const t = n / 4, nx = x + lean * t * t, ny = H - (H - top) * t; ctx.fillStyle = '#8a6a2a'; ctx.fillRect(nx - 4, ny, 8, 3); }
      // The ear: 16 spikelets alternating, each three grains shaded, a long awn each.
      const ex = x + lean, ang = nod + lean / 400, ca = Math.sin(ang), sa = Math.cos(ang);
      for (let g = 0; g < 16; g++) {
        const d = g * 9, gx = ex + ca * d, gy = top - sa * d, side = g % 2 ? 1 : -1, sz = 1 - g / 26;
        for (let q = 0; q < 2; q++) {
          const ox = gx + side * (5 + q * 4) * sa, oy = gy + side * (5 + q * 4) * ca;
          const grad = ctx.createLinearGradient(ox - 6, oy, ox + 6, oy);
          grad.addColorStop(0, mix('#a98330', '#c9a24a', tone)); grad.addColorStop(0.6, mix('#e2c475', '#f2dc9a', tone)); grad.addColorStop(1, '#b38c3a');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.ellipse(ox, oy, 6.5 * sz, 11 * sz, ang + side * 0.4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(120,90,30,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(232,212,150,0.9)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(gx + side * 10 * sa, gy - 6); ctx.quadraticCurveTo(gx + side * 16 * sa + ca * 30, gy - 40, gx + side * 22 + ca * 60, gy - sa * 70); ctx.stroke();
      }
    }
  },
  rape(ctx, r) {
    // Lobed blue-green leaves clasping the stems low down.
    for (let k = 0; k < 7; k++) {
      const x = r() * W, y = H - 30 - r() * 300, s = r() < 0.5 ? -1 : 1, L = 90 + r() * 70;
      ctx.fillStyle = mix('#4a7642', '#6c9a5a', r());
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let l = 0; l <= 4; l++) { const t = l / 4; ctx.quadraticCurveTo(x + s * L * t + s * 10, y - 30 - 18 * Math.sin(t * Math.PI) - (l % 2) * 10, x + s * L * (t + 0.12), y - 10 * Math.sin(t * 3)); }
      ctx.quadraticCurveTo(x + s * L * 0.5, y + 22, x, y + 4); ctx.fill();
      ctx.strokeStyle = 'rgba(190,215,170,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * L, y - 8); ctx.stroke();
    }
    for (let k = 0; k < 4; k++) {
      const x = 60 + r() * (W - 120), top = 120 + r() * 200, lean = (r() - 0.5) * 70;
      ctx.strokeStyle = '#6a9440'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + lean * 0.3, H * 0.6, x + lean, top + 40); ctx.stroke();
      const fx = x + lean;
      // Its pods: long, thin, on short stalks, below the flowers.
      for (let p = 0; p < 9; p++) {
        const y = top + 90 + p * 24, s = p % 2 ? 1 : -1;
        ctx.strokeStyle = '#7ea84c'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(fx - lean * 0.01 * p, y); ctx.quadraticCurveTo(fx + s * 14, y - 10, fx + s * 34, y - 46); ctx.stroke();
      }
      // The raceme: flowers four-petalled, cross-shaped, a darker eye; buds at the top.
      for (let f = 0; f < 22; f++) {
        const a = r() * Math.PI, d = 8 + r() * 46, cx = fx + Math.cos(a) * d * 1.2, cy = top + 40 - Math.sin(a) * d * 0.9;
        const rot = r() * Math.PI;
        for (let q = 0; q < 4; q++) {
          const t = rot + q * Math.PI / 2;
          ctx.fillStyle = q % 2 ? '#f6dc22' : '#fbe74a';
          ctx.beginPath(); ctx.ellipse(cx + Math.cos(t) * 7, cy + Math.sin(t) * 7, 7.5, 5, t, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(190,150,10,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.fillStyle = '#c9a00e'; ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      for (let b = 0; b < 9; b++) { ctx.fillStyle = mix('#b9c24a', '#e0c82a', r()); ctx.beginPath(); ctx.ellipse(fx + (r() - 0.5) * 22, top - r() * 26, 4, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  },
};

/** A crop's picture, drawn once. `makeCanvas(w, h)`: a canvas (the DOM's in the application). */
export function drawCropPicture(kind, makeCanvas = (w, h) => { const c = domCanvas(w); c.height = h; return c; }, near = false) {
  const c = makeCanvas(W, H);
  (near ? NEAR_PICTURES : PICTURES)[kind](c.getContext('2d'), rng(0x5eed + kind.length + (near ? 99 : 0)));
  return c;
}

/** A stand's picture from above (`canopy`), drawn once, or null. */
export function drawCropTop(kind, makeCanvas = (w, h) => { const c = domCanvas(w); c.height = h; return c; }) {
  if (!TOP_PICTURES[kind]) return null;
  const c = makeCanvas(512, 512);
  TOP_PICTURES[kind](c.getContext('2d'), rng(0x7a11 + kind.length));
  return c;
}

/** A level card `w` square at `y`, its corners on the circle of the planes' ends. PURE. */
export function cropCanopyGeometry(w, y) {
  const h = w / 2, position = [], uv = [];
  for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { position.push((u - 0.5) * w * 1.1, y, (v - 0.5) * w * 1.1); uv.push(u, v); }
  return { position, uv, index: [0, 2, 1, 0, 3, 2], h };
}

/**
 * A card's material lit the same on both faces: three turns a back face's normal down (`normal * faceDirection`), so
 * a card seen from behind went dark olive (half the rape's flowers, seen in the application). Its normals all point
 * up (the ground's light): the flip is taken out.
 */
function bothSidesLit(material) {
  const before = material.onBeforeCompile, key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (shader, renderer) => {
    if (before) before(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace(/normal = normal \* faceDirection;/g, ''));
  };
  material.customProgramCacheKey = () => `${key}+both-sides-lit`;
  return material;
}

/** Each crop's parts (geometry, material) for a level (`near`), made once. */
const made = new Map();
function cropModel(kind, near = false) {
  const key = `${kind}|${near}`;
  if (!made.has(key)) {
    const k = near ? CROP_KINDS[kind].near : CROP_KINDS[kind], g = cropCardGeometry(k.width, k.height, k.planes);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(g.position, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geometry.setIndex(g.index);
    // Lit from above like the ground they grow on, not by the planes' own normals (edge-on, a card went black).
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(g.position.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const map = new THREE.CanvasTexture(drawCropPicture(kind, undefined, near));
    map.anisotropy = 8;
    const material = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.35, roughness: 0.95, metalness: 0 });
    opaqueCutout(material);
    bothSidesLit(material);
    const parts = [{ geometry, material }];
    if (k.canopy) {
      const c = cropCanopyGeometry(k.width, k.height * k.canopy), top = new THREE.BufferGeometry();
      top.setAttribute('position', new THREE.Float32BufferAttribute(c.position, 3));
      top.setAttribute('uv', new THREE.Float32BufferAttribute(c.uv, 2));
      top.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      top.setIndex(c.index);
      const topMaterial = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(drawCropTop(kind)), side: THREE.DoubleSide, alphaTest: 0.35, roughness: 0.95, metalness: 0 });
      opaqueCutout(topMaterial);
      bothSidesLit(topMaterial);
      parts.push({ geometry: top, material: topMaterial });
    }
    made.set(key, parts);
  }
  return made.get(key);
}

/** The InstancedMeshes of `cards` (a level's parts), each card at the ground's height. */
function instancesOf(cards, parts, heightAt) {
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const matrices = cards.map(t => {
    q.setFromAxisAngle(up, t.rotY);
    s.set(t.scale, t.scale, t.scale);
    p.set(t.x, heightAt(t.x, t.z), t.z);
    return m.compose(p, q, s).clone();
  });
  for (const { geometry, material } of parts) {
    const mesh = new THREE.InstancedMesh(geometry, material, cards.length);
    matrices.forEach((mm, i) => mesh.setMatrixAt(i, mm));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.userData.shared = true;
    group.add(mesh);
  }
  return group;
}

/**
 * The crop of a field Zone, the ground's height at (x, z) by `heightAt`, off `avoid`: a Group, or null. A crop with a
 * near level is cut into tiles, each a THREE.LOD (its far cards; its near ones made when the camera first nears it).
 */
export function crops3D(o, heightAt = () => 0, { avoid = null } = {}) {
  const cards = cropCards(o, { avoid });
  if (!cards.length) return null;
  const kind = CROP_KINDS[o.crop.kind];
  const group = new THREE.Group();
  group.userData.crop = cards.length;
  if (!kind.near) { group.add(instancesOf(cards, cropModel(o.crop.kind), heightAt)); return group; }
  const tiles = new Map();
  for (const c of cards) {
    const key = `${Math.floor(c.x / CROP_TILE_M)},${Math.floor(c.z / CROP_TILE_M)}`;
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(c);
  }
  const masque = o.world.masque;
  for (const [key, list] of tiles) {
    const [ti, tj] = key.split(',').map(Number);
    const lod = new THREE.LOD();
    const cx = (ti + 0.5) * CROP_TILE_M, cz = (tj + 0.5) * CROP_TILE_M;
    lod.position.set(cx, heightAt(cx, cz), cz);
    // Its levels are in the world (the cards' own places): they undo the tile's position.
    const nearLevel = new THREE.Group(), farLevel = instancesOf(list, cropModel(o.crop.kind), heightAt);
    for (const g of [nearLevel, farLevel]) g.position.set(-cx, -lod.position.y, -cz);
    lod.addLevel(nearLevel, 0);
    lod.addLevel(farLevel, NEAR_M);
    let built = false;
    const update = lod.update.bind(lod);
    lod.update = (camera) => {
      if (!built && camera.getWorldPosition(new THREE.Vector3()).distanceTo(lod.getWorldPosition(new THREE.Vector3())) < NEAR_M * 1.25) {
        built = true;
        const sub = cropMask(masque, ti * CROP_TILE_M, tj * CROP_TILE_M, (ti + 1) * CROP_TILE_M, (tj + 1) * CROP_TILE_M);
        const near = sub ? cropCards(o, { avoid, near: true, masque: sub }) : [];
        if (near.length) nearLevel.add(instancesOf(near, cropModel(o.crop.kind, true), heightAt));
      }
      update(camera);
    };
    group.add(lod);
  }
  return group;
}
