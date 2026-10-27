/**
 * @file canvas-tools.js
 * The tools that take over the canvas: Tracé, Measure (the Build tool was removed by #454f).
 *
 * What they have in common, and what makes them one module rather than several: each owns a state
 * object in `S` (`S.traceTool`, `S.measureTool`), each takes over the cursor while
 * active, and each is mutually exclusive with the others. Starting one is the same gesture every
 * time, the click then means something different until the tool is stopped.
 *
 * WHERE THEY COME FROM. The section of events.js banner-headed "BUILD A BUILDING TOOL". That banner
 * lied, for the third time in this repository: under it sat the Build tool, the Tracé tool, the
 * Measure tool, three keyboard-navigation helpers and the wiring of the Undo button, five subjects.
 * Only the three tools moved here; a banner is a comment, not a map.
 *
 * NOT HERE, on purpose:
 *   — the DRAWING of the previews (drawTracé…) which lives in draw.js;
 *   — the mouse handlers that feed the tools, which stay in the event layer.
 *
 * The canvas element is looked up when needed rather than held in a module-level `const`. An
 * imported module is evaluated BEFORE the module that imports it (cf. docs/en/architecture.md rule
 * #2): a top-level `getElementById` here would run earlier than the one in events.js, and would
 * silently bind to whatever the DOM held at that instant.
 */

import { TRACÉ_DEFAULTS } from './constants.js';
import { S, currentPage, newId, tr } from './state.js';
import { tracéBBox } from './utils.js';
import { computeTracéWorld3D } from './scene3d.js';
import { drawCurrentPage } from './draw.js';

// The undo stack, injected rather than imported (cf. docs/en/architecture.md rule #2).
let _snapshot = () => {};
export function setCanvasToolsCallbacks({ snapshot }) { _snapshot = snapshot; }

// Cursor shown while a tool is active. Set through a helper so the three tools cannot drift apart
// on this detail, and so a missing #board never throws mid-gesture.
function setCanvasCursor(valeur){
  const canvas = document.getElementById('board');
  if (canvas) canvas.style.cursor = valeur;
}

// #454f : L'OUTIL « CONSTRUIRE UN BÂTIMENT » A ÉTÉ RETIRÉ (demandé : la construction se fait dans
// l'éditeur de bâtiment). Avec lui : startBuildMode, screenToWorldFloor, buildApplyAngleSnap et
// buildApplyAlignSnap, qui ne servaient qu'à lui.

// ════════════════════════════════════════════════════════════
// TRACÉ tool, roads, paths, low walls, hedges, fences, terrain zones
// ════════════════════════════════════════════════════════════

// Display names, kept next to the only place that assigns them. French because they are shown to
// the user and stored in the project file.
const TRACÉ_NAMES = {
  route: 'Route', chemin: 'Chemin de terre', muret: 'Muret',
  cloture: 'Clôture', haie: 'Haie végétale', barriere: 'Barrière de route',
};

/** Activates the Tracé tool of the given type on `panel`. Any tracé in progress is dropped. */
export function startTraceTool(panel, type){
  stopTraceTool(false);
  const def = TRACÉ_DEFAULTS[type] || {};
  if (type === 'terrain') {
    S.traceTool = { type, panelId: panel.id, startX: 0, startY: 0, endX: 0, endY: 0, drawing: false, terrainType: 'herbe' };
  } else {
    S.traceTool = { type, panelId: panel.id, pts: [], preview: null, color: def.color, width: def.width };
  }
  setCanvasCursor('crosshair');
}

/**
 * Stops the Tracé tool. `save === true` turns what was drawn into an Element; anything else drops
 * it. Both paths clear the tool and the cursor, a tool that stops halfway leaves the canvas in a
 * mode the user cannot get out of.
 */
export function stopTraceTool(save){
  if (!S.traceTool) return;
  if (save) {
    const page = currentPage();
    const panel = page.objects.find(o => o.id === S.traceTool.panelId);
    if (panel) {
      _snapshot();
      if (S.traceTool.type === 'terrain') {
        const rx = Math.min(S.traceTool.startX, S.traceTool.endX);
        const ry = Math.min(S.traceTool.startY, S.traceTool.endY);
        const rw = Math.abs(S.traceTool.endX - S.traceTool.startX);
        const rh = Math.abs(S.traceTool.endY - S.traceTool.startY);
        // Below ~4 px the zone is a slip of the mouse, not an intention.
        if (rw > 4 && rh > 4) {
          const obj = { id: newId(), type: 'tracé', tracéType: 'terrain',
            name: 'Terrain', panelId: panel.id, x: rx, y: ry, w: rw, h: rh,
            terrainType: 'herbe', label: '' };
          page.objects.push(obj);
          computeTracéWorld3D(obj, panel, page); // store the world XZ coords
          S.selectedId = obj.id;
        }
      } else if (S.traceTool.pts.length >= 2) {
        const bb = tracéBBox(S.traceTool.pts);
        const obj = { id: newId(), type: 'tracé',
          tracéType: S.traceTool.type,
          name: TRACÉ_NAMES[S.traceTool.type] || 'Tracé',
          panelId: panel.id, pts: S.traceTool.pts.slice(),
          color: S.traceTool.color, width: S.traceTool.width,
          x: bb.x, y: bb.y, w: bb.w, h: bb.h };
        page.objects.push(obj);
        computeTracéWorld3D(obj, panel, page); // store the world XZ coords
        S.selectedId = obj.id;
      }
    }
  }
  S.traceTool = null;
  setCanvasCursor('');
  drawCurrentPage();
}

// ════════════════════════════════════════════════════════════
// MEASURE tool, distance on the ground, top-down view only
// ════════════════════════════════════════════════════════════

export function startMeasureTool(panel){
  S.measureTool = { panelId: panel.id, start: null, end: null, live: null };
  setCanvasCursor('crosshair');
  const sec = document.getElementById('sideMesureSection');
  if (sec) sec.style.display = '';
  const res = document.getElementById('sideMesureResult');
  if (res) res.style.display = 'none';
  const st = document.getElementById('sideMesureStatus');
  if (st) st.textContent = tr('Click a 1st point on the ground.', 'Cliquez un 1er point sur le sol.');
  drawCurrentPage();
}

/** Called by the Finish button, by Escape, and by a right-click. */
export function stopMeasureTool(){
  S.measureTool = null;
  setCanvasCursor('');
  const sec = document.getElementById('sideMesureSection');
  if (sec) sec.style.display = 'none';
  drawCurrentPage();
}
