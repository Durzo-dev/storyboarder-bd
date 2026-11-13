/**
 * @file aerial-photo.js
 * THE AERIAL PHOTO OF A ZONE (France), a source to READ at the import, never shown: the IGN's orthophoto, from
 * which the real nature of the grounds, the trees OpenStreetMap lacks and the roofs' colours are read
 * (#477f). Fetched, read in memory and dropped: no file is kept. Which photo to ask (the zone in degrees, its
 * size in pixels) and its credit. PURE: the request is the main process's (electron/bibliotheque/
 * real-place.js aerialPhoto).
 */

/** The ground resolution asked (metres per pixel): the orthophoto is about 0.2 m; 0.25 keeps a 400 m zone at 1600 px. */
export const METRES_PER_PIXEL = 0.25;
/** The largest side asked (pixels). */
export const MAX_PIXELS = 2048;
/** The credit of the IGN's orthophoto (Licence Ouverte Etalab 2.0), for what is read from it. */
export const AERIAL_CREDIT = Object.freeze({ en: 'Aerial photo: © IGN, BD ORTHO® (Licence Ouverte 2.0)', fr: 'Vue aérienne : © IGN, BD ORTHO® (Licence Ouverte 2.0)' });

/**
 * The photo to ask for a zone, or null when there is none (outside France: the IGN covers France). `toGeo`:
 * the zone's projector (geo-local.js), local metres → { lat, lon }; `halfSize`: half its side (metres).
 * Returns { bbox: { south, west, north, east }, width, height }: the photo's top is the north, its pixel
 * (u, v) the local point (-halfSize + u · side / width, -halfSize + v · side / height).
 */
export function aerialPhotoPlan({ toGeo, halfSize, country }){
  if (country !== 'fr' || !(halfSize > 0) || typeof toGeo !== 'function') return null;
  const nw = toGeo({ x: -halfSize, z: -halfSize }), se = toGeo({ x: halfSize, z: halfSize });
  const side = Math.min(MAX_PIXELS, Math.max(256, Math.round(2 * halfSize / METRES_PER_PIXEL)));
  return { bbox: { south: se.lat, west: nw.lon, north: nw.lat, east: se.lon }, width: side, height: side };
}
