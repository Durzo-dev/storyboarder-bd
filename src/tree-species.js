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

/**
 * Poly Haven's barks (CC0): the asset's identifier (https://polyhaven.com/a/<id>). A species may instead have its
 * bark DRAWN (`barkDrawn(seed, makeCanvas)`, no file). `barkGain` (1 by default) lightens a bark darker than the
 * species' real one (its tint times the gain: colours above white).
 */
const BARK = (id) => id;

/**
 * The file of a species' bark, shipped in assets/textures/ (tools/ez-tree/fetch-barks.cjs: Poly Haven's colour map,
 * 512 px, JPEG): `ecorce-platane.jpg`. Species with the same Poly Haven bark share ONE file, that of the first of them
 * in SPECIES (the hornbeam and the alder read the hackberry's and the linden's): no copy shipped twice.
 */
export const barkFile = (name) => {
  const id = SPECIES[name] && SPECIES[name].bark;
  const first = id ? Object.keys(SPECIES).find(k => SPECIES[k].bark === id) : name;
  return `ecorce-${first.toLowerCase()}.jpg`;
};

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

/**
 * A birch's bark, DRAWN (no CC0 photo of a white birch bark on Poly Haven, 16 Nov. 2026): chalk white, grey
 * streaks along the trunk, short dark lenticels ACROSS it (u, the canvas' x, goes round the branch) and a few
 * black patches. Its colours are those of Commons' photos of Betula pendula.
 */
