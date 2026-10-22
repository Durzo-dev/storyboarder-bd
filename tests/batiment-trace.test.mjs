// #454a-3 : la forme des murs aux jonctions (src/batiment-geometrie.js) et le tracé
// (src/batiment-trace.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { polygonesDesMurs } from '../src/batiment-geometrie.js';
import {
  aimanter, ajouterMur, couperMur, croiseUnMur, deplacerSommet, supprimerMur, sommetSous, murSous,
  sommetsDuNiveau, longueurDuMur, projeter,
} from '../src/batiment-trace.js';
import { creerBatiment } from '../src/batiment.js';

const fr = (en, f) => f;
const r3 = (p) => [Math.round(p.x * 1000) / 1000, Math.round(p.z * 1000) / 1000];
const mur = (id, a, b, e = 0.2) => ({ id, niveauId: 'n0', a, b, epaisseur: e, revetement: { interieur: null, exterieur: null } });

describe('les jonctions', () => {
  test('un mur seul reste un rectangle', () => {
    const p = polygonesDesMurs([mur('m', { x: 0, z: 0 }, { x: 4, z: 0 })]).get('m');
    assert.deepEqual(p.map(r3), [[0, 0.1], [4, 0.1], [4, -0.1], [0, -0.1]]);
  });
  test('un angle droit : coupe d’onglet, sans encoche', () => {
    const g = polygonesDesMurs([mur('h', { x: 0, z: 0 }, { x: 4, z: 0 }), mur('v', { x: 0, z: 0 }, { x: 0, z: 3 })]);
    assert.deepEqual(g.get('h').map(r3), [[0.1, 0.1], [4, 0.1], [4, -0.1], [-0.1, -0.1]]);
    const v = g.get('v').map(r3);
    assert.ok(v.some(q => q[0] === -0.1 && q[1] === -0.1), 'le coin extérieur est partagé');
    assert.ok(v.some(q => q[0] === 0.1 && q[1] === 0.1), 'le coin intérieur aussi');
  });
  test('une pièce fermée : les quatre coins extérieurs sont ceux du rectangle épaissi', () => {
    const c = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }];
    const murs = c.map((p, i) => mur('m' + i, p, c[(i + 1) % 4]));
    const pts = [...polygonesDesMurs(murs).values()].flat().map(r3);
    for (const coin of [[-0.1, -0.1], [4.1, -0.1], [4.1, 3.1], [-0.1, 3.1]]) {
      assert.ok(pts.some(q => q[0] === coin[0] && q[1] === coin[1]), String(coin));
    }
  });
  test('un T : la branche bute contre la face, les deux moitiés restent alignées', () => {
    const g = polygonesDesMurs([
      mur('g', { x: 0, z: 0 }, { x: 2, z: 0 }), mur('d', { x: 2, z: 0 }, { x: 4, z: 0 }),
      mur('t', { x: 2, z: 0 }, { x: 2, z: 3 }),
    ]);
    const t = g.get('t').map(r3);
    assert.ok(t.every(q => q[1] >= 0.1 - 1e-9 || q[1] === 3), 'la branche commence à la face (z = 0,1)');
    const gauche = g.get('g').map(r3);
    assert.ok(gauche.some(q => q[0] === 2 && q[1] === -0.1), 'face arrière continue, sans coin');
  });
  test('deux murs dans le prolongement : raccord droit', () => {
    const g = polygonesDesMurs([mur('a', { x: 0, z: 0 }, { x: 2, z: 0 }), mur('b', { x: 2, z: 0 }, { x: 5, z: 0 })]);
    assert.deepEqual(g.get('a').map(r3), [[0, 0.1], [2, 0.1], [2, -0.1], [0, -0.1]]);
  });
  test('un angle très aigu ne lance pas un onglet au loin', () => {
    const g = polygonesDesMurs([mur('a', { x: 0, z: 0 }, { x: 5, z: 0 }), mur('b', { x: 0, z: 0 }, { x: 5, z: 0.05 })]);
    for (const p of [...g.values()].flat()) assert.ok(Math.hypot(p.x, p.z) < 6, 'borné');
  });
});

