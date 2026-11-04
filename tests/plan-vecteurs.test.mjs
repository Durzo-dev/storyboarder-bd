/**
 * tests/plan-vecteurs.test.mjs : #456b, des pixels de mur aux murs du bâtiment. Masques synthétiques
 * (droits, tournés, en L, avec un mur en biais), puis un plan complet : image → murs détectés →
 * segments → bâtiment de l'éditeur, avec ses pièces déduites.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { vectoriserLesMurs, batimentDuPlan } from '../src/plan-vecteurs.js';
import { detecterLesMurs } from '../src/plan-murs.js';

/** Un masque w × h où sont peints des rectangles [x0, y0, x1, y1], tournés de `angle` autour de (cx, cy). */
function masque(w, h, rects, angle = 0, cx = w / 2, cy = h / 2){
  const m = new Uint8Array(w * h), c = Math.cos(-angle), s = Math.sin(-angle);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // Le point ramené dans le repère non tourné.
    const u = cx + (x + 0.5 - cx) * c - (y + 0.5 - cy) * s, v = cy + (x + 0.5 - cx) * s + (y + 0.5 - cy) * c;
    if (rects.some(([x0, y0, x1, y1]) => u >= x0 && u < x1 && v >= y0 && v < y1)) m[y * w + x] = 1;
  }
  return m;
}
/** Un trait épais de a à b, d'épaisseur e, ajouté au masque. */
function traitEpais(m, w, h, a, b, e){
  const L = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - a.x, dy = y + 0.5 - a.y, t = dx * ux + dy * uy, n = -dx * uy + dy * ux;
    if (t >= 0 && t <= L && Math.abs(n) <= e / 2) m[y * w + x] = 1;
  }
}

// Le plan de référence : murs de 12 px (x 100-500, y 80-380), une cloison de 8 px à x = 300.
const MURS = [[100, 80, 500, 92], [100, 368, 500, 380], [100, 80, 112, 380], [488, 80, 500, 380], [296, 92, 304, 368]];
const angleDe = (s) => Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
const sommetsDistincts = (segs) => {
  const v = [];
  for (const s of segs) for (const p of [s.a, s.b]) if (!v.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 0.5)) v.push(p);
  return v;
};
/** L'angle modulo 90°, ramené à l'écart avec `ref` (degrés). */
const ecartModulo90 = (a, ref) => { let d = ((a - ref) / (Math.PI / 180)) % 90; if (d > 45) d -= 90; if (d < -45) d += 90; return Math.abs(d); };

