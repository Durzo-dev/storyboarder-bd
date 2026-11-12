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
async function request(url, { method = 'GET', body = null, json = true, timeout = TIMEOUT_MS, headers = {}, onBytes = null } = {}){
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  try {
    const rep = await net.fetch(url, { method, body, signal: abort.signal,
      headers: { 'User-Agent': agent(), Accept: json ? 'application/json' : '*/*', ...headers } });
    if (!rep.ok) {
      console.warn(`[real-place] ${new URL(url).host}: HTTP ${rep.status}`);
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
    const late = abort.signal.aborted;
    console.warn(`[real-place] ${new URL(url).host}: ${late ? 'timeout' : `${e.name}: ${e.message}`}`);
    return { error: late ? 'timeout' : 'network' };
  } finally {
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
    + `way["landuse"]${b};way["natural"]${b};way["leisure"]${b};way["amenity"="parking"]${b};`
    + `node["natural"="tree"]${b};node["highway"="street_lamp"]${b};node["traffic_sign"]${b};node["highway"~"^(stop|give_way)$"]${b};`
    + `node["natural"="shrub"]${b};);out geom;`;
}

const extracts = sources.memoireBornee(4, 40 * 1024 * 1024);
/**
 * The server that last gave an extract, asked first next time (seen: the first of the list silent for 90 s,
 * the second answering in 18 s; every import after that waited the 90 s again).
 */
let lastGood = null;
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
  const failures = [];
  const order = lastGood ? [lastGood, ...OVERPASS.filter(u => u !== lastGood)] : OVERPASS;
  for (let k = 0; k < order.length; k++) {
    const url = order[k], host = new URL(url).host, started = Date.now();
    const tell = (bytes) => { if (progress) progress({ server: k + 1, servers: OVERPASS.length, bytes }); };
    let told = 0;
    tell(0);
    const r = await request(url, { method: 'POST', body: `data=${encodeURIComponent(overpassQuery(bbox))}`, timeout: OVERPASS_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      onBytes: (bytes) => { const now = Date.now(); if (now - told >= PROGRESS_EVERY_MS) { told = now; tell(bytes); } } });
    // ⚠️ AN OVERPASS ANSWER CAN BE « 200 OK » AND INCOMPLETE: a query that ran out of time or memory ends with
    // a `remark` (« runtime error: … ») after the elements it had. Taken, it would make a Scene with
    // holes; it is a failure, and the next server is asked.
    const remark = r.json && typeof r.json.remark === 'string' && /error/i.test(r.json.remark) ? r.json.remark : null;
    const good = r.json && Array.isArray(r.json.elements) && !remark;
    console.info(`[real-place] overpass ${host}: ${good ? 'ok' : (remark ? 'incomplete' : (r.error || 'response'))}${r.status ? ` (HTTP ${r.status})` : ''}`
      + ` in ${Date.now() - started} ms, ${r.size || 0} bytes${remark ? ` (${remark.slice(0, 120)})` : ''}`);
    if (good) { tell(r.size || 0); extracts.set(key, r.json); lastGood = url; return { json: r.json, server: host }; }
    failures.push(remark ? 'incomplete' : (r.error || 'response'));
  }
  return { error: overpassFailure(failures) };
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

module.exports = { search, country, osm, bdtopo, bdTopoUrl, altitudes, tile, overpassQuery, ALTITUDE_HOSTS };
