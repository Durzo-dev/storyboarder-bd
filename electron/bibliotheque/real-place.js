/**
 * real-place.js, the NETWORK of a Scene built from a real place (the main process): place search
 * (Nominatim), the OSM extract (Overpass, with mirrors), the altitudes (the requests planned by
 * src/real-place-sources.js) and the map tiles (OpenStreetMap). The decisions are in src/ (pure); here,
 * only the requests, identified by the application's User-Agent, as the services' usage policies ask.
 *
 * Every address is built here or checked against an allow-list: the renderer never makes this process
 * fetch an arbitrary address.
 */
'use strict';
const { net } = require('electron');
const { agent } = require('./store');
const sources = require('./store-sources');

const TIMEOUT_MS = 30000;
const OVERPASS_TIMEOUT_MS = 90000;

/**
 * The Overpass servers, in order (OSM wiki, « Public Overpass API instances », read 12 Nov. 2026): the two
 * public instances that ask no key and set no limit first (Private.coffee, formerly overpass.kumi.systems,
 * whose old address no longer answers; VK Maps), the main instance last: its page says it is overloaded
 * and asks to use the alternatives when possible.
 */
const OVERPASS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
/** The altitude services the renderer may ask for (src/real-place-sources.js). */
const ALTITUDE_HOSTS = /^https:\/\/(data\.geopf\.fr\/altimetrie\/|api\.open-meteo\.com\/v1\/elevation\?)/;

/**
 * One request. `onBytes(received)`: the answer is read as a stream and every chunk reported (a long answer
 * then shows that it is coming); the JSON is parsed at the end. The result carries `size` (bytes).
 */
/**
 * The import's requests under way, so « Cancel » stops them at once (abortImport): a request waited for
 * (Overpass, up to 90 s) made a cancel take as long (seen).
 */
const _enCours = new Set();
function abortImport(){
  for (const a of _enCours) { a.annule = true; a.abort(); }
  _enCours.clear();
  _importAnnule = true;
}
/** Set by abortImport, reset by the next import's first request (osm): the loops stop asking. */
let _importAnnule = false;

async function request(url, { method = 'GET', body = null, json = true, timeout = TIMEOUT_MS, headers = {}, onBytes = null, onController = null } = {}){
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  _enCours.add(abort);
  if (onController) onController(abort);
  try {
    const rep = await net.fetch(url, { method, body, signal: abort.signal,
      headers: { 'User-Agent': agent(), Accept: json ? 'application/json' : '*/*', ...headers } });
    if (!rep.ok) {
      // What the server says (its first words): a 400 tells which parameter it refuses.
      let why = '';
      try { why = (await rep.text()).replace(/\s+/g, ' ').slice(0, 200); } catch { /* nothing to read */ }
      console.warn(`[real-place] ${new URL(url).host}${new URL(url).pathname}: HTTP ${rep.status}${why ? ` (${why})` : ''}`);
      return { error: rep.status === 429 ? 'quota' : 'response', status: rep.status };
    }
    if (json && onBytes && rep.body) {
      const reader = rep.body.getReader(), chunks = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); size += value.length;
        onBytes(size);
      }
      const text = Buffer.concat(chunks.map(c => Buffer.from(c.buffer, c.byteOffset, c.length))).toString('utf8');
      try { return { json: JSON.parse(text), size }; } catch { return { error: 'response', size }; }
    }
    if (json) return { json: await rep.json() };
    return { bytes: new Uint8Array(await rep.arrayBuffer()) };
  } catch (e) {
    if (abort.annule) return { error: 'cancelled' };
    const late = abort.signal.aborted;
    console.warn(`[real-place] ${new URL(url).host}: ${late ? 'timeout' : `${e.name}: ${e.message}`}`);
    return { error: late ? 'timeout' : 'network' };
  } finally {
    _enCours.delete(abort);
    clearTimeout(timer);
  }
}