function birchBark({ seed = 1, makeCanvas = domCanvas } = {}){
  const c = makeCanvas(256);
  const ctx = c.getContext('2d'), rnd = rng(seed);
  ctx.fillStyle = '#e6e3da'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rnd() < 0.5 ? '#d4d0c6' : '#f2f0ea';
    ctx.globalAlpha = 0.5; ctx.fillRect(rnd() * 256, 0, 2 + rnd() * 6, 256); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#3a3632';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 256, y = rnd() * 256, w = 6 + rnd() * 22;
    ctx.fillRect(x, y, w, 1.5 + rnd() * 2);
    if (x + w > 256) ctx.fillRect(x - 256, y, w, 2);
  }
  for (let i = 0; i < 5; i++) {
    const x = rnd() * 256, y = rnd() * 256, w = 14 + rnd() * 26, h = 8 + rnd() * 16;
    ctx.fillStyle = '#26231f';
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x, y - h / 2); ctx.lineTo(x + w / 2, y); ctx.lineTo(x, y + h / 2); ctx.closePath(); ctx.fill();
  }
  return c;
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
  // A maple's: five broad pointed lobes, the sinuses rounded and deep, a large tooth a side (Acer platanoides).
  maple(ctx, s){
    const lobes = [[-1.55, 0.7], [-0.82, 0.92], [0, 1], [0.82, 0.92], [1.55, 0.7]];
    ctx.beginPath(); ctx.moveTo(0, s * 0.25);
    lobes.forEach(([a, l], i) => {
      const tip = [Math.sin(a) * s * l, -Math.cos(a) * s * l];
      const mid = (a + (i ? lobes[i - 1][0] : a - 0.9)) / 2, sinus = [Math.sin(mid) * s * 0.5, -Math.cos(mid) * s * 0.5];
      ctx.quadraticCurveTo(sinus[0] * 0.85, sinus[1] * 0.85, sinus[0], sinus[1]);
      ctx.lineTo((sinus[0] + tip[0]) / 2 - Math.cos(a) * s * 0.16, (sinus[1] + tip[1]) / 2 - Math.sin(a) * s * 0.16);
      ctx.lineTo(tip[0], tip[1]);
    });
    ctx.lineTo(Math.sin(2.4) * s * 0.5, -Math.cos(2.4) * s * 0.5);
    ctx.closePath();
  },
  // An oak's: obovate, four or five deep rounded lobes a side, short-stalked (Quercus robur).
  oak(ctx, s){
    const w = (t) => s * 0.55 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.8) * (0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 4.5 + 0.3)));
    ctx.beginPath(); ctx.moveTo(0, s);
    for (let i = 0; i <= 60; i++) ctx.lineTo(w(i / 60), s - 2 * s * i / 60);
    for (let i = 60; i >= 0; i--) ctx.lineTo(-w(i / 60), s - 2 * s * i / 60);
    ctx.closePath();
  },
  // A horse chestnut's: seven obovate leaflets spread like a hand from one point, each apart (Aesculus
  // hippocastanum); filled here leaflet by leaflet (overlapping in one path, they merged into one lobed blob).
  chestnut(ctx, s){
    for (let k = -3; k <= 3; k++) {
      const l = s * (1 - Math.abs(k) * 0.13);
      ctx.save(); ctx.translate(0, s * 0.4); ctx.rotate(k * 0.5);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(l * 0.28, -l * 0.5, l * 0.2, -l * 1.1, 0, -l * 1.25);
      ctx.bezierCurveTo(-l * 0.2, -l * 1.1, -l * 0.28, -l * 0.5, 0, 0);
      ctx.fill(); ctx.restore();
    }
    ctx.beginPath();
  },
  // An ash's leaflet, or a cherry's leaf: a pointed oval, toothed, broader (`w`) or narrower.
  ovate(ctx, s){
    ctx.beginPath(); ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.55, -s * 0.45, s * 0.5, s * 0.55, 0, s);
    ctx.bezierCurveTo(-s * 0.5, s * 0.55, -s * 0.55, -s * 0.45, 0, -s);
    ctx.closePath();
  },
  lance(ctx, s){
    ctx.beginPath(); ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.42, 0, 0, s); ctx.quadraticCurveTo(-s * 0.42, 0, 0, -s); ctx.closePath();
  },
  // A poplar's or a birch's: a triangle, its base broad and nearly straight, its tip drawn out (Populus nigra, Betula).
  delta(ctx, s){
    ctx.beginPath(); ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.15, s * 0.78, s * 0.55);
    ctx.quadraticCurveTo(s * 0.45, s * 0.9, 0, s * 0.72);
    ctx.quadraticCurveTo(-s * 0.45, s * 0.9, -s * 0.78, s * 0.55);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.15, 0, -s);
    ctx.closePath();
  },
  // A tulip tree's: four lobes, its tip cut square, as if notched (Liriodendron tulipifera).
  tulip(ctx, s){
    ctx.beginPath(); ctx.moveTo(0, s);
    ctx.lineTo(s * 0.35, s * 0.55); ctx.lineTo(s * 0.85, s * 0.35); ctx.lineTo(s * 0.6, -s * 0.15);
    ctx.lineTo(s * 0.8, -s * 0.55); ctx.lineTo(s * 0.45, -s * 0.85); ctx.lineTo(s * 0.12, -s * 0.62);
    ctx.lineTo(-s * 0.12, -s * 0.62); ctx.lineTo(-s * 0.45, -s * 0.85); ctx.lineTo(-s * 0.8, -s * 0.55);
    ctx.lineTo(-s * 0.6, -s * 0.15); ctx.lineTo(-s * 0.85, s * 0.35); ctx.lineTo(-s * 0.35, s * 0.55);
    ctx.closePath();
  },
  // A sweet chestnut's: long and narrow, a sharp tooth at the end of each vein (Castanea sativa).
  serrate(ctx, s){
    const n = 22, w = (t) => s * 0.3 * Math.pow(Math.sin(Math.PI * t), 0.7);
    const side = (k) => { for (let i = 1; i < n; i++) { const t = k > 0 ? i / n : 1 - i / n; ctx.lineTo(k * w(t) * (i % 2 ? 1.12 : 0.88), s - 2 * s * t); } };
    ctx.beginPath(); ctx.moveTo(0, s); side(1); ctx.lineTo(0, -s); side(-1); ctx.closePath();
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

/** A pine's shoot: needles in pairs, long, in tufts at the twigs' ends (Pinus sylvestris, pinaster). */
function needleTuft({ colours = ['#5a8442', '#66904c', '#73a056'], seed = 1, makeCanvas = domCanvas } = {}){
  const c = makeCanvas(512);
  const ctx = c.getContext('2d'), rnd = rng(seed);
  ctx.lineCap = 'round';
  const twigs = [[256, 505, 0, 330], [256, 330, -0.7, 200], [256, 290, 0.75, 190], [256, 400, -0.95, 150], [256, 380, 0.9, 150]];
  for (const [x, y, ang, len] of twigs) {
    const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len;
    ctx.strokeStyle = '#6a5038'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    // The needles on the twig's outer half, thicker towards its end.
    for (let i = 0; i < 46; i++) {
      const t = 0.45 + 0.55 * Math.sqrt(rnd());
      const px = x + (ex - x) * t, py = y + (ey - y) * t;
      const a = ang + (rnd() - 0.5) * 2.6 * (1.2 - t), l = 55 + rnd() * 45;
      ctx.strokeStyle = colours[Math.floor(rnd() * colours.length)]; ctx.lineWidth = 2.6 + rnd() * 1.4;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(a) * l, py - Math.cos(a) * l); ctx.stroke();
    }
  }
  return c;
}

