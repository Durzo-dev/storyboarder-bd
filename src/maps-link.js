/**
 * @file src/maps-link.js
 * PURE. #492: the Google Maps link of a Panel whose Scene came from a real place, opening the place as its camera
 * sees it, for the artist to look at the true place.
 *
 * A Scene made from a real place keeps it (`panel.lieu`: lat, lon of its centre); a Panel loading that Scene keeps it
 * too, with the shift its content took (`decalageX`, metres: loadSceneIntoPanel centres the content in X). The
 * camera: an orbit around (camWx, camWy, camWz) at camDist, pitch camRotX (down), yaw camRotY (compass facing =
 * −camRotY), as scene3d.js places it (panelCamBasis3D).
 *
 * Two links: Street View (`map_action=pano`: the nearest street photo, faithful at street level) for a camera near
 * the ground; Google's 3D view (`@lat,lon,{alt}a,{fov}y,{heading}h,{tilt}t`, an unofficial but stable form) for a
 * camera up in the air, which no street photo shows.
 */
import { projector } from './geo-local.js';
import { PANEL_CAM_DEFAULT_DIST_3D, WALL_PX_PER_UNIT_3D } from './constants.js';

/** Up to this height (metres), the camera stands in a street: Street View; above, the 3D view. */
export const STREET_HEIGHT_MAX = 15;
const DEG = 180 / Math.PI;
const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Has this Panel a real place (its Scene came from one)? */
export function hasRealPlace(panel){
  const l = panel && panel.lieu;
  return !!(l && Number.isFinite(l.lat) && Number.isFinite(l.lon));
}

/**
 * The Panel's view as a place: `{ lat, lon, height, heading, pitch, fov }` (height metres above the ground, heading
 * compass degrees, pitch degrees UP as Street View counts it, fov the Panel's horizontal field), or null. `page`:
 * its page's size (`w`, `h`, in page pixels), which sets the field (framePanelCamera3D).
 */
export function viewOfPanel(panel, page){
  if (!hasRealPlace(panel)) return null;
  const p = Number(panel.camRotX) || 0, y = Number(panel.camRotY) || 0;
  const d = Number(panel.camDist) > 0 ? Number(panel.camDist) : PANEL_CAM_DEFAULT_DIST_3D;
  const eye = {
    x: (Number(panel.camWx) || 0) + d * Math.cos(p) * Math.sin(y),
    y: (Number(panel.camWy) || 0) + d * Math.sin(p),
    z: (Number(panel.camWz) || 0) + d * Math.cos(p) * Math.cos(y),
  };
  const geo = projector(panel.lieu).toGeo({ x: eye.x + (Number(panel.lieu.decalageX) || 0), z: eye.z });
  const halfH = (page.h / WALL_PX_PER_UNIT_3D) / 2;
  const vfov = 2 * Math.atan(halfH / PANEL_CAM_DEFAULT_DIST_3D);
  // The Panel crops the Page's render (framePanelCamera3D): its field is the Page's, narrowed to its own size.
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * ((panel.w || page.w) / page.h));
  const vfovCase = 2 * Math.atan(Math.tan(vfov / 2) * ((panel.h || page.h) / page.h));
  return {
    lat: round(geo.lat, 6), lon: round(geo.lon, 6), height: round(Math.max(1, eye.y), 1),
    heading: round(((-y * DEG) % 360 + 360) % 360, 0), pitch: round(clamp(-p * DEG, -90, 90), 0),
    fov: round(clamp(hfov * DEG, 10, 120), 0), vfov: round(clamp(vfovCase * DEG, 10, 120), 0),
  };
}

/** Street View at the view's place, facing as it faces. */
export function streetViewLink(v){
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${v.lat},${v.lon}&heading=${v.heading}&pitch=${v.pitch}&fov=${v.fov}`;
}

/** Google's 3D view from the view's place and height (tilt: 0 straight down, 90 to the horizon). */
export function view3dLink(v){
  const tilt = clamp(90 + v.pitch, 0, 90);
  return `https://www.google.com/maps/@${v.lat},${v.lon},${v.height}a,${v.vfov}y,${v.heading}h,${tilt}t/data=!3m1!1e3`;
}

/** The link that fits the view: Street View in a street, the 3D view from above. */
export const mapsLinkOf = (v) => (v.height <= STREET_HEIGHT_MAX ? streetViewLink(v) : view3dLink(v));
