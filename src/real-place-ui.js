/**
 * @file real-place-ui.js
 * THE SCREEN of a new Scene: « Manual creation » (an empty Scene, as before) or « From an existing place »:
 * search a place (Nominatim), or click on the map (OpenStreetMap tiles), choose the zone's size, import, with
 * a progress bar and the list of steps. The network is the main process's (electron/bibliotheque/
 * real-place.js); the decisions are pure (osm-scene.js, real-place-sources.js, real-place-import.js); laying
 * the content in a new Scene is events.js's (`creerScene`, injected). Its static texts are in i18n.js.
 */

import { S, tr, newId } from './state.js';
import { translateOsm, ZONE_SIDE_MAX, DETAIL_LEVELS } from './osm-scene.js';
import { planRelief } from './real-place-sources.js';
import { readBdTopo } from './building-survey.js';
import { facadesOf, bestView, samplePoints, wallColour } from './facade-colour.js';
import { buildStepLabel } from './scene-loading.js';
import { wireSearchField } from './search-field.js';
import { sceneContentOf, IMPORT_STEPS, importProgress, downloadDetail } from './real-place-import.js';
import { projector } from './geo-local.js';
import { nomDuTrace } from './canvas-tools.js';
import { enregistrerFermeture } from './modal-stack.js';

const $ = (id) => document.getElementById(id);
const TILE = 256;
const ZOOM_MIN = 3, ZOOM_MAX = 18;
/** Where the map opens before any search: France (France first). */
const DEFAULT_VIEW = { lat: 46.6, lon: 2.4, z: 6 };

let _rappels = { creerScene: () => null, creerSceneManuelle: () => null, construireScene: async () => true };
/** The screen's state: the view, the chosen zone, the chosen place's name and country. */
let V = null;
/** The search field's clear button follows a value written by the screen (search-field.js). */
let _rafraichirRecherche = () => {};

/** The callbacks (injected: the screen does not import events.js). */
export function cablerLieuReel(rappels){
  _rappels = { ..._rappels, ...rappels };
  // ONE button for a new Scene (asked): it opens the choice, manual or from a real place.
  $('addSceneBtn').onclick = () => ouvrirNouvelleScene();
  $('realPlaceManual').onclick = () => { fermer(); _rappels.creerSceneManuelle(); };
  $('realPlaceExisting').onclick = () => montrerLeLieu();
  // The whole card answers, not only its title (the button keeps the keyboard).
  document.querySelectorAll('.real-place-choice-card').forEach(c => {
    c.addEventListener('click', (e) => { if (e.target === c || e.target.tagName === 'P' || e.target.closest('svg')) $(c.dataset.choix).click(); });
  });
  // The map data's progress (main process): the server asked and the bytes received, shown with the time.
  const api = window.storyboarderAPI;
  if (api && api.onRealPlaceOsmProgress) api.onRealPlaceOsmProgress((p) => {
    if (!V || !V.download) return;
    if (!V.download.p || p.server !== V.download.p.server) V.download.since = Date.now();
    V.download.p = p;
    montrerLeTelechargement();
  });
  $('realPlaceClose').onclick = annulerOuFermer;
  $('realPlaceCancel').onclick = annulerOuFermer;
  $('realPlaceSearchForm').onsubmit = (e) => { e.preventDefault(); chercher(); };
  $('realPlaceQuery').addEventListener('input', suggerer);
  _rafraichirRecherche = wireSearchField(document.querySelector('#realPlaceSearchForm .champ-recherche'), {
    onClear: () => { $('realPlaceResults').hidden = true; } });
  $('realPlaceImport').onclick = importer;
  $('realPlaceSize').onchange = () => { if (V) { V.halfSize = Number($('realPlaceSize').value) / 2; dessiner(); } };
  // The level of detail: kept for the session (the select keeps it), and what it brings said under the row.
  $('realPlaceDetailLevel').onchange = direLeNiveau;
  cablerLaCarte($('realPlaceMap'));
  // Esc and a click outside close it, as its neighbours (modal-stack.js).
  enregistrerFermeture('realPlaceModal', annulerOuFermer);
  const realPlaceModal = document.getElementById('realPlaceModal');
  realPlaceModal.addEventListener('mousedown', (e) => { if (e.target === realPlaceModal) fermer(); });
}

