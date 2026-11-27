/**
 * @file src/maps-link.js
 * PURE. #492: the Google Maps link of a Panel whose Scene came from a real place, opening the place as its camera
 * sees it, for the artist to look at the true place.
 *
 * A Scene made from a real place keeps it (`panel.lieu`: lat, lon of its centre); a Panel loading that Scene keeps it
 * too, with the shift its content took (`decalageX`, metres: loadSceneIntoPanel centres the content in X). The
 * camera: an orbit around its resolved centre (`_orbitCx/Cy/Cz`, written by framePanelCamera3D at each render: an
 * orbit target or a selected Element moves it off camWx/Wy/Wz; those are the fallback) at camDist, pitch camRotX (down), yaw camRotY (compass facing =
 * −camRotY), as scene3d.js places it (panelCamBasis3D).
 *
 * Two links: Street View (official `map_action=pano`: the nearest street photo, faithful at street level) for a
 * camera near the ground; for a camera up in the air, which no street photo shows, GOOGLE EARTH (web), which is
 * always in 3D: `earth.google.com/web/@lat,lon,{alt}a,{range}d,{fov}y,{heading}h,{tilt}t,0r`, an orbit camera like
 * ours (the point looked at, the distance to it, the heading, the tilt: 0 straight down, 90 level).
 * ⚠️ NOT GOOGLE MAPS from above (measured with Durzo): its 3D form takes its lat/lon as the camera (a tilted view
 * opened ~1.5 km off in his browser), and any browser without its 3D flattens it to a north-up map, so the camera's
 * heading is lost. Measured on Earth: `a` is the point's altitude ABOVE SEA LEVEL (the relief's `altitude`); Earth
 * keeps the camera and settles the point on its own 3D ground.
 */
import { projector } from './geo-local.js';
import { PANEL_CAM_DEFAULT_DIST_3D, WALL_PX_PER_UNIT_3D } from './constants.js';
import { hauteurDuRelief } from './terrain-relief.js';

/**
 * The browser window Google Maps fills, width over height. Its `fov` is the window's HORIZONTAL field: given the
 * Panel's own, a near-square Panel came out zoomed in (seen by Durzo, about one zoom step). The window's vertical
 * field is matched to the Panel's instead, so the Panel's height is what the window shows.
 */
export const MAPS_WINDOW_ASPECT = 16 / 9;
/** Up to this height (metres), the camera stands in a street: Street View; above, the satellite map. */
export const STREET_HEIGHT_MAX = 15;
const DEG = 180 / Math.PI;
const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Has this Panel a real place (its Scene came from one)? */
export function hasRealPlace(panel){
  const l = panel && panel.lieu;
  return !!(l && Number.isFinite(l.lat) && Number.isFinite(l.lon));
}

/** The centre the camera orbits, as the render resolved it, else the free orbit's (camWx/Wy/Wz). */
export function orbitCentreOf(panel){
  const resolved = ['_orbitCx', '_orbitCy', '_orbitCz'].every(k => Number.isFinite(panel[k]));
  return resolved ? { x: panel._orbitCx, y: panel._orbitCy, z: panel._orbitCz }
    : { x: Number(panel.camWx) || 0, y: Number(panel.camWy) || 0, z: Number(panel.camWz) || 0 };
}

/**
 * The Panel's view as a place: `{ lat, lon, height, heading, pitch, fov }` (height metres above the ground, heading
 * compass degrees, pitch degrees UP as Street View counts it, fov the window's horizontal field for the Panel's vertical one, MAPS_WINDOW_ASPECT), or null. `page`:
 * its page's size (`w`, `h`, in page pixels), which sets the field (framePanelCamera3D).
 */