/** Places matching `query` (Nominatim): [{ name, lat, lon, country }]. One request per search. */
async function search(query, lang){
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return { places: [] };
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(q)}`
    + `&accept-language=${lang === 'en' ? 'en' : 'fr'}`;
  const r = await request(url);
  if (r.error) return r;
  const places = (Array.isArray(r.json) ? r.json : []).map(p => ({
    name: String(p.display_name || ''), lat: Number(p.lat), lon: Number(p.lon),
    country: p.address && typeof p.address.country_code === 'string' ? p.address.country_code : null,
  })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  return { places };
}

/**
 * SUGGESTIONS WHILE TYPING, from two services asked separately (the window merges them as they come):
 *   - 'ign': the IGN's completion service (Géoplateforme, no key), made for this, quick, France only: places,
 *     addresses, streets, towns;
 *   - 'photon': Photon (komoot's public server), the world, but slow or silent at times (seen: every request
 *     timing out), hence a short timeout.
 * Nominatim forbids auto-complete in its usage policy. The window waits for a pause in the typing and asks from
 * three letters; a newer suggestion from the same service aborts the one under way. Same shape as search.
 */
const SUGGESTION_SOURCES = {
  ign: { timeout: 4000, url: (q) => `https://data.geopf.fr/geocodage/completion?maximumResponses=6&text=${encodeURIComponent(q)}`, read: placesOfIgn },
  photon: { timeout: 3000, url: (q, lang) => `https://photon.komoot.io/api/?limit=6&lang=${lang}&q=${encodeURIComponent(q)}`, read: placesOfPhoton },
};
const _suggestionsEnCours = {};
async function suggest(query, lang, source = 'photon'){
  const q = String(query || '').trim().slice(0, 200);
  const src = SUGGESTION_SOURCES[source];
  if (q.length < 3 || !src) return { places: [] };
  if (_suggestionsEnCours[source]) { _suggestionsEnCours[source].annule = true; _suggestionsEnCours[source].abort(); }
  const started = Date.now();
  const r = await request(src.url(q, lang === 'en' ? 'en' : 'fr'), { timeout: src.timeout, onController: (c) => { _suggestionsEnCours[source] = c; } });
  // Every answer written to the log, as Overpass's are: a silent suggestion service looks like a broken field.
  if (r.error) { console.warn(`[real-place] ${source} "${q}": ${r.error}${r.status ? ` (HTTP ${r.status})` : ''} in ${Date.now() - started} ms`); return r; }
  const places = src.read(r.json);
  console.info(`[real-place] ${source} "${q}": ${places.length} places in ${Date.now() - started} ms`);
  return { places };
}
/** The IGN completion answer as places: its full text, lat, lon; France. */
function placesOfIgn(json){
  return ((json && Array.isArray(json.results)) ? json.results : []).map(p => ({
    name: String(p.fulltext || ''), lat: Number(p.y), lon: Number(p.x), country: 'fr',
  })).filter(p => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon));
}
/** Photon's GeoJSON answer as places: a readable name (name, street, town, region, country), lat, lon, country code. */
function placesOfPhoton(json){
  const seen = new Set();
  return ((json && Array.isArray(json.features)) ? json.features : []).map(f => {
    const p = f.properties || {}, c = f.geometry && f.geometry.coordinates;
    const street = p.street ? (p.housenumber ? `${p.housenumber} ${p.street}` : p.street) : null;
    const parts = [p.name, street, p.city || p.town || p.village, p.state, p.country].filter(Boolean);
    const name = [...new Set(parts)].join(', ');
    return { name, lat: Array.isArray(c) ? Number(c[1]) : NaN, lon: Array.isArray(c) ? Number(c[0]) : NaN,
      country: typeof p.countrycode === 'string' ? p.countrycode.toLowerCase() : null };
  }).filter(p => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon) && !seen.has(p.name) && seen.add(p.name));
}

