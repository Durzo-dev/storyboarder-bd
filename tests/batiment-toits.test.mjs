// #458 : les toits d'un bâtiment (src/batiment-toits.js), et leur rendu (batiment-3d.js).
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  toitDuNiveau, fixerToit, contoursDuToit, piecesDecouvertes, decaler, estConvexe, aireSignee,
  geometrieDuToit, toitsDuNiveau, hauteurDesToits, ACROTERE,
} from '../src/batiment-toits.js';
import { creerBatiment } from '../src/batiment.js';
import { ajouterRectangle } from '../src/batiment-trace.js';
import { ajouterEtage, hauteurDesMursDuNiveau } from '../src/batiment-niveaux.js';
import { actualiserPieces } from '../src/batiment-pieces.js';
import { encombrementDuBatiment } from '../src/batiment-element.js';
import { construireBatiment3D, materiauxBatiment3D } from '../src/batiment-3d.js';

const fr = (en, f) => f;
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
function maison(l = 6, p = 4){
  const b = creerBatiment('Maison', fr);
  ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: l, z: p }, 0.2);
  actualiserPieces(b, 'n0', fr);
  return b;
}

describe('les réglages', () => {
  test('absent : plat, comme avant ; bornés ; fixerToit ne touche que ce qu\'on donne', () => {
    assert.equal(toitDuNiveau({}).type, 'plat');
    const t = toitDuNiveau({ toit: { type: 'deux-pans', pente: 99, debord: -1, sens: 5 } });
    assert.deepEqual([t.type, t.pente, t.debord, t.sens], ['deux-pans', 60, 0, 1]);
    const b = maison();
    fixerToit(b, 'n0', { type: 'quatre-pans' });
    fixerToit(b, 'n0', { pente: 30 });
    assert.equal(b.niveaux[0].toit.type, 'quatre-pans');
    assert.equal(b.niveaux[0].toit.pente, 30);
  });
});

describe('la forme couverte', () => {
  test('deux pièces voisines : un seul contour, sans la cloison, sans sommet aligné', () => {
    const b = creerBatiment('Deux', fr);
    ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 3, z: 4 }, 0.2);
    ajouterRectangle(b, 'n0', { x: 3, z: 0 }, { x: 6, z: 4 }, 0.2);
    actualiserPieces(b, 'n0', fr);
    assert.equal(piecesDecouvertes(b, 'n0').length, 2);
    const c = contoursDuToit(b, 'n0');
    assert.equal(c.length, 1);
    assert.equal(c[0].points.length, 4, 'les points de la cloison (alignés) sont retirés');
    proche(aireSignee(c[0].points), 24);
    assert.ok(c[0].adosses.every(a => !a), 'rien au-dessus : aucun côté adossé');
  });
  test('un étage couvre ce qui est sous lui : le rez-de-chaussée n\'a plus de toit dessous', () => {
    const b = maison();
    const n1 = ajouterEtage(b, fr);
    ajouterRectangle(b, n1.id, { x: 0, z: 0 }, { x: 6, z: 4 }, 0.2);
    actualiserPieces(b, n1.id, fr);
    assert.equal(contoursDuToit(b, 'n0').length, 0);
    assert.equal(contoursDuToit(b, n1.id).length, 1);
  });
  test('décaler pousse vers l\'extérieur ; une forme en L n\'est pas convexe', () => {
    const carre = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }];
    proche(aireSignee(decaler(carre, 0.5)), 25);
    assert.equal(estConvexe(carre), true);
    assert.equal(estConvexe([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 4 }, { x: 0, z: 4 }]), false);
  });
});

