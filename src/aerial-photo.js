/**
 * @file aerial-photo.js
 * THE AERIAL PHOTO ON THE GROUND (« Realistic » level, France): the IGN's orthophoto of the zone, laid as a
 * Zone that covers it whole, so that squares, courtyards and parks show what they really are. Which photo to
 * ask (the zone in degrees, its size in pixels), which of the import's Zones it replaces, and the Zone that
 * carries it. PURE: the request is the main process's (electron/bibliotheque/real-place.js aerialPhoto), the
 * file the image store's (image-store.js), the drawing scene3d.js's.
 */

/** The ground resolution asked (metres per pixel): the orthophoto is about 0.2 m; 0.25 keeps a 400 m zone at 1600 px. */
export const METRES_PER_PIXEL = 0.25;
/** The largest side asked (pixels): a texture every graphics card takes. */
export const MAX_PIXELS = 2048;
/** The credit of the IGN's orthophoto (Licence Ouverte Etalab 2.0). */
export const AERIAL_CREDIT = Object.freeze({ en: 'Aerial photo: © IGN, BD ORTHO® (Licence Ouverte 2.0)', fr: 'Vue aérienne : © IGN, BD ORTHO® (Licence Ouverte 2.0)' });
/**
 * THE ZONES THE PHOTO REPLACES: grounds it shows better (a square's paving, a park's lawns and paths).
 * Water stays a Zone: it is drawn as water, which a photo is not.
 */
export const REPLACED_GROUNDS = Object.freeze(['béton', 'bitume', 'herbe', 'gazon', 'terre', 'sable', 'gravier']);

/**
 * The photo to ask for a zone, or null when there is none (outside France: the IGN covers France). `toGeo`:
 * the zone's projector (geo-local.js), local metres → { lat, lon }; `halfSize`: half its side (metres).
 * Returns { bbox: { south, west, north, east }, width, height }.
 */
export function aerialPhotoPlan({ toGeo, halfSize, country }){
  if (country !== 'fr' || !(halfSize > 0) || typeof toGeo !== 'function') return null;
  const nw = toGeo({ x: -halfSize, z: -halfSize }), se = toGeo({ x: halfSize, z: halfSize });
  const side = Math.min(MAX_PIXELS, Math.max(256, Math.round(2 * halfSize / METRES_PER_PIXEL)));
  return { bbox: { south: se.lat, west: nw.lon, north: nw.lat, east: se.lon }, width: side, height: side };
}

/** The import's Zones without those the photo replaces (`zones`: translateOsm's). */
export function zonesKeptUnderPhoto(zones){
  return (zones || []).filter(z => !REPLACED_GROUNDS.includes(z.terrainType));
}

/**
 * The Zone that carries the photo, in translateOsm's shape (sceneContentOf makes it a Zone object): a
 * rectangle over the whole zone, north up (the photo's top), the photo's file in `photoAerienne`. Its ground
 * (`béton`) is what is drawn while the photo loads, or when its file is missing.
 */
export function aerialPhotoZone({ halfSize, image, name }){
  const h = halfSize;
  return {
    name, terrainType: 'béton', photoAerienne: image,
    world: { cx: 0, cz: 0, w: 2 * h, h: 2 * h, rotY: 0,
      corners: [{ x: -h, z: -h }, { x: h, z: -h }, { x: h, z: h }, { x: -h, z: h }] },
  };
}
