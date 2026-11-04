/**
 * tests/plan-ouvertures.test.mjs : #456c, les ouvertures d'un plan. Un plan synthétique au poché
 * noir, avec les conventions relevées dans docs/en/plan-sources.md : une porte (trou + arc d'un quart
 * de cercle), une porte contre un angle, une porte à deux battants, une fenêtre (trois traits fins
 * dans l'épaisseur du mur, que la détection comble), un passage (un trou, rien d'autre). Puis la
 * chaîne entière jusqu'au bâtiment de l'éditeur.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { detecterLesMurs } from '../src/plan-murs.js';
import { vectoriserLesMurs, batimentDuPlan } from '../src/plan-vecteurs.js';
import { ouverturesDuPlan } from '../src/plan-ouvertures.js';

const W = 600, H = 450;
function plan({ fenetre = true } = {}){
  const px = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) px.set([248, 244, 232, 255], i * 4);
  const noir = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) px.set([20, 20, 20], (y * W + x) * 4); };
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) noir(x, y); };
  const arc = (cx, cy, r, f) => { for (let k = 0; k <= 300; k++) { const a = k / 300 * Math.PI / 2; noir(...f(cx, cy, r, a)); } };
  // Mur du haut : la fenêtre (x 160-220) est faite de trois traits fins ; trou de 60 px (x 360-420)
  // pour la porte double.
  rect(100, 80, 160, 92); rect(220, 80, 360, 92); rect(420, 80, 500, 92);
  if (fenetre) for (const y of [80, 86, 91]) for (let x = 160; x < 220; x++) noir(x, y);
  else rect(160, 80, 220, 92);
  // Porte double : deux arcs de 30 px, charnières sur la face intérieure (y = 92), vers le bas.
  arc(360, 92, 30, (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  arc(420, 92, 30, (cx, cy, r, a) => [cx - r * Math.cos(a), cy + r * Math.sin(a)]);
  // Mur du bas : il commence à x = 152, la porte (40 px) est contre l'angle gauche.
  rect(152, 368, 500, 380);
  arc(152, 368, 40, (cx, cy, r, a) => [cx - r * Math.cos(a), cy - r * Math.sin(a)]);
  // Murs gauche et droit ; le droit a un passage (y 150-200), sans rien.
  rect(100, 80, 112, 380); rect(488, 80, 500, 150); rect(488, 200, 500, 380);
  // La cloison : une porte (y 200-240), charnière en (304, 200), qui s'ouvre vers l'est.
  rect(296, 92, 304, 200); rect(296, 240, 304, 368);
  arc(304, 200, 40, (cx, cy, r, a) => [cx + r * Math.sin(a), cy + r * Math.cos(a)]);
  for (let x = 304; x <= 344; x++) noir(x, 200);
  return px;
}

function chaine(px){
  const d = detecterLesMurs(px, W, H);
  const { segments } = vectoriserLesMurs(d.murs, d.largeur, d.hauteur);
  return ouverturesDuPlan(segments, d.encre, d.largeur, d.hauteur);
}
const toutes = (segs) => segs.flatMap(s => s.ouvertures.map(o => ({ s, o })));
/** Le point d'une ouverture, en pixels, à la position t le long de son segment, décalé de k vers n. */
const point = (s, t, k = 0) => {
  const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), u = { x: (s.b.x - s.a.x) / L, y: (s.b.y - s.a.y) / L };
  return { x: s.a.x + u.x * t - u.y * k, y: s.a.y + u.y * t + u.x * k };
};
const centre = ({ s, o }) => point(s, (o.s0 + o.s1) / 2);
const proche = (p, x, y, tol = 4) => Math.hypot(p.x - x, p.y - y) < tol;

describe('#456c, les ouvertures', () => {
  const segs = chaine(plan());
  const ouv = toutes(segs);

  test('cinq ouvertures, une par baie dessinée', () => {
    assert.equal(ouv.length, 5, JSON.stringify(ouv.map(({ o }) => o.type)));
  });

  test('la porte de la cloison : sa place, sa largeur, sa charnière et son côté', () => {
    const p = ouv.find(x => proche(centre(x), 300, 220));
    assert.ok(p, 'trouvée');
    assert.equal(p.o.type, 'porte');
    assert.equal(p.o.battants, 1);
    assert.ok(Math.abs(p.o.s1 - p.o.s0 - 40) <= 2);
    // La charnière est en (300, 200), le battant s'ouvre vers +x.
    const H0 = point(p.s, p.o.charniere === 'debut' ? p.o.s0 : p.o.s1);
    assert.ok(proche(H0, 300, 200), `charnière ${JSON.stringify(H0)}`);
    const cote = point(p.s, (p.o.s0 + p.o.s1) / 2, 10 * p.o.sens);
    assert.ok(cote.x > 305, 'ouverte vers l\'est');
  });

  test('la porte contre l\'angle : le mur est prolongé jusqu\'au mur perpendiculaire', () => {
    const p = ouv.find(x => proche(centre(x), 132, 374));
    assert.ok(p, 'trouvée');
    assert.equal(p.o.type, 'porte');
    const H0 = point(p.s, p.o.charniere === 'debut' ? p.o.s0 : p.o.s1);
    assert.ok(proche(H0, 152, 374), `charnière ${JSON.stringify(H0)}`);
    assert.ok(point(p.s, (p.o.s0 + p.o.s1) / 2, 10 * p.o.sens).y < 370, 'ouverte vers le haut');
  });

  test('la porte à deux battants', () => {
    const p = ouv.find(x => proche(centre(x), 390, 86));
    assert.ok(p);
    assert.equal(p.o.type, 'porte');
    assert.equal(p.o.battants, 2);
  });

  test('la fenêtre, comblée par la détection, est retrouvée dans le mur plein', () => {
    const p = ouv.find(x => proche(centre(x), 190, 86, 6));
    assert.ok(p);
    assert.equal(p.o.type, 'fenetre');
    assert.ok(Math.abs(p.o.s1 - p.o.s0 - 60) <= 6);
  });

  test('le trou sans rien est un passage', () => {
    const p = ouv.find(x => proche(centre(x), 494, 175));
    assert.ok(p);
    assert.equal(p.o.type, 'passage');
  });

  test('un mur plein n\'a pas de fenêtre inventée', () => {
    const sans = toutes(chaine(plan({ fenetre: false })));
    assert.equal(sans.filter(x => x.o.type === 'fenetre').length, 0);
  });

  test('de bout en bout : le bâtiment a ses deux pièces fermées et ses cinq ouvertures', () => {
    const { batiment, refuses, ouverturesRefusees } = batimentDuPlan(segs, { metresParPixel: 0.0225 });
    assert.equal(refuses, 0);
    assert.equal(ouverturesRefusees, 0);
    assert.equal(batiment.pieces.length, 2);
    const types = batiment.ouvertures.map(o => o.type).sort();
    assert.deepEqual(types, ['fenetre', 'passage', 'porte', 'porte', 'porte']);
    const porte = batiment.ouvertures.find(o => o.type === 'porte' && o.battants === 1);
    assert.ok(Math.abs(porte.largeur - 0.9) < 0.06, `largeur ${porte.largeur}`);
  });
});
