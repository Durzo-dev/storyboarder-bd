/**
 * @file real-place-sources.js
 * The SOURCES of a real place, per country, with a world fallback: who gives the relief, and which
 * default values fill what OpenStreetMap leaves out (level height, levels and roof per building type).
 * PURE: the requests are described here, sent by the main process (the import), answered here.
 *
 * One OSM translator for every country (osm-scene.js); only the providers and the tables change. France
 * first; a country is added by an entry in COUNTRIES (its relief providers, best first, and its rules).
 */

import { projector } from './geo-local.js';

/** The building rules of France: a level of 2.8 m (the building editor's default), gabled roofs. */
const FRENCH_RULES = Object.freeze({
  levelHeight: 2.8,
  levels: Object.freeze({ house: 2, detached: 2, semidetached_house: 2, terrace: 2, residential: 3, apartments: 4, hotel: 4,
    commercial: 2, retail: 1, office: 4, industrial: 1, warehouse: 1, garage: 1, garages: 1, shed: 1, hut: 1,
    church: 3, chapel: 2, school: 2, government: 3, public: 2, farm_auxiliary: 1, barn: 1, default: 2 }),
  flatRoofs: Object.freeze(['commercial', 'retail', 'office', 'industrial', 'warehouse', 'garage', 'garages', 'school', 'government', 'public', 'supermarket']),
  roofPitch: 35,
});

/** The world's rules, when the country has none: a 3 m level, gentler pitches. */
const WORLD_RULES = Object.freeze({ ...FRENCH_RULES, levelHeight: 3, roofPitch: 30 });

/**
 * The relief providers. `request(points)` → { url, method?, body? } (GET unless `method: 'POST'`, then `body`
 * is sent as JSON); `parse(json, n)` → n altitudes in metres, null
 * where the provider has no data. `maxPoints` per request, `perSecond` requests at most.
 */
const PROVIDERS = Object.freeze({
  // France: the IGN Géoplateforme altimetry service, RGE ALTI (1 m). No key; 5 requests per second per
  // address; 5,000 points per request; -99999 outside its coverage.
  ign: Object.freeze({
    id: 'ign', name: 'IGN RGE ALTI®', attribution: '© IGN, RGE ALTI®', maxPoints: 5000, perSecond: 5, metres: 1,
    // POST: 5,000 points would make a GET address of about 100 kB, which servers refuse.
    request: (points) => ({ url: 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json', method: 'POST',
      body: { lon: points.map(p => p.lon.toFixed(7)).join('|'), lat: points.map(p => p.lat.toFixed(7)).join('|'),
        resource: 'ign_rge_alti_wld', delimiter: '|', zonly: 'true' } }),
    parse: (json, n) => readAltitudes(json && json.elevations, n, (v) => v <= -9999),
  }),
  // The world: Open-Meteo's elevation API, Copernicus DEM GLO-90 (90 m). Its batch size and its terms of
  // free use are to be checked against the service by the import.
  openMeteo: Object.freeze({
    id: 'openMeteo', name: 'Copernicus DEM GLO-90 (Open-Meteo)', attribution: 'Copernicus DEM GLO-90, via Open-Meteo',
    maxPoints: 100, perSecond: 1, metres: 90,
    request: (points) => ({ url: 'https://api.open-meteo.com/v1/elevation?'
      + `latitude=${points.map(p => p.lat.toFixed(6)).join(',')}&longitude=${points.map(p => p.lon.toFixed(6)).join(',')}` }),
    parse: (json, n) => readAltitudes(json && json.elevation, n, () => false),
  }),
});

function readAltitudes(list, n, noData){
  if (!Array.isArray(list) || list.length !== n) return null;
  return list.map(v => (typeof v === 'number' && Number.isFinite(v) && !noData(v) ? v : null));
}

