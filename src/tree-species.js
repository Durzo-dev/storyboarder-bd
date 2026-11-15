/**
 * src/tree-species.js: OUR SPECIES FOR EZ-TREE (#480f, in the application since #480g): each one a preset of EZ-Tree to start from, what
 * changes (its silhouette), its bark (Poly Haven, CC0) and its foliage DRAWN here (no licence). Tuned by eye in the
 * browser on 15 Nov. 2026 against reference photos of Wikimedia Commons (leaves, sprays, whole trees):
 *   - plane (Platanus × hispanica): 3 to 5 pointed lobes, a tall trunk, a wide crown; Poly Haven's own plane bark;
 *   - linden (Tilia cordata): a heart, its edge toothed, its tip drawn out; a domed crown; grey ridged bark;
 *   - cypress (Cupressus sempervirens): NO leaves nor needles: flat sprays of tiny scales, branching again and
 *     again; a narrow flame-shaped column; fibrous bark;
 *   - olive (Olea europaea): narrow lances, dark grey-green above, silvery under, in opposite pairs; a short
 *     twisted trunk under a broad crown.
 * Each species has its sheet in docs/en/tree-species.md (tests/tree-species.test.mjs). The canvases come from
 * `makeCanvas(size)` (a DOM canvas in the application; tests give their own), so this module runs anywhere.
 */

/** Poly Haven's barks (CC0): the asset's identifier (https://polyhaven.com/a/<id>). */
const BARK = (id) => id;

/**
 * The file of a species' bark, shipped in assets/textures/ (tools/ez-tree/fetch-barks.cjs: Poly Haven's colour map,
 * 512 px, JPEG): `ecorce-platane.jpg`.
 */
export const barkFile = (name) => `ecorce-${name.toLowerCase()}.jpg`;

/** A DOM canvas of `size` px (the application's); tests replace it. */
export const domCanvas = (size) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
};

function rng(seed){
  let r = seed * 9301 + 49297;
  return () => (r = (r * 16807) % 2147483647) / 2147483647;
}
function shade(hex, k){
  const n = parseInt(hex.slice(1), 16);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('');
}

/** Leaf shapes, drawn around (0, 0), `s` their half length. */
const SHAPES = {
  plane(ctx, s, rnd){
    const lobes = [[-1.75, 0.55], [-0.95, 0.85], [0, 1], [0.95, 0.85], [1.75, 0.55]];
    ctx.beginPath(); ctx.moveTo(0, s * 0.18);
    lobes.forEach(([a, l], i) => {
      const tip = [Math.sin(a) * s * l, -Math.cos(a) * s * l];
      const mid = (a + (i ? lobes[i - 1][0] : a - 0.9)) / 2, sinus = [Math.sin(mid) * s * 0.42, -Math.cos(mid) * s * 0.42];
      ctx.lineTo(sinus[0], sinus[1]);
      ctx.lineTo((sinus[0] + tip[0]) / 2 + (rnd() - 0.5) * s * 0.06, (sinus[1] + tip[1]) / 2);
      ctx.lineTo(tip[0], tip[1]);
    });
    ctx.lineTo(Math.sin(2.65) * s * 0.4, -Math.cos(2.65) * s * 0.4);
    ctx.closePath();
  },
  linden(ctx, s){
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const t = i / 90 * Math.PI * 2;
      let x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      x *= (1 + 0.035 * (i % 2 ? 1 : -1)) * (x > 0 ? 1.05 : 0.95);
      ctx.lineTo(x * s / 17, -y * s / 17 * 1.05 + s * 0.1);
    }
    ctx.closePath();
  },
  olive(ctx, s){
    ctx.beginPath(); ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.3, 0, 0, s); ctx.quadraticCurveTo(-s * 0.3, 0, 0, -s); ctx.closePath();
  },
};

