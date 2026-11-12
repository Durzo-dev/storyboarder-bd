/**
 * tests/real-place-sources.test.mjs: the sources of a real place per country (src/real-place-sources.js).
 * The IGN answers below were recorded on 11 November 2026 from the Géoplateforme altimetry service
 * (RGE ALTI®, © IGN), at the centre of Eguisheim (48.04265 N, 7.30605 E). The network itself is the
 * import's; here, what is asked and how the answers are read.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { rulesFor, planRelief } from '../src/real-place-sources.js';
import { projector } from '../src/geo-local.js';
import { translateOsm } from '../src/osm-scene.js';

const EGUISHEIM = { lat: 48.04265, lon: 7.30605 };
// A 10 m zone sampled every 5 m: 3 × 3 points, row by row from the north-west corner.
const IGN_9 = { elevations: [208.61, 209.52, 209.56, 208.46, 209.27, 209.22, 208.11, 208.78, 209.01] };

describe('real place, the rules per country', () => {
  test('France has its own table; any other country takes the world\'s', () => {
    assert.equal(rulesFor('fr').levelHeight, 2.8);
    assert.equal(rulesFor('FR').levelHeight, 2.8, 'the code\'s case does not matter');
    assert.equal(rulesFor('de').levelHeight, 3);
    assert.equal(rulesFor(null).levelHeight, 3);
    assert.equal(rulesFor('fr').levels.house, 2);
  });
  test('the translator takes the country\'s table', () => {
    const extract = { elements: [{ type: 'way', id: 1, tags: { building: 'house' }, geometry: [[48, 7], [48, 7.0001], [48.0001, 7.0001], [48.0001, 7], [48, 7]] }] };
    const fr = translateOsm(extract, { centre: { lat: 48.00005, lon: 7.00005 }, halfSize: 50, country: 'fr' });
    const de = translateOsm(extract, { centre: { lat: 48.00005, lon: 7.00005 }, halfSize: 50, country: 'de' });
    assert.equal(fr.buildings[0].building.niveaux[0].hauteur, 2.8);
    assert.equal(de.buildings[0].building.niveaux[0].hauteur, 3);
  });
});

describe('real place, the relief of a zone', () => {
  test('France: the IGN first, by POST (5,000 points would not fit in an address), Open-Meteo as fallback', () => {
    const p = planRelief({ centre: EGUISHEIM, halfSize: 200, country: 'fr' });
    assert.equal(p.provider.id, 'ign');
    assert.equal(p.fallbacks, 1);
    assert.deepEqual(p.requests.map(r => r.count), [5000, 1561], '81 × 81 points every 5 m, in two requests');
    assert.equal(p.requests[0].method, 'POST');
    assert.equal(p.requests[0].body.lon.split('|').length, 5000);
    assert.equal(p.requests[0].body.resource, 'ign_rge_alti_wld');
    assert.equal(planRelief({ centre: EGUISHEIM, halfSize: 200, country: 'fr', providerIndex: 1 }).provider.id, 'openMeteo');
    assert.equal(planRelief({ centre: EGUISHEIM, halfSize: 200, country: 'fr', providerIndex: 2 }), null, 'no third provider');
  });
  test('the world: Open-Meteo, sampled every 45 m (half its 90 m), so two requests instead of sixty-six', () => {
    const p = planRelief({ centre: { lat: 52.52, lon: 13.4 }, halfSize: 200, country: 'de' });
    assert.equal(p.provider.id, 'openMeteo');
    assert.equal(p.requests.length, 2);
    assert.ok(p.requests.every(r => r.count <= 100 && !r.method));
    assert.match(p.requests[0].url, /^https:\/\/api\.open-meteo\.com\/v1\/elevation\?latitude=/);
  });
  test('the points: the zone\'s grid, row by row from the north-west corner', () => {
    const p = planRelief({ centre: EGUISHEIM, halfSize: 5, country: 'fr' });
    const lons = p.requests[0].body.lon.split('|').map(Number), lats = p.requests[0].body.lat.split('|').map(Number);
    const { toLocal } = projector(EGUISHEIM);
    const first = toLocal({ lat: lats[0], lon: lons[0] }), last = toLocal({ lat: lats[8], lon: lons[8] });
    assert.ok(Math.abs(first.x + 5) < 0.01 && Math.abs(first.z + 5) < 0.01, 'north-west');
    assert.ok(Math.abs(last.x - 5) < 0.01 && Math.abs(last.z - 5) < 0.01, 'south-east');
  });
  test('a real IGN answer becomes altitudes every metre over the zone', () => {
    const g = planRelief({ centre: EGUISHEIM, halfSize: 5, country: 'fr' }).assemble([IGN_9]);
    assert.equal(g.nx, 11);
    assert.equal(g.x0, -5);
    assert.equal(g.missing, 0);
    assert.equal(g.altitudes[0], 208.61, 'the north-west sample, where it was taken');
    assert.equal(g.altitudes[5 * 11 + 5], 209.27, 'the centre');
    assert.equal(g.altitudes[10 * 11 + 10], 209.01, 'the south-east');
    assert.equal(g.altitudes[2], Math.round((208.61 * 0.6 + 209.52 * 0.4) * 100) / 100, 'interpolated between two samples');
    assert.equal(g.provider, 'ign');
  });
  test('outside its coverage the IGN answers -99999: those points take the mean; all of them: no relief', () => {
    const p = planRelief({ centre: EGUISHEIM, halfSize: 5, country: 'fr' });
    const holes = { elevations: IGN_9.elevations.map((v, i) => (i === 0 ? -99999 : v)) };
    const g = p.assemble([holes]);
    assert.ok(Math.abs(g.missing - 1 / 9) < 1e-9);
    assert.ok(g.altitudes[0] > 208 && g.altitudes[0] < 210, 'no pit to sea level');
    assert.equal(p.assemble([{ elevations: new Array(9).fill(-99999) }]), null);
  });
  test('an unreadable answer gives null: the import tries the next provider', () => {
    const p = planRelief({ centre: EGUISHEIM, halfSize: 5, country: 'fr' });
    assert.equal(p.assemble([{ elevations: [1, 2] }]), null, 'wrong count');
    assert.equal(p.assemble([{ erreur: 'x' }]), null);
    assert.equal(p.assemble([]), null);
  });
  test('the grid never exceeds the relief\'s 401 points of side, even when the samples overflow the zone', () => {
    const p = planRelief({ centre: { lat: 52.52, lon: 13.4 }, halfSize: 200, country: 'de' });
    const g = p.assemble(p.requests.map(r => ({ elevation: new Array(r.count).fill(34) })));
    assert.equal(g.nx, 401);
    assert.equal(g.altitudes[200 * 401 + 200], 34);
  });
});

describe('real place, altitudes that cannot be', () => {
  test('a few samples far under the town are no data (seen: Montpellier on a 300 m cliff)', () => {
    const p = planRelief({ centre: EGUISHEIM, halfSize: 5, country: 'fr' });
    const odd = { elevations: IGN_9.elevations.map((v, i) => (i === 4 ? -2514.3 : v)) };
    const g = p.assemble([odd]);
    assert.ok(Math.abs(g.missing - 1 / 9) < 1e-9, 'counted as missing');
    assert.ok(Math.min(...g.altitudes) > 208 && Math.max(...g.altitudes) < 210, 'the town keeps its few metres of relief');
  });
  test('no land under -450 m nor over 9,000 m', () => {
    const p = planRelief({ centre: EGUISHEIM, halfSize: 5, country: 'fr' });
    const g = p.assemble([{ elevations: IGN_9.elevations.map((v, i) => (i === 0 ? 12000 : v)) }]);
    assert.ok(Math.max(...g.altitudes) < 210);
  });
});
