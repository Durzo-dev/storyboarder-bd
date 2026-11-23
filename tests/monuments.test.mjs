/**
 * tests/monuments.test.mjs: a real place's known monuments (#475): which buildings are monuments
 * (src/monuments.js, on Eguisheim's real extract, tests/fixtures/osm-eguisheim.json, © OpenStreetMap
 * contributors, ODbL), what is searched, how a model is turned, which licences are proposed, and a model
 * taking a monument's place in a laid Scene (src/monuments-ui.js).
 */
import './helpers/dom-stub.mjs';
import './helpers/render-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { monumentOf, searchFor, alongFootprint, monumentsOf, licenceAccepted } = await import('../src/monuments.js');
const { translateOsm } = await import('../src/osm-scene.js');
const { sceneContentOf } = await import('../src/real-place-import.js');
const { layRealPlace } = await import('../src/real-place-lay.js');
const { createScene } = await import('../src/scenes.js');
const { S } = await import('../src/state.js');

describe('monuments, which buildings are', () => {
  test('a named building linked to Wikidata, heritage, historic, a sight, a museum, or a church or castle', () => {
    assert.deepEqual(monumentOf({ building: 'yes', name: 'Opéra Comédie', wikidata: 'Q3354488' }), { name: 'Opéra Comédie', wikidata: 'Q3354488' });
    assert.ok(monumentOf({ building: 'yes', name: 'Hôtel X', heritage: '2' }));
    assert.ok(monumentOf({ building: 'yes', name: 'Porte', historic: 'city_gate' }));
    assert.ok(monumentOf({ building: 'yes', name: 'Musée Fabre', tourism: 'museum' }));
    assert.ok(monumentOf({ building: 'church', name: 'Église Saints-Pierre-et-Paul' }));
    assert.ok(monumentOf({ building: 'castle', name: 'Château' }));
  });
  test('not a monument: no name, an ordinary building, `historic=building` alone', () => {
    assert.equal(monumentOf({ building: 'church', wikidata: 'Q1' }), null, 'no name: nothing to search');
    assert.equal(monumentOf({ building: 'apartments', name: 'Résidence du Parc' }), null);
    assert.equal(monumentOf({ building: 'yes', name: 'Maison', historic: 'building' }), null);
  });
  test('the English name is searched when OSM gives one (Sketchfab\'s titles are mostly English)', () => {
    const m = monumentOf({ building: 'yes', name: 'Tour Eiffel', 'name:en': 'Eiffel Tower', wikidata: 'Q243' });
    assert.equal(searchFor(m), 'Eiffel Tower');
    assert.equal(searchFor(monumentOf({ building: 'church', name: 'Église', 'name:en': 'Église' })), 'Église', 'the same name: once');
  });
  test('on Eguisheim\'s real extract: its church and chapel, at Detailed and Realistic only', () => {
    const village = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
    const centre = { lat: (village.bbox.sud + village.bbox.nord) / 2, lon: (village.bbox.ouest + village.bbox.est) / 2 };
    const names = (detail) => translateOsm(village, { centre, halfSize: 100, detail }).buildings.filter(e => e.monument).map(e => e.monument.name).sort();
    assert.deepEqual(names('detailed'), ['Chapelle Saint-Léon IX', 'Église Saints-Pierre-et-Paul']);
    assert.deepEqual(names('simple'), []);
  });
});

describe('monuments, a model laid along the footprint, with an accepted licence', () => {
  test('the model\'s x axis along the footprint\'s length (a half or quarter turn left to the user)', () => {
    const rect = (a) => [[-10, -3], [10, -3], [10, 3], [-10, 3]].map(([x, z]) => ({ x: x * Math.cos(a) - z * Math.sin(a), z: x * Math.sin(a) + z * Math.cos(a) }));
    assert.equal(alongFootprint(rect(0)), 0);
    // A footprint turned from +x towards +z by 0.5 rad: the model turned the other way (rotation.y).
    assert.ok(Math.abs(alongFootprint(rect(0.5)) + 0.5) < 1e-3);
    assert.ok(Math.abs(alongFootprint(rect(-1)) - 1) < 1e-3);
  });
  test('licences: all but « no derivatives »', () => {
    for (const code of ['cc0', 'by', 'by-sa', 'by-nc', 'by-nc-sa']) assert.equal(licenceAccepted({ code }), true, code);
    for (const code of ['by-nd', 'by-nc-nd']) assert.equal(licenceAccepted({ code }), false, code);
    assert.equal(licenceAccepted(null), true, 'unknown: the store says it');
  });
});

