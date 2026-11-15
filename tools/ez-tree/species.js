/**
 * tools/ez-tree/species.js: OUR SPECIES FOR EZ-TREE (#480f): each one a preset of EZ-Tree to start from, what
 * changes (its silhouette), its bark (Poly Haven, CC0) and its leaf, DRAWN here (a twig and leaves of a shape:
 * no licence). Tuned by eye in the browser on 15 Nov. 2026 (plane, linden, cypress, olive). Browser code.
 */

/** Poly Haven's barks (CC0), 1k colour maps. */
const BARK = (id) => `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${id}/${id}_diff_1k.jpg`;

/** Leaf shapes, drawn around (0, 0), `s` their half length. */
const LEAF = {
  palmate(ctx, s){
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const a = i / 200 * Math.PI * 2, r = s * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos(2.5 * a)), 0.6));
      const x = Math.sin(a) * r, y = -Math.cos(a) * r * 0.95;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  },
  heart(ctx, s){
    ctx.beginPath(); ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s * 0.7, s * 1.05, s * 0.25, 0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.05, s * 0.25, -s * 0.9, -s * 0.7, 0, -s); ctx.closePath();
  },
  lance(ctx, s){ ctx.beginPath(); ctx.ellipse(0, 0, s * 0.22, s, 0, 0, Math.PI * 2); },
  scale(ctx, s){ ctx.beginPath(); ctx.ellipse(0, 0, s * 0.35, s * 0.8, 0, 0, Math.PI * 2); },
};

/** A leaf cluster on a transparent 512 px canvas: a twig, `n` leaves of a shape, colours varying. */
export function leafCluster({ shape, colours, n = 7, size = 70, spread = 0.9, seed = 1 }){
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  let r = seed;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  ctx.translate(256, 500);
  ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -380); ctx.stroke();
  for (let i = 0; i < n; i++) {
    const t = 0.15 + 0.85 * i / (n - 1), side = i % 2 ? 1 : -1;
    ctx.save();
    ctx.translate(0, -380 * t);
    ctx.rotate(side * (0.5 + rnd() * spread * 0.6) * (i === n - 1 ? 0 : 1));
    ctx.translate(0, -size * 1.1);
    ctx.fillStyle = colours[Math.floor(rnd() * colours.length)];
    LEAF[shape](ctx, size * (0.8 + rnd() * 0.35));
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, size * 0.8); ctx.lineTo(0, -size * 0.8); ctx.stroke();
    ctx.restore();
  }
  return c;
}

/** The species: `from` (an EZ-Tree preset), `set(options)`, the bark and its scale, the leaf drawn. */
export const SPECIES = {
  Platane: { from: 'Oak Large', bark: BARK('bark_platanus'), barkScale: [1, 6],
    leaf: { shape: 'palmate', colours: ['#4f7a34', '#5c8a3c', '#46702f', '#6a9444'], n: 6, size: 78 },
    set(o){ o.branch.length[0] = 55; o.branch.angle[1] = 48; o.branch.children[0] = 8; o.branch.radius[0] = 3.2; o.branch.force.strength = 0.01; o.leaves.size = 5.5; o.leaves.count = 9; } },
  Tilleul: { from: 'Ash Large', bark: BARK('japanese_zelkova_bark'), barkScale: [1, 6],
    leaf: { shape: 'heart', colours: ['#5b8a3a', '#6b9a44', '#4f7d33'], n: 8, size: 58 },
    set(o){ o.branch.angle[1] = 52; o.branch.angle[2] = 45; o.branch.force.strength = 0.02; o.leaves.size = 4.5; o.leaves.count = 12; } },
  Cypres: { from: 'Pine Medium', bark: BARK('chinese_cedar_bark'), barkScale: [1, 6],
    leaf: { shape: 'scale', colours: ['#2c4a26', '#33552b', '#284222'], n: 12, size: 40, spread: 0.3 },
    set(o){ o.branch.angle[1] = 20; o.branch.length[1] = 18; o.branch.children[0] = 60; o.branch.start[1] = 0.04; o.branch.force.strength = 0.06; o.leaves.size = 7; o.leaves.count = 22; o.leaves.angle = 10; } },
  Olivier: { from: 'Oak Small', bark: BARK('tree_bark_03'), barkScale: [1, 3],
    leaf: { shape: 'lance', colours: ['#6f7d58', '#7f8c66', '#a3ad8e', '#5f6d4a'], n: 16, size: 60, spread: 1.1 },
    set(o){ o.branch.length[0] = 16; o.branch.radius[0] = 2.6; o.branch.gnarliness[0] = 0.3; o.branch.gnarliness[1] = 0.35; o.branch.twist[0] = 0.5; o.branch.angle[1] = 58; o.branch.length[1] = 20; o.branch.children[0] = 7; o.branch.force.strength = -0.01; o.leaves.size = 5; o.leaves.count = 28; } },
};