/** A twig with leaves of a shape (in opposite pairs if asked), on a transparent 512 px canvas. */
function leafTwig({ shape, colours, under = null, n = 7, size = 70, spread = 0.9, opposite = false, seed = 1, makeCanvas = domCanvas }){
  const c = makeCanvas(512);
  const ctx = c.getContext('2d'), rnd = rng(seed);
  ctx.translate(256, 505);
  ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(14, -200, 0, -400); ctx.stroke();
  for (let i = 0; i < n; i++) {
    const t = 0.12 + 0.88 * i / (n - 1);
    for (const side of opposite ? [1, -1] : [i % 2 ? 1 : -1]) {
      ctx.save();
      ctx.translate(0, -400 * t);
      ctx.rotate(side * (0.45 + rnd() * spread * 0.6) * (i === n - 1 && !opposite ? 0.1 : 1));
      ctx.translate(0, -size * 1.05);
      const base = under && rnd() < 0.3 ? under : colours[Math.floor(rnd() * colours.length)];
      const g = ctx.createLinearGradient(-size, 0, size, 0);
      g.addColorStop(0, shade(base, 0.85)); g.addColorStop(0.5, shade(base, 1.08)); g.addColorStop(1, shade(base, 0.9));
      ctx.fillStyle = g;
      SHAPES[shape](ctx, size * (0.8 + rnd() * 0.3), rnd);
      ctx.fill();
      ctx.strokeStyle = shade(base, 1.35); ctx.globalAlpha = 0.55; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, size * 0.6); ctx.lineTo(0, -size * 0.75);
      if (shape !== 'olive') for (const k of [-1, 1]) { ctx.moveTo(0, size * 0.1); ctx.lineTo(k * size * 0.55, -size * 0.45); }
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
  return c;
}

/** A cypress spray: flat fronds branching three times, covered with tiny overlapping scales. */
function cypressSpray({ colours = ['#2f4f27', '#3a5f2e', '#456d33'], tip = '#7d9a44', seed = 1, makeCanvas = domCanvas } = {}){
  const c = makeCanvas(512);
  const ctx = c.getContext('2d'), rnd = rng(seed);
  function frond(x, y, ang, len, w, depth){
    const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len;
    const steps = Math.max(3, Math.round(len / (w * 1.3)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      ctx.fillStyle = depth === 0 && t > 0.6 ? tip : colours[Math.floor(rnd() * colours.length)];
      ctx.beginPath(); ctx.ellipse(x + (ex - x) * t, y + (ey - y) * t, w * 1.1, w * 1.7, ang, 0, Math.PI * 2); ctx.fill();
    }
    if (depth > 0) {
      const kids = 7 + Math.floor(rnd() * 3);
      for (let k = 1; k <= kids; k++) {
        const t = k / (kids + 1);
        frond(x + (ex - x) * t, y + (ey - y) * t, ang + (k % 2 ? 1 : -1) * (0.7 + rnd() * 0.2), len * (0.5 * (1 - t) + 0.18), w * 0.72, depth - 1);
      }
    }
  }
  frond(256, 505, 0, 360, 9, 3);
  return c;
}

/** The species: `from` (an EZ-Tree preset), the Element's `type`, its usual `height` in a town (m, its sheet),
 * its `genus` (OSM, GBIF), `set(options)`, the bark (Poly Haven id), its scale and tint, the foliage drawn
 * (`foliage(seed, makeCanvas)`). */
export const SPECIES = {
  Platane: { from: 'Oak Large', type: 'arbre', height: 18, genus: 'Platanus',
    bark: BARK('bark_platanus'), barkScale: [1, 6], barkTint: 0xffffff,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'plane', colours: ['#4f8a3e', '#5a9445', '#467d37'], n: 6, size: 110, seed }),
    set(o){ o.branch.length[0] = 60; o.branch.angle[1] = 40; o.branch.children[0] = 8; o.branch.radius[0] = 3.4; o.branch.force.strength = 0.015; o.leaves.size = 8; o.leaves.count = 12; } },
  Tilleul: { from: 'Ash Large', type: 'arbre', height: 14, genus: 'Tilia',
    bark: BARK('tree_bark_03'), barkScale: [1, 6], barkTint: 0xd8d4cc,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'linden', colours: ['#4e8a35', '#5c9a3f', '#447a2f'], n: 7, size: 62, seed }),
    set(o){ o.branch.angle[1] = 50; o.branch.angle[2] = 45; o.branch.force.strength = 0.025; o.leaves.size = 5; o.leaves.count = 12; } },
  Cypres: { from: 'Pine Medium', type: 'cypres', height: 14, genus: 'Cupressus',
    bark: BARK('chinese_cedar_bark'), barkScale: [1, 6], barkTint: 0xffffff,
    foliage: (seed, makeCanvas) => cypressSpray({ seed, makeCanvas }),
    set(o){ o.branch.length[0] = 70; o.branch.angle[1] = 16; o.branch.length[1] = 13; o.branch.children[0] = 80; o.branch.start[1] = 0.03; o.branch.force.strength = 0.08; o.leaves.size = 8; o.leaves.count = 18; o.leaves.angle = 8; } },
  Olivier: { from: 'Oak Small', type: 'olivier', height: 6, genus: 'Olea',
    bark: BARK('bark_willow_02'), barkScale: [1, 3], barkTint: 0xcfcabd,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'olive', colours: ['#55634a', '#5f6d50', '#4d5a42'], under: '#b3bba4', n: 11, size: 68, opposite: true, spread: 0.8, seed }),
    set(o){ o.branch.length[0] = 18; o.branch.radius[0] = 3; o.branch.start[1] = 0.5; o.branch.gnarliness[0] = 0.3; o.branch.gnarliness[1] = 0.35; o.branch.twist[0] = 0.5; o.branch.angle[1] = 58; o.branch.length[1] = 20; o.branch.children[0] = 7; o.branch.force.strength = -0.01; o.leaves.size = 4.5; o.leaves.count = 16; o.leaves.start = 0.3; o.leaves.alphaTest = 0.3; } },
};

/** The variants of each species (seeds 1 to VARIANTS): enough for a row of trees not to look cloned. */
export const VARIANTS = 3;

/** Our species of a tree, by its genus first (OSM tags, the flora's draw), else by its type: a key of SPECIES or null. */
export function speciesFor(objType, genus){
  const all = Object.entries(SPECIES);
  const byGenus = genus && all.find(([, sp]) => sp.genus === genus);
  if (byGenus && (byGenus[1].type === objType || objType === 'arbre')) return byGenus[0];
  const byType = objType !== 'arbre' && all.find(([, sp]) => sp.type === objType);
  return byType ? byType[0] : null;
}