/** A fir's or a spruce's spray: flat, branching twice, short needles combed out on both sides (Abies, Picea). */
function firSpray({ colours = ['#4a7444', '#55804e', '#618c58'], under = '#7f9f7a', seed = 1, makeCanvas = domCanvas } = {}){
  const c = makeCanvas(512);
  const ctx = c.getContext('2d'), rnd = rng(seed);
  ctx.lineCap = 'round';
  function shoot(x, y, ang, len, depth){
    const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len;
    ctx.strokeStyle = '#6b5a3c'; ctx.lineWidth = 2 + depth * 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    const steps = Math.round(len / 6);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, px = x + (ex - x) * t, py = y + (ey - y) * t;
      for (const k of [1, -1]) {
        const a = ang + k * (1.05 + rnd() * 0.2), l = (12 + rnd() * 4) * (1 - 0.4 * t);
        ctx.strokeStyle = rnd() < 0.15 ? under : colours[Math.floor(rnd() * colours.length)]; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(a) * l, py - Math.cos(a) * l); ctx.stroke();
      }
    }
    if (depth > 0) {
      for (let k = 1; k <= 6; k++) {
        const t = k / 7.5;
        shoot(x + (ex - x) * t, y + (ey - y) * t, ang + (k % 2 ? 1 : -1) * (0.85 + rnd() * 0.15), len * 0.42 * (1 - t * 0.6), depth - 1);
      }
    }
  }
  shoot(256, 505, 0, 440, 2);
  return c;
}

/** The species: `from` (an EZ-Tree preset), its `label` (the sheet's « Essence » list), the Element's `type`, its usual `height` in a town (m, its sheet),
 * its `genus` (OSM, GBIF), `set(options)`, the bark (Poly Haven id), its tint, the foliage drawn
 * (`foliage(seed, makeCanvas)`). */
