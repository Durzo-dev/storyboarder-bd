/**
 * @file real-place-ui.js
 * THE SCREEN of a new Scene: « Manual creation » (an empty Scene, as before) or « From an existing place »:
 * search a place (Nominatim), or click on the map (OpenStreetMap tiles), choose the zone's size, import, with
 * a progress bar and the list of steps. The network is the main process's (electron/bibliotheque/
 * real-place.js); the decisions are pure (osm-scene.js, real-place-sources.js, real-place-import.js); laying
 * the content in a new Scene is events.js's (`creerScene`, injected). Its static texts are in i18n.js.
 */

import { tr, newId } from './state.js';
import { translateOsm, ZONE_SIDE_MAX } from './osm-scene.js';
import { planRelief } from './real-place-sources.js';
import { sceneContentOf, IMPORT_STEPS, importProgress } from './real-place-import.js';
import { projector } from './geo-local.js';
import { nomDuTrace } from './canvas-tools.js';
import { enregistrerFermeture } from './modal-stack.js';

const $ = (id) => document.getElementById(id);
const TILE = 256;
const ZOOM_MIN = 3, ZOOM_MAX = 18;
/** Where the map opens before any search: France (France first). */
const DEFAULT_VIEW = { lat: 46.6, lon: 2.4, z: 6 };

let _rappels = { creerScene: () => null, creerSceneManuelle: () => null };
/** The screen's state: the view, the chosen zone, the chosen place's name and country. */
let V = null;

/** The callbacks (injected: the screen does not import events.js). */
export function cablerLieuReel(rappels){
  _rappels = { ..._rappels, ...rappels };
  // ONE button for a new Scene (asked): it opens the choice, manual or from a real place.
  $('addSceneBtn').onclick = () => ouvrirNouvelleScene();
  $('realPlaceManual').onclick = () => { fermer(); _rappels.creerSceneManuelle(); };
  $('realPlaceExisting').onclick = () => montrerLeLieu();
  // The whole card answers, not only its title (the button keeps the keyboard).
  document.querySelectorAll('.real-place-choice-card').forEach(c => {
    c.addEventListener('click', (e) => { if (e.target === c || e.target.tagName === 'P') $(c.dataset.choix).click(); });
  });
  $('realPlaceClose').onclick = fermer;
  $('realPlaceCancel').onclick = fermer;
  $('realPlaceSearchForm').onsubmit = (e) => { e.preventDefault(); chercher(); };
  $('realPlaceImport').onclick = importer;
  $('realPlaceSize').onchange = () => { if (V) { V.halfSize = Number($('realPlaceSize').value) / 2; dessiner(); } };
  cablerLaCarte($('realPlaceMap'));
  // Esc and a click outside close it, as its neighbours (modal-stack.js).
  enregistrerFermeture('realPlaceModal', fermer);
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
  $('realPlaceProgress').hidden = true;
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

/** The import's steps as a list (done, under way, to come) and the bar. `step` null: all to come. */
function montrerLaProgression(step, sub = 0){
  const labels = { map: tr('Map data (OpenStreetMap)', 'Données de la carte (OpenStreetMap)'), country: tr('Country of the place', 'Pays du lieu'),
    buildings: tr('Buildings, streets and grounds', 'Bâtiments, rues et sols'), relief: tr('Relief', 'Relief'), scene: tr('Creating the scene', 'Création de la scène') };
  const i = step ? IMPORT_STEPS.indexOf(step) : -1;
  $('realPlaceProgress').hidden = false;
  $('realPlaceBar').style.width = `${Math.round((step ? importProgress(step, sub) : 0) * 100)}%`;
  $('realPlaceSteps').replaceChildren(...IMPORT_STEPS.map((k, n) => {
    const li = document.createElement('li');
    li.textContent = labels[k];
    li.className = n < i ? 'fait' : n === i ? 'encours' : '';
    return li;
  }));
}

function fermer(){
  if (V && V.busy) return;   // an import under way finishes first (it creates the Scene)
  $('realPlaceModal').classList.add('hidden');
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
  $('realPlaceSearchBtn').disabled = !V || V.busy;
}

const ERREURS = () => ({
  network: tr('No connection to the service. Check your Internet connection.', 'Pas de connexion au service. Vérifiez la connexion à Internet.'),
  timeout: tr('The service is taking too long to answer. Try again in a moment.', 'Le service met trop de temps à répondre. Réessayez dans un instant.'),
  quota: tr('The service asks to wait a little before asking again.', 'Le service demande de patienter un peu avant de redemander.'),
  response: tr('The service sent an unexpected answer. Try again later.', 'Le service a renvoyé une réponse inattendue. Réessayez plus tard.'),
  zone: tr('This zone is too large.', 'Cette zone est trop grande.'),
});
const erreur = (code) => ERREURS()[code] || ERREURS().response;

// ── Search ──────────────────────────────────────────────────────────────────────────────────────

async function chercher(){
  const q = $('realPlaceQuery').value.trim();
  if (!q || !V || V.busy) return;
  dire(tr('Searching…', 'Recherche…'), 'chargement');
  const r = await window.storyboarderAPI.realPlaceSearch(q, tr('en', 'fr'));
  if (!V) return;
  if (r.error) { dire(erreur(r.error), true); return; }
  dire(r.places.length ? '' : tr('No place found.', 'Aucun lieu trouvé.'));
  const liste = $('realPlaceResults');
  liste.replaceChildren(...r.places.map(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'real-place-result';
    b.textContent = p.name;
    b.onclick = () => choisirLieu(p);
    return b;
  }));
  liste.hidden = !r.places.length;
}