describe('monuments, a model taking a monument\'s place in a laid Scene', async () => {
  const { remplacerLeBatiment, cablerMonuments } = await import('../src/monuments-ui.js');
  test('the model on the footprint, as high as the building, turned along it; the building hidden, one undo step', async () => {
    const village = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
    const centre = { lat: (village.bbox.sud + village.bbox.nord) / 2, lon: (village.bbox.ouest + village.bbox.est) / 2 };
    let n = 0;
    const c = sceneContentOf(translateOsm(village, { centre, halfSize: 100 }), { panelId: 'P', newId: () => `m${++n}` });
    const scene = createScene();
    const { page } = layRealPlace(scene, { ...c, elements: [] }, { halfSize: 100, newObject: () => null });
    const church = monumentsOf(page.objects).find(o => o.monument.name === 'Église Saints-Pierre-et-Paul');
    assert.ok(church, 'the monument kept on its Element');
    let snapshots = 0;
    for (const id of ['objectMonumentChange', 'objectMonumentRestore', 'objectModalCancel', 'objectMonumentField']) if (!document.getElementById(id)) { const b = document.createElement('button'); b.id = id; document.body.appendChild(b); }
    cablerMonuments({ snapshot: () => { snapshots++; }, render: () => {} });
    const el = await remplacerLeBatiment(scene, church, 'eglise.glb');
    assert.equal(el.objType, 'modele'); assert.equal(el.modelFile, 'eglise.glb');
    assert.equal(el.name, 'Église Saints-Pierre-et-Paul');
    assert.deepEqual([el.wxFloor, el.wzFloor], [church.wxFloor, church.wzFloor]);
    assert.ok(el.realHeightFloor > 10, `as high as the church (${el.realHeightFloor} m)`);
    assert.ok(Number.isFinite(el.rotY) && el.rotY !== 0, 'turned along its footprint');
    assert.equal(church.hidden3d, true, 'hidden, not deleted');
    assert.ok(page.objects.includes(church) && page.objects.includes(el));
    assert.equal(snapshots, 1);
    assert.equal(monumentsOf(page.objects).length, 1, 'the chapel is left');
    // Its sheet: « Restore the building » removes the model and shows the building again (one more step).
    assert.equal(el.monumentDe, church.id);
    S.scenes.push(scene);
    document.getElementById('objectMonumentField').dataset.id = el.id;
    document.getElementById('objectMonumentRestore').onclick();
    assert.ok(!page.objects.includes(el), 'the model removed');
    assert.equal(church.hidden3d, undefined, 'the building shown again');
    assert.equal(snapshots, 2);
  });
});