/** The countries with their own sources (ISO 3166-1 alpha-2, lower case). The rest takes `world`. */
const COUNTRIES = Object.freeze({
  fr: Object.freeze({ relief: ['ign', 'openMeteo'], rules: FRENCH_RULES }),
  world: Object.freeze({ relief: ['openMeteo'], rules: WORLD_RULES }),
});

const countryOf = (code) => COUNTRIES[String(code || '').toLowerCase()] || COUNTRIES.world;

/** The building rules of a country (`fr`…); the world's when it has none. */
export function rulesFor(countryCode){
  return countryOf(countryCode).rules;
}

/**
 * THE RELIEF OF A ZONE, planned: the zone (`centre`, `halfSize` metres) sampled every `step` metres (no
 * finer than half the provider's resolution), the
 * requests of the best provider of the country (`providerIndex` 0; the next ones are fallbacks), and
 * `assemble(answers)` which turns the providers' answers (one JSON per request, in order) into altitudes
 * on a 1 m grid, ready for the relief: `{ x0, z0, nx, nz, altitudes, provider, missing }`, or null if a
 * request's answer is unreadable (the import then tries the next provider). `missing`: the share of
 * samples without data (outside the provider's coverage).
 */
export function planRelief({ centre, halfSize, country, step = 5, providerIndex = 0 }){
  const ids = countryOf(country).relief;
  const provider = PROVIDERS[ids[providerIndex]];
  if (!provider) return null;
  // No finer than half the provider's resolution: a 90 m model sampled every 5 m would cost 66 requests
  // for nothing finer.
  step = Math.max(step, provider.metres / 2);
  const h = Math.max(step, Math.ceil(halfSize / step) * step);
  const n = Math.round((2 * h) / step) + 1;
  const { toGeo } = projector(centre);
  const points = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) points.push(toGeo({ x: -h + i * step, z: -h + j * step }));
  const requests = [];
  for (let k = 0; k < points.length; k += provider.maxPoints) requests.push({ ...provider.request(points.slice(k, k + provider.maxPoints)), count: Math.min(provider.maxPoints, points.length - k) });
  return {
    provider: { id: provider.id, name: provider.name, attribution: provider.attribution, perSecond: provider.perSecond },
    fallbacks: ids.length - providerIndex - 1,
    requests,
    assemble(answers){
      if (!Array.isArray(answers) || answers.length !== requests.length) return null;
      const samples = [];
      for (let r = 0; r < requests.length; r++) {
        const values = provider.parse(answers[r], requests[r].count);
        if (!values) return null;
        samples.push(...values);
      }
      return resampleToMetre(samples, n, step, h, Math.min(200, Math.round(halfSize)), provider.id);
    },
  };
}

/**
 * Samples every `step` metres (n × n, row by row in z, from −h) to a 1 m grid over the zone (−out to +out,
 * at most 401 points of side, the relief's largest), by bilinear interpolation. A sample without data takes
 * the mean of the others (a hole would otherwise be a pit to sea level).
 */
function resampleToMetre(samples, n, step, h, out, providerId){
  const known = samples.filter(v => v !== null);
  if (!known.length) return null;
  const mean = known.reduce((a, b) => a + b, 0) / known.length;
  const s = samples.map(v => (v === null ? mean : v));
  const side = 2 * out + 1;
  const altitudes = new Array(side * side);
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
    const fx = (i - out + h) / step, fz = (j - out + h) / step;
    const i0 = Math.min(n - 2, Math.floor(fx)), j0 = Math.min(n - 2, Math.floor(fz));
    const tx = fx - i0, tz = fz - j0;
    const a = s[j0 * n + i0], b = s[j0 * n + i0 + 1], c = s[(j0 + 1) * n + i0], d = s[(j0 + 1) * n + i0 + 1];
    altitudes[j * side + i] = Math.round(((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz) * 100) / 100;
  }
  return { x0: -out, z0: -out, nx: side, nz: side, altitudes, provider: providerId, missing: (samples.length - known.length) / samples.length };
}
