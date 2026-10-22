// #454a-3b : les pièces (src/batiment-pieces.js) et la pièce rectangulaire d'un geste.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  facesDesMurs, pointDansPolygone, pointInterieur, actualiserPieces, formesDesPieces, pieceSous,
} from '../src/batiment-pieces.js';
import { ajouterMur, ajouterRectangle, supprimerMur, deplacerSommet } from '../src/batiment-trace.js';
import { creerBatiment } from '../src/batiment.js';

const fr = (en, f) => f;
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
function chaine(b, pts, fermee = true){
  const n = fermee ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) ajouterMur(b, 'n0', pts[i], pts[(i + 1) % pts.length], 0.2);
}

describe('les faces', () => {
  test('une pièce carrée : une face, 12 m²', () => {
    const b = creerBatiment('B', fr);
    chaine(b, [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }]);
    const f = facesDesMurs(b.murs);
    assert.equal(f.length, 1);
    proche(f[0].aire, 12);
  });
  test('un mur de refend : deux pièces', () => {
    const b = creerBatiment('B', fr);
    chaine(b, [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }]);
    ajouterMur(b, 'n0', { x: 1, z: 0 }, { x: 1, z: 3 }, 0.2, { accrocheA: { type: 'mur' }, accrocheB: { type: 'mur' } });
    const aires = facesDesMurs(b.murs).map(f => f.aire).sort((x, y) => x - y);
    assert.deepEqual(aires.map(a => Math.round(a)), [3, 9]);
  });
  test('ce qui n’est pas fermé ne fait pas de pièce, une impasse à l’intérieur ne casse rien', () => {
    const b = creerBatiment('B', fr);
    chaine(b, [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }], false);
    assert.equal(facesDesMurs(b.murs).length, 0);
    const c = creerBatiment('C', fr);
    chaine(c, [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }]);
    ajouterMur(c, 'n0', { x: 2, z: 0 }, { x: 2, z: 1.5 }, 0.2, { accrocheA: { type: 'mur' } });
    const f = facesDesMurs(c.murs);
    assert.equal(f.length, 1);
    proche(f[0].aire, 12);
  });
  test('deux pièces séparées : deux faces, pas de face extérieure', () => {
    const b = creerBatiment('B', fr);
    chaine(b, [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }, { x: 0, z: 2 }]);
    chaine(b, [{ x: 5, z: 0 }, { x: 7, z: 0 }, { x: 7, z: 2 }, { x: 5, z: 2 }]);
    assert.equal(facesDesMurs(b.murs).length, 2);
  });
});

describe('les polygones', () => {
  const L = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 1 }, { x: 1, z: 1 }, { x: 1, z: 4 }, { x: 0, z: 4 }];
  test('aire d’un L, et point dedans / dehors', () => {
    const b = { murs: L.map((p, i) => ({ id: 'm' + i, a: p, b: L[(i + 1) % L.length] })) };
    proche(facesDesMurs(b.murs)[0].aire, 7, 1e-6);
    assert.equal(pointDansPolygone({ x: 0.5, z: 3 }, L), true);
    assert.equal(pointDansPolygone({ x: 3, z: 3 }, L), false);
  });
  test('le point intérieur d’un L tombe dans le L', () => {
    assert.equal(pointDansPolygone(pointInterieur(L), L), true);
  });
});