/** The new Scene's window, at its first step: the choice. */
export function ouvrirNouvelleScene(){
  V = { view: { ...DEFAULT_VIEW }, zone: null, halfSize: Number($('realPlaceSize').value) / 2, name: null, country: null, busy: false };
  $('realPlaceChoice').hidden = false;
  $('realPlacePlace').hidden = true;
  $('realPlaceResults').hidden = true;
  $('realPlaceResults').replaceChildren();
  rendreLaConsigne();
  dire('');
  majBoutons();
  $('realPlaceModal').classList.remove('hidden');
}

/** The second step, from an existing place: search, map, zone. */
function montrerLeLieu(){
  if (!V) return;
  $('realPlaceChoice').hidden = true;
  $('realPlacePlace').hidden = false;
  requestAnimationFrame(() => { taillerLaCarte(); dessiner(); $('realPlaceQuery').focus(); });
}

/**
 * The import's progress: the step under way in the instructions' place, next to the zone's size (asked), and
 * at the bottom the bar (with the detail line above it). `step` null: nothing done yet.
 */
function montrerLaProgression(step, sub = 0, detail = null){
  const labels = { map: tr('Map data (OpenStreetMap)', 'Données de la carte (OpenStreetMap)'), country: tr('Country of the place', 'Pays du lieu'),
    buildings: tr('Buildings, streets and grounds', 'Bâtiments, rues et sols'),
    facades: tr('Facade colours (street photos)', 'Couleurs des façades (photos de rue)'), relief: tr('Relief', 'Relief'), scene: tr('Creating the scene', 'Création de la scène'),
    construction: buildStepLabel('buildings', step === 'construction' ? detail : null), ground: buildStepLabel('ground') };
  const i = step ? IMPORT_STEPS.indexOf(step) : -1;
  $('realPlaceProgress').hidden = false;
  $('realPlaceBar').style.width = `${Math.round((step ? importProgress(step, sub) : 0) * 100)}%`;
  $('realPlaceStep').textContent = i < 0 ? '' : `${labels[step]} · ${tr('step', 'étape')} ${i + 1}/${IMPORT_STEPS.length}`;
  // The zone's options are set: the progress takes their place (asked).
  $('realPlaceOptions').hidden = $('realPlaceDetailInfo').hidden = true;
}

/** Back to the instructions, the progress put away (an import failed or cancelled, or the window opened). */
function rendreLaConsigne(){
  $('realPlaceProgress').hidden = true;
  $('realPlaceOptions').hidden = $('realPlaceDetailInfo').hidden = false;
  direLeNiveau();
  montrerLeDetail('');
}

/** The step's detail line: shown when there is one, faded out (its height given back) when there is none. */
function montrerLeDetail(texte){
  const d = $('realPlaceDetail');
  if (texte) d.textContent = texte;
  d.classList.toggle('vide', !texte);
}

/** What the chosen level of detail brings (osm-scene.js, DETAIL_LEVELS): what is made, not a duration (asked). */
function direLeNiveau(){
  const niveau = $('realPlaceDetailLevel').value;
  $('realPlaceDetailInfo').textContent = niveau === 'simple'
    ? tr('Simple: the buildings\' volumes, default roofs, roads, paths, grounds, relief, trees and lamps.',
      'Simple : volumes des bâtiments, toits par défaut, routes, chemins, sols, relief, arbres et lampadaires.')
    : niveau === 'realistic'
      ? tr('Realistic: all of Detailed, and the facades: shutters, stone surrounds and shop windows, in the region\'s colours; their colour read on street photos (Panoramax) where there are some.',
        'Réaliste : tout le niveau Détaillé, et les façades : volets, encadrements de pierre et vitrines, aux couleurs de la région ; leur teinte lue sur les photos de rue (Panoramax) quand il y en a.')
      : tr('Detailed: also the real heights, roofs and materials (IGN, in France), pavements, road signs, shrubs and benches.',
        'Détaillé : en plus, hauteurs, toits et matériaux réels (IGN, en France), trottoirs, panneaux, buissons et bancs.');
}