export function viewOfPanel(panel, page){
  if (!hasRealPlace(panel)) return null;
  const p = Number(panel.camRotX) || 0, y = Number(panel.camRotY) || 0;
  const d = Number(panel.camDist) > 0 ? Number(panel.camDist) : PANEL_CAM_DEFAULT_DIST_3D;
  const c = orbitCentreOf(panel);
  const eye = {
    x: c.x + d * Math.cos(p) * Math.sin(y),
    y: c.y + d * Math.sin(p),
    z: c.z + d * Math.cos(p) * Math.cos(y),
  };
  const geo = projector(panel.lieu).toGeo({ x: eye.x + (Number(panel.lieu.decalageX) || 0), z: eye.z });
  const halfH = (page.h / WALL_PX_PER_UNIT_3D) / 2;
  const vfov = 2 * Math.atan(halfH / PANEL_CAM_DEFAULT_DIST_3D);
  // The Panel crops the Page's render (framePanelCamera3D): its field is the Page's, narrowed to its own size.
  const vfovCase = 2 * Math.atan(Math.tan(vfov / 2) * ((panel.h || page.h) / page.h));
  const hfov = 2 * Math.atan(Math.tan(vfovCase / 2) * MAPS_WINDOW_ASPECT);
  // The ground point at the centre of the view: the view's axis met with the ground under the eye. Looking level or
  // up, it never meets it: the orbit's centre stands in for it.
  const ground = panel.relief ? hauteurDuRelief(panel.relief, eye.x, eye.z) : 0;
  const f = { x: -Math.cos(p) * Math.sin(y), y: -Math.sin(p), z: -Math.cos(p) * Math.cos(y) };
  const t = f.y < -0.02 ? (eye.y - ground) / -f.y : null;
  const seen = t && t > 0 ? { x: eye.x + f.x * t, z: eye.z + f.z * t } : { x: c.x, z: c.z };
  const range = t && t > 0 ? t : d;
  const seenGeo = projector(panel.lieu).toGeo({ x: seen.x + (Number(panel.lieu.decalageX) || 0), z: seen.z });
  // Its altitude above sea level, as Earth counts it: the relief's base plus the ground (or the orbit's centre).
  const base = panel.relief && Number.isFinite(panel.relief.altitude) ? panel.relief.altitude : 0;
  const seenY = t && t > 0 ? (panel.relief ? hauteurDuRelief(panel.relief, seen.x, seen.z) : 0) : c.y;
  // The width of ground the Panel shows there: its own horizontal field (it crops the Page's render) at that range.
  const hfovCase = 2 * Math.atan(Math.tan(vfov / 2) * ((panel.w || page.w) / page.h));
  const width = 2 * range * Math.tan(hfovCase / 2);
  return {
    target: { lat: round(seenGeo.lat, 6), lon: round(seenGeo.lon, 6), width: round(width, 1), range: round(range, 1),
      altitude: round(base + seenY, 1) },
    lat: round(geo.lat, 6), lon: round(geo.lon, 6),
    // Above the ground under the eye (the relief, in the Panel's frame), as Google counts its `a` (measured).
    height: round(Math.max(1, eye.y - (panel.relief ? hauteurDuRelief(panel.relief, eye.x, eye.z) : 0)), 1),
    heading: round(((-y * DEG) % 360 + 360) % 360, 0), pitch: round(clamp(-p * DEG, -90, 90), 0),
    fov: round(clamp(hfov * DEG, 10, 120), 0), vfov: round(clamp(vfovCase * DEG, 10, 120), 0),
  };
}

/** Street View at the view's place, facing as it faces. */
export function streetViewLink(v){
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${v.lat},${v.lon}&heading=${v.heading}&pitch=${v.pitch}&fov=${v.fov}`;
}

/** Google Earth (web, always 3D), the camera orbiting the point the view looks at as the Panel's does. */
export function earthLink(v){
  const t = v.target;
  const tilt = clamp(90 + v.pitch, 0, 90);
  return `https://earth.google.com/web/@${t.lat},${t.lon},${t.altitude}a,${t.range}d,${v.fov}y,${v.heading}h,${tilt}t,0r`;
}

/** The link that fits the view: Street View in a street, Google Earth from above. */
export const mapsLinkOf = (v) => (v.height <= STREET_HEIGHT_MAX ? streetViewLink(v) : earthLink(v));
