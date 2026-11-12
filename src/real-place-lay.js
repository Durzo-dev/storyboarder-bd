/**
 * real-place-lay.js, LAYING a real place in a new Scene: the content assembled by real-place-import.js
 * (sceneContentOf) becomes the objects of the Scene's page, each one standing on the Ground at its place,
 * and the camera frames the whole zone from above.
 */
import { WALL_PX_PER_UNIT_3D, PANEL_CAM_DEFAULT_DIST_3D } from './constants.js';
import { creerElementBatiment } from './batiment-element.js';
import { setElementWorldPos3D, applyGroundMagnetY, groundMagnetEligible, tracéUpdateScreenPts } from './scene3d.js';

/** The zone fills the view but for this margin (10 %), so its edges stay visible. */
const FRAMING_MARGIN = 1.1;

/**
 * The camera distance at which a square of half-side `halfSize` (metres), seen from straight above, fits in
 * the view. The field of view is fixed by the page's height at the default distance (scene3d.js,
 * framePanelCamera3D): at that distance the view is page.h / 40 metres high; it grows with the distance.
 */
function topViewDistance(halfSize, view){
  const halfH = (view.h / WALL_PX_PER_UNIT_3D) / 2 / PANEL_CAM_DEFAULT_DIST_3D;
  const half = Math.min(halfH, halfH * view.w / view.h);
  return halfSize * FRAMING_MARGIN / half;
}

/**
 * Lays `content` in the new Scene `scene` (createScene, one page, one panel): relief and credits on the
 * panel, Paths and Zones, buildings and objects at their place. `newObject(panel, view, objType)` builds a
 * built-in object (events.js, the same as the "Add" menu). Returns { page, panel }.
 */
export function layRealPlace(scene, content, { halfSize, newObject }){
  const page = scene.pages[0], panel = page.objects.find(o => o.type === 'panel');
  // ⚠️ A SCENE'S PAGE HAS NO SIZE OF ITS OWN: the size is the Scene's, and the application reads it through
  // currentPage(). Given the bare page, every 2D frame was computed against an undefined height: NaN
  // everywhere, and not one building or object drawn (seen). The view below is what currentPage() gives.
  const view = { w: scene.w, h: scene.h, scale: scene.scale, format: scene.format, style3d: scene.style3d, objects: page.objects };
  if (content.relief) panel.relief = content.relief;
  if (content.ground) panel.groundType = content.ground;
  panel.creditsDuLieu = content.credits.slice();
  // ⚠️ THE DEPTH `o.z` STAYS 0. An Element's size is its 2D size seen at the depth `o.z`, a perspective made
  // for a few metres in front of the camera (30 m): put at the place's north-south position (up to ±200 m),
  // a building to the south shrank to nothing and one to the north grew out of scale. The position in the
  // world is `wxFloor`/`wzFloor`, which the rendering reads; the height comes from the Ground magnet, as
  // for an Element added by hand (ensureNewElementVisibleInPanel3D), then from the relief at render time.
  const place = (o, x, z) => {
    o.z = 0;
    setElementWorldPos3D(o, panel, x, 0);
    o.wxFloor = x; o.wzFloor = z;
    if (groundMagnetEligible(o) && o.magnetGround !== false) applyGroundMagnetY(o, panel);
    page.objects.push(o);
  };
  for (const t of content.traces) { t.panelId = panel.id; page.objects.push(t); tracéUpdateScreenPts(t, panel, view); }
  for (const b of content.buildings) place(creerElementBatiment({ panel, page: view, batiment: b.building }), b.x, b.z);
  for (const e of content.elements) place(newObject(panel, view, e.objType), e.x, e.z);
  // The whole zone in view, from above (createScene's camera), around its centre.
  panel.camDist = panel.camDistTarget = topViewDistance(halfSize, view);
  return { page, panel };
}