export const SPECIES = {
  Platane: { from: 'Oak Large', label: { fr: 'Platane', en: 'Plane' }, type: 'arbre', height: 18, genus: 'Platanus',
    bark: BARK('bark_platanus'), barkTint: 0xffffff, barkGain: 1.6,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'plane', colours: ['#4f8a3e', '#5a9445', '#467d37'], n: 6, size: 110, seed }),
    set(o){ o.branch.length[0] = 60; o.branch.angle[1] = 40; o.branch.children[0] = 8; o.branch.radius[0] = 3.4; o.branch.force.strength = 0.015; o.leaves.size = 5.5; o.leaves.count = 20; } },
  Tilleul: { from: 'Ash Large', label: { fr: 'Tilleul', en: 'Linden' }, type: 'arbre', height: 14, genus: 'Tilia',
    bark: BARK('tree_bark_03'), barkTint: 0xd8d4cc,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'linden', colours: ['#4e8a35', '#5c9a3f', '#447a2f'], n: 7, size: 62, seed }),
    set(o){ o.branch.angle[1] = 50; o.branch.angle[2] = 45; o.branch.force.strength = 0.025; o.leaves.size = 5; o.leaves.count = 12; } },
  Cypres: { from: 'Pine Medium', label: { fr: 'Cyprès', en: 'Cypress' }, type: 'cypres', height: 14, genus: 'Cupressus',
    bark: BARK('chinese_cedar_bark'), barkTint: 0xffffff,
    foliage: (seed, makeCanvas) => cypressSpray({ seed, makeCanvas }),
    set(o){ o.branch.length[0] = 70; o.branch.angle[1] = 16; o.branch.length[1] = 13; o.branch.children[0] = 80; o.branch.start[1] = 0.03; o.branch.force.strength = 0.08; o.leaves.size = 8; o.leaves.count = 18; o.leaves.angle = 8; } },
  Olivier: { from: 'Oak Small', label: { fr: 'Olivier', en: 'Olive' }, type: 'olivier', height: 6, genus: 'Olea',
    bark: BARK('bark_willow_02'), barkTint: 0xcfcabd,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'olive', colours: ['#55634a', '#5f6d50', '#4d5a42'], under: '#b3bba4', n: 11, size: 68, opposite: true, spread: 0.8, seed }),
    set(o){ o.branch.length[0] = 18; o.branch.radius[0] = 3; o.branch.start[1] = 0.5; o.branch.gnarliness[0] = 0.3; o.branch.gnarliness[1] = 0.35; o.branch.twist[0] = 0.5; o.branch.angle[1] = 58; o.branch.length[1] = 20; o.branch.children[0] = 7; o.branch.force.strength = -0.01; o.leaves.size = 4.5; o.leaves.count = 16; o.leaves.start = 0.3; o.leaves.alphaTest = 0.3; } },
  // ── Wave 1 (#480h): the streets' and the forests' trees ──
  // A twig drawn fills about a quarter of its square: its leaves are sized to show (the cherry's 2.2 left its
  // crown bare, seen in the harness on 16 Nov. 2026).
  Erable: { from: 'Ash Medium', label: { fr: 'Érable', en: 'Maple' }, type: 'arbre', height: 15, genus: 'Acer',
    bark: BARK('trident_maple_bark'), barkTint: 0xd6d0c6,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'maple', colours: ['#4f8b3b', '#5d9a44', '#46803a'], n: 6, opposite: true, size: 78, seed }),
    set(o){ o.branch.angle[1] = 55; o.branch.children[0] = 8; o.branch.children[1] = 5; o.branch.gnarliness[1] = 0.12; o.branch.start[1] = 0.3; o.leaves.size = 4.5; o.leaves.count = 18; } },
  Chene: { from: 'Oak Large', label: { fr: 'Chêne', en: 'Oak' }, type: 'arbre', height: 20, genus: 'Quercus',
    bark: BARK('jolcham_oak_bark_01'), barkTint: 0xffffff,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'oak', colours: ['#3f6f2f', '#4a7a35', '#3a652c'], n: 8, size: 62, seed }),
    set(o){ o.branch.radius[0] = 3.6; o.branch.gnarliness[1] = 0.25; o.branch.angle[1] = 65; o.branch.length[0] = 40; o.leaves.size = 6; o.leaves.count = 14; } },
  Marronnier: { from: 'Oak Large', label: { fr: 'Marronnier', en: 'Horse chestnut' }, type: 'arbre', height: 18, genus: 'Aesculus',
    bark: BARK('bark_brown_02'), barkTint: 0xe0d8cc,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'chestnut', colours: ['#3f7a33', '#4b8a3a', '#386f2e'], n: 4, opposite: true, size: 80, spread: 0.6, seed }),
    set(o){ o.branch.angle[1] = 45; o.branch.force.strength = -0.02; o.branch.length[0] = 45; o.leaves.size = 7; o.leaves.count = 16; } },
  Frene: { from: 'Ash Large', label: { fr: 'Frêne', en: 'Ash' }, type: 'arbre', height: 20, genus: 'Fraxinus',
    bark: BARK('bark_brown_01'), barkTint: 0xcfcfc8,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'lance', colours: ['#5a9445', '#66a04d', '#528a3e'], n: 11, opposite: true, size: 46, spread: 0.7, seed }),
    set(o){ o.branch.angle[1] = 35; o.branch.start[1] = 0.45; o.leaves.size = 5; o.leaves.count = 16; } },
  Cerisier: { from: 'Oak Small', label: { fr: 'Cerisier', en: 'Cherry' }, type: 'arbre', height: 8, genus: 'Prunus',
    bark: BARK('sakura_bark'), barkTint: 0xffffff,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#4c7f37', '#578c3f', '#447332'], n: 9, size: 52, seed }),
    set(o){ o.branch.angle[1] = 40; o.branch.length[1] = 12; o.leaves.size = 4; o.leaves.count = 22; } },
  Micocoulier: { from: 'Ash Medium', label: { fr: 'Micocoulier', en: 'Hackberry' }, type: 'arbre', height: 16, genus: 'Celtis',
    bark: BARK('chinese_hackberry_bark'), barkTint: 0xdcdad2,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'lance', colours: ['#4d7a3c', '#56853f', '#45703a'], n: 8, size: 58, seed }),
    set(o){ o.branch.angle[1] = 50; o.branch.children[0] = 9; o.branch.gnarliness[1] = 0.15; o.leaves.size = 8; o.leaves.count = 22; } },
  Pin: { from: 'Pine Large', label: { fr: 'Pin', en: 'Pine' }, type: 'conifere', height: 20, genus: 'Pinus',
    bark: BARK('pine_bark'), barkTint: 0xffffff,
    foliage: (seed, makeCanvas) => needleTuft({ seed, makeCanvas }),
    set(o){
      o.branch.levels = 2; o.branch.start[1] = 0.6; o.branch.children[0] = 14; o.branch.angle[1] = 88; o.branch.length[1] = 34;
      o.branch.radius[1] = 0.5; o.branch.gnarliness[0] = 0.06; o.branch.gnarliness[1] = 0.2; o.branch.force.strength = 0.004;
      o.branch.children[1] = 5; o.branch.angle[2] = 55; o.branch.length[2] = 12; o.branch.start[2] = 0.3; o.branch.radius[2] = 0.6;
      o.leaves.size = 4.5; o.leaves.count = 24; o.leaves.start = 0.2;
    } },
  Peuplier: { from: 'Aspen Large', label: { fr: 'Peuplier', en: 'Poplar' }, type: 'arbre', height: 25, genus: 'Populus',
    bark: BARK('bark_willow'), barkTint: 0xd4d4cc, barkGain: 2.2,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'delta', colours: ['#5b8f42', '#66994a', '#4f803a'], n: 7, size: 60, seed }),
    set(o){ o.branch.start[1] = 0.3; o.branch.angle[1] = 28; o.branch.length[1] = 24; o.branch.children[0] = 14; o.leaves.size = 6; o.leaves.count = 20; o.leaves.start = 0.1; } },
  Robinier: { from: 'Aspen Medium', label: { fr: 'Robinier', en: 'Black locust' }, type: 'arbre', height: 15, genus: 'Robinia',
    bark: BARK('japanese_camphor_bark'), barkTint: 0xffffff,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#6a9a4a', '#76a653', '#5e8c42'], n: 9, size: 34, opposite: true, spread: 0.5, seed }),
    set(o){ o.branch.radius[0] = 1.5; o.branch.angle[1] = 55; o.branch.gnarliness[0] = 0.05; o.branch.gnarliness[1] = 0.25; o.branch.length[1] = 12; o.leaves.size = 6.5; o.leaves.count = 18; } },
  Charme: { from: 'Oak Medium', label: { fr: 'Charme', en: 'Hornbeam' }, type: 'arbre', height: 15, genus: 'Carpinus',
    bark: BARK('chinese_hackberry_bark'), barkTint: 0xc8c8c2,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#4f8a3a', '#5a9642', '#467d34'], n: 8, size: 50, seed }),
    set(o){ o.branch.angle[1] = 45; o.branch.children[0] = 8; o.leaves.size = 7; o.leaves.count = 20; } },
  Pommier: { from: 'Oak Small', label: { fr: 'Pommier / poirier', en: 'Apple / pear' }, type: 'arbre', height: 7, genus: ['Malus', 'Pyrus'],
    bark: BARK('japanese_zelkova_bark'), barkTint: 0xd8d0c4,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#557f3c', '#5f8b44', '#4c7335'], under: '#9db089', n: 8, size: 50, seed }),
    set(o){ o.branch.angle[1] = 55; o.branch.children[0] = 6; o.branch.gnarliness[1] = 0.3; o.branch.force.strength = -0.01; o.leaves.size = 4.2; o.leaves.count = 22; } },
  Bouleau: { from: 'Aspen Medium', label: { fr: 'Bouleau', en: 'Birch' }, type: 'arbre', height: 15, genus: 'Betula',
    barkDrawn: (seed, makeCanvas) => birchBark({ seed, makeCanvas }), barkTint: 0xffffff,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'delta', colours: ['#6c9c48', '#78a852', '#5f8e40'], n: 9, size: 40, seed }),
    set(o){ o.branch.angle[1] = 32; o.branch.force.strength = 0.006; o.leaves.size = 3.6; o.leaves.count = 22; } },
  Hetre: { from: 'Oak Large', label: { fr: 'Hêtre', en: 'Beech' }, type: 'arbre', height: 25, genus: 'Fagus',
    bark: BARK('japanese_sycamore'), barkTint: 0xb4b8bc,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#4d8a35', '#58963e', '#437a2e'], n: 9, size: 50, seed }),
    set(o){ o.branch.radius[0] = 3; o.branch.angle[1] = 55; o.branch.length[0] = 50; o.leaves.size = 6.5; o.leaves.count = 18; } },
  Chataignier: { from: 'Oak Large', label: { fr: 'Châtaignier', en: 'Sweet chestnut' }, type: 'arbre', height: 20, genus: 'Castanea',
    bark: BARK('metasequoia_bark'), barkTint: 0xffffff,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'serrate', colours: ['#4b8233', '#56903b', '#437530'], n: 7, size: 90, seed }),
    set(o){ o.branch.radius[0] = 3.8; o.branch.twist[0] = 0.3; o.branch.angle[1] = 60; o.branch.gnarliness[1] = 0.2; o.leaves.size = 6; o.leaves.count = 14; } },
  Sapin: { from: 'Pine Medium', label: { fr: 'Sapin / épicéa', en: 'Fir / spruce' }, type: 'conifere', height: 25, genus: ['Abies', 'Picea'],
    bark: BARK('knotted_pine_bark'), barkTint: 0xb8b4ac,
    foliage: (seed, makeCanvas) => firSpray({ seed, makeCanvas }),
    set(o){ o.branch.gnarliness[0] = 0.01; o.branch.gnarliness[1] = 0.03; o.branch.force.strength = 0; o.branch.twist[0] = 0; o.leaves.size = 4; } },
};