describe('les pans', () => {
  const rect = [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 4 }, { x: 0, z: 4 }];
  const pente45 = { pente: 45, debord: 0 };
  test('deux pans : le faîtage suit le grand côté, à mi-largeur ; deux pignons triangulaires', () => {
    const g = geometrieDuToit(rect, { ...pente45, type: 'deux-pans' }, 3);
    assert.equal(g.pans.length, 2);
    proche(g.haut, 3 + 2, 1e-9);
    assert.equal(g.pignons.length, 2, 'les deux petits côtés');
    g.pignons.forEach(p => assert.equal(p.points.length, 3));
  });
  test('deux pans tournés d\'un quart : le faîtage en travers, plus haut', () => {
    const g = geometrieDuToit(rect, { ...pente45, type: 'deux-pans', sens: 1 }, 3);
    proche(g.haut, 3 + 4, 1e-9);
  });
  test('quatre pans : quatre pans, aucun pignon, la même hauteur qu\'en deux pans', () => {
    const g = geometrieDuToit(rect, { ...pente45, type: 'quatre-pans' }, 3);
    assert.equal(g.pans.length, 4);
    assert.equal(g.pignons.length, 0);
    proche(g.haut, 5, 1e-9);
  });
  test('un pan : un seul pan ; trois murs à fermer (le haut et les deux côtés)', () => {
    const g = geometrieDuToit(rect, { ...pente45, type: 'un-pan' }, 3);
    assert.equal(g.pans.length, 1);
    assert.equal(g.pignons.length, 3);
  });
  test('le débord prolonge les pans sous le dessus des murs', () => {
    const g = geometrieDuToit(rect, { pente: 45, debord: 0.5, type: 'quatre-pans' }, 3);
    proche(Math.min(...g.bord.map(p => p.y)), 2.5, 1e-9);
  });
});

describe('sur un bâtiment', () => {
  test('toitsDuNiveau : posé sur le dessus des murs ; une forme en L attend #458b', () => {
    const b = maison();
    fixerToit(b, 'n0', { type: 'deux-pans' });
    const [t] = toitsDuNiveau(b, 'n0');
    proche(t.base, hauteurDesMursDuNiveau(b, 'n0'));
    assert.ok(t.geometrie && !t.enAttente);
    const l = creerBatiment('L', fr);
    ajouterRectangle(l, 'n0', { x: 0, z: 0 }, { x: 4, z: 2 }, 0.2);
    ajouterRectangle(l, 'n0', { x: 0, z: 2 }, { x: 2, z: 4 }, 0.2);
    actualiserPieces(l, 'n0', fr);
    fixerToit(l, 'n0', { type: 'quatre-pans' });
    const [tl] = toitsDuNiveau(l, 'n0');
    assert.equal(tl.enAttente, true);
    assert.equal(tl.geometrie, null);
  });
  test('la hauteur du bâtiment compte le toit (les bâtiments placés gardent leur taille)', () => {
    const b = maison();
    const plat = encombrementDuBatiment(b).hauteur;
    fixerToit(b, 'n0', { type: 'deux-pans', pente: 45, debord: 0 });
    assert.ok(encombrementDuBatiment(b).hauteur > plat + 1.9);
    fixerToit(b, 'n0', { type: 'plat', bordure: 'acrotere' });
    proche(hauteurDesToits(b), hauteurDesMursDuNiveau(b, 'n0') + ACROTERE.hauteur);
  });
  test('le rendu 3D : la boîte du bâtiment monte jusqu\'au faîtage', async () => {
    const T = globalThis.THREE;
    const b = maison();
    fixerToit(b, 'n0', { type: 'deux-pans', pente: 40, debord: 0.3 });
    const g = construireBatiment3D(T, b, materiauxBatiment3D(T));
    const boite = new T.Box3().setFromObject(g);
    proche(boite.max.y, encombrementDuBatiment(b).hauteur, 1e-4);
    const coupe = construireBatiment3D(T, b, materiauxBatiment3D(T), { jusquA: 'n0' });
    assert.ok(new T.Box3().setFromObject(coupe).max.y < boite.max.y, 'la coupe ouvre aussi le toit');
  });
});

test('les textures de toit : un usage de bâtiment, comme les revêtements', () => {
  const src = readFileSync(new URL('../src/textures-integrees.js', import.meta.url), 'utf8');
  assert.match(src, /USAGES_BATIMENT = \['mur-ext', 'mur-int', 'sol-int', 'plafond', 'toit'\]/);
});