/** The country (ISO code) of a point (Nominatim reverse, country level), or null. */
async function country(lat, lon){
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { country: null };
  const r = await request(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&lat=${lat}&lon=${lon}`);
  if (r.error) return r;
  const c = r.json && r.json.address && r.json.address.country_code;
  return { country: typeof c === 'string' ? c : null };
}

/** The Overpass query of a zone: what the translator reads (src/osm-scene.js), with geometry. */
function overpassQuery({ south, west, north, east }){
  const b = `(${south},${west},${north},${east})`;
  return `[out:json][timeout:60];(way["building"]${b};way["highway"]${b};way["barrier"]${b};way["waterway"]${b};`
    + `way["landuse"]${b};way["natural"]${b};way["leisure"]${b};way["amenity"~"^(parking|fountain)$"]${b};`
    + `node["natural"="tree"]${b};node["highway"="street_lamp"]${b};node["traffic_sign"]${b};node["highway"~"^(stop|give_way)$"]${b};`
    + `node["natural"="shrub"]${b};node["amenity"~"^(bench|fountain|waste_basket|shelter)$"]${b};node["barrier"="bollard"]${b};`
    + `node["highway"="bus_stop"]${b};node["shop"]${b};node["entrance"]${b};`
    + `node["amenity"~"^(restaurant|cafe|bar|pharmacy|bank|fast_food)$"]${b};);out geom;`;
}

const extracts = sources.memoireBornee(4, 40 * 1024 * 1024);
/** Bytes received are reported at most this often (the window redraws its line each time). */
const PROGRESS_EVERY_MS = 200;
/**
 * The OSM extract of a zone (bbox in degrees): the first Overpass server that answers. Cached.
 * `progress({ server, servers, bytes })`: the server being asked (1-based) and the bytes received from it.
 * Each attempt is written to the log (server, outcome, duration, size): where the time goes.
 */
async function osm(bbox, progress = null){
  const ok = bbox && ['south', 'west', 'north', 'east'].every(k => Number.isFinite(bbox[k]));
  if (!ok || bbox.north - bbox.south > 0.01 || bbox.east - bbox.west > 0.02) return { error: 'zone' };
  const key = JSON.stringify(bbox);
  const cached = extracts.get(key);
  if (cached) return { json: cached };
  _importAnnule = false;
  return overpassRace(bbox, key, progress);
}

/**
 * ⚠️ THE SERVERS RACE, STAGGERED (« hedged » requests). Asked one after the other, a silent server cost its
 * whole timeout before the next was asked (seen: 90 s, twice, on one import; probing them first with a tiny
 * query told nothing, all three silent at 6 s while one of them then answered in 37 s). The first server is
 * asked; if it has given nothing good after HEDGE_AFTER_MS, or as soon as it fails, the next one too, and so
 * on; the first complete answer wins and the others are stopped. Never more than one request per server.
 * A server that failed in this session is asked last (`_overpassFailures`).
 */
const HEDGE_AFTER_MS = 20000;
const _overpassFailures = new Map();
function overpassOrder(){
  return OVERPASS.map((url, i) => ({ url, i, f: _overpassFailures.get(url) || 0 })).sort((a, b) => (a.f - b.f) || (a.i - b.i)).map(x => x.url);
}
function overpassRace(bbox, key, progress){
  const order = overpassOrder();
  return new Promise((resolve) => {
    const failures = [], controllers = [];
    let started = 0, finished = 0, done = false, timer = null, told = 0, most = 0;
    const tell = (bytes) => { if (progress) progress({ server: started, servers: OVERPASS.length, bytes }); };
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      for (const c of controllers) { c.annule = true; c.abort(); }
      resolve(result);
    };
    const hedge = () => { clearTimeout(timer); if (started < order.length) timer = setTimeout(() => { launch(); hedge(); }, HEDGE_AFTER_MS); };
    function launch(){
      if (done || started >= order.length) return;
      const url = order[started++], host = new URL(url).host, t0 = Date.now();
      tell(most);
      request(url, { method: 'POST', body: `data=${encodeURIComponent(overpassQuery(bbox))}`, timeout: OVERPASS_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        onController: (c) => controllers.push(c),
        onBytes: (bytes) => { most = Math.max(most, bytes); const now = Date.now(); if (now - told >= PROGRESS_EVERY_MS) { told = now; tell(most); } } })
        .then((r) => {
          finished++;
          if (done) return;
          // ⚠️ AN OVERPASS ANSWER CAN BE « 200 OK » AND INCOMPLETE: a query that ran out of time or memory ends
          // with a `remark` (« runtime error: … ») after the elements it had. Taken, it would make a Scene with
          // holes; it is a failure.
          const remark = r.json && typeof r.json.remark === 'string' && /error/i.test(r.json.remark) ? r.json.remark : null;
          const good = r.json && Array.isArray(r.json.elements) && !remark;
          console.info(`[real-place] overpass ${host}: ${good ? 'ok' : (remark ? 'incomplete' : (r.error || 'response'))}${r.status ? ` (HTTP ${r.status})` : ''}`
            + ` in ${Date.now() - t0} ms, ${r.size || 0} bytes${remark ? ` (${remark.slice(0, 120)})` : ''}`);
          if (good) { extracts.set(key, r.json); tell(r.size || 0); finish({ json: r.json, server: host }); return; }
          if (r.error === 'cancelled' || _importAnnule) { finish({ error: 'cancelled' }); return; }
          _overpassFailures.set(url, (_overpassFailures.get(url) || 0) + 1);
          failures.push(remark ? 'incomplete' : (r.error || 'response'));
          if (started < order.length) { launch(); hedge(); }
          else if (finished === started) finish({ error: overpassFailure(failures) });
        });
    }
    launch();
    hedge();
  });
}

/**
 * What to tell when no Overpass server gave the extract: no connection at all ('network'), else the servers
 * are busy ('busy': too slow, refused, answered an error or half an answer), which is what it nearly always is.
 */
function overpassFailure(failures){
  return failures.length && failures.every(f => f === 'network') ? 'network' : 'busy';
}

/** The BD TOPO buildings of a zone (France): the IGN's WFS, no key. Only the properties building-survey.js reads. */
const BDTOPO_PROPERTIES = ['geometrie', 'hauteur', 'altitude_minimale_toit', 'altitude_maximale_toit', 'usage_1',
  'materiaux_des_murs', 'materiaux_de_la_toiture', 'construction_legere'];
function bdTopoUrl({ south, west, north, east }){
  return 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:batiment'
    + `&BBOX=${south},${west},${north},${east},urn:ogc:def:crs:EPSG::4326&COUNT=5000`
    + `&PROPERTYNAME=${BDTOPO_PROPERTIES.join(',')}&outputFormat=application/json`;
}
const surveys = sources.memoireBornee(4, 20 * 1024 * 1024);
/** The surveyed buildings of a zone (bbox in degrees, the same as osm's): the WFS answer, or { error }. Cached. */
async function bdtopo(bbox){
  const ok = bbox && ['south', 'west', 'north', 'east'].every(k => Number.isFinite(bbox[k]));
  if (!ok || bbox.north - bbox.south > 0.01 || bbox.east - bbox.west > 0.02) return { error: 'zone' };
  const key = JSON.stringify(bbox);
  const cached = surveys.get(key);
  if (cached) return { json: cached };
  const started = Date.now();
  const r = await request(bdTopoUrl(bbox));
  const good = r.json && Array.isArray(r.json.features);
  console.info(`[real-place] bdtopo: ${good ? `${r.json.features.length} buildings` : (r.error || 'response')} in ${Date.now() - started} ms`);
  if (!good) return r.error ? r : { error: 'response' };
  surveys.set(key, r.json);
  return { json: r.json };
}

/**
 * STREET PHOTOS (#474c): Panoramax's federated catalogue (no key; study: durzo-docs facades-photos.md). The
 * photos of a zone, reduced to what choosing one needs: place, bearing of its centre, field, the URL of its
 * standard picture (2 048 px wide), licence and instance (the credit; never the contributor's account, which
 * can be an e-mail address). Their picture hosts are remembered: streetPhoto only fetches from them.
 */
const PANORAMAX_SEARCH = 'https://api.panoramax.xyz/api/search';
const _photoHosts = new Set();
async function streetPhotos(bbox){
  const ok = bbox && ['south', 'west', 'north', 'east'].every(k => Number.isFinite(bbox[k]));
  if (!ok || bbox.north - bbox.south > 0.01 || bbox.east - bbox.west > 0.02) return { error: 'zone' };
  const started = Date.now();
  const r = await request(`${PANORAMAX_SEARCH}?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&limit=500`, { timeout: 20000 });
  if (r.error) { console.warn(`[real-place] panoramax: ${r.error} in ${Date.now() - started} ms`); return r; }
  const photos = [];
  for (const f of (r.json && Array.isArray(r.json.features)) ? r.json.features : []) {
    const p = f.properties || {}, c = f.geometry && f.geometry.coordinates;
    const sd = f.assets && f.assets.sd && f.assets.sd.href;
    const yaw = Number(p['view:azimuth'] ?? p['pers:yaw']);
    const fov = Number((p['pers:interior_orientation'] || {}).field_of_view);
    if (!Array.isArray(c) || typeof sd !== 'string' || !sd.startsWith('https://') || !Number.isFinite(yaw)) continue;
    const via = (f.links || []).find(l => l.rel === 'via');
    _photoHosts.add(new URL(sd).host);
    photos.push({ id: String(f.id), lon: Number(c[0]), lat: Number(c[1]), yaw, fov: Number.isFinite(fov) && fov > 0 ? fov : 360,
      url: sd, license: String(p.license || ''), instance: (via && via.instance_name) || new URL(sd).host, date: String(p.datetime || '') });
  }
  console.info(`[real-place] panoramax: ${photos.length} photos in ${Date.now() - started} ms`);
  return { photos };
}
/** A street photo's standard picture (JPEG bytes), from a host streetPhotos gave; or { error }. */
async function streetPhoto(url){
  let host = null;
  try { host = new URL(String(url)).host; } catch { /* not a URL */ }
  if (!host || !String(url).startsWith('https://') || !_photoHosts.has(host)) return { error: 'response' };
  const r = await request(url, { json: false, timeout: 20000 });
  return r.error ? r : { data: r.bytes };
}

/**
 * THE AERIAL PHOTO of a zone (src/aerial-photo.js plans it): the IGN's orthophoto, through the Géoplateforme's
 * WMS (no key, Licence Ouverte 2.0), as one JPEG. `bbox`: { south, west, north, east } (degrees); `width`,
 * `height`: pixels (2048 at most). Returns { data } or { error }.
 */
const AERIAL_WMS = 'https://data.geopf.fr/wms-r';
async function aerialPhoto(bbox, width, height){
  const n = (v) => Number(v);
  const b = bbox || {};
  if (![b.south, b.west, b.north, b.east].every(v => Number.isFinite(n(v))) || !(n(b.north) > n(b.south)) || !(n(b.east) > n(b.west))) return { error: 'response' };
  const w = Math.max(16, Math.min(2048, Math.round(n(width) || 0))), h = Math.max(16, Math.min(2048, Math.round(n(height) || 0)));
  // WMS 1.3.0 in EPSG:4326: the bounding box is latitude first.
  const url = `${AERIAL_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ORTHOIMAGERY.ORTHOPHOTOS&STYLES=&CRS=EPSG:4326`
    + `&BBOX=${n(b.south)},${n(b.west)},${n(b.north)},${n(b.east)}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/jpeg`;
  const started = Date.now();
  const r = await request(url, { json: false, timeout: 30000 });
  if (r.error) return r;
  // A WMS error comes back as XML with a 200: a photo begins with the JPEG mark.
  if (!r.bytes || r.bytes.length < 1000 || r.bytes[0] !== 0xFF || r.bytes[1] !== 0xD8) { console.warn('[real-place] aerial photo: not a JPEG'); return { error: 'response' }; }
  console.info(`[real-place] aerial photo: ${w}×${h} px, ${Math.round(r.bytes.length / 1024)} KB in ${Date.now() - started} ms`);
  return { data: r.bytes };
}

/**
 * THE HEIGHTS OF A ZONE (src/height-reading.js plans and reads them): the IGN's LiDAR HD MNH (the height above
 * the ground, 50 cm), from the Géoplateforme's WMS as raw floats (`image/x-bil;bits=32`, row by row from the
 * north), no key. `bbox`: degrees; `width`, `height`: cells (2048 at most). Returns { data } (the bytes) or
 * { error }.
 */
async function heightGrid(bbox, width, height){
  const n = (v) => Number(v);
  const b = bbox || {};
  if (![b.south, b.west, b.north, b.east].every(v => Number.isFinite(n(v))) || !(n(b.north) > n(b.south)) || !(n(b.east) > n(b.west))) return { error: 'response' };
  const w = Math.max(16, Math.min(2048, Math.round(n(width) || 0))), h = Math.max(16, Math.min(2048, Math.round(n(height) || 0)));
  const url = `${AERIAL_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=IGNF_LIDAR-HD_MNH_ELEVATION.ELEVATIONGRIDCOVERAGE.WGS84G&STYLES=&CRS=EPSG:4326`
    + `&BBOX=${n(b.south)},${n(b.west)},${n(b.north)},${n(b.east)}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/x-bil;bits=32`;
  const started = Date.now();
  const r = await request(url, { json: false, timeout: 30000 });
  if (r.error) return r;
  // Exactly one float per cell: anything else (an XML error with a 200) is no grid.
  if (!r.bytes || r.bytes.length !== w * h * 4) { console.warn('[real-place] heights: not a grid'); return { error: 'response' }; }
  console.info(`[real-place] heights (LiDAR HD): ${w}×${h} cells in ${Date.now() - started} ms`);
  return { data: r.bytes };
}

/**
 * The altitude requests planned by the renderer (planRelief): sent in order, `perSecond` at most, each
 * checked against ALTITUDE_HOSTS. Returns { answers } (one JSON per request) or { error }.
 */
async function altitudes(requests, perSecond = 1){
  if (!Array.isArray(requests) || !requests.length || requests.length > 50) return { error: 'response' };
  const gap = 1000 / Math.max(0.2, Math.min(10, Number(perSecond) || 1));
  const answers = [];
  for (let i = 0; i < requests.length; i++) {
    const q = requests[i];
    if (!q || typeof q.url !== 'string' || !ALTITUDE_HOSTS.test(q.url)) return { error: 'response' };
    if (i) await new Promise(ok => setTimeout(ok, gap));
    const r = q.method === 'POST'
      ? await request(q.url, { method: 'POST', body: JSON.stringify(q.body || {}), headers: { 'Content-Type': 'application/json' } })
      : await request(q.url);
    if (r.error) return r;
    answers.push(r.json);
  }
  return { answers };
}

const tiles = sources.memoireBornee(400, 30 * 1024 * 1024);
/** A map tile (OpenStreetMap standard layer), as PNG bytes. Cached for the session. */
async function tile(z, x, y){
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 19 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return { error: 'response' };
  const key = `${z}/${x}/${y}`;
  const cached = tiles.get(key);
  if (cached) return { data: cached };
  const r = await request(`https://tile.openstreetmap.org/${key}.png`, { json: false });
  if (r.error) return r;
  tiles.set(key, r.bytes);
  return { data: r.bytes };
}

module.exports = { search, suggest, abortImport, streetPhotos, streetPhoto, aerialPhoto, heightGrid, country, osm, bdtopo, bdTopoUrl, altitudes, tile, overpassQuery, ALTITUDE_HOSTS };