/** The detail line of the map data: the server, the seconds spent on it, the bytes received. */
function montrerLeTelechargement(){
  const d = V && V.download;
  montrerLeDetail(d ? downloadDetail(d.p, (Date.now() - d.since) / 1000, S.appLang === 'en' ? 'en' : 'fr') : '');
}

/**
 * « Cancel » (and the cross, and Esc): during an import, the import stops at its next step and the Scene
 * being made is removed (importer); otherwise the window closes.
 */
function annulerOuFermer(){
  if (V && V.busy) {
    // At once (asked: a cancel waited for the request under way, up to 90 s): the requests are stopped in the
    // main process, and the window closes now. The import, when its await returns, finds no window (V null)
    // and stops; a Scene being built is removed by construireScene (cancelled() reads V).
    V.cancelled = true;
    const api = window.storyboarderAPI;
    if (api && api.realPlaceAbort) api.realPlaceAbort();
    V.busy = false;
    fermer();
    return;
  }
  fermer();
}

function fermer(){
  if (V && V.busy) return;   // an import under way finishes first (it creates the Scene)
  $('realPlaceModal').classList.add('hidden');
  // Closed, it forgets the search (asked): the next opening starts from an empty field.
  $('realPlaceQuery').value = '';
  _rafraichirRecherche();
  $('realPlaceResults').hidden = true;
  $('realPlaceResults').replaceChildren();
  clearTimeout(_suggestion.minuteur); _suggestion.n++;
  V = null;
}

function dire(texte, genre = false){
  const m = $('realPlaceStatus');
  m.textContent = texte || '';
  m.classList.toggle('erreur', genre === true);
  m.classList.toggle('chargement', genre === 'chargement');
}

function majBoutons(){
  $('realPlaceImport').disabled = !V || !V.zone || V.busy;
  // After a failed import, the same button tries again (asked).
  $('realPlaceImport').textContent = V && V.echec ? tr('Try again', 'Réessayer') : tr('Create the scene', 'Créer la scène');
  // During the import, « Create the scene » has nothing left to do (asked): only « Cancel » stays, full width.
  const busy = !!(V && V.busy);
  $('realPlaceImport').hidden = busy;
  document.querySelector('.real-place-actions').classList.toggle('seul', busy);
}

const ERREURS = () => ({
  network: tr('No connection to the service. Check your Internet connection.', 'Pas de connexion au service. Vérifiez la connexion à Internet.'),
  timeout: tr('The service is taking too long to answer. Try again in a moment.', 'Le service met trop de temps à répondre. Réessayez dans un instant.'),
  quota: tr('The service asks to wait a little before asking again.', 'Le service demande de patienter un peu avant de redemander.'),
  response: tr('The service sent an unexpected answer. Try again later.', 'Le service a renvoyé une réponse inattendue. Réessayez plus tard.'),
  zone: tr('This zone is too large.', 'Cette zone est trop grande.'),
  busy: tr('The OpenStreetMap servers are busy and did not send the map data. Try again in a moment, or with a smaller zone.',
    'Les serveurs OpenStreetMap sont surchargés et n\'ont pas envoyé les données de la carte. Réessayez dans un instant, ou avec une zone plus petite.'),
});
const erreur = (code) => ERREURS()[code] || ERREURS().response;

// ── Search ──────────────────────────────────────────────────────────────────────────────────────

async function chercher(){
  const q = $('realPlaceQuery').value.trim();
  if (!q || !V || V.busy) return;
  clearTimeout(_suggestion.minuteur); _suggestion.n++;
  dire(tr('Searching…', 'Recherche…'), 'chargement');
  const r = await window.storyboarderAPI.realPlaceSearch(q, tr('en', 'fr'));
  if (!V) return;
  if (r.error) { dire(erreur(r.error), true); return; }
  dire(r.places.length ? '' : tr('No place found.', 'Aucun lieu trouvé.'));
  montrerLesLieux(r.places);
}

