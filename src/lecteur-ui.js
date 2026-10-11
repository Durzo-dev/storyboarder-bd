/**
 * @file lecteur-ui.js
 * L'écran du LECTEUR (demandé) : lire un Tome ou un Chapitre à la suite, à la place de la Planche,
 * avec son menu à droite. Les décisions (étalements, sens, vue guidée, cadrage) sont dans
 * src/lecteur.js, pures et testées ; ici, le DOM et le dessin.
 *
 * Gestes : clic sur le bord gauche ou droit, flèches du clavier (le sens suit la lecture : en manga,
 * la gauche avance), Espace pour lancer ou arrêter le défilement, F pour le plein écran, Origine et
 * Fin pour la première et la dernière page, Échap pour sortir (du plein écran d'abord).
 *
 * Les Planches sont dessinées à la demande (rendrePlancheEnImage, draw.js) et gardées le temps de la
 * lecture ; les miniatures sont préparées en arrière-plan, une à une, pour ne pas figer l'écran.
 */
import { S, tr, panelsInPage } from './state.js';
import { rendrePlancheEnImage } from './draw.js';
import {
  optionsValides, etalements, etalementDeLaPage, pasDuCote, etapesGuidees, etapeDeLaPage,
  cadrageDansLaVue, avancer, VITESSE_MIN, VITESSE_MAX,
} from './lecteur.js';

const CLE_OPTIONS = 'lecteur:options';
const HAUTEUR_MINIATURE = 96;
const CACHE_MAX = 16;

const $ = (id) => document.getElementById(id);
let L = null;   // la lecture en cours : { ti, pages, titre, index, ... }
let options = lireOptions();
let _rappels = {};

/** Ce que le Lecteur demande au reste de l'application (fermer l'Éditeur, etc.). */
export function cablerLecteur(rappels){ _rappels = rappels || {}; }

function lireOptions(){
  try { return optionsValides(JSON.parse(globalThis.localStorage.getItem(CLE_OPTIONS) || 'null')); }
  catch { return optionsValides(null); }
}
function memoriserOptions(){
  try { globalThis.localStorage.setItem(CLE_OPTIONS, JSON.stringify(options)); } catch { /* une préférence perdue */ }
}

export function lecteurOuvert(){ return !!L; }

/**
 * Ouvre le Lecteur sur une suite de Planches d'un Tome. `pages` : leurs index, dans l'ordre ;
 * `depart` : celle par laquelle commencer (la première par défaut).
 */
export function ouvrirLecteur(ti, pages, titre, depart = null){
  if (!pages || !pages.length) return;
  if (_rappels.avantOuverture) _rappels.avantOuverture();
  L = { ti, pages: pages.slice(), titre, index: 0, cache: new Map(), miniatures: new Map(), generation: 0, minuterie: null, tache: null };
  const debut = depart != null ? depart : pages[0];
  L.index = options.guide ? etapeDeLaPage(etapes(), debut) : etalementDeLaPage(etalementsCourants(), debut);
  $('lecteurOverlay').classList.remove('hidden');
  $('lecteurTitre').textContent = titre || '';
  construirePanneau();
  construireMiniatures();
  afficher();
  window.addEventListener('keydown', clavier, true);
  window.addEventListener('resize', afficher);
}

export function fermerLecteur(){
  if (!L) return;
  clearTimeout(L.minuterie); clearTimeout(L.tache);
  L = null;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  $('lecteurOverlay').classList.add('hidden');
  $('lecteurVue').replaceChildren();
  $('lecteurMiniatures').replaceChildren();
  window.removeEventListener('keydown', clavier, true);
  window.removeEventListener('resize', afficher);
  if (_rappels.apresFermeture) _rappels.apresFermeture();
}

// ── Ce qu'on parcourt : des étalements, ou des étapes guidées ──────────────────────────────────

