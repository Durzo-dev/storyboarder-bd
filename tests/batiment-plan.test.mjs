// #454a-2 : la vue de dessus de l'éditeur (src/batiment-plan.js) et la reprise des pièces tracées
// dans une Scène (batimentDesPieces, src/batiment.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ECHELLE_MIN, ECHELLE_MAX, versEcran, versBatiment, pasDeGrille, zoomerAutour, glisserVue,
  polygoneDuMur, boiteDesMurs, cadrerSur,
} from '../src/batiment-plan.js';
import { batimentDesPieces } from '../src/batiment.js';

const fr = (en, f) => f;
const proche = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

describe('le repère', () => {
  test('aller et retour', () => {
    const vue = { cx: 3, cz: -2, echelle: 50 };
    const e = versEcran(vue, 800, 600, { x: 4, z: 0 });
    assert.deepEqual(e, { x: 450, y: 400 });
    const p = versBatiment(vue, 800, 600, e);
    proche(p.x, 4); proche(p.z, 0);
  });
  test('le zoom garde le point sous la souris, et reste borné', () => {
    const vue = { cx: 0, cz: 0, echelle: 40 };
    const e = { x: 600, y: 150 };
    const avant = versBatiment(vue, 800, 600, e);
    const v = zoomerAutour(vue, 800, 600, e, 2);
    assert.equal(v.echelle, 80);
    const apres = versBatiment(v, 800, 600, e);
    proche(avant.x, apres.x); proche(avant.z, apres.z);
    assert.equal(zoomerAutour(vue, 800, 600, e, 1e6).echelle, ECHELLE_MAX);
    assert.equal(zoomerAutour(vue, 800, 600, e, 1e-6).echelle, ECHELLE_MIN);
  });
  test('glisser déplace la vue à l’inverse de la main', () => {
    assert.deepEqual(glisserVue({ cx: 0, cz: 0, echelle: 10 }, 20, -10), { cx: -2, cz: 1, echelle: 10 });
  });
});

describe('la grille', () => {
  test('un pas fin lisible et un pas fort qui tombe sur le mètre', () => {
    assert.deepEqual(pasDeGrille(200), { fin: 0.1, fort: 0.5 });
    assert.deepEqual(pasDeGrille(50), { fin: 0.5, fort: 2.5 });
    assert.deepEqual(pasDeGrille(60), { fin: 0.25, fort: 1 });
    assert.deepEqual(pasDeGrille(20), { fin: 1, fort: 5 });
    for (const e of [2, 5, 13, 37, 120, 400]) assert.ok(pasDeGrille(e).fin * e >= 14 || pasDeGrille(e).fin === 100, String(e));
  });
});

describe('les murs', () => {
  test('le polygone d’un mur : son épaisseur de part et d’autre de l’axe', () => {
    const p = polygoneDuMur({ a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, epaisseur: 0.2 });
    assert.deepEqual(p.map(q => [q.x, q.z].map(v => Math.round(v * 100) / 100)), [[0, 0.1], [4, 0.1], [4, -0.1], [0, -0.1]]);
  });
  test('la boîte d’un niveau, et null sans mur', () => {
    const b = { murs: [
      { niveauId: 'n0', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, epaisseur: 0.2 },
      { niveauId: 'n1', a: { x: 0, z: 0 }, b: { x: 0, z: 9 }, epaisseur: 0.2 },
    ] };
    const boite = boiteDesMurs(b, 'n0');
    proche(boite.minZ, -0.1); proche(boite.maxX, 4);
    assert.ok(boiteDesMurs(b).maxZ > 8.9);
    assert.equal(boiteDesMurs({ murs: [] }), null);
  });
  test('le cadrage fait tenir la boîte, et montre 20 m sans mur', () => {
    const v = cadrerSur({ minX: 0, maxX: 10, minZ: 0, maxZ: 5 }, 840, 640, 20);
    assert.deepEqual(v, { cx: 5, cz: 2.5, echelle: 80 });
    assert.deepEqual(cadrerSur(null, 440, 440, 20), { cx: 0, cz: 0, echelle: 20 });
  });
});

describe('reprendre les pièces tracées dans une Scène', () => {
  // Une pièce carrée de 4 m, centrée en (10, 10), murs de 3 m ; une porte sur le premier.
  const mur = (id, wx, wz, rotY, extra = {}) => ({ id, type: 'objet3d', objType: 'mur', pieceId: 'P', wxFloor: wx, wzFloor: wz, realLenFloor: 4, rotY, realHeightFloor: 3, ...extra });
  const objets = [
    mur('w1', 10, 8, 0, { pieceLabel: 'Salon' }),
    mur('w2', 10, 12, 0),
    mur('w3', 8, 10, Math.PI / 2),
    mur('w4', 12, 10, Math.PI / 2, { realHeightFloor: 1 }),
    { id: 'd', type: 'objet3d', objType: 'porte_ouverte', magnetWallId: 'w1', wallAlongFrac: 0.3 },
    { id: 'autre', type: 'objet3d', objType: 'mur', pieceId: 'Q', wxFloor: 50, wzFloor: 50, realLenFloor: 2, rotY: 0 },
    { id: 'chaise', type: 'objet3d', objType: 'chaise' },
  ];
  const b = batimentDesPieces(objets, ['P'], 'Maison', fr);
  test('un niveau, les quatre murs de la pièce seulement, recentrés', () => {
    assert.equal(b.nom, 'Maison');
    assert.equal(b.niveaux.length, 1);
    assert.equal(b.niveaux[0].hauteur, 3);
    assert.equal(b.murs.length, 4);
    // Recentré sur les AXES des murs (leurs épaisseurs diffèrent : le muret est plus mince).
    const xs = b.murs.flatMap(m => [m.a.x, m.b.x]), zs = b.murs.flatMap(m => [m.a.z, m.b.z]);
    proche((Math.min(...xs) + Math.max(...xs)) / 2, 0, 1e-9); proche((Math.min(...zs) + Math.max(...zs)) / 2, 0, 1e-9);
    proche(b.murs[0].a.x, -2, 1e-9); proche(b.murs[0].a.z, -2, 1e-9); proche(b.murs[0].b.x, 2, 1e-9);
  });
  test('l’épaisseur d’avant (6 % de la hauteur), et une hauteur propre pour le muret', () => {
    proche(b.murs[0].epaisseur, 0.18);
    assert.equal(b.murs[0].hauteurPropre, undefined);
    assert.equal(b.murs[3].hauteurPropre, 1);
  });
  test('la porte suit son mur, la pièce garde son nom', () => {
    assert.deepEqual(b.ouvertures.map(o => [o.murId, o.type, o.le]), [['m0', 'porte', 0.3]]);
    assert.deepEqual(b.pieces.map(p => p.nom), ['Salon']);
  });
  test('aucune pièce : un bâtiment vide, pas une erreur', () => {
    const vide = batimentDesPieces(objets, [], 'Rien', fr);
    assert.deepEqual([vide.murs.length, vide.pieces.length], [0, 0]);
  });
  test('la Scène n’est pas touchée', () => {
    assert.equal(objets[0].wxFloor, 10);
    assert.equal(objets.length, 7);
  });
});