/**
 * Suggestions while typing (asked): after a pause of SUGGESTION_MS, from three letters, the places the IGN and
 * Photon propose (main process, real-place.js) in the same list as a search. An answer that comes after newer
 * typing is dropped (`n`). Enter still searches (Nominatim).
 */
const SUGGESTION_MS = 350;
const _suggestion = { minuteur: null, n: 0 };
function suggerer(){
  clearTimeout(_suggestion.minuteur);
  const q = $('realPlaceQuery').value.trim();
  const n = ++_suggestion.n;
  if (q.length < 3 || !V || V.busy) { if (q.length < 3) $('realPlaceResults').hidden = true; return; }
  _suggestion.minuteur = setTimeout(() => {
    const api = window.storyboarderAPI;
    if (!api || !api.realPlaceSuggest) return;
    // Two services at once (main process, real-place.js): the IGN's (France, quick) shown as soon as it comes,
    // Photon's (the world) added after it. Both failed: said, gently (Enter still searches).
    const recus = { ign: null, photon: null };
    const montrer = () => {
      if (!V || n !== _suggestion.n) return;
      const places = [...(recus.ign && recus.ign.places) || [], ...(recus.photon && recus.photon.places) || []];
      const vus = new Set();
      const uniques = places.filter(p => { const k = `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`; if (vus.has(k)) return false; vus.add(k); return true; }).slice(0, 8);
      if (uniques.length) { dire(''); montrerLesLieux(uniques); return; }
      if (recus.ign && recus.photon && recus.ign.error && recus.photon.error) {
        dire(tr('Suggestions are unavailable for now: press Enter to search.', 'Suggestions indisponibles pour le moment : Entrée lance la recherche.'));
      }
    };
    for (const source of ['ign', 'photon']) {
      api.realPlaceSuggest(q, tr('en', 'fr'), source).then(r => { recus[source] = r || { error: 'response' }; montrer(); });
    }
  }, SUGGESTION_MS);
}

/** The list of places under the search field (a search's results, or suggestions). */
function montrerLesLieux(places){
  const liste = $('realPlaceResults');
  const r = { places };
  liste.replaceChildren(...r.places.map(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'real-place-result';
    b.textContent = p.name;
    // Chosen: the field takes its name and the place is found (asked: as if it had been searched).
    b.onclick = () => {
      clearTimeout(_suggestion.minuteur); _suggestion.n++;
      $('realPlaceQuery').value = p.name;
      _rafraichirRecherche();
      choisirLieu(p);
    };
    return b;
  }));
  liste.hidden = !r.places.length;
}

function choisirLieu(p){
  V.view = { lat: p.lat, lon: p.lon, z: 16 };
  V.zone = { lat: p.lat, lon: p.lon }; V.echec = false;
  V.name = p.name.split(',')[0].trim() || null;
  V.country = p.country;
  $('realPlaceResults').hidden = true;
  majBoutons();
  dessiner();
}

// ── The map (Web Mercator tiles) ────────────────────────────────────────────────────────────────

