/**
 * @file geo-local.js
 * Local metres around a geographic centre: the frame of a Scene built from a real place. PURE.
 */

const EARTH_RADIUS = 6371008.8;
const DEG = Math.PI / 180;

/**
 * Local metres around `centre` ({lat, lon}): an equirectangular projection, exact enough on 400 m (the
 * error grows with the square of the distance: well under a centimetre here). x to the east, z to the SOUTH
 * (north is up in the top view), as the Scene's frame.
 */
export function projector(centre){
  const kx = EARTH_RADIUS * DEG * Math.cos(centre.lat * DEG), kz = EARTH_RADIUS * DEG;
  return {
    toLocal: (p) => ({ x: (p.lon - centre.lon) * kx, z: -(p.lat - centre.lat) * kz }),
    toGeo: (q) => ({ lat: centre.lat - q.z / kz, lon: centre.lon + q.x / kx }),
  };
}
