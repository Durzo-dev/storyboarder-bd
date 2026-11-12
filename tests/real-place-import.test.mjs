/**
 * tests/real-place-import.test.mjs: a real place turned into the content of a Scene (src/real-place-import.js)
 * and the relief from real altitudes (src/terrain-relief.js, reliefDepuisAltitudes). Extract: Eguisheim
 * (tests/fixtures/osm-eguisheim.json, © OpenStreetMap contributors, ODbL); altitudes: a real IGN answer.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { translateOsm } from '../src/osm-scene.js';
import { sceneContentOf, pathObject } from '../src/real-place-import.js';
import { planRelief } from '../src/real-place-sources.js';
import * as R from '../src/terrain-relief.js';

const village = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
const centre = { lat: (village.bbox.sud + village.bbox.nord) / 2, lon: (village.bbox.ouest + village.bbox.est) / 2 };
let n = 0;
const newId = () => `id${++n}`;
const nameOf = (k) => ({ route: 'Route', chemin: 'Chemin de terre', muret: 'Muret', terrain: 'Terrain' })[k] || k;
const translated = translateOsm(village, { centre, halfSize: 60, country: 'fr' });
// A 10 m zone of real IGN altitudes (Eguisheim, 11 Nov. 2026), assembled to a 1 m grid.
const IGN_9 = { elevations: [208.61, 209.52, 209.56, 208.46, 209.27, 209.22, 208.11, 208.78, 209.01] };
const altitudes = planRelief({ centre, halfSize: 5, country: 'fr' }).assemble([IGN_9]);

describe('real place, the content of a Scene', () => {
  const c = sceneContentOf(translated, { panelId: 'P', newId, nameOf, altitudes, reliefCredit: '© IGN, RGE ALTI®' });
  test('Zones first, then Paths, all on the Scene\'s canvas, with fresh ids', () => {
    assert.equal(c.traces.length, c.counts.zones + c.counts.paths);
    assert.ok(c.traces.slice(0, c.counts.zones).every(o => o.tracéType === 'terrain'));
    assert.ok(c.traces.every(o => o.type === 'tracé' && o.panelId === 'P' && /^id\d+$/.test(o.id)));
    assert.equal(new Set(c.traces.map(o => o.id)).size, c.traces.length);
  });
  test('a road keeps its 3D width and its plan stroke follows; a pedestrian street has no marking', () => {
    const grandRue = c.traces.find(o => o.name === 'Grand\'Rue');
    assert.equal(grandRue.world.width, 5);
    assert.equal(grandRue.width, 10, 'the default 10 px stroke for 5 m');
    const square = c.traces.find(o => o.tracéType === 'terrain' && o.name === 'Place du Marché aux Saules');
    assert.equal(square.terrainType, 'bitume');
    assert.ok(square.world.masque);
  });
  test('a wall gets its default height, a river its depth, an unnamed Path the application\'s name', () => {
    const wall = c.traces.find(o => o.tracéType === 'muret');
    assert.equal(wall.wallHeight, 1);
    assert.equal(wall.name, 'Muret');
    const river = pathObject({ kind: 'riviere', world: { pts: [{ x: 0, z: 0 }, { x: 5, z: 0 }], width: 8 } }, { panelId: 'P', newId, nameOf });
    assert.equal(river.profondeur, R.PROFONDEUR_RIVIERE);
    const street = pathObject({ kind: 'route', marking: false, world: { pts: [{ x: 0, z: 0 }, { x: 5, z: 0 }], width: 5 } }, { panelId: 'P', newId, nameOf });
    assert.equal(street.marquage, false);
  });
  test('the buildings and Elements are handed over as translated; the credits name OSM and the relief\'s source', () => {
    assert.equal(c.buildings.length, translated.buildings.length);
    assert.deepEqual(c.credits, ['© OpenStreetMap contributors, ODbL', '© IGN, RGE ALTI®']);
  });
  test('the relief: heights relative to the middle altitude, back to 0 on the edges', () => {
    assert.equal(c.relief.altitude, 209);
    assert.equal(c.relief.nx, 11);
    assert.equal(c.bornee, false);
    for (let i = 0; i < 11; i++) assert.equal(c.relief.h[i], 0, 'the north edge');
    assert.ok(R.reliefValide(c.relief));
  });
  test('without altitudes: a flat Ground, and OSM alone in the credits', () => {
    const flat = sceneContentOf(translated, { panelId: 'P', newId, nameOf });
    assert.equal(flat.relief, null);
    assert.deepEqual(flat.credits, ['© OpenStreetMap contributors, ODbL']);
  });
});

describe('the relief from real altitudes', () => {
  test('heights relative to the middle of the range, rounded to the metre (no edge blending)', () => {
    const r = R.reliefDepuisAltitudes({ x0: -1, z0: -1, pas: 1, nx: 3, nz: 2, altitudes: [312, 382, 452, 315.25, 385, 450] }, 0);
    assert.equal(r.bornee, false);
    assert.equal(r.relief.altitude, 382);
    assert.deepEqual(r.relief.h, [-70, 0, 70, -66.75, 3, 68]);
  });
  test('the edges meet the flat Ground: 0 on the border, full height beyond the blending', () => {
    const alt = new Array(61 * 61).fill(250); alt[30 * 61 + 30] = 230;   // a 20 m high plateau, one dip in the middle
    const r = R.reliefDepuisAltitudes({ x0: -30, z0: -30, nx: 61, nz: 61, altitudes: alt }, 20);
    assert.equal(r.relief.altitude, 240);
    assert.equal(r.relief.h[0], 0);
    assert.equal(r.relief.h[30 * 61 + 0], 0, 'west edge');
    assert.equal(r.relief.h[30 * 61 + 30], -10, 'the middle keeps its height');
    assert.ok(r.relief.h[30 * 61 + 10] > 0 && r.relief.h[30 * 61 + 10] < 10, 'half-way through the blending');
  });
  test('beyond 600 m of rise: clamped and said; an unreadable altitude takes the base; a bad grid is refused', () => {
    const r = R.reliefDepuisAltitudes({ x0: 0, z0: 0, nx: 2, nz: 2, altitudes: [0, 1000, 500, null] }, 0);
    assert.equal(r.bornee, true);
    assert.equal(Math.max(...r.relief.h), R.HAUTEUR_MAX);
    assert.equal(r.relief.h[3], 0);
    assert.equal(R.reliefDepuisAltitudes({ x0: 0, z0: 0, nx: 2, nz: 2, altitudes: [1, 2, 3] }), null);
    assert.equal(R.reliefDepuisAltitudes({ x0: 0, z0: 0, nx: 2, nz: 2, altitudes: [null, null, null, null] }), null);
  });
});

describe('the import\'s progress and placement', async () => {
  const { IMPORT_STEPS, importProgress } = await import('../src/real-place-import.js');
  test('the steps in order; the bar grows through them, each step\'s share filled by its own progress', () => {
    assert.deepEqual(IMPORT_STEPS, ['map', 'country', 'buildings', 'facades', 'relief', 'scene', 'construction', 'ground']);
    assert.equal(importProgress('map'), 0);
    let last = -1;
    for (const s of IMPORT_STEPS) for (const sub of [0, 0.5, 1]) { const p = importProgress(s, sub); assert.ok(p >= last); last = p; }
    assert.ok(Math.abs(importProgress('ground', 1) - 1) < 1e-9);
    assert.ok(importProgress('relief', 0.5) > importProgress('relief', 0) && importProgress('relief', 0.5) < importProgress('scene', 0));
    assert.equal(importProgress('unknown'), 0);
  });
  test('« New scene » opens the choice, manual or from a real place', () => {
    const ui = readFileSync(new URL('../src/real-place-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /\$\('addSceneBtn'\)\.onclick = \(\) => ouvrirNouvelleScene\(\);/);
    assert.doesNotMatch(readFileSync(new URL('../src/index.html', import.meta.url), 'utf8'), /addRealSceneBtn/);
  });
});

describe('real place, the map data\'s detail line', async () => {
  const { downloadDetail } = await import('../src/real-place-import.js');
  test('the server asked, the seconds on it, then what has arrived', () => {
    assert.equal(downloadDetail({ server: 1, servers: 3, bytes: 0 }, 4.7), 'Serveur 1 sur 3 · 4 s · en attente de la réponse');
    assert.equal(downloadDetail({ server: 2, servers: 3, bytes: 1.5 * 1024 * 1024 }, 12, 'en'), 'Server 2 of 3 · 12 s · 1.5 MB received');
    assert.equal(downloadDetail({ server: 1, servers: 3, bytes: 2048 }, 1), 'Serveur 1 sur 3 · 1 s · 2 Ko reçus');
  });
  test('nothing heard yet: no line', () => {
    assert.equal(downloadDetail(null, 3), '');
  });
  test('the main process reads Overpass as a stream, reports it, and logs each attempt', () => {
    const net = readFileSync(new URL('../electron/bibliotheque/real-place.js', import.meta.url), 'utf8');
    assert.match(net, /rep\.body\.getReader\(\)/);
    assert.match(net, /console\.info\(`\[real-place\] overpass \$\{host\}/);
    assert.match(readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8'), /event\.sender\.send\('realplace:osmProgress', p\)/);
  });
});

describe('real place, the Overpass servers', () => {
  const net = readFileSync(new URL('../electron/bibliotheque/real-place.js', import.meta.url), 'utf8');
  test('the free public instances first, the overloaded main one last; the dead old address gone', () => {
    const list = net.slice(net.indexOf('const OVERPASS = ['), net.indexOf('];', net.indexOf('const OVERPASS = [')));
    const hosts = [...list.matchAll(/https:\/\/([^/']+)/g)].map(m => m[1]);
    assert.deepEqual(hosts, ['overpass.private.coffee', 'maps.mail.ru', 'overpass-api.de']);
    assert.doesNotMatch(net, /kumi\.systems\/api/);
  });
  test('a « 200 » answer with a runtime error remark is a failure; all failed: busy, unless no connection at all', () => {
    assert.match(net, /r\.json\.remark === 'string' && \/error\/i\.test\(r\.json\.remark\)/);
    assert.match(net, /const good = r\.json && Array\.isArray\(r\.json\.elements\) && !remark;/);
    assert.match(net, /failures\.every\(f => f === 'network'\) \? 'network' : 'busy'/);
    assert.match(readFileSync(new URL('../src/real-place-ui.js', import.meta.url), 'utf8'), /busy: tr\('The OpenStreetMap servers are busy/);
  });
});

describe('real place, the most available Overpass server', () => {
  test('all are probed at once with the smallest query; the extract goes to them in the order they answered', () => {
    const net = readFileSync(new URL('../electron/bibliotheque/real-place.js', import.meta.url), 'utf8');
    assert.match(net, /const times = await Promise\.all\(OVERPASS\.map\(probeOverpass\)\);/);
    assert.match(net, /\.sort\(\(a, b\) => \(a\.t - b\.t\) \|\| \(a\.i - b\.i\)\)/);
    assert.match(net, /const order = await overpassOrder\(\);/);
  });
  test('the window says it is looking for a server', async () => {
    const { downloadDetail } = await import('../src/real-place-import.js');
    assert.equal(downloadDetail({ probing: true }, 1), 'Recherche du serveur le plus disponible…');
  });
});

describe('real place, the window', () => {
  const ui = readFileSync(new URL('../src/real-place-ui.js', import.meta.url), 'utf8');
  const net = readFileSync(new URL('../electron/bibliotheque/real-place.js', import.meta.url), 'utf8');
  test('suggestions while typing come from the IGN and Photon (Nominatim forbids auto-complete), after a pause, from three letters', () => {
    assert.match(net, /https:\/\/data\.geopf\.fr\/geocodage\/completion\?maximumResponses=6/, 'the IGN: quick, France');
    assert.match(ui, /for \(const source of \['ign', 'photon'\]\)/, 'both asked, merged as they come');
    assert.match(ui, /\$\('realPlaceQuery'\)\.addEventListener\('input', suggerer\);/);
    assert.match(ui, /if \(q\.length < 3 \|\| !V \|\| V\.busy\)/);
    assert.match(net, /https:\/\/photon\.komoot\.io\/api\/\?limit=6/);
    assert.doesNotMatch(ui, /addEventListener\('input', chercher\)/, 'never Nominatim while typing');
  });
  test('each choice has its illustration; the progress at the bottom, the step under way above the bar', () => {
    const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
    assert.equal((html.match(/class="real-place-illustration"/g) || []).length, 2);
    const i = html.indexOf('id="realPlaceProgress"');
    assert.ok(i > html.indexOf('id="realPlaceStatus"') && i < html.indexOf('class="real-place-actions"'), 'just above the buttons');
    const html2 = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
    const p = html2.indexOf('id="realPlaceProgress"');
    assert.ok(p < html2.indexOf('id="realPlaceStep"') && html2.indexOf('id="realPlaceStep"') < html2.indexOf('id="realPlaceDetail"')
      && html2.indexOf('id="realPlaceDetail"') < html2.indexOf('id="realPlaceBar"'), 'the step, its detail under it, then the bar');
  });
  test('during the import the progress takes the options\' place; an empty detail fades out', () => {
    assert.match(ui, /\$\('realPlaceOptions'\)\.hidden = \$\('realPlaceDetailInfo'\)\.hidden = true;/);
    assert.match(ui, /d\.classList\.toggle\('vide', !texte\);/);
    assert.match(readFileSync(new URL('../src/style.css', import.meta.url), 'utf8'), /\.real-place-detail\.vide\{ opacity:0; max-height:0; \}/);
  });
  test('« Cancel » during the import: the requests stopped in the main process, the window closed at once', () => {
    assert.match(ui, /if \(api && api\.realPlaceAbort\) api\.realPlaceAbort\(\);\n    V\.busy = false;\n    fermer\(\);/);
    assert.match(ui, /const arrete = \(\) => V !== moi \|\| moi\.cancelled;/, 'a reopened window is not the old import\'s');
    const net = readFileSync(new URL('../electron/bibliotheque/real-place.js', import.meta.url), 'utf8');
    assert.match(net, /for \(const a of _enCours\) \{ a\.annule = true; a\.abort\(\); \}/);
  });
  test('a search field with its clear button; « Try again » after a failure; closing forgets the search', () => {
    const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
    assert.match(html, /<div class="champ-recherche">\s*<input id="realPlaceQuery"[^>]*>\s*<button id="realPlaceClearBtn" class="champ-recherche-effacer"[^>]*hidden>[\s\S]*?<\/button>\s*<\/div>/);
    assert.doesNotMatch(html, /id="realPlaceSearchBtn"/, 'no search button: the suggestions come while typing, Enter still searches');
    assert.match(ui, /\$\('realPlaceQuery'\)\.value = p\.name;\n      _rafraichirRecherche\(\);\n      choisirLieu\(p\);/, 'a suggestion fills the field and finds the place');
    assert.match(ui, /V && V\.echec \? tr\('Try again', 'Réessayer'\)/);
    assert.match(ui, /\$\('realPlaceQuery'\)\.value = '';/);
  });
});

describe('real place, the level of detail in the window', () => {
  test('a choice next to the zone\'s size, what it brings said under the row; simple asks no IGN survey', () => {
    const ui = readFileSync(new URL('../src/real-place-ui.js', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
    assert.match(html, /<select id="realPlaceDetailLevel">\s*<option value="simple">Simple<\/option>\s*<option value="detailed" selected>Détaillé<\/option>/);
    assert.match(ui, /if \(country === 'fr' && niveau !== 'simple' && api\.realPlaceBdTopo\)/);
    assert.match(ui, /translate: tr, survey, detail: niveau \}\);/);
  });
});

describe('real place, the facades\' colours from street photos (#474c)', () => {
  test('realistic only, never blocking; each photo read once; its credit added', () => {
    const ui = readFileSync(new URL('../src/real-place-ui.js', import.meta.url), 'utf8');
    const net = readFileSync(new URL('../electron/bibliotheque/real-place.js', import.meta.url), 'utf8');
    assert.match(ui, /if \(niveau === 'realistic'\) \{\n      await etape\('facades'\);/);
    assert.match(ui, /contenu\.credits\.push\(\.\.\.photoCredits\);/);
    assert.match(net, /if \(!host \|\| !String\(url\)\.startsWith\('https:\/\/'\) \|\| !_photoHosts\.has\(host\)\) return \{ error: 'response' \};/, 'only the hosts the search gave');
    assert.doesNotMatch(net, /providers\[0\]/, 'never the contributor\'s account (an e-mail address at times)');
  });
});