const monde = (lat, lon, z) => {
  const n = TILE * 2 ** z, s = Math.sin(lat * Math.PI / 180);
  return { x: (lon + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
};
const geo = (x, y, z) => {
  const n = TILE * 2 ** z;
  return { lon: x / n * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI };
};
/** Metres per pixel of the map at a latitude and zoom. */
const metresParPixel = (lat, z) => 40075016.686 * Math.cos(lat * Math.PI / 180) / (TILE * 2 ** z);

const tuiles = new Map();   // "z/x/y" → ImageBitmap | 'attente' | 'echec'

function taillerLaCarte(){
  const c = $('realPlaceMap'), r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1;
  c.width = Math.max(1, Math.round(r.width * k)); c.height = Math.max(1, Math.round(r.height * k));
}

function dessiner(){
  if (!V) return;
  const c = $('realPlaceMap'), ctx = c.getContext('2d'), k = window.devicePixelRatio || 1;
  const W = c.width / k, H = c.height / k;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#d9d4cc';
  ctx.fillRect(0, 0, W, H);
  const { lat, lon, z } = V.view;
  const zi = Math.round(z), centre = monde(lat, lon, zi);
  const ox = centre.x - W / 2, oy = centre.y - H / 2, max = 2 ** zi;
  for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + H) / TILE); ty++) {
    if (ty < 0 || ty >= max) continue;
    for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + W) / TILE); tx++) {
      const x = ((tx % max) + max) % max, key = `${zi}/${x}/${ty}`;
      const t = tuiles.get(key);
      if (t && t !== 'attente' && t !== 'echec') ctx.drawImage(t, tx * TILE - ox, ty * TILE - oy, TILE, TILE);
      else if (!t) chargerTuile(zi, x, ty, key);
    }
  }
  if (V.zone) {
    const p = monde(V.zone.lat, V.zone.lon, zi), side = 2 * V.halfSize / metresParPixel(V.zone.lat, zi);
    ctx.strokeStyle = '#ff7a45'; ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255,122,69,.15)';
    ctx.fillRect(p.x - ox - side / 2, p.y - oy - side / 2, side, side);
    ctx.strokeRect(p.x - ox - side / 2, p.y - oy - side / 2, side, side);
  }
}

async function chargerTuile(z, x, y, key){
  tuiles.set(key, 'attente');
  try {
    const r = await window.storyboarderAPI.realPlaceTile(z, x, y);
    if (!r || !r.data) { tuiles.set(key, 'echec'); return; }
    tuiles.set(key, await createImageBitmap(new Blob([r.data], { type: 'image/png' })));
    dessiner();
  } catch (e) { tuiles.set(key, 'echec'); }
}

function cablerLaCarte(c){
  let geste = null;
  c.addEventListener('pointerdown', (e) => {
    if (!V) return;
    c.setPointerCapture(e.pointerId);
    geste = { x: e.clientX, y: e.clientY, view: { ...V.view }, bouge: false };
  });
  c.addEventListener('pointermove', (e) => {
    if (!geste || !V) return;
    const dx = e.clientX - geste.x, dy = e.clientY - geste.y;
    if (!geste.bouge && Math.hypot(dx, dy) < 4) return;
    geste.bouge = true;
    const z = Math.round(geste.view.z), p = monde(geste.view.lat, geste.view.lon, z);
    const g = geo(p.x - dx, p.y - dy, z);
    V.view = { ...geste.view, lat: g.lat, lon: g.lon };
    dessiner();
  });
  c.addEventListener('pointerup', (e) => {
    if (!geste || !V) return;
    if (!geste.bouge && !V.busy) {
      // A click: the zone's centre, here. Its country is asked at import time.
      const r = c.getBoundingClientRect(), z = Math.round(V.view.z), p = monde(V.view.lat, V.view.lon, z);
      V.zone = geo(p.x + (e.clientX - r.left - r.width / 2), p.y + (e.clientY - r.top - r.height / 2), z); V.echec = false;
      V.country = null;
      majBoutons();
      dessiner();
    }
    geste = null;
  });
  c.addEventListener('wheel', (e) => {
    if (!V) return;
    e.preventDefault();
    const r = c.getBoundingClientRect(), z0 = Math.round(V.view.z);
    const z1 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z0 + (e.deltaY < 0 ? 1 : -1)));
    if (z1 === z0) return;
    // The point under the cursor stays under it.
    const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
    const p0 = monde(V.view.lat, V.view.lon, z0), sous = geo(p0.x + mx, p0.y + my, z0);
    const p1 = monde(sous.lat, sous.lon, z1), g = geo(p1.x - mx, p1.y - my, z1);
    V.view = { lat: g.lat, lon: g.lon, z: z1 };
    dessiner();
  }, { passive: false });
  window.addEventListener('resize', () => { if (V) { taillerLaCarte(); dessiner(); } });
}