function etalementsCourants(){ return etalements(L.pages, options); }
function etapes(){
  const t = S.tomes[L.ti];
  return etapesGuidees(L.pages, (pi) => {
    const p = t && t.pages[pi];
    return p ? panelsInPage(p).map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h, caseNumber: c.caseNumber })) : [];
  });
}
function total(){ return options.guide ? etapes().length : etalementsCourants().length; }
/** La Planche « courante » (pour garder sa place quand on change d'option). */
function pageCourante(){
  if (options.guide) { const e = etapes()[L.index]; return e ? e.page : L.pages[0]; }
  const e = etalementsCourants()[L.index];
  return e ? (e.gauche != null ? e.gauche : e.droite) : L.pages[0];
}

function aller(pas){
  if (!L) return;
  const r = avancer(L.index, pas, total());
  if (r.fin && pas > 0 && options.auto) { options.auto = false; memoriserOptions(); construirePanneau(); }
  if (r.index !== L.index) { L.index = r.index; afficher(); }
}
function allerA(index){ if (!L) return; L.index = Math.max(0, Math.min(total() - 1, index)); afficher(); }

/** Change une option en gardant la Planche qu'on regarde. */
function changer(cle, valeur){
  const page = L ? pageCourante() : null;
  options = optionsValides({ ...options, [cle]: valeur });
  memoriserOptions();
  if (L) {
    L.index = options.guide ? etapeDeLaPage(etapes(), page) : etalementDeLaPage(etalementsCourants(), page);
    construirePanneau();
    construireMiniatures();
    afficher();
  }
}

// ── Le dessin ──────────────────────────────────────────────────────────────────────────────────

/** Une Planche dessinée à (au moins) cette hauteur, gardée pendant la lecture. */
async function planche(pi, hauteurPx){
  const palier = Math.min(4000, Math.ceil(hauteurPx / 200) * 200);
  const cle = pi + '@' + palier;
  if (L.cache.has(cle)) return L.cache.get(cle);
  const c = await rendrePlancheEnImage(L.ti, pi, palier);
  if (!L) return c;
  L.cache.set(cle, c);
  if (L.cache.size > CACHE_MAX) L.cache.delete(L.cache.keys().next().value);
  // La miniature, tirée du grand dessin : gratuite.
  if (c && !L.miniatures.has(pi)) poserMiniature(pi, c);
  return c;
}

function vueRect(){
  const v = $('lecteurVue');
  return { w: v.clientWidth || 1, h: v.clientHeight || 1 };
}