describe('les raccords (signalé) : un toit adossé à l\'étage du dessus', () => {
  const aile = (type) => {
    const b = creerBatiment('M', fr);
    ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 6, z: 5 }, 0.2);
    ajouterRectangle(b, 'n0', { x: 6, z: 1 }, { x: 10, z: 4 }, 0.2);
    actualiserPieces(b, 'n0', fr);
    const n1 = ajouterEtage(b, fr);
    ajouterRectangle(b, n1.id, { x: 0, z: 0 }, { x: 6, z: 5 }, 0.2);
    actualiserPieces(b, n1.id, fr);
    fixerToit(b, 'n0', { type, pente: 30, debord: 0.4 });
    fixerToit(b, n1.id, { type: 'deux-pans', pente: 40, debord: 0.4 });
    return { b, n1, t: toitsDuNiveau(b, 'n0')[0] };
  };
  const ys = (g, filtre) => g.pans.flatMap(p => p.points).filter(filtre).map(q => q.y);
  test('le côté contre l\'étage est adossé : le toit s\'arrête à la face de son mur, sans débord ni rive', () => {
    const { t } = aile('deux-pans');
    assert.deepEqual(t.adosses.filter(Boolean).length, 1);
    const xs = t.geometrie.pans.flatMap(p => p.points).map(q => q.x);
    proche(Math.min(...xs), 6.1, 1e-6);   // la face du mur de l'étage, pas au-delà
    assert.equal(t.geometrie.bordAdosses.filter(Boolean).length, 1);
    assert.equal(t.geometrie.pignons.length, 1, 'un seul pignon, le côté libre ; contre l\'étage, son mur ferme');
  });
  test('un appentis MONTE vers le mur de l\'étage', () => {
    const { t } = aile('un-pan');
    const contreLeMur = ys(t.geometrie, q => q.x < 6.2), auBout = ys(t.geometrie, q => q.x > 10);
    assert.ok(Math.min(...contreLeMur) > Math.max(...auBout));
  });
  test('un deux-pans amène son faîtage de face sur le mur (le pignon contre la maison)', () => {
    const { t } = aile('deux-pans');
    const haut = t.geometrie.haut;
    const faitage = t.geometrie.pans.flatMap(p => p.points).filter(q => Math.abs(q.y - haut) < 1e-6);
    assert.ok(faitage.every(q => Math.abs(q.z - 2.5) < 1e-6), 'le faîtage court en x, à mi-profondeur');
  });
  test('il reste sous l\'égout de l\'étage (pente réduite au besoin)', () => {
    const { b, n1 } = aile('un-pan');
    fixerToit(b, 'n0', { pente: 60 });
    const [t] = toitsDuNiveau(b, 'n0');
    const egoutEtage = toitsDuNiveau(b, n1.id)[0].geometrie.bord.reduce((m, p) => Math.min(m, p.y), Infinity);
    assert.ok(t.geometrie.haut < egoutEtage - 0.12, `${t.geometrie.haut} sous ${egoutEtage}`);
  });
});

test('un étage posé en partie sur une pièce (sans suivre ses murs) : elle reste plate, et c\'est dit', () => {
  const b = maison(10, 6);
  const n1 = ajouterEtage(b, fr);
  ajouterRectangle(b, n1.id, { x: 6, z: 0 }, { x: 10, z: 6 }, 0.2);
  actualiserPieces(b, n1.id, fr);
  fixerToit(b, 'n0', { type: 'deux-pans' });
  const [t] = toitsDuNiveau(b, 'n0');
  assert.equal(t.sousUnEtage, true);
  assert.equal(t.geometrie, null);
});

test('la rive d\'un pignon suit le toit jusqu\'au faîtage (signalé : elle traversait le pignon à l\'horizontale)', () => {
  const rect = [{ x: 0, z: 0 }, { x: 8, z: 0 }, { x: 8, z: 4 }, { x: 0, z: 4 }];
  const g = geometrieDuToit(rect, { type: 'deux-pans', pente: 45, debord: 0.3 }, 3);
  const pignons = g.rives.filter(r => r.points.length === 3);
  assert.equal(pignons.length, 2, 'les deux petits côtés passent par le faîtage');
  pignons.forEach(r => proche(r.points[1].y, g.haut, 1e-9));
  const egouts = g.rives.filter(r => r.points.length === 2);
  egouts.forEach(r => proche(r.points[0].y, r.points[1].y, 1e-9));
  const src = readFileSync(new URL('../src/batiment-3d.js', import.meta.url), 'utf8');
  assert.match(src, /g\.rives\.forEach\(r => \{\n\s*if \(r\.adosse\) return;/);
});