// ── Import ──────────────────────────────────────────────────────────────────────────────────────

/** Imports the chosen zone. Resolves to { scene } once built, or { error } (a sentence, for an AI's tool). */
async function importer(){
  if (!V || !V.zone || V.busy) return { error: 'No zone is chosen, or an import is already under way.' };
  const annule = { error: 'The import was cancelled by the user.' };
  const api = window.storyboarderAPI;
  V.busy = true; V.cancelled = false; V.echec = false;
  majBoutons();
  dire('');
  // THIS import's window: cancelled, it is closed at once (annulerOuFermer) and V becomes null, or another
  // window's state if the window is opened again meanwhile. Every step checks that it is still its own.
  const moi = V;
  const arrete = () => V !== moi || moi.cancelled;
  const centre = { ...V.zone }, halfSize = Math.min(V.halfSize, ZONE_SIDE_MAX / 2);
  const niveau = DETAIL_LEVELS.includes($('realPlaceDetailLevel').value) ? $('realPlaceDetailLevel').value : 'detailed';
  // Each step shows on the list before its work: an await lets the window draw it.
  const etape = async (step, sub = 0) => { montrerLaProgression(step, sub); await new Promise(ok => setTimeout(ok, 0)); };
  try {
    await etape('map');
    const { toGeo } = projector(centre);
    const nw = toGeo({ x: -halfSize, z: -halfSize }), se = toGeo({ x: halfSize, z: halfSize });
    // The longest step, with no known total: the line under the steps says which server, for how long,
    // and what has arrived, every second.
    V.download = { p: null, since: Date.now() };
    const tick = setInterval(montrerLeTelechargement, 1000);
    let extrait;
    const bbox = { south: se.lat, west: nw.lon, north: nw.lat, east: se.lon };
    try { extrait = await api.realPlaceOsm(bbox); }
    finally { clearInterval(tick); if (V === moi) { V.download = null; montrerLeTelechargement(); } }
    if (arrete()) return annule;
    if (extrait.error) { V.echec = true; dire(erreur(extrait.error), true); return { error: `The map data could not be downloaded (${extrait.error}).` }; }
    await etape('country');
    let country = V.country;
    if (!country) { const c = await api.realPlaceCountry(centre.lat, centre.lon); country = (c && c.country) || null; }
    if (arrete()) return annule;
    await etape('buildings');
    // France: the IGN's surveyed buildings (heights, roofs, materials), matched to OSM's. Without them (no
    // answer, another country) OSM alone, as before.
    let survey = null;
    if (country === 'fr' && niveau !== 'simple' && api.realPlaceBdTopo) {
      const s = await api.realPlaceBdTopo(bbox);
      if (arrete()) return annule;
      if (s && s.json) survey = readBdTopo(s.json, centre);
    }
    const translated = translateOsm(extrait.json, { centre, halfSize, country: country || 'world', translate: tr, survey, detail: niveau });
    console.info(`[real-place] ${translated.buildings.length} buildings, ${translated.entrances} OSM entrances`);
    // Realistic: the facades' colours read on street photos (#474c). Never blocking: without photos, as before.
    let photoCredits = [];
    if (niveau === 'realistic') {
      await etape('facades');
      photoCredits = await couleursDesFacades(translated, bbox, centre, (sub) => montrerLaProgression('facades', sub), arrete);
      if (arrete()) return annule;
    }
    await etape('relief');
    const relief = await reliefDuLieu(centre, halfSize, country, (sub) => montrerLaProgression('relief', sub), arrete);
    if (arrete()) return annule;
    await etape('scene');
    const contenu = sceneContentOf(translated, { panelId: null, newId, nameOf: nomDuTrace,
      altitudes: relief && relief.altitudes, reliefCredit: relief && relief.credit });
    contenu.credits.push(...photoCredits);
    // The Paths' canvas is the new Scene's: creerScene attaches them to it.
    const scene = _rappels.creerScene(contenu, { nom: V.name || tr('Real place', 'Lieu réel'), demiCote: halfSize,
      lieu: { lat: centre.lat, lon: centre.lon, size_m: halfSize * 2, detail: niveau, country: country || null } });
    // Then built behind this window, which shows it to the end (scene-loading.js): one bar, start to end.
    // Cancelled: the Scene is removed (construireScene).
    const fini = await _rappels.construireScene(scene, {
      onProgress: (step, sub, detail) => montrerLaProgression(step === 'buildings' ? 'construction' : 'ground', sub, detail),
      cancelled: arrete,
    });
    if (V !== moi) return fini ? { scene } : annule;
    V.busy = false;
    fermer();
    return fini ? { scene } : annule;
  } catch (e) {
    console.error('[real-place]', e);
    if (V !== moi) return annule;
    V.echec = true;
    dire(erreur('response'), true);
    return { error: `The import failed inside Storyboarder: ${e && e.message ? e.message : e}` };
  } finally {
    // Still open (failed): the instructions come back; the error stays said.
    if (V === moi) { V.busy = false; rendreLaConsigne(); majBoutons(); }
  }
}