describe('#456b, les segments', () => {
  test('un plan droit : 7 murs (deux coupés en T par la cloison), exactement horizontaux ou verticaux', () => {
    const { angle, segments } = vectoriserLesMurs(masque(600, 450, MURS), 600, 450);
    assert.equal(angle, 0);
    assert.equal(segments.length, 7);
    for (const s of segments) assert.ok(Math.abs(s.a.x - s.b.x) < 1e-9 || Math.abs(s.a.y - s.b.y) < 1e-9);
    // Les quatre angles et les deux T : six sommets, sur les axes des murs.
    const v = sommetsDistincts(segments);
    assert.equal(v.length, 6);
    for (const [x, y] of [[106, 86], [494, 86], [106, 374], [494, 374], [300, 86], [300, 374]]) {
      assert.ok(v.some(p => Math.hypot(p.x - x, p.y - y) < 1), `sommet (${x}, ${y})`);
    }
    const cloison = segments.find(s => Math.abs(s.a.x - 300) < 1 && Math.abs(s.b.x - 300) < 1);
    assert.ok(Math.abs(cloison.epaisseur - 8) <= 1);
    assert.ok(segments.filter(s => s !== cloison).every(s => Math.abs(s.epaisseur - 12) <= 1));
  });

  test('un plan photographié de biais (tourné de 20°) : la direction est retrouvée, les murs y sont alignés', () => {
    const A = 20 * Math.PI / 180;
    const { angle, segments } = vectoriserLesMurs(masque(700, 600, MURS.map(([a, b, c, d]) => [a + 50, b + 75, c + 50, d + 75]), A), 700, 600);
    assert.ok(Math.abs(angle - A) < 0.6 * Math.PI / 180, `angle ${angle / (Math.PI / 180)}`);
    assert.equal(segments.length, 7);
    for (const s of segments) assert.ok(ecartModulo90(angleDe(s), angle) < 1e-6);
    assert.equal(sommetsDistincts(segments).length, 6);
  });

  test('un mur en L : un angle commun, des bouts libres au bout du mur', () => {
    const { segments } = vectoriserLesMurs(masque(400, 300, [[50, 50, 300, 62], [50, 62, 62, 250]]), 400, 300);
    assert.equal(segments.length, 2);
    const v = sommetsDistincts(segments);
    assert.equal(v.length, 3);
    assert.ok(v.some(p => Math.hypot(p.x - 56, p.y - 56) < 1));
    assert.ok(v.some(p => Math.hypot(p.x - 300, p.y - 56) < 1.5));
    assert.ok(v.some(p => Math.hypot(p.x - 56, p.y - 250) < 1.5));
  });

  test('un mur en biais (une tour, un pan coupé) garde son angle et se raccorde aux murs droits', () => {
    const m = masque(600, 450, MURS.slice(0, 4));
    traitEpais(m, 600, 450, { x: 112, y: 300 }, { x: 250, y: 92 }, 10);
    const { segments } = vectoriserLesMurs(m, 600, 450);
    const attendu = Math.atan2(92 - 300, 250 - 112);
    const biais = segments.find(s => ecartModulo90(angleDe(s), 0) > 10);
    assert.ok(biais, 'le mur en biais existe');
    const d = Math.abs(((angleDe(biais) - attendu + Math.PI * 1.5) % Math.PI) - Math.PI / 2);
    assert.ok(d < 3 * Math.PI / 180, `écart ${d / (Math.PI / 180)}°`);
    // Ses deux bouts sont portés sur les axes des murs qu'il touche (x = 106 et y = 86).
    const bouts = [biais.a, biais.b];
    assert.ok(bouts.some(p => Math.abs(p.x - 106) < 1.5), 'raccordé au mur de gauche');
    assert.ok(bouts.some(p => Math.abs(p.y - 86) < 1.5), 'raccordé au mur du haut');
  });

  test('un masque vide ne donne rien', () => {
    assert.deepEqual(vectoriserLesMurs(new Uint8Array(200 * 100), 200, 100).segments, []);
  });
});

describe('#456b, le bâtiment', () => {
  test('les segments deviennent des murs en mètres, centrés, et les deux pièces sont déduites', () => {
    const { segments } = vectoriserLesMurs(masque(600, 450, MURS), 600, 450);
    const { batiment, refuses } = batimentDuPlan(segments, { metresParPixel: 0.02 });
    assert.equal(refuses, 0);
    assert.equal(batiment.murs.length, 7);
    assert.equal(batiment.pieces.length, 2);
    const xs = batiment.murs.flatMap(m => [m.a.x, m.b.x]), zs = batiment.murs.flatMap(m => [m.a.z, m.b.z]);
    assert.ok(Math.abs(Math.min(...xs) + Math.max(...xs)) < 0.01, 'centré en x');
    assert.ok(Math.abs(Math.min(...zs) + Math.max(...zs)) < 0.01, 'centré en z');
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 7.76) < 0.03, '388 px × 2 cm');
    const epaisseurs = new Set(batiment.murs.map(m => m.epaisseur));
    assert.deepEqual([...epaisseurs].sort(), [0.16, 0.24]);
  });

  test('sans échelle, rien n\'est construit', () => {
    const { batiment, refuses } = batimentDuPlan([{ a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, epaisseur: 4 }], {});
    assert.equal(batiment.murs.length, 0);
    assert.equal(refuses, 1);
  });

  test('de bout en bout : une image de plan (poché noir, mobilier, porte) devient un bâtiment à deux pièces', () => {
    const w = 600, h = 450, px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) px.set([248, 244, 232, 255], i * 4);
    const peindre = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) px.set([20, 20, 20], (y * w + x) * 4); };
    for (const [x0, y0, x1, y1] of MURS) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) peindre(x, y);
    for (let x = 140; x < 260; x++) { peindre(x, 130); peindre(x, 200); }   // une table
    for (let k = 0; k <= 120; k++) { const a = k / 120 * Math.PI / 2; peindre(Math.round(304 + 40 * Math.cos(a)), Math.round(300 - 40 * Math.sin(a))); }
    const d = detecterLesMurs(px, w, h);
    const { segments } = vectoriserLesMurs(d.murs, d.largeur, d.hauteur);
    const { batiment } = batimentDuPlan(segments, { metresParPixel: 0.025 });
    assert.equal(batiment.pieces.length, 2);
  });
});