function choisirLieu(p){
  V.view = { lat: p.lat, lon: p.lon, z: 16 };
  V.zone = { lat: p.lat, lon: p.lon };
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
      V.zone = geo(p.x + (e.clientX - r.left - r.width / 2), p.y + (e.clientY - r.top - r.height / 2), z);
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

async function importer(){
  if (!V || !V.zone || V.busy) return;
  const api = window.storyboarderAPI;
  V.busy = true;
  majBoutons();
  dire('');
  const centre = { ...V.zone }, halfSize = Math.min(V.halfSize, ZONE_SIDE_MAX / 2);
  // Each step shows on the list before its work: an await lets the window draw it.
  const etape = async (step, sub = 0) => { montrerLaProgression(step, sub); await new Promise(ok => setTimeout(ok, 0)); };
  try {
    await etape('map');
    const { toGeo } = projector(centre);
    const nw = toGeo({ x: -halfSize, z: -halfSize }), se = toGeo({ x: halfSize, z: halfSize });
    const extrait = await api.realPlaceOsm({ south: se.lat, west: nw.lon, north: nw.lat, east: se.lon });
    if (!V) return;
    if (extrait.error) { dire(erreur(extrait.error), true); return; }
    await etape('country');
    let country = V.country;
    if (!country) { const c = await api.realPlaceCountry(centre.lat, centre.lon); country = (c && c.country) || null; }
    await etape('buildings');
    const translated = translateOsm(extrait.json, { centre, halfSize, country: country || 'world', translate: tr });
    await etape('relief');
    const relief = await reliefDuLieu(centre, halfSize, country, (sub) => montrerLaProgression('relief', sub));
    if (!V) return;
    await etape('scene');
    const contenu = sceneContentOf(translated, { panelId: null, newId, nameOf: nomDuTrace,
      altitudes: relief && relief.altitudes, reliefCredit: relief && relief.credit });
    // The Paths' canvas is the new Scene's: creerScene attaches them to it.
    _rappels.creerScene(contenu, { nom: V.name || tr('Real place', 'Lieu réel'), demiCote: halfSize });
    montrerLaProgression('scene', 1);
    V.busy = false;
    fermer();
  } catch (e) {
    console.error('[real-place]', e);
    dire(erreur('response'), true);
  } finally {
    if (V) { V.busy = false; majBoutons(); }
  }
}

/**
 * The relief: the country's best provider, then the next ones; null if none answers (the Scene is then
 * flat, and the Scene still comes). Its requests one by one, at the provider's rate, so `avance(sub)` can
 * follow them.
 */
async function reliefDuLieu(centre, halfSize, country, avance = () => {}){
  for (let i = 0; ; i++) {
    const plan = planRelief({ centre, halfSize, country, providerIndex: i });
    if (!plan) return null;
    const answers = [];
    for (let k = 0; k < plan.requests.length; k++) {
      if (k) await new Promise(ok => setTimeout(ok, 1000 / plan.provider.perSecond));
      const r = await window.storyboarderAPI.realPlaceAltitudes([plan.requests[k]], plan.provider.perSecond);
      if (!r || !r.answers) break;
      answers.push(r.answers[0]);
      avance((k + 1) / plan.requests.length);
    }
    const altitudes = answers.length === plan.requests.length ? plan.assemble(answers) : null;
    if (altitudes) return { altitudes, credit: plan.provider.attribution };
  }
}
