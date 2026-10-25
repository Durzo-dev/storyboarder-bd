/**
 * #446d : les textures de « Mes textures » sur le Sol et les Tracés (src/textures-utilisateur.js).
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_TYPE_DEFS, TRACÉ_TEXTURES } from '../src/constants.js';
import * as U from '../src/textures-utilisateur.js';

const entree = (x = {}) => ({ cle: 'polyhaven:rocky_trail', dossier: 'polyhaven-rocky_trail', nom: 'Rocky Trail', grain: 'grain.couleur.png',
  nature: 'couleur', teinte: '#7a6a55', matieres: ['terre', 'roche'], usages: ['sol', 'chemin', 'muret'], dimensions: [2, 2], ...x });
const livres = GROUND_TYPE_DEFS.length;

describe('les textures de l\'utilisateur sur le Sol et les Tracés (#446d)', () => {
  beforeEach(() => U.installerTexturesUtilisateur([]));

  test('l\'identifiant persisté est le dossier ; la clé du grain porte sa nature, comme les grains livrés', () => {
    assert.equal(U.idDe(entree()), 'tex:polyhaven-rocky_trail');
    assert.equal(U.cleDuGrain(entree()), 'tex:polyhaven-rocky_trail.couleur');
    assert.equal(U.cleDuGrain(entree({ nature: 'gris' })), 'tex:polyhaven-rocky_trail');
    assert.ok(GROUND_TYPE_DEFS.every(d => !U.estTextureUtilisateur(d.id)), 'aucune matière livrée ne commence par tex:');
  });

  test('une texture du Sol entre dans GROUND_TYPE_DEFS (les menus et le rendu la trouvent), au naturel', () => {
    U.installerTexturesUtilisateur([entree()]);
    const d = GROUND_TYPE_DEFS.find(x => x.id === 'tex:polyhaven-rocky_trail');
    assert.ok(d && d.importee);
    assert.equal(d.swatch, '#7a6a55');
    assert.equal(d.repeat, 3000);                 // la densité des matières livrées
    assert.equal(d.pavage, true);
  });

  test('une matière à motif régulier n\'a pas droit à l\'anti-répétition', () => {
    U.installerTexturesUtilisateur([entree({ matieres: ['paves'], dossier: 'x-paves' })]);
    assert.equal(GROUND_TYPE_DEFS.find(x => x.id === 'tex:x-paves').pavage, false);
  });

  test('RÉGRESSION : réinstaller remplace, sans doublon ; une texture supprimée quitte le Sol', () => {
    U.installerTexturesUtilisateur([entree()]);
    U.installerTexturesUtilisateur([entree()]);
    assert.equal(GROUND_TYPE_DEFS.length, livres + 1);
    U.installerTexturesUtilisateur([]);
    assert.equal(GROUND_TYPE_DEFS.length, livres);
  });

  test('l\'usage décide : sans « sol », pas au Sol ; sans grain, nulle part', () => {
    U.installerTexturesUtilisateur([entree({ usages: ['muret'] }), entree({ dossier: 'y', grain: null })]);
    assert.equal(GROUND_TYPE_DEFS.length, livres);
    assert.deepEqual(U.texturesPourLeTrace('muret').map(t => t.id), ['tex:polyhaven-rocky_trail']);
    assert.deepEqual(U.texturesPourLeTrace('route'), []);
  });

  test('un Tracé prend la texture choisie si son type la permet, l\'originale sinon (ou si elle manque)', () => {
    U.installerTexturesUtilisateur([entree()]);
    const t = U.textureDuTrace('chemin', 'tex:polyhaven-rocky_trail');
    assert.equal(t.grain, 'tex:polyhaven-rocky_trail.couleur');
    assert.deepEqual(t.tuile, [2, 2]);
    assert.equal(U.textureDuTrace('haie', 'tex:polyhaven-rocky_trail'), TRACÉ_TEXTURES.haie);   // pas un usage de haie
    assert.equal(U.textureDuTrace('chemin', 'tex:absente'), TRACÉ_TEXTURES.chemin);           // autre machine
    assert.equal(U.textureDuTrace('chemin', null), TRACÉ_TEXTURES.chemin);
  });

  test('taille réelle inconnue : une tuile de 2 m', () => {
    U.installerTexturesUtilisateur([entree({ dimensions: null })]);
    assert.deepEqual(U.textureDuTrace('muret', 'tex:polyhaven-rocky_trail').tuile, [2, 2]);
  });

  test('« Utilisée dans ce projet » compte les Sols, Zones et Tracés, par Tomes et Scènes', () => {
    const id = 'tex:polyhaven-rocky_trail';
    const tomes = [{ pages: [{ objects: [{ type: 'panel', groundType: id }, { type: 'tracé', tracéType: 'chemin', traceTexture: id }, { type: 'panel', groundType: 'herbe' }] }] }];
    const scenes = [{ pages: [{ objects: [{ type: 'tracé', tracéType: 'terrain', terrainType: id }] }] }];
    assert.deepEqual(U.utilisationsDe(id, { tomes, scenes }), { tomes: 2, scenes: 1 });
    assert.deepEqual(U.utilisationsDe('tex:autre', { tomes, scenes }), { tomes: 0, scenes: 0 });
  });
});