describe('l’aimantation', () => {
  const b = creerBatiment('B', fr);
  b.murs.push(mur('m0', { x: 0, z: 0 }, { x: 4, z: 0 }));
  test('un sommet proche l’emporte', () => {
    const r = aimanter(b, 'n0', { x: 4.05, z: 0.04 }, { tol: 0.1 });
    assert.deepEqual([r.point, r.accroche.type], [{ x: 4, z: 0 }, 'sommet']);
  });
  test('le milieu d’un mur : une accroche en T', () => {
    const r = aimanter(b, 'n0', { x: 2, z: 0.05 }, { tol: 0.1 });
    assert.deepEqual([r.point, r.accroche], [{ x: 2, z: 0 }, { type: 'mur', murId: 'm0' }]);
  });
  test('depuis un point : l’angle par pas de 15°, la longueur au centimètre', () => {
    const r = aimanter(b, 'n0', { x: 10.004, z: 5.2 }, { tol: 0.1, depuis: { x: 10, z: 2 } });
    assert.deepEqual(r.point, { x: 10, z: 5.2 }, 'vertical');
    const d = aimanter(b, 'n0', { x: 13, z: 3.1 }, { tol: 0.01, depuis: { x: 10, z: 2 } }).point;
    const angle = Math.atan2(d.z - 2, d.x - 10) * 180 / Math.PI;
    assert.ok(Math.abs(angle - Math.round(angle / 15) * 15) < 0.1, String(angle));
  });
  test('les guides : alignement sur un sommet existant', () => {
    const r = aimanter(b, 'n0', { x: 4.06, z: 7 }, { tol: 0.1 });
    assert.equal(r.point.x, 4);
    assert.deepEqual(r.guides.map(g => g.axe), ['x']);
  });
  test('Alt : rien n’est aimanté', () => {
    assert.deepEqual(aimanter(b, 'n0', { x: 4.05, z: 0.04 }, { tol: 0.1, libre: true }).point, { x: 4.05, z: 0.04 });
  });
  test('le sommet qu’on déplace ne s’aimante pas à lui-même', () => {
    const r = aimanter(b, 'n0', { x: 4.05, z: 0.04 }, { tol: 0.1, sauf: { x: 4, z: 0 } });
    assert.notEqual(r.accroche.type, 'sommet');
  });
});