// Wave 2 (#480h) is added to SPECIES just below: the rest of the streets, the holm oak, the stone pine, the
// forests' Douglas fir and larch.
Object.assign(SPECIES, {
  Sophora: { from: 'Ash Medium', label: { fr: 'Sophora', en: 'Pagoda tree' }, type: 'arbre', height: 14, genus: ['Styphnolobium', 'Sophora'],
    bark: BARK('japanese_camphor_bark'), barkTint: 0xc8c4bc,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#4f8a3a', '#5a9643', '#467f35'], n: 11, size: 30, opposite: true, spread: 0.6, seed }),
    set(o){ o.branch.angle[1] = 50; o.branch.children[0] = 9; o.branch.gnarliness[1] = 0.2; o.leaves.size = 6; o.leaves.count = 20; } },
  Orme: { from: 'Oak Medium', label: { fr: 'Orme', en: 'Elm' }, type: 'arbre', height: 18, genus: 'Ulmus',
    bark: BARK('bark_brown_01'), barkTint: 0xbcb8b0,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'serrate', colours: ['#3f7030', '#4a7c38', '#3a672c'], n: 9, size: 44, seed }),
    set(o){ o.branch.start[1] = 0.22; o.branch.angle[1] = 42; o.branch.length[0] = 40; o.branch.length[1] = 24; o.branch.force.strength = 0.01; o.leaves.size = 6; o.leaves.count = 22; } },
  Aulne: { from: 'Ash Medium', label: { fr: 'Aulne', en: 'Alder' }, type: 'arbre', height: 15, genus: 'Alnus',
    bark: BARK('tree_bark_03'), barkTint: 0x8c8880,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'linden', colours: ['#365f2a', '#3f6a30', '#305626'], n: 8, size: 46, seed }),
    set(o){ o.branch.angle[1] = 55; o.branch.length[1] = 16; o.branch.children[0] = 12; o.branch.start[1] = 0.25; o.leaves.size = 5; o.leaves.count = 18; } },
  Noisetier: { from: 'Bush 1', label: { fr: 'Noisetier', en: 'Hazel' }, type: 'arbuste', height: 4, genus: 'Corylus',
    bark: BARK('sakura_bark'), barkTint: 0xb8a898,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'linden', colours: ['#55893f', '#609547', '#4c7d38'], n: 7, size: 52, seed }),
    set(o){ o.branch.angle[1] = 18; o.branch.children[0] = 9; o.leaves.size = 4; o.leaves.count = 16; } },
  Cedre: { from: 'Pine Large', label: { fr: 'Cèdre', en: 'Cedar' }, type: 'conifere', height: 22, genus: 'Cedrus',
    bark: BARK('chinese_cedar_bark'), barkTint: 0xa8a49c,
    foliage: (seed, makeCanvas) => needleTuft({ seed, makeCanvas, colours: ['#4c6a5a', '#577563', '#62806c'] }),
    set(o){
      o.branch.levels = 2; o.branch.start[1] = 0.12; o.branch.children[0] = 22; o.branch.angle[1] = 88; o.branch.length[1] = 40;
      o.branch.radius[1] = 0.45; o.branch.gnarliness[0] = 0.02; o.branch.gnarliness[1] = 0.05; o.branch.force.strength = -0.004;
      o.branch.children[1] = 10; o.branch.angle[2] = 88; o.branch.length[2] = 12; o.branch.start[2] = 0.15; o.branch.radius[2] = 0.6;
      o.leaves.size = 4; o.leaves.count = 22; o.leaves.start = 0.2; o.leaves.angle = 80;
    } },
  Fevier: { from: 'Ash Medium', label: { fr: 'Févier', en: 'Honey locust' }, type: 'arbre', height: 15, genus: 'Gleditsia',
    bark: BARK('japanese_camphor_bark'), barkTint: 0x9c9890,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#7aa84a', '#86b453', '#6e9b42'], n: 13, size: 22, opposite: true, spread: 0.5, seed }),
    set(o){ o.branch.angle[1] = 60; o.branch.children[0] = 6; o.branch.gnarliness[1] = 0.18; o.leaves.size = 5.5; o.leaves.count = 14; } },
  If: { from: 'Bush 3', label: { fr: 'If', en: 'Yew' }, type: 'conifere', height: 10, genus: 'Taxus',
    bark: BARK('chinese_cedar_bark'), barkTint: 0xd09a80,
    foliage: (seed, makeCanvas) => firSpray({ seed, makeCanvas, colours: ['#2a4526', '#31502c', '#385a32'], under: '#5e7a50' }),
    set(o){ o.branch.length[0] = 12; o.branch.radius[0] = 1.2; o.branch.angle[1] = 40; o.branch.length[1] = 10; o.branch.length[2] = 6; o.leaves.size = 3.6; o.leaves.count = 6; } },
  Saule: { from: 'Aspen Large', label: { fr: 'Saule pleureur', en: 'Weeping willow' }, type: 'arbre', height: 12, genus: 'Salix',
    bark: BARK('bark_willow'), barkTint: 0xd4d0c4, barkGain: 1.8,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'lance', colours: ['#8fb25a', '#9bbd63', '#82a650'], under: '#b6c99a', n: 13, size: 40, spread: 0.3, seed }),
    set(o){ o.branch.length[0] = 35; o.branch.start[1] = 0.35; o.branch.angle[1] = 55; o.branch.length[1] = 26; o.branch.force.strength = -0.05; o.branch.children[1] = 9; o.leaves.size = 5.5; o.leaves.count = 30; } },
  Yeuse: { from: 'Oak Small', label: { fr: 'Chêne vert', en: 'Holm oak' }, type: 'arbre', height: 10, genus: 'Quercus', taxa: ['quercus ilex', 'quercus suber', 'quercus coccifera'],
    bark: BARK('chinese_hackberry_bark'), barkTint: 0x8a8682,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#34502c', '#3c5a32', '#2f4828'], under: '#8c9a80', n: 10, size: 30, seed }),
    set(o){ o.branch.length[0] = 20; o.branch.radius[0] = 2; o.branch.angle[1] = 55; o.branch.children[0] = 7; o.branch.gnarliness[1] = 0.12; o.leaves.size = 5; o.leaves.count = 30; } },
  Pignon: { from: 'Pine Large', label: { fr: 'Pin parasol', en: 'Stone pine' }, type: 'pin_parasol', height: 14, genus: 'Pinus', taxa: ['pinus pinea'],
    bark: BARK('pine_bark'), barkTint: 0xffffff, barkGain: 1.2,
    foliage: (seed, makeCanvas) => needleTuft({ seed, makeCanvas, colours: ['#4f7a3c', '#5a8646', '#669250'] }),
    set(o){
      o.branch.levels = 2; o.branch.start[1] = 0.66; o.branch.children[0] = 12; o.branch.angle[1] = 72; o.branch.length[1] = 60;
      o.branch.radius[1] = 0.6; o.branch.gnarliness[0] = 0.08; o.branch.gnarliness[1] = 0.1; o.branch.force.strength = 0;
      o.branch.children[1] = 8; o.branch.angle[2] = 35; o.branch.length[2] = 14; o.branch.start[2] = 0.45; o.branch.radius[2] = 0.6;
      o.leaves.size = 5; o.leaves.count = 26; o.leaves.start = 0.4;
    } },
  Douglas: { from: 'Pine Large', label: { fr: 'Douglas', en: 'Douglas fir' }, type: 'conifere', height: 30, genus: 'Pseudotsuga',
    bark: BARK('knotted_pine_bark'), barkTint: 0xb0a090,
    foliage: (seed, makeCanvas) => firSpray({ seed, makeCanvas, colours: ['#3e6838', '#477342', '#517e4b'], under: '#7c9c74' }),
    set(o){ o.branch.gnarliness[0] = 0.01; o.branch.force.strength = 0; o.leaves.size = 3.5; } },
  Meleze: { from: 'Pine Medium', label: { fr: 'Mélèze', en: 'Larch' }, type: 'conifere', height: 25, genus: 'Larix',
    bark: BARK('pine_bark'), barkTint: 0xc0a898,
    foliage: (seed, makeCanvas) => needleTuft({ seed, makeCanvas, colours: ['#7aa858', '#86b462', '#6e9b4e'] }),
    set(o){ o.branch.gnarliness[0] = 0.01; o.branch.force.strength = -0.01; o.branch.children[0] = 50; o.leaves.size = 3; o.leaves.count = 14; } },
  Noyer: { from: 'Oak Large', label: { fr: 'Noyer', en: 'Walnut' }, type: 'arbre', height: 18, genus: 'Juglans',
    bark: BARK('tree_bark_03'), barkTint: 0xc8c4bc,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#5a8a3e', '#659647', '#517e37'], n: 7, size: 62, opposite: true, spread: 0.6, seed }),
    set(o){ o.branch.length[0] = 30; o.branch.angle[1] = 60; o.branch.children[0] = 7; o.branch.radius[0] = 3.2; o.leaves.size = 7; o.leaves.count = 14; } },
  Magnolia: { from: 'Oak Small', label: { fr: 'Magnolia', en: 'Magnolia' }, type: 'arbre', height: 9, genus: 'Magnolia',
    bark: BARK('sakura_bark'), barkTint: 0xa8a8a4,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'ovate', colours: ['#2f5428', '#386030', '#2a4b24'], under: '#6b6a45', n: 6, size: 80, seed }),
    set(o){ o.branch.angle[1] = 45; o.branch.children[0] = 6; o.leaves.size = 5; o.leaves.count = 18; } },
  Liquidambar: { from: 'Ash Medium', label: { fr: 'Liquidambar', en: 'Sweetgum' }, type: 'arbre', height: 16, genus: 'Liquidambar',
    bark: BARK('japanese_zelkova_bark'), barkTint: 0xb0a89c,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'maple', colours: ['#4a8236', '#558e3e', '#427530'], n: 6, size: 64, seed }),
    set(o){ o.branch.angle[1] = 40; o.branch.length[0] = 50; o.branch.length[1] = 16; o.branch.children[0] = 12; o.branch.start[1] = 0.25; o.leaves.size = 5; o.leaves.count = 16; } },
  Tulipier: { from: 'Ash Large', label: { fr: 'Tulipier', en: 'Tulip tree' }, type: 'arbre', height: 22, genus: 'Liriodendron',
    bark: BARK('tree_bark_03'), barkTint: 0xb8b4ac,
    foliage: (seed, makeCanvas) => leafTwig({ makeCanvas, shape: 'tulip', colours: ['#5a923e', '#669e47', '#508636'], n: 6, size: 66, seed }),
    set(o){ o.branch.angle[1] = 38; o.branch.start[1] = 0.3; o.branch.children[0] = 12; o.leaves.size = 6; o.leaves.count = 14; } },
});

