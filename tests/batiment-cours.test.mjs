// #458c : les cours d'un bâtiment (src/batiment-cours.js), leur sol, leur toit.
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerBatiment } from '../src/batiment.js';
import { ajouterRectangle, supprimerMur } from '../src/batiment-trace.js';
import { ajouterEtage } from '../src/batiment-niveaux.js';
import { actualiserPieces, supprimerPiece, pieceSous, formesDesPieces } from '../src/batiment-pieces.js';
import { empriseDeLaPiece, etagesAuDessus, prolongerLaCour } from '../src/batiment-cours.js';
import { estUneTerrasse, toitsDuNiveau, fixerToit } from '../src/batiment-toits.js';

const fr = (en, f) => f;
/** Le plan signalé : quatre pièces autour d'une cinquième, au centre ; un étage par-dessus. */
function maison(etage = 'plein'){
  const b = creerBatiment('M', fr);
  for (const [a, c] of [[[0, 0], [3, 6]], [[3, 0], [6, 2]], [[3, 2], [6, 6]], [[6, 0], [9, 6]], [[0, 6], [9, 9]]]) {
    ajouterRectangle(b, 'n0', { x: a[0], z: a[1] }, { x: c[0], z: c[1] }, 0.2);
    actualiserPieces(b, 'n0', fr);
  }
  const n1 = ajouterEtage(b, fr);
  ajouterRectangle(b, n1.id, { x: 0, z: 0 }, { x: 9, z: 9 }, 0.2);
  if (etage === 'coupe') ajouterRectangle(b, n1.id, { x: 0, z: 0 }, { x: 4.5, z: 9 }, 0.2);   // un mur à x = 4,5 traverse la cour
  actualiserPieces(b, n1.id, fr);
  const centre = pieceSous(b, 'n0', { x: 4.5, z: 4 });
  return { b, n1, centre };
}

describe('prolonger une cour aux étages', () => {
  test('l\'étage qui la couvre est trouvé ; la cour y monte, murs tracés, et y est un vide', () => {
    const { b, n1, centre } = maison();
    supprimerPiece(b, 'n0', centre, supprimerMur);
    const poly = empriseDeLaPiece(b, 'n0', centre);
    assert.deepEqual(etagesAuDessus(b, 'n0', poly), [n1.id]);
    const murs = b.murs.filter(m => m.niveauId === n1.id).length;
    const r = prolongerLaCour(b, 'n0', centre, 0.2, fr);
    assert.deepEqual(r, { etages: [n1.id] });
    assert.ok(b.murs.filter(m => m.niveauId === n1.id).length > murs, 'des murs tracés à l\'étage');
    const haut = pieceSous(b, n1.id, { x: 4.5, z: 4 });
    assert.equal(b.pieces.find(p => p.id === haut).vide, true);
    assert.equal(formesDesPieces(b, n1.id).size, 2, 'l\'étage : sa pièce autour, et la cour');
  });
  test('un mur de l\'étage traverse l\'emprise : erreur, à ce niveau', () => {
    const { b, n1, centre } = maison('coupe');
    supprimerPiece(b, 'n0', centre, supprimerMur);
    assert.deepEqual(prolongerLaCour(b, 'n0', centre, 0.2, fr), { erreur: { niveauId: n1.id, raison: 'mur' } });
  });
  test('l\'éditeur : la fenêtre de confirmation, l\'erreur, un seul point d\'annulation', () => {
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /const etages = poly \? etagesAuDessus\(essai, niveauId, poly\) : \[\];/);
    assert.match(ui, /if \(!ok \|\| E !== ed\) return;\n\s*const r = prolongerLaCour\(/);
    assert.match(ui, /if \(r\.erreur\) \{[\s\S]*?_rappels\.alerter\(/);
    assert.match(ui, /modifier\(b => \{ for \(const k of Object\.keys\(b\)\) delete b\[k\]; Object\.assign\(b, essai\); \}\);/);
  });
});

describe('le sol et le toit d\'une cour', () => {
  test('au-dessus d\'une cour, pas de sol ; au-dessus d\'une pièce, une terrasse ; au rez-de-chaussée, pas de sol', () => {
    const { b, n1, centre } = maison();
    supprimerPiece(b, 'n0', centre, supprimerMur);
    assert.equal(estUneTerrasse(b, b.pieces.find(p => p.id === centre)), false, 'rez-de-chaussée');
    prolongerLaCour(b, 'n0', centre, 0.2, fr);
    const haut = b.pieces.find(p => p.id === pieceSous(b, n1.id, { x: 4.5, z: 4 }));
    assert.equal(estUneTerrasse(b, haut), false, 'au-dessus d\'une cour');
    const c = maison();   // une cour à l'étage seulement, au-dessus d'une pièce
    const b2 = c.b;
    ajouterRectangle(b2, c.n1.id, { x: 3, z: 2 }, { x: 6, z: 6 }, 0.2);
    actualiserPieces(b2, c.n1.id, fr);
    const cour = b2.pieces.find(p => p.id === pieceSous(b2, c.n1.id, { x: 4.5, z: 4 }));
    cour.vide = true;
    assert.equal(estUneTerrasse(b2, cour), true);
  });
  test('le toit fait le tour de la cour (en pente, ou plat), sans la couvrir', () => {
    const { b, n1, centre } = maison();
    supprimerPiece(b, 'n0', centre, supprimerMur);
    prolongerLaCour(b, 'n0', centre, 0.2, fr);
    for (const type of ['quatre-pans', 'deux-pans', 'un-pan']) {
      fixerToit(b, n1.id, { type, debord: 0.3 });
      const [t] = toitsDuNiveau(b, n1.id);
      assert.equal(t.trous.length, 1, 'la cour est un trou du toit');
      assert.ok(t.geometrie, type);
      const pts = t.geometrie.pans.flatMap(p => p.points);
      // Aucun point du toit au milieu de la cour (4,5 ; 4).
      assert.ok(!pts.some(q => Math.hypot(q.x - 4.5, q.z - 4) < 0.5), `${type} : rien au milieu de la cour`);
    }
  });
});

test('signalé : un étage DUPLIQUÉ (la même pièce, sommet pour sommet, au-dessus) : la cour y monte', async () => {
  const { dupliquerNiveau } = await import('../src/batiment-niveaux.js');
  const b = creerBatiment('M', fr);
  for (const [a, c] of [[[0, 0], [3, 6]], [[3, 0], [6, 2]], [[3, 2], [6, 6]], [[6, 0], [9, 6]], [[0, 6], [9, 9]]]) {
    ajouterRectangle(b, 'n0', { x: a[0], z: a[1] }, { x: c[0], z: c[1] }, 0.2);
    actualiserPieces(b, 'n0', fr);
  }
  const n1 = dupliquerNiveau(b, 'n0', fr);
  const centre = pieceSous(b, 'n0', { x: 4.5, z: 4 });
  supprimerPiece(b, 'n0', centre, supprimerMur);
  assert.deepEqual(etagesAuDessus(b, 'n0', empriseDeLaPiece(b, 'n0', centre)), [n1.id]);
  assert.deepEqual(prolongerLaCour(b, 'n0', centre, 0.2, fr), { etages: [n1.id] });
  assert.equal(b.pieces.find(p => p.id === pieceSous(b, n1.id, { x: 4.5, z: 4 })).vide, true);
});