describe('monuments, the last step of « New scene » (asked)', () => {
  const ui = readFileSync(new URL('../src/real-place-ui.js', import.meta.url), 'utf8');
  test('after the Scene is built, in the same window, only when there are monuments', () => {
    assert.match(ui, /if \(fini && trouves\.length\) \{\n      const revue = etapeMonuments\(scene, trouves\)/);
  });
  test('« Finish » lays the models chosen; closing keeps the generated buildings', () => {
    assert.match(ui, /if \(poser\) for \(const \[o, f\] of choisis\) await remplacerLeBatiment\(scene, o, f\);/);
    assert.match(ui, /\$\('realPlaceMonumentsDone'\)\.onclick = \(\) => finir\(true\);/);
    assert.match(ui, /if \(V && V\.monuments\) \{ V\.monuments\.finir\(false\); return; \}/);
  });
  test('a model chosen turns the button into « Replace with a building », which drops it', () => {
    assert.match(ui, /fichier \? tr\('Replace with a building', 'Remplacer par un bâtiment'\) : tr\('Find a 3D model', 'Chercher un modèle 3D'\)/);
    assert.match(ui, /if \(choisis\.has\(o\)\) \{ choisis\.delete\(o\);/);
  });
});

describe('#480d: an import asked by an AI does not wait for the review', () => {
  const ui = readFileSync(new URL('../src/real-place-ui.js', import.meta.url), 'utf8');
  const link = readFileSync(new URL('../src/mcp-link.js', import.meta.url), 'utf8');
  test('⚠️ THE AI\'S IMPORT ANSWERS ONCE THE SCENE IS MADE; the window stays open on the review for the user', () => {
    // It waited for a click on « Finish » nobody gave: the AI's call never ended.
    assert.ok(ui.includes('const revue = etapeMonuments(scene, trouves).then(() => { if (V === moi) fermer(); });'));
    assert.ok(ui.includes('if (!pourIA) await revue;'), 'the user\'s own import still ends with its review');
    assert.ok(ui.includes('return importer({ pourIA: true });'));
  });
  test('⚠️ THE AI\'S PREVIEWS WAIT FOR AN IMPORT UNDER WAY, NOT FOR THE WINDOW (open on the review, they waited 80 s in vain)', () => {
    assert.ok(link.includes("if ((!loading || loading.hidden) && !importEnCours()) return;"));
    assert.ok(!link.includes("$('realPlaceModal')"), 'the window\'s being open blocks no preview');
    assert.ok(ui.includes('export const importEnCours = () => !!(V && V.busy);'));
  });
  test('a new AI import while the review waits is refused, said to the AI (it would drop the user\'s choices)', () => {
    assert.ok(ui.includes("if (V && V.monuments) return { error: 'The « New scene » window waits for the user to review the last import"));
    assert.ok(ui.includes('if (!V.monuments) { rendreLaConsigne(); majBoutons(); }'), 'the review is not covered by the instructions');
  });
});

const { modelFound, distinctiveWords } = await import('../src/monuments.js');
describe('#480d: a monument is proposed only when the store has a model of it', () => {
  const ui = readFileSync(new URL('../src/real-place-ui.js', import.meta.url), 'utf8');
  const res = (nom, code = 'by') => ({ nom, licence: { code } });
  test('its distinctive words: neither the little words nor what every church or tower is called', () => {
    assert.deepEqual(distinctiveWords('Cathédrale Saint-Pierre de Montpellier'), ['saint', 'pierre', 'montpellier']);
    assert.deepEqual(distinctiveWords('Tour Eiffel'), ['eiffel']);
    assert.deepEqual(distinctiveWords('La Tour'), ['la', 'tour'], 'all generic: all its words');
  });
  test('⚠️ MEASURED ON SKETCHFAB (23 Nov.): the famous found, the local ones not, an ND licence never', () => {
    // The first results Sketchfab gave (downloadable), as measured.
    assert.equal(modelFound({ name: 'Tour Eiffel', nameEn: 'Eiffel Tower' }, [res('Eiffel Tower Telephone'), res('Eiffel Tower, Paris, France')]), true);
    assert.equal(modelFound({ name: 'Maison Carrée' }, [res('Maison Carree Cieling Flower'), res('Roman Temple of Evora', 'by-nc')]), true,
      'accents aside');
    assert.equal(modelFound({ name: 'Pont du Gard' }, [res('Pont du Gard')]), true);
    assert.equal(modelFound({ name: 'Arènes de Nîmes' }, []), false, 'Sketchfab found nothing');
    assert.equal(modelFound({ name: 'Cathédrale Saint-Pierre de Montpellier' }, [res('Saint Pierre de Rome')]), false, 'not every word');
    assert.equal(modelFound({ name: 'Arc de Triomphe' }, [res('Arc de Triomphe Wrapped', 'by-nc-nd')]), false, 'no derivatives: never laid in place');
    assert.equal(modelFound({ name: 'Pont du Gard' }, [...Array(24).fill(res('Roman bridge')), res('Pont du Gard')]), false, 'beyond the first page');
  });
  test('⚠️ THE STEP SHOWS THE FOUND ONLY, AND NONE WHEN NONE IS (the search asked beforehand)', () => {
    assert.ok(ui.includes('const trouves = fini ? await monumentsTrouves(scene) : [];'));
    assert.ok(ui.includes('if (fini && trouves.length) {'));
  });
});
