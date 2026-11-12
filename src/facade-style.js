/**
 * @file facade-style.js
 * THE FACADE OF A REAL PLACE'S BUILDING, at the « Realistic » level of detail (osm-scene.js): what a street of
 * the region usually shows, since no source surveys facades. Inspired, not surveyed:
 *   - shutters on the windows of a house or a small block (four levels or fewer), not on the tall blocks of a
 *     city centre, nor on a church, a shop, a shed or an industrial building;
 *   - a stone surround on the windows and doors of a dwelling;
 *   - shop windows on the ground floor's street side of a building holding a shop;
 *   - the colours by region: Alsace (pink sandstone, painted shutters), the South (pale stone, pastel
 *     shutters), elsewhere (light stone, grey, green or white shutters). A building's colour is drawn from
 *     its region's palette by its id, so the same place is drawn the same at every import. PURE.
 */

/** Building types that wear no shutters (OSM `building`, or what buildingTypeOf gives a surveyed one). */
const WITHOUT_SHUTTERS = ['church', 'chapel', 'cathedral', 'commercial', 'retail', 'industrial', 'warehouse', 'shed',
  'garage', 'garages', 'farm_auxiliary', 'barn', 'office', 'supermarket', 'school', 'government', 'public', 'hut', 'roof'];
/** Building types that are dwellings (a surround on their openings). `yes`: most of a town's buildings. */
const DWELLINGS = ['house', 'detached', 'semidetached_house', 'terrace', 'apartments', 'residential', 'yes', 'farm', 'hotel'];

const REGIONS = {
  alsace: { shutters: ['#3f6b4a', '#8a3b2e', '#3d5f7a', '#6b7f3a', '#c8a24a'], surround: '#b9877a' },
  south: { shutters: ['#7fa2b5', '#8fae8c', '#c9b48a', '#a8c3c9', '#6f8fa6'], surround: '#e8dcc4' },
  north: { shutters: ['#5d6b73', '#6f7f5a', '#e9e6df', '#7a8c99', '#4f5d66'], surround: '#e3ddd0' },
};

/** The region of a point (WGS 84): rough boxes, enough for a palette. */
export function regionOf(lat, lon){
  if (lat > 47.4 && lat < 49.1 && lon > 6.8 && lon < 8.3) return 'alsace';
  if (lat < 46) return 'south';
  return 'north';
}

/** A number from a string or a number, the same every time (FNV-1a). */
function hash(seed){
  let h = 0x811c9dc5;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/**
 * The facade of one building: { shutters, shutterColour, surround, shopWindows }. `type`: its OSM `building`
 * value; `levels`: its number of levels; `lat`, `lon`: where it stands; `seed`: its id (OSM or survey);
 * `shop`: does it hold a shop (an OSM shop inside its footprint, or a commercial use).
 */
export function facadeStyleOf({ type = 'yes', levels = 1, lat = 46, lon = 2, seed = 0, shop = false } = {}){
  const region = REGIONS[regionOf(lat, lon)];
  const shutters = !WITHOUT_SHUTTERS.includes(type) && levels <= 4;
  return {
    shutters,
    shutterColour: shutters ? region.shutters[hash(seed) % region.shutters.length] : null,
    surround: DWELLINGS.includes(type) ? region.surround : null,
    shopWindows: !!shop,
  };
}
