/**
 * @file scene-loading.js
 * A LARGE SCENE BUILT A FEW BUILDINGS AT A TIME, seen through a translucent veil, with its progress.
 *
 * Opening a Scene of a few hundred buildings built every building in the first frame: seconds of a frozen
 * window (measured: 2.2 s for Montpellier's Écusson, 300 buildings). Here the buildings are made in slices
 * of about 40 ms, the window drawing the progress between them, and the Scene is drawn every DRAW_EVERY_MS
 * with the buildings built so far (marquerEnConstruction3D: the rest wait, the ground is flattened at the
 * end); then the first complete render (relief, roads, grounds) ends it.
 *
 * Two places show the progress, with the same steps (BUILD_STEPS): the « New scene » window when a Scene is
 * made from a real place (real-place-ui.js, which calls buildScene), and, when an existing large Scene is
 * opened, the CARD over the Scene (a translucent veil, the card at the bottom, « Cancel » closes the Scene
 * and goes back to where one was).
 */
import { tr } from './state.js';
import { ensureObjectRigEntry3D } from './rig3d.js';
import { marquerEnConstruction3D, avancerConstruction3D } from './scene3d.js';
import { estUnBatimentPlace } from './batiment-element.js';

/** From this many placed buildings, a Scene is built progressively (with the card when opened). */
export const PROGRESSIVE_FROM = 20;
/** The building steps, in order, and their share of their bar. */
export const BUILD_STEPS = Object.freeze(['buildings', 'ground']);
const STEP_SHARE = Object.freeze({ buildings: 0.85, ground: 0.15 });
/** A slice of building work, milliseconds, before the window is given back to draw the progress. */
const SLICE_MS = 40;
/** How often the Scene is drawn while built (milliseconds): it is seen growing, without slowing it much. */
const DRAW_EVERY_MS = 300;

/** The placed buildings of a Scene's page. */
export const placedBuildings = (page) => ((page && page.objects) || []).filter(o => estUnBatimentPlace(o));

/** The progress (0 to 1) at `step`, itself `sub` done. */
export function buildProgress(step, sub = 0){
  const i = BUILD_STEPS.indexOf(step);
  if (i < 0) return 0;
  let done = 0;
  for (let k = 0; k < i; k++) done += STEP_SHARE[BUILD_STEPS[k]];
  return Math.min(1, done + STEP_SHARE[step] * Math.max(0, Math.min(1, sub)));
}

/** The label of a building step, with its count for the buildings (« Buildings 120 / 300 »). */
export function buildStepLabel(step, detail = null){
  if (step === 'buildings') {
    const base = tr('Building the buildings', 'Construction des bâtiments');
    return detail && detail.total ? `${base} ${detail.done} / ${detail.total}` : base;
  }
  if (step === 'ground') return tr('Drawing the relief, roads and grounds', 'Affichage du relief, des routes et des sols');
  return step;
}

const pause = () => new Promise(ok => setTimeout(ok, 0));

/**
 * Builds the Scene `scene` progressively: its buildings in slices, then its first complete render
 * (`render`, renderAll). `onProgress(step, sub, detail)`; `cancelled()` is asked between slices. The Panel is
 * marked as being built from the start, so a render meanwhile skips it. Resolves to true when built, false
 * when cancelled (the Panel is then unmarked, and nothing else is undone: the caller decides).
 */
export async function buildScene(scene, { onProgress = () => {}, cancelled = () => false, render = () => {} } = {}){
  const page = scene && scene.pages && scene.pages[0];
  const panel = page && page.objects.find(o => o.type === 'panel');
  if (!panel) return false;
  marquerEnConstruction3D(panel.id, true);
  try {
    const buildings = placedBuildings(page), total = buildings.length;
    onProgress('buildings', 0, { done: 0, total });
    await pause();
    let started = performance.now(), drawn = started;
    for (let i = 0; i < total; i++) {
      if (cancelled()) return false;
      try { ensureObjectRigEntry3D(buildings[i]); } catch (e) { console.warn('[scene-loading]', e); }
      if (performance.now() - started > SLICE_MS) {
        onProgress('buildings', (i + 1) / total, { done: i + 1, total });
        if (performance.now() - drawn > DRAW_EVERY_MS) { avancerConstruction3D(panel.id); render(); drawn = performance.now(); }
        await pause();
        started = performance.now();
      }
    }
    if (cancelled()) return false;
    onProgress('ground', 0, null);
    await pause();
    if (cancelled()) return false;
    marquerEnConstruction3D(panel.id, false);
    render();
    onProgress('ground', 1, null);
    return true;
  } finally {
    marquerEnConstruction3D(panel.id, false);
  }
}

// ── The card over a large Scene being opened ──────────────────────────────────────────────────

let _job = null;
let _rappels = { render: () => {}, retour: () => {} };

/** Wired once by events.js: `render` (renderAll), `retour(previous)` (back to where one was). */
export function cablerChargementDeScene(rappels){
  _rappels = { ..._rappels, ...rappels };
  const annuler = () => { if (_job) _job.cancelled = true; };
  const bouton = document.getElementById('sceneLoadingCancel');
  if (bouton) bouton.onclick = annuler;
}

/** The card: the step under way, centred above the bar, as in the « New scene » window. */
function montrerLaCarte(step, sub, detail){
  const i = BUILD_STEPS.indexOf(step);
  document.getElementById('sceneLoadingBar').style.width = `${Math.round(buildProgress(step, sub) * 100)}%`;
  document.getElementById('sceneLoadingStep').textContent = i < 0 ? ''
    : `${buildStepLabel(step, detail)} · ${tr('step', 'étape')} ${i + 1}/${BUILD_STEPS.length}`;
}

/**
 * Called by openScene before its first render: a large Scene (PROGRESSIVE_FROM buildings or more) is built
 * behind the card; a small one opens as before. `previous`: where one was ({ editingSceneId, selectedId }),
 * for « Cancel ». A Scene already being built by someone else (the « New scene » window) is left to it.
 */
export function ouvrirSceneProgressivement(scene, previous){
  if (_job) _job.cancelled = true;
  const page = scene && scene.pages && scene.pages[0];
  if (!page || placedBuildings(page).length < PROGRESSIVE_FROM) return false;
  const job = { cancelled: false };
  _job = job;
  const carte = document.getElementById('sceneLoading');
  carte.hidden = false;
  montrerLaCarte('buildings', 0, null);
  buildScene(scene, { onProgress: montrerLaCarte, cancelled: () => job.cancelled, render: () => _rappels.render() }).then(fini => {
    if (_job !== job) return;   // another Scene was opened meanwhile: it has the card
    _job = null;
    carte.hidden = true;
    if (!fini) _rappels.retour(previous);
  });
  // buildScene has marked the Panel already (before its first pause): the render openScene makes next skips it.
  return true;
}