async function afficher(){
  if (!L) return;
  const gen = ++L.generation;
  const t = S.tomes[L.ti];
  const vue = $('lecteurVue');
  const zone = vueRect();
  const dpr = globalThis.devicePixelRatio || 1;
  $('lecteurOverlay').dataset.fond = options.fond;
  vue.classList.toggle('lecteur-guide', options.guide);
  vue.classList.toggle('lecteur-largeur', !options.guide && options.ajustement === 'largeur');
  majPosition();
  if (options.guide) {
    const etape = etapes()[L.index];
    if (!etape) return;
    const cad = cadrageDansLaVue(etape.cadre, { w: t.w, h: t.h }, zone);
    const c = await planche(etape.page, t.h * cad.echelle * dpr);
    if (!L || gen !== L.generation || !c) return;
    let img = vue.querySelector('canvas.lecteur-page-guidee');
    if (!img || img.dataset.page !== String(etape.page) || img.width !== c.width) {
      img = c.cloneNode(false); img.getContext('2d').drawImage(c, 0, 0);
      img.className = 'lecteur-page-guidee'; img.dataset.page = String(etape.page);
      const ancien = vue.querySelector('canvas.lecteur-page-guidee');
      // Une nouvelle Planche arrive sans glisser depuis la précédente.
      if (ancien && ancien.dataset.page !== String(etape.page)) img.classList.add('sans-transition');
      vue.replaceChildren(img);
      void img.offsetWidth;
    }
    img.style.width = `${t.w * cad.echelle}px`;
    img.style.height = `${t.h * cad.echelle}px`;
    img.style.transform = `translate(${cad.x}px, ${cad.y}px)`;
    requestAnimationFrame(() => img.classList.remove('sans-transition'));
  } else {
    const e = etalementsCourants()[L.index];
    if (!e) return;
    const slots = options.double ? [e.gauche, e.droite] : [e.gauche];
    // Hauteur affichée d'une page : la vue entière (« page entière »), ou ce qui remplit la largeur.
    const parPage = options.ajustement === 'largeur'
      ? (zone.w * 0.98 / slots.length) * (t.h / t.w)
      : Math.min(zone.h * 0.96, (zone.w * 0.98 / slots.length) * (t.h / t.w));
    const rendus = await Promise.all(slots.map(pi => (pi == null ? null : planche(pi, parPage * dpr))));
    if (!L || gen !== L.generation) return;
    const ligne = document.createElement('div');
    ligne.className = 'lecteur-etalement';
    slots.forEach((pi, k) => {
      const c = rendus[k];
      let el;
      if (c) { el = c.cloneNode(false); el.getContext('2d').drawImage(c, 0, 0); el.className = 'lecteur-page'; }
      else { el = document.createElement('div'); el.className = 'lecteur-page lecteur-page-blanche'; }
      el.style.height = `${parPage}px`;
      el.style.width = `${parPage * t.w / t.h}px`;
      ligne.appendChild(el);
    });
    vue.replaceChildren(ligne);
    vue.scrollTop = 0;
  }
  // Les miniatures suivent la page lue, et le défilement automatique repart pour une étape.
  marquerMiniature();
  clearTimeout(L.minuterie);
  if (options.auto) L.minuterie = setTimeout(() => aller(1), options.vitesse * 1000);
}

function majPosition(){
  const n = L.pages.length;
  const page = pageCourante();
  const rang = L.pages.indexOf(page) + 1;
  const etape = options.guide ? ` · ${tr('panel', 'case')} ${L.index + 1}/${total()}` : '';
  $('lecteurPosition').textContent = `${tr('Page', 'Planche')} ${page + 1} · ${rang}/${n}${etape}`;
}

// ── Les miniatures ─────────────────────────────────────────────────────────────────────────────

function construireMiniatures(){
  const bande = $('lecteurMiniatures');
  bande.hidden = !options.miniatures;
  bande.replaceChildren();
  if (!options.miniatures || !L) return;
  L.pages.forEach(pi => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lecteur-miniature';
    b.dataset.page = String(pi);
    b.title = `${tr('Page', 'Planche')} ${pi + 1}`;
    const num = document.createElement('span');
    num.textContent = String(pi + 1);
    b.appendChild(num);
    b.onclick = () => allerA(options.guide ? etapeDeLaPage(etapes(), pi) : etalementDeLaPage(etalementsCourants(), pi));
    bande.appendChild(b);
    const deja = L.miniatures.get(pi);
    if (deja) poserMiniature(pi, deja, b);
  });
  marquerMiniature();
  // En arrière-plan, une à une : les miniatures qu'aucune lecture n'a encore dessinées.
  const suivante = async () => {
    if (!L || !options.miniatures) return;
    const pi = L.pages.find(p => !L.miniatures.has(p));
    if (pi == null) return;
    const c = await rendrePlancheEnImage(L.ti, pi, HAUTEUR_MINIATURE * (globalThis.devicePixelRatio || 1));
    if (!L) return;
    if (c) poserMiniature(pi, c); else L.miniatures.set(pi, null);
    L.tache = setTimeout(suivante, 30);
  };
  clearTimeout(L.tache);
  L.tache = setTimeout(suivante, 300);
}