/** The variants of each species (seeds 1 to VARIANTS): enough for a row of trees not to look cloned. */
export const VARIANTS = 3;

/** Our species of a tree, by its genus first (OSM tags, the flora's draw), else by its type: a key of SPECIES or null. */
export function speciesFor(objType, genus, taxon = null){
  const all = Object.entries(SPECIES);
  const genera = (sp) => (Array.isArray(sp.genus) ? sp.genus : [sp.genus]);
  // Its species first (OSM's `species`, « quercus ilex »): a genus may have two species of ours (holm oak, oak).
  const t = taxon && String(taxon).toLowerCase();
  const byTaxon = t && all.find(([, sp]) => (sp.taxa || []).some(x => t.startsWith(x)));
  if (byTaxon) return byTaxon[0];
  // Then its genus: the species of its type first (a stone pine for a `pin_parasol`), else one without taxa.
  const ofGenus = genus ? all.filter(([, sp]) => genera(sp).includes(genus)) : [];
  const byGenus = ofGenus.find(([, sp]) => sp.type === objType) || ofGenus.find(([, sp]) => !sp.taxa);
  if (byGenus && (byGenus[1].type === objType || objType === 'arbre')) return byGenus[0];
  // Without its genus, a type our one species stands for whole (a cypress, an olive): not a tree nor a conifer,
  // whose genera differ too much (a cedar is no pine).
  const ofType = all.filter(([, sp]) => sp.type === objType);
  return !['arbre', 'conifere'].includes(objType) && ofType.length === 1 ? ofType[0][0] : null;
}

/** The species an Element of `objType` may take (the sheet's « Essence » list): keys of SPECIES. */
export function speciesOfType(objType){
  return Object.keys(SPECIES).filter(k => SPECIES[k].type === objType);
}
