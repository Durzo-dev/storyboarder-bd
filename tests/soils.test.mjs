/**
 * tests/soils.test.mjs: THE BARE EARTH'S COLOUR FROM THE SOIL MAP (#482e, src/soils.js). The units measured on
 * 16 Nov. 2026 read into their kind; a Zone of bare earth takes the colour of the soil most of it stands on (its
 * texture's kind kept for the « Realistic » level); other Zones untouched; the tint carried into the Scene.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soilKindOf, readSoils, applySoils, soilUnder, SOIL_KINDS } from '../src/soils.js';
import { zoneObject } from '../src/real-place-import.js';

test('the units measured: their kind (the description\'s words first, then the soil group)', () => {
  assert.equal(soilKindOf('CALCOSOL(56%)', 'Sols bruns calcaires limoneux profonds sur loess'), 'chalk');
  assert.equal(soilKindOf('CALCISOL(70%)', 'Haute terrasse forestière … de sables bartoniens : Luvisols Typiques'), 'sand');
  assert.equal(soilKindOf('FLUVIOSOL(49%)', 'Basses plaines alluviales des rivières roussillonnaises'), 'alluvial');
  assert.equal(soilKindOf('NEOLUVISOL(71%)', 'Plateaux limono-argileux à argilo-limoneux, épais'), 'loam');
  assert.equal(soilKindOf('REDUCTISOL(40%)', 'Vallées … hydromorphes, à nappe profonde'), 'wet');
  assert.equal(soilKindOf('BRUNISOL(30%)', 'Sols des collines du bassin de Loudeac issus de schistes tendres'), 'brown');
  assert.equal(soilKindOf('ANDOSOL(65%)', 'Plateaux inclinés des coulées … sur basalte-trachyandésite'), 'volcanic');
  assert.equal(soilKindOf('FERSIALSOL(60%)', ''), 'red');
  assert.equal(soilKindOf('RENDOSOL', 'sols caillouteux sur calcaire'), 'stony');
  assert.equal(soilKindOf('', ''), null);
  for (const k of Object.values(SOIL_KINDS)) assert.match(k.colour, /^#[0-9a-f]{6}$/);
});

const centre = { lat: 48.25, lon: 1.7 };
const k = 1 / 111320, kx = 1 / (111320 * Math.cos(centre.lat * Math.PI / 180));
const unit = (ger, nom, x0, z0, w, d) => ({ properties: { ger_nom: ger, nom_ucs: nom }, geometry: { type: 'MultiPolygon',
  coordinates: [[[[x0, z0], [x0 + w, z0], [x0 + w, z0 + d], [x0, z0 + d], [x0, z0]].map(([x, z]) => [centre.lon + x * kx, centre.lat - z * k])]] } });
const zoneOver = (x0, z0, nx, nz, terrainType = 'terre') => ({ terrainType,
  world: { masque: { pas: 2, x0, z0, nx, nz, plein: '1'.repeat(nx * nz) } } });

test('a Zone of bare earth takes the colour of the soil most of it stands on; others untouched', () => {
  const soils = readSoils({ features: [unit('NEOLUVISOL', 'limons', -100, -100, 100, 200), unit('CALCOSOL', 'calcaire', 0, -100, 100, 200)] }, centre);
  assert.equal(soils.length, 2);
  const field = zoneOver(-40, 0, 25, 10);            // x −40 to +10: mostly on the loam
  const lawn = zoneOver(-40, 0, 25, 10, 'gazon');
  const kinds = applySoils([field, lawn], soils);
  assert.equal(field.soil, 'loam');
  assert.equal(field.terrainColor, SOIL_KINDS.loam.colour);
  assert.equal(lawn.terrainColor, undefined);
  assert.deepEqual(kinds, ['loam']);
  assert.equal(soilUnder(zoneOver(500, 500, 2, 2).world, soils), null, 'off the map: nothing');
});

test('the tint goes into the Scene\'s Zone', () => {
  let n = 0;
  const o = zoneObject({ terrainType: 'terre', terrainColor: '#8a6a4a', world: zoneOver(0, 0, 1, 1).world }, { panelId: 'p', newId: () => `z${n++}` });
  assert.equal(o.terrainColor, '#8a6a4a');
  assert.equal(zoneObject({ terrainType: 'herbe', world: zoneOver(0, 0, 1, 1).world }, { panelId: 'p', newId: () => 'z' }).terrainColor, undefined);
});
