/**
 * tests/texture-maps-3d.test.mjs, a texture's occlusion and roughness (#494a, src/texture-maps-3d.js).
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../node_modules/three/build/three.module.js';
import { occulterLaTuile3D, prendLOcclusion, PART_OCCLUSION, carteRepetee3D } from '../src/texture-maps-3d.js';
import * as R from '../src/batiment-revetements.js';
import { installerTexturesUtilisateur } from '../src/textures-utilisateur.js';
import { _setGrain3D, _viderGrains3D } from '../src/bubble-grain.js';

describe('#494a: occlusion and roughness', () => {
  test('⚠️ THE OCCLUSION IS MULTIPLIED INTO THE TILE, PARTLY, AND THE CONTEXT IS GIVEN BACK AS IT WAS', () => {
    const appels = [];
    const ctx = { save: () => appels.push('save'), restore: () => appels.push('restore'),
      drawImage: (img, x, y, w, h) => appels.push(['draw', ctx.globalCompositeOperation, ctx.globalAlpha, w, h]),
      globalCompositeOperation: 'source-over', globalAlpha: 1 };
    occulterLaTuile3D(ctx, { width: 4 }, 1024, 1024);
    assert.deepEqual(appels, ['save', ['draw', 'multiply', PART_OCCLUSION, 1024, 1024], 'restore'], 'stretched over the whole tile');
    assert.ok(PART_OCCLUSION > 0 && PART_OCCLUSION < 1, 'all of it would darken the lit faces too');
    appels.length = 0;
    occulterLaTuile3D(ctx, null, 8, 8);
    assert.deepEqual(appels, [], 'no map: nothing');
  });

  test('⚠️ A GREY GRAIN TAKES NO OCCLUSION: its hollows were shaded at baking', () => {
    assert.equal(prendLOcclusion('tex:polyhaven-asphalt_04.couleur'), true);
    assert.equal(prendLOcclusion('tex:polyhaven-white_stucco_02'), false);
  });

  test('a map repeats, untinted', () => {
    const t = carteRepetee3D(THREE, { width: 4, height: 4 });
    assert.equal(t.wrapS, THREE.RepeatWrapping);
    assert.equal(t.wrapT, THREE.RepeatWrapping);
  });

  test('⚠️ A BUILDING WEARS ITS ROUGHNESS MAP (the map gives it: roughness 1), and its painting carries both maps', () => {
    _viderGrains3D();
    const entree = { cle: 'polyhaven:brick', dossier: 'polyhaven-brick', grain: 'grain.couleur.png', nature: 'couleur', teinte: '#aabbcc',
      usages: ['mur-ext'], dimensions: [2, 2], cartes: ['couleur', 'normal', 'rugosite', 'ao'] };
    installerTexturesUtilisateur([entree]);
    const p = R.peintureDuRevetement({ texture: 'tex:polyhaven-brick' }, 'mur-ext');
    assert.equal(p.ao, 'tex:polyhaven-brick#ao');
    assert.equal(p.rugosite, 'tex:polyhaven-brick#rugosite');
    const fabrique = R.fabriqueDeRevetements(THREE);
    _setGrain3D('tex:polyhaven-brick.couleur', { width: 4, height: 4 });
    assert.equal(fabrique({ texture: 'tex:polyhaven-brick' }, 'mur-ext').roughnessMap, null, 'not loaded yet: none');
    _setGrain3D('tex:polyhaven-brick#rugosite', { width: 4, height: 4 });
    const m = fabrique({ texture: 'tex:polyhaven-brick' }, 'mur-ext');
    assert.ok(m.roughnessMap, 'arrived after the colour: a new material (its key says so)');
    assert.equal(m.roughness, 1);
    assert.equal(m.roughnessMap.repeat.x, m.map.repeat.x, 'on the colour\'s tile');
    installerTexturesUtilisateur([]); _viderGrains3D();
  });
});