/**
 * AN IMPORT ASKED BY AN AI (mcp-tools.js, create_scene_from_place): the « New scene » window opens on the
 * place, as if the user had chosen it, and imports it; the user sees the progress and may cancel. The place by
 * name (`query`: the first place found) or by `lat` and `lon`. Resolves to { scene } or { error }.
 */
export async function importerPourIA({ query = null, lat, lon, sideM = 200, detail = 'detailed', name = null }){
  if (V && V.busy) return { error: 'An import is already under way in Storyboarder: wait for it to end, then try again.' };
  const api = window.storyboarderAPI;
  let place;
  if (query) {
    const r = await api.realPlaceSearch(query, tr('en', 'fr'));
    if (r.error) return { error: `The place search failed (${r.error}).` };
    if (!r.places.length) return { error: `No place found for « ${query} ». Try another wording, or give lat and lon.` };
    place = r.places[0];
  } else {
    place = { lat, lon, name: name || tr('Real place', 'Lieu réel'), country: null };
  }
  ouvrirNouvelleScene();
  montrerLeLieu();
  choisirLieu(place);
  V.halfSize = Math.min(sideM, ZONE_SIDE_MAX) / 2;
  const taille = $('realPlaceSize');
  if ([...taille.options].some(o => Number(o.value) === sideM)) taille.value = String(sideM);
  if (DETAIL_LEVELS.includes(detail)) { $('realPlaceDetailLevel').value = detail; direLeNiveau(); }
  dessiner();
  return importer();
}

/** The most street photos read for one import: each is ~300-500 KB, and a 360° one serves many buildings. */
const PHOTOS_MAX = 60;

/**
 * THE FACADES' COLOURS FROM STREET PHOTOS (#474c; facade-colour.js decides, here the network and the pixels).
 * The zone's Panoramax photos; for each building the photo that best sees one of its facades; each photo
 * fetched once (the most useful first, PHOTOS_MAX at most), its pixels read at the facade's points; the
 * colour set on the building's facade (its texture kept, tinted). Returns the credit lines of the photos used.
 */