describe('les pièces gardent leur nom', () => {
  function maison(){
    const b = creerBatiment('B', fr);
    chaine(b, [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }]);
    actualiserPieces(b, 'n0', fr);
    return b;
  }
  test('une pièce fermée reçoit un nom et un repère', () => {
    const b = maison();
    assert.equal(b.pieces.length, 1);
    assert.equal(b.pieces[0].nom, 'Pièce 1');
    assert.ok(b.pieces[0].repere);
  });
  test('renommée, puis déformée : elle garde son nom', () => {
    const b = maison();
    b.pieces[0].nom = 'Salon';
    deplacerSommet(b, 'n0', { x: 4, z: 3 }, { x: 5, z: 4 });
    actualiserPieces(b, 'n0', fr);
    assert.deepEqual(b.pieces.map(p => p.nom), ['Salon']);
  });
  test('coupée en deux : une moitié garde le nom, l’autre en reçoit un nouveau', () => {
    const b = maison();
    b.pieces[0].nom = 'Salon';
    b.pieces[0].sol = 'parquet';
    ajouterMur(b, 'n0', { x: 1, z: 0 }, { x: 1, z: 3 }, 0.2, { accrocheA: { type: 'mur' }, accrocheB: { type: 'mur' } });
    actualiserPieces(b, 'n0', fr);
    assert.deepEqual(b.pieces.map(p => p.nom).sort(), ['Pièce 1', 'Salon']);
    assert.equal(b.pieces.find(p => p.nom === 'Salon').sol, 'parquet', 'ses revêtements suivent');
  });
  test('ouverte (un mur supprimé) : elle disparaît ; les autres niveaux ne bougent pas', () => {
    const b = maison();
    b.pieces.push({ id: 'pz', niveauId: 'n1', nom: 'Grenier' });
    supprimerMur(b, b.murs[0].id);
    actualiserPieces(b, 'n0', fr);
    assert.deepEqual(b.pieces.map(p => p.nom), ['Grenier']);
  });
  test('les formes et la pièce sous la souris', () => {
    const b = maison();
    const formes = formesDesPieces(b, 'n0');
    proche(formes.get(b.pieces[0].id).aire, 12);
    assert.equal(pieceSous(b, 'n0', { x: 2, z: 1 }), b.pieces[0].id);
    assert.equal(pieceSous(b, 'n0', { x: 9, z: 9 }), null);
  });
  test('une pièce reprise d’une Scène sans repère : elle en reçoit un, son nom est perdu seulement si rien ne la contient', () => {
    const b = maison();
    b.pieces = [{ id: 'p0', niveauId: 'n0', nom: 'Salle', repere: { x: 2, z: 1.5 } }];
    actualiserPieces(b, 'n0', fr);
    assert.deepEqual(b.pieces.map(p => p.nom), ['Salle']);
  });
});

describe('la pièce rectangulaire d’un geste', () => {
  test('quatre murs, une pièce', () => {
    const b = creerBatiment('B', fr);
    const r = ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 5, z: 3 }, 0.2);
    assert.equal(r.murs.length, 4);
    assert.equal(facesDesMurs(b.murs).length, 1);
  });
  test('accolée à une pièce existante, coin sur un mur : jonctions en T, deux pièces', () => {
    const b = creerBatiment('B', fr);
    ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 4, z: 4 }, 0.2);
    const r = ajouterRectangle(b, 'n0', { x: 4, z: 1 }, { x: 7, z: 3 }, 0.2);
    assert.ok(r.murs, JSON.stringify(r));
    assert.equal(facesDesMurs(b.murs).length, 2);
  });
  test('un côté entièrement accolé n’est pas doublé : trois murs neufs, deux pièces', () => {
    const b = creerBatiment('B', fr);
    ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 4, z: 4 }, 0.2);
    const r = ajouterRectangle(b, 'n0', { x: 4, z: 0 }, { x: 7, z: 4 }, 0.2);
    assert.equal(r.murs.length, 3);
    assert.equal(b.murs.length, 7);
    assert.equal(facesDesMurs(b.murs).length, 2);
  });
  test('tout ou rien : un côté qui traverse un mur, et rien n’est ajouté', () => {
    const b = creerBatiment('B', fr);
    ajouterMur(b, 'n0', { x: 2, z: -5 }, { x: 2, z: 5 }, 0.2);
    assert.deepEqual(ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 4, z: 3 }, 0.2), { erreur: 'croise' });
    assert.equal(b.murs.length, 1);
    assert.deepEqual(ajouterRectangle(b, 'n0', { x: 5, z: 0 }, { x: 5.01, z: 3 }, 0.2), { erreur: 'court' });
  });
});