describe('construire', () => {
  test('ajouter une chaîne, puis fermer la pièce', () => {
    const b = creerBatiment('B', fr);
    const c = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }];
    c.forEach((p, i) => assert.ok(ajouterMur(b, 'n0', p, c[(i + 1) % 4], 0.2).mur));
    assert.equal(b.murs.length, 4);
    assert.equal(sommetsDuNiveau(b, 'n0').length, 4);
  });
  test('refus : trop court, ou qui traverse un mur', () => {
    const b = creerBatiment('B', fr);
    ajouterMur(b, 'n0', { x: 0, z: 0 }, { x: 4, z: 0 }, 0.2);
    assert.deepEqual(ajouterMur(b, 'n0', { x: 1, z: 1 }, { x: 1.01, z: 1 }, 0.2), { erreur: 'court' });
    assert.deepEqual(ajouterMur(b, 'n0', { x: 2, z: -1 }, { x: 2, z: 1 }, 0.2), { erreur: 'croise' });
    assert.deepEqual(ajouterMur(b, 'n0', { x: 1, z: 0 }, { x: 3, z: 0 }, 0.2), { erreur: 'croise' }, 'superposé');
    assert.equal(croiseUnMur(b, 'n0', { x: 2, z: 0 }, { x: 2, z: 2 }), false, 'un T ne traverse pas');
  });
  test('la jonction en T coupe le mur touché, les ouvertures suivent leur moitié', () => {
    const b = creerBatiment('B', fr);
    ajouterMur(b, 'n0', { x: 0, z: 0 }, { x: 4, z: 0 }, 0.2);
    b.ouvertures.push({ id: 'o1', murId: b.murs[0].id, type: 'porte', le: 0.75, y: 0, largeur: 0.9, hauteur: 2.1 });
    ajouterMur(b, 'n0', { x: 1, z: 0 }, { x: 1, z: 3 }, 0.2, { accrocheA: { type: 'mur', murId: b.murs[0].id } });
    assert.equal(b.murs.length, 3);
    const porte = b.ouvertures[0];
    const hote = b.murs.find(m => m.id === porte.murId);
    assert.deepEqual([hote.a, hote.b], [{ x: 1, z: 0 }, { x: 4, z: 0 }]);
    assert.ok(Math.abs(porte.le - 2 / 3) < 1e-9, 'à 3 m du départ, soit 2/3 de la moitié droite');
  });
  test('les deux bouts sur le même mur : deux coupes', () => {
    const b = creerBatiment('B', fr);
    ajouterMur(b, 'n0', { x: 0, z: 0 }, { x: 6, z: 0 }, 0.2);
    const id = b.murs[0].id;
    // Un mur en U ne peut pas : on teste deux T successifs reliés par un mur parallèle décalé.
    ajouterMur(b, 'n0', { x: 1, z: 0 }, { x: 1, z: 2 }, 0.2, { accrocheA: { type: 'mur', murId: id } });
    ajouterMur(b, 'n0', { x: 5, z: 0 }, { x: 5, z: 2 }, 0.2, { accrocheA: { type: 'mur', murId: id } });
    assert.equal(b.murs.filter(m => m.a.z === 0 && m.b.z === 0).length, 3);
  });
  test('couper trop près d’un bout ne fait rien', () => {
    const b = creerBatiment('B', fr);
    ajouterMur(b, 'n0', { x: 0, z: 0 }, { x: 4, z: 0 }, 0.2);
    assert.equal(couperMur(b, b.murs[0].id, { x: 0.01, z: 0 }), null);
  });
  test('déplacer un sommet emmène tous les murs qui y sont attachés', () => {
    const b = creerBatiment('B', fr);
    ajouterMur(b, 'n0', { x: 0, z: 0 }, { x: 4, z: 0 }, 0.2);
    ajouterMur(b, 'n0', { x: 4, z: 0 }, { x: 4, z: 3 }, 0.2);
    assert.equal(deplacerSommet(b, 'n0', { x: 4, z: 0 }, { x: 5, z: -1 }), 2);
    assert.deepEqual([b.murs[0].b, b.murs[1].a], [{ x: 5, z: -1 }, { x: 5, z: -1 }]);
    deplacerSommet(b, 'n0', { x: 5, z: -1 }, { x: 0, z: 0 });
    assert.equal(b.murs.length, 1, 'le mur réduit à rien disparaît');
  });
  test('supprimer un mur emporte ses ouvertures', () => {
    const b = creerBatiment('B', fr);
    ajouterMur(b, 'n0', { x: 0, z: 0 }, { x: 4, z: 0 }, 0.2);
    b.ouvertures.push({ id: 'o', murId: b.murs[0].id });
    supprimerMur(b, b.murs[0].id);
    assert.deepEqual([b.murs, b.ouvertures], [[], []]);
  });
  test('trouver sous la souris', () => {
    const b = creerBatiment('B', fr);
    ajouterMur(b, 'n0', { x: 0, z: 0 }, { x: 4, z: 0 }, 0.2);
    assert.deepEqual(sommetSous(b, 'n0', { x: 3.95, z: 0 }, 0.1), { x: 4, z: 0 });
    assert.equal(murSous(b, 'n0', { x: 2, z: 0.15 }, 0.1).mur.id, b.murs[0].id);
    assert.equal(murSous(b, 'n0', { x: 2, z: 0.5 }, 0.1), null);
    assert.equal(longueurDuMur(b.murs[0]), 4);
    assert.equal(projeter({ x: 9, z: 1 }, { x: 0, z: 0 }, { x: 4, z: 0 }).t, 1);
  });
});
