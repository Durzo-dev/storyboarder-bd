// #454a-4b : les bâtiments dans « Mes modèles » (src/batiment-bibliotheque.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIE_BATIMENTS, vientDuFichier, entreesBatiments, actionDEnregistrement } from '../src/batiment-bibliotheque.js';
import { creerBatiment } from '../src/batiment.js';
import { ajouterRectangle } from '../src/batiment-trace.js';
import { actualiserPieces } from '../src/batiment-pieces.js';
import { modelUsageLocations } from '../src/model-usages.js';

const fr = (en, f) => f;
function maison(){
  const b = creerBatiment('Maison', fr);
  ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 6, z: 4 }, 0.2);
  actualiserPieces(b, 'n0', fr);
  return b;
}

describe('les entrées', () => {
  test('une entrée par fichier, rangée dans Architecture, avec ce qui fait un bâtiment', () => {
    const [e] = entreesBatiments([{ fichier: 'Maison.batiment.json', batiment: maison(), taille: 900 }]);
    assert.equal(e.batiment, true);
    assert.equal(e.titre, 'Maison');
    assert.equal(e.categorie, CATEGORIE_BATIMENTS);
    assert.deepEqual([e.niveaux, e.pieces, e.ouvertures, e.os, e.introuvable], [1, 1, 0, 0, false]);
    assert.deepEqual(e.dimensions.map(v => Math.round(v * 10) / 10), [6.2, 4.2, 3]);
  });
  test('un fichier illisible reste listé, signalé', () => {
    const [e] = entreesBatiments([{ fichier: 'Abime.batiment.json', batiment: null }]);
    assert.equal(e.introuvable, true);
    assert.equal(e.dimensions, null);
  });
  test('où il sert : les bâtiments placés DEPUIS ce fichier, la casse ignorée', () => {
    const projet = {
      scenes: [{ id: 's1', name: 'Rue', pages: [{ objects: [
        { id: 'e1', type: 'objet3d', objType: 'batiment', batimentSource: 'maison.batiment.json', name: 'Maison' },
        { id: 'e2', type: 'objet3d', objType: 'batiment', name: 'Autre' },
      ] }] }],
      tomes: [],
    };
    const [e] = entreesBatiments([{ fichier: 'Maison.batiment.json', batiment: maison() }], projet);
    assert.deepEqual(e.scenes.map(g => g.elements.map(x => x.id)), [['e1']]);
    assert.equal(vientDuFichier(projet.scenes[0].pages[0].objects[1], 'Maison.batiment.json'), false);
  });
  test('les modèles importés gardent leur décompte habituel', () => {
    const projet = { scenes: [{ id: 's', pages: [{ objects: [{ id: 'm', type: 'objet3d', objType: 'modele', modelFile: 'a.glb' }] }] }] };
    assert.equal(modelUsageLocations('a.glb', projet).length, 1);
  });
});

describe('enregistrer', () => {
  test('neuf : un nouveau fichier ; même nom : remplacer ; renommé : un nouveau modèle', () => {
    assert.equal(actionDEnregistrement(null, 'Maison'), 'nouveau');
    assert.equal(actionDEnregistrement('Maison.batiment.json', 'maison'), 'remplacer');
    assert.equal(actionDEnregistrement('Maison.batiment.json', 'Maison en ruine'), 'nouveau');
  });
});