async function couleursDesFacades(translated, bbox, centre, avance, arrete){
  const api = window.storyboarderAPI;
  if (!api || !api.realPlaceStreetPhotos || typeof createImageBitmap !== 'function') return [];
  const r = await api.realPlaceStreetPhotos(bbox);
  if (arrete() || !r || !r.photos || !r.photos.length) return [];
  const { toLocal } = projector(centre);
  const photos = r.photos.map(p => ({ ...p, ...toLocal({ lat: p.lat, lon: p.lon }) }));
  const data = translated.buildings.map(e => facadesOf(e));
  // Each building's view; the outlines within 60 m may stand in between.
  const vues = new Map();
  data.forEach((d, i) => {
    if (!d.facades.length) return;
    const c = d.outline[0];
    const autres = data.filter((o, k) => k !== i && o.outline.some(q => Math.hypot(q.x - c.x, q.z - c.z) < 60)).map(o => o.outline);
    const v = bestView(d, photos, autres);
    if (!v) return;
    if (!vues.has(v.photo.id)) vues.set(v.photo.id, { photo: v.photo, items: [] });
    vues.get(v.photo.id).items.push({ entry: translated.buildings[i], view: v, eaves: d.eaves });
  });
  const parPhoto = [...vues.values()].sort((a, b) => b.items.length - a.items.length).slice(0, PHOTOS_MAX);
  const credits = new Set();
  let colores = 0;
  for (let k = 0; k < parPhoto.length; k++) {
    if (arrete()) return [];
    avance(k / parPhoto.length);
    const { photo, items } = parPhoto[k];
    const img = await api.realPlaceStreetPhoto(photo.url);
    if (arrete()) return [];
    if (!img || !img.data) continue;
    let pixels;
    try {
      const bmp = await createImageBitmap(new Blob([img.data], { type: 'image/jpeg' }));
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width; canvas.height = bmp.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0);
      pixels = { ctx, width: bmp.width, height: bmp.height };
      bmp.close();
    } catch (e) { console.warn('[real-place] photo', e); continue; }
    for (const it of items) {
      const pts = samplePoints(it.view, it.eaves, { width: pixels.width, height: pixels.height });
      // Each point: the mean of a 5 × 5 pixel square (a single pixel is noise: a joint, a leaf).
      const lus = pts.map(({ u, v }) => {
        const x = Math.max(0, Math.min(pixels.width - 5, Math.round(u * pixels.width) - 2));
        const y = Math.max(0, Math.min(pixels.height - 5, Math.round(v * pixels.height) - 2));
        const d = pixels.ctx.getImageData(x, y, 5, 5).data;
        let r0 = 0, g0 = 0, b0 = 0;
        for (let i = 0; i < d.length; i += 4) { r0 += d[i]; g0 += d[i + 1]; b0 += d[i + 2]; }
        return [r0 / 25, g0 / 25, b0 / 25];
      });
      const c = wallColour(lus);
      if (!c) continue;
      const b = it.entry.building;
      b.facade = { texture: (b.facade && b.facade.texture) || null, couleur: c.colour };
      colores++;
      credits.add(tr(`Street photos: Panoramax (${photo.instance}, ${photo.license})`, `Photos de rue : Panoramax (${photo.instance}, ${photo.license})`));
    }
  }
  avance(1);
  console.info(`[real-place] facades coloured from street photos: ${colores} of ${translated.buildings.length} buildings, ${parPhoto.length} photos read`);
  return [...credits];
}

/**
 * The relief: the country's best provider, then the next ones; null if none answers (the Scene is then
 * flat, and the Scene still comes). Its requests one by one, at the provider's rate, so `avance(sub)` can
 * follow them.
 */
async function reliefDuLieu(centre, halfSize, country, avance = () => {}, arrete = () => false){
  for (let i = 0; ; i++) {
    const plan = planRelief({ centre, halfSize, country, providerIndex: i });
    if (!plan || arrete()) return null;
    const answers = [];
    for (let k = 0; k < plan.requests.length; k++) {
      if (k) await new Promise(ok => setTimeout(ok, 1000 / plan.provider.perSecond));
      if (arrete()) return null;
      const r = await window.storyboarderAPI.realPlaceAltitudes([plan.requests[k]], plan.provider.perSecond);
      if (!r || !r.answers) break;
      answers.push(r.answers[0]);
      avance((k + 1) / plan.requests.length);
    }
    const altitudes = answers.length === plan.requests.length ? plan.assemble(answers) : null;
    if (altitudes) {
      const a = altitudes.altitudes;
      console.info(`[real-place] relief: ${plan.provider.id}, ${Math.min(...a)} to ${Math.max(...a)} m, ${Math.round(altitudes.missing * 100)} % without data`);
      return { altitudes, credit: plan.provider.attribution };
    }
  }
}