function poserMiniature(pi, source, bouton){
  if (!L) return;
  const h = HAUTEUR_MINIATURE * (globalThis.devicePixelRatio || 1);
  let petit = L.miniatures.get(pi);
  if (!petit && source) {
    petit = document.createElement('canvas');
    petit.height = Math.round(h); petit.width = Math.max(1, Math.round(h * source.width / source.height));
    petit.getContext('2d').drawImage(source, 0, 0, petit.width, petit.height);
    L.miniatures.set(pi, petit);
  }
  const b = bouton || $('lecteurMiniatures').querySelector(`[data-page="${pi}"]`);
  if (!b || !petit || b.querySelector('canvas')) return;
  const copie = petit.cloneNode(false); copie.getContext('2d').drawImage(petit, 0, 0);
  b.insertBefore(copie, b.firstChild);
}

function marquerMiniature(){
  if (!L) return;
  const vues = new Set();
  if (options.guide) { const e = etapes()[L.index]; if (e) vues.add(e.page); }
  else { const e = etalementsCourants()[L.index]; if (e) { vues.add(e.gauche); vues.add(e.droite); } }
  $('lecteurMiniatures').querySelectorAll('.lecteur-miniature').forEach(b => {
    const actif = vues.has(Number(b.dataset.page));
    b.classList.toggle('actif', actif);
    if (actif && b === [...b.parentNode.children].find(x => vues.has(Number(x.dataset.page)))) {
      b.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  });
}

// ── Le menu du Lecteur ─────────────────────────────────────────────────────────────────────────

function section(titre, enfants){
  const s = document.createElement('section');
  s.className = 'side-section lecteur-section';
  const h = document.createElement('h2'); h.textContent = titre;
  s.append(h, ...enfants.filter(Boolean));
  return s;
}
/** Un choix exclusif en boutons (comme une case radio, plus lisible dans un menu étroit). */
function choix(cle, valeurs, desactive = false){
  const g = document.createElement('div');
  g.className = 'lecteur-choix';
  valeurs.forEach(([v, libelle]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = libelle;
    b.className = 'lecteur-choix-btn' + (options[cle] === v ? ' actif' : '');
    b.disabled = desactive;
    b.onclick = () => changer(cle, v);
    g.appendChild(b);
  });
  return g;
}
function caseACocher(cle, libelle){
  const l = document.createElement('label');
  l.className = 'modal-checkbox-line lecteur-case';
  const i = document.createElement('input');
  i.type = 'checkbox'; i.checked = !!options[cle];
  i.onchange = () => changer(cle, i.checked);
  l.append(i, document.createTextNode(' ' + libelle));
  return l;
}

function construirePanneau(){
  const p = $('lecteurPanneau');
  const lecture = document.createElement('button');
  lecture.type = 'button';
  lecture.className = 'full-btn lecteur-lecture';
  lecture.textContent = options.auto ? tr('⏸ Pause (Space)', '⏸ Pause (Espace)') : tr('▶ Play (Space)', '▶ Lecture (Espace)');
  lecture.onclick = () => changer('auto', !options.auto);
  const vitesse = document.createElement('div');
  vitesse.className = 'lecteur-vitesse';
  const etiquette = document.createElement('label');
  const unite = options.guide ? tr('per panel', 'par case') : tr('per page', 'par page');
  etiquette.textContent = `${tr('Speed', 'Vitesse')} : ${options.vitesse} s ${unite}`;
  const curseur = document.createElement('input');
  curseur.type = 'range'; curseur.min = String(VITESSE_MIN); curseur.max = String(VITESSE_MAX); curseur.step = '1';
  curseur.value = String(options.vitesse);
  curseur.oninput = () => { etiquette.textContent = `${tr('Speed', 'Vitesse')} : ${curseur.value} s ${unite}`; };
  curseur.onchange = () => changer('vitesse', Number(curseur.value));
  vitesse.append(etiquette, curseur);
  const plein = document.createElement('button');
  plein.type = 'button';
  plein.className = 'nav-btn';
  plein.textContent = tr('⛶ Full screen (F)', '⛶ Plein écran (F)');
  plein.onclick = basculerPleinEcran;
  const aide = document.createElement('p');
  aide.className = 'side-hint';
  aide.textContent = tr('← → or click the edges to turn pages · Home / End · Esc to leave.',
    '← → ou clic sur les bords pour tourner les pages · Origine / Fin · Échap pour sortir.');
  p.replaceChildren(
    section(tr('Display', 'Affichage'), [
      choix('double', [[false, tr('One page', 'Une page')], [true, tr('Two pages', 'Deux pages')]], options.guide),
      choix('debut', [['droite', tr('First page on the right', 'Première page à droite')], ['gauche', tr('First page on the left', 'Première page à gauche')]], options.guide || !options.double),
      choix('ajustement', [['hauteur', tr('Whole page', 'Page entière')], ['largeur', tr('Fit width', 'Largeur')]], options.guide),
      caseACocher('guide', tr('Guided view, panel by panel', 'Vue guidée, case par case')),
    ]),
    section(tr('Reading direction', 'Sens de lecture'), [
      choix('sens', [['ltr', tr('To the right (comics)', 'Vers la droite (BD)')], ['rtl', tr('To the left (manga)', 'Vers la gauche (manga)')]]),
    ]),
    section(tr('Automatic scrolling', 'Défilement automatique'), [lecture, vitesse]),
    section(tr('Look', 'Apparence'), [
      choix('fond', [['sombre', tr('Dark', 'Sombre')], ['gris', tr('Grey', 'Gris')], ['clair', tr('Light', 'Clair')]]),
      caseACocher('miniatures', tr('Thumbnail strip', 'Bandeau de miniatures')),
      plein,
    ]),
    aide,
  );
}

// ── Plein écran et clavier ─────────────────────────────────────────────────────────────────────

function basculerPleinEcran(){
  const o = $('lecteurOverlay');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (o.requestFullscreen) o.requestFullscreen().catch(() => {});
}
document.addEventListener('fullscreenchange', () => {
  const o = $('lecteurOverlay');
  if (o) o.classList.toggle('lecteur-plein-ecran', document.fullscreenElement === o);
  if (L) setTimeout(afficher, 50);
});

function clavier(e){
  if (!L) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox') return;
  let fait = true;
  if (e.key === 'ArrowRight') aller(pasDuCote('droite', options.sens));
  else if (e.key === 'ArrowLeft') aller(pasDuCote('gauche', options.sens));
  else if (e.key === 'PageDown') aller(1);
  else if (e.key === 'PageUp') aller(-1);
  else if (e.key === 'Home') allerA(0);
  else if (e.key === 'End') allerA(total() - 1);
  else if (e.key === ' ') changer('auto', !options.auto);
  else if (e.key === 'f' || e.key === 'F') basculerPleinEcran();
  else if (e.key === 'Escape') { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else fermerLecteur(); }
  // Les raccourcis de la Planche (Éditeur, caméra, déplacements, Cases suivantes) n'ont pas de
  // sens pendant la lecture : avalés, pour ne pas agir sur la Planche cachée dessous.
  else if (!e.ctrlKey && !e.metaKey && ['e', 'E', 'c', 'C', 't', 'T', 'w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', '[', ']'].includes(e.key)) { /* rien */ }
  else fait = false;
  // Le Lecteur garde ses touches : la Planche cachée dessous ne doit pas les recevoir (F centrerait
  // sa caméra, les flèches déplaceraient sa sélection).
  if (fait) { e.preventDefault(); e.stopImmediatePropagation(); }
}

// ── Câblage du DOM (une fois) ──────────────────────────────────────────────────────────────────

export function initLecteur(){
  $('lecteurFermerBtn').onclick = fermerLecteur;
  $('lecteurBordGauche').onclick = () => aller(pasDuCote('gauche', options.sens));
  $('lecteurBordDroite').onclick = () => aller(pasDuCote('droite', options.sens));
}
