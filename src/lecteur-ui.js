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
import { ICONES_DOUBLE, ICONES_DEBUT, ICONES_AJUSTEMENT, ICONES_SENS, ICONE_LIVRE, ICONE_GUIDE, ICONE_MINIATURES } from './lecteur-icones.js';
import { S, tr, panelsInPage } from './state.js';
import { rendrePlancheEnImage } from './draw.js';
import {
  optionsValides, etalements, etalementDeLaPage, pasDuCote, etapesGuidees, etapeDeLaPage,
  cadrageDansLaVue, avancer, coteQuiTourne, VITESSE_MIN, VITESSE_MAX,
  ajustementEffectif,
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
  window.addEventListener('resize', surRedimension);
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
  window.removeEventListener('resize', surRedimension);
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
  if (r.index !== L.index) { L.index = r.index; L.pas = pas; afficher(); }
}
// Un saut (miniature, Origine, Fin) ne tourne pas de page : il n'a pas de sens de lecture.
function allerA(index){ if (!L) return; L.index = Math.max(0, Math.min(total() - 1, index)); L.pas = 0; afficher(); }

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

/** Hauteur affichée d'une page : la vue entière (« page entière »), ou ce qui remplit la largeur. */
function hauteurParPage(zone, nb, t){
  return ajustementEffectif(options) === 'largeur'
    ? (zone.w * 0.98 / nb) * (t.h / t.w)
    : Math.min(zone.h * 0.96, (zone.w * 0.98 / nb) * (t.h / t.w));
}

/**
 * REMET À LA TAILLE, SANS REDESSINER, ce qui est déjà à l'écran : appelé à chaque changement de
 * taille de la vue (fenêtre, plein écran). Signalé : passer en plein écran faisait deux ou trois
 * sauts de taille, parce que chaque événement relançait un dessin asynchrone, chacun s'affichant à
 * son tour à une taille déjà dépassée. Ici tout se recale dans la même image, sans glisser (la
 * transition de la vue guidée est coupée le temps du recalage) ; le dessin à la bonne définition
 * vient une fois la taille stabilisée (cf. surRedimension).
 */
function retailler(){
  if (!L) return;
  const t = S.tomes[L.ti];
  const vue = $('lecteurVue');
  const zone = vueRect();
  if (options.guide) {
    const img = vue.querySelector('canvas.lecteur-page-guidee');
    const etape = etapes()[L.index];
    if (img && etape) {
      const cad = cadrageDansLaVue(etape.cadre, { w: t.w, h: t.h }, zone);
      img.classList.add('sans-transition');
      img.style.width = `${t.w * cad.echelle}px`;
      img.style.height = `${t.h * cad.echelle}px`;
      img.style.transform = `translate(${cad.x}px, ${cad.y}px)`;
      void img.offsetWidth;
      img.classList.remove('sans-transition');
    }
  } else {
    const pages = vue.querySelectorAll('.lecteur-etalement > .lecteur-page');
    const parPage = hauteurParPage(zone, pages.length || 1, t);
    pages.forEach(el => { el.style.height = `${parPage}px`; el.style.width = `${parPage * t.w / t.h}px`; });
  }
  placerBords();
}

let _redimension = null;
function surRedimension(){
  if (!L) return;
  retailler();
  clearTimeout(_redimension);
  _redimension = setTimeout(afficher, 250);
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
  // Les classes d'abord, la mesure ensuite (signalé : un second clic sur « Largeur » rétrécissait
  // la page). Mesurée avant, la vue n'avait pas encore sa place réservée à l'ascenseur, ou l'avait
  // déjà selon le dessin d'avant : la largeur changeait d'un clic à l'autre. `scrollbar-gutter`
  // (style.css) rend cette place constante, qu'il y ait un ascenseur ou non.
  vue.classList.toggle('lecteur-guide', options.guide);
  vue.classList.toggle('lecteur-largeur', !options.guide && ajustementEffectif(options) === 'largeur');
  const zone = vueRect();
  const dpr = globalThis.devicePixelRatio || 1;
  $('lecteurOverlay').dataset.fond = options.fond;
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
    const parPage = hauteurParPage(zone, slots.length, t);
    const rendus = await Promise.all(slots.map(pi => (pi == null ? null : planche(pi, parPage * dpr))));
    if (!L || gen !== L.generation) return;
    if (L.animation) L.animation.finish();
    const ligne = document.createElement('div');
    ligne.className = 'lecteur-etalement' + (options.livre ? ' livre' : '') + (options.double ? ' double' : '');
    slots.forEach((pi, k) => {
      // Une FEUILLE par page : elle porte l'ombre et l'ombre de reliure (vue livre), le canevas dedans.
      const el = document.createElement('div');
      el.className = 'lecteur-page' + (rendus[k] ? '' : ' lecteur-page-blanche');
      if (rendus[k]) el.appendChild(copieCanevas(rendus[k]));
      el.style.height = `${parPage}px`;
      el.style.width = `${parPage * t.w / t.h}px`;
      ligne.appendChild(el);
    });
    const ancienne = vue.querySelector('.lecteur-etalement');
    vue.replaceChildren(ligne);
    vue.scrollTop = 0;
    // Vue livre : la page se tourne, comme dans un album (demandé). Seulement en avançant ou en
    // reculant d'un cran, et seulement si la disposition n'a pas changé (même nombre de pages).
    const cote = options.livre && L.pas ? coteQuiTourne(L.pas, options.sens) : null;
    if (cote && ancienne && ancienne.children.length === ligne.children.length) tournerLaPage(vue, ancienne, ligne, cote);
    L.pas = 0;
  }
  // Les miniatures suivent la page lue, les bords se recollent à elle, et le défilement automatique
  // repart pour une étape.
  placerBords();
  marquerMiniature();
  clearTimeout(L.minuterie);
  if (options.auto) L.minuterie = setTimeout(() => aller(1), options.vitesse * 1000);
}

function copieCanevas(c){
  const k = c.cloneNode(false);
  k.getContext('2d').drawImage(c, 0, 0);
  return k;
}
/** Le contenu d'une feuille, recopié (un canevas ne se partage pas entre deux places du DOM). */
function copieContenu(feuille){
  const c = feuille && feuille.querySelector('canvas');
  return c ? copieCanevas(c) : null;
}

/**
 * L'ANIMATION DE PAGE TOURNÉE (vue livre). Le nouvel étalement est déjà en place ; par-dessus, une
 * feuille à deux faces pivote autour de la reliure : recto, l'ancienne page qui part ; verso, la page
 * qui arrive de l'autre côté. Tant qu'elle n'est pas retombée, l'autre côté montre encore l'ancienne
 * page (un cache). En simple page, l'ancienne page s'envole et découvre la nouvelle.
 */
function tournerLaPage(vue, ancienne, nouvelle, cote){
  const anciens = [...ancienne.children], nouveaux = [...nouvelle.children];
  const double = nouveaux.length === 2;
  const iTourne = double ? (cote === 'droite' ? 1 : 0) : 0;
  const iAutre = double ? 1 - iTourne : -1;
  const base = vue.getBoundingClientRect();
  const placer = (el, cible) => {
    const r = cible.getBoundingClientRect();
    el.style.left = `${r.left - base.left + vue.scrollLeft}px`;
    el.style.top = `${r.top - base.top + vue.scrollTop}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
  };
  const face = (contenu, dos) => {
    const f = document.createElement('div');
    f.className = 'lecteur-face' + (dos ? ' lecteur-face-dos' : '') + (contenu ? '' : ' lecteur-face-blanche');
    if (contenu) f.appendChild(contenu);
    return f;
  };
  const feuille = document.createElement('div');
  feuille.className = 'lecteur-feuille-tournante';
  feuille.style.transformOrigin = cote === 'droite' ? 'left center' : 'right center';
  feuille.append(face(copieContenu(anciens[iTourne]), false), face(double ? copieContenu(nouveaux[iAutre]) : null, true));
  placer(feuille, nouveaux[iTourne]);
  let cache = null;
  if (double) {
    cache = document.createElement('div');
    cache.className = 'lecteur-cache-page' + (anciens[iAutre].querySelector('canvas') ? '' : ' lecteur-face-blanche');
    const contenu = copieContenu(anciens[iAutre]);
    if (contenu) cache.appendChild(contenu);
    placer(cache, nouveaux[iAutre]);
    vue.appendChild(cache);
  }
  vue.appendChild(feuille);
  const angle = cote === 'droite' ? -180 : 180;
  const anim = feuille.animate(
    [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${angle}deg)` }],
    { duration: 650, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
  // Le cache disparaît quand la feuille passe la verticale : à partir de là, c'est son verso qui
  // recouvre ce côté.
  const caches = cache ? setTimeout(() => { if (cache) cache.remove(); }, 325) : null;
  const nettoyer = () => { clearTimeout(caches); feuille.remove(); if (cache) cache.remove(); if (L && L.animation === anim) L.animation = null; };
  anim.onfinish = nettoyer;
  anim.oncancel = nettoyer;
  L.animation = anim;
}

// « Planche 1 · 1&2/9 » (demandé) : le numéro de la première Planche montrée, puis les RANGS des
// Planches à l'écran dans ce qu'on lit (deux en double page, sans la page blanche), sur le total.
function majPosition(){
  const n = L.pages.length;
  let montrees;
  if (options.guide) { const e = etapes()[L.index]; montrees = e ? [e.page] : []; }
  else {
    const e = etalementsCourants()[L.index];
    // Dans l'ordre de LECTURE, pas de gauche à droite (en manga, la droite se lit d'abord).
    montrees = e ? (options.sens === 'rtl' ? [e.droite, e.gauche] : [e.gauche, e.droite]).filter(p => p != null) : [];
  }
  if (!montrees.length) { $('lecteurPosition').textContent = ''; return; }
  const rangs = montrees.map(p => L.pages.indexOf(p) + 1).sort((a, b) => a - b);
  const etape = options.guide ? ` · ${tr('panel', 'case')} ${L.index + 1}/${total()}` : '';
  $('lecteurPosition').textContent = `${tr('Page', 'Planche')} ${Math.min(...montrees) + 1} · ${rangs.join('&')}/${n}${etape}`;
}

/**
 * Les bords cliquables : COLLÉS à la page montrée (signalé : en simple page ils restaient aux bords
 * de la scène, loin de la page), et ABSENTS du côté où il n'y a plus rien (début ou fin).
 */
function placerBords(){
  const g = $('lecteurBordGauche'), d = $('lecteurBordDroite');
  const scene = g.parentNode.getBoundingClientRect();
  const page = !options.guide && $('lecteurVue').querySelector('.lecteur-etalement');
  const r = page ? page.getBoundingClientRect() : null;
  // TOUT L'ESPACE de chaque côté de la page est cliquable (demandé, plus ergonomique qu'une bande
  // collée à elle) ; la flèche reste contre la page. Au moins 64 px, même quand la page remplit tout.
  const large = 64;
  if (r && r.width) {
    const gauche = Math.max(large, r.left - scene.left);
    const droite = Math.max(large, scene.right - r.right);
    g.style.left = '0px'; g.style.width = `${gauche}px`;
    d.style.left = 'auto'; d.style.right = '0px'; d.style.width = `${droite}px`;
  } else {
    g.style.left = '0px'; g.style.width = `${large}px`;
    d.style.left = 'auto'; d.style.right = '0px'; d.style.width = `${large}px`;
  }
  const n = total();
  g.hidden = avancer(L.index, pasDuCote('gauche', options.sens), n).fin;
  d.hidden = avancer(L.index, pasDuCote('droite', options.sens), n).fin;
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
/**
 * Un choix exclusif en boutons (comme une case radio, plus lisible dans un menu étroit). Avec un
 * pictogramme (`[valeur, libellé, icône]`), le bouton n'a pas de texte : son nom passe en infobulle
 * et en aria-label, comme dans l'éditeur de bâtiment (demandé : « des boutons plus visuels »).
 */
function choix(cle, valeurs, desactive = false, variante = ''){
  const g = document.createElement('div');
  g.className = 'choix' + (variante ? ` choix-${variante}` : '');   // #460c : le composant de choix commun
  valeurs.forEach(([v, libelle, icone]) => {
    const b = document.createElement('button');
    b.type = 'button';
    if (icone) { b.innerHTML = icone; b.title = libelle; b.setAttribute('aria-label', libelle); }
    else b.textContent = libelle;
    b.className = (icone ? 'icone' : '') + (options[cle] === v ? ' actif' : '');
    b.disabled = desactive;
    b.onclick = () => changer(cle, v);
    g.appendChild(b);
  });
  return g;
}
/** Un réglage marche / arrêt en pictogramme : orange quand il est actif (aria-pressed le dit aussi). */
function bascule(cle, libelle, icone, desactive = false){
  const b = document.createElement('button');
  b.type = 'button'; b.innerHTML = icone; b.title = libelle;
  b.setAttribute('aria-label', libelle); b.setAttribute('aria-pressed', String(!!options[cle]));
  b.className = 'icone' + (options[cle] ? ' actif' : '');
  b.disabled = desactive;
  b.onclick = () => changer(cle, !options[cle]);
  return b;
}
function groupeOptions(...rangees){
  const g = document.createElement('div');
  g.className = 'choix-options-groupe';
  g.append(...rangees.filter(Boolean));
  return g;
}
/** Une bascule seule sur sa ligne, de toute la largeur (demandé), comme les choix au-dessus. */
function ligneDeBascules(...boutons){
  const g = document.createElement('div');
  g.className = 'choix';
  g.append(...boutons);
  return g;
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
      // Des pictogrammes, nom en infobulle (demandé) : une page / deux, la première à droite ou à
      // gauche, la page entière ou en largeur ; puis les deux vues, en bascules.
      choix('double', [[false, tr('One page', 'Une page'), ICONES_DOUBLE.false], [true, tr('Two pages', 'Deux pages'), ICONES_DOUBLE.true]], options.guide, 'types'),
      // Les OPTIONS du nombre de pages, petites, sous un trait (demandé) : en une page, l'ajustement
      // (page entière ou largeur) ; en deux pages, la première page à droite ou à gauche (la largeur
      // y changeait trop peu : retirée, cf. ajustementEffectif). La vue guidée les éteint (elle
      // cadre case par case).
      !options.guide && groupeOptions(options.double
        ? choix('debut', [['droite', tr('First page on the right', 'Première page à droite'), ICONES_DEBUT.droite], ['gauche', tr('First page on the left', 'Première page à gauche'), ICONES_DEBUT.gauche]], false, 'options')
        : choix('ajustement', [['hauteur', tr('Whole page', 'Page entière'), ICONES_AJUSTEMENT.hauteur], ['largeur', tr('Fit width', 'Largeur'), ICONES_AJUSTEMENT.largeur]], false, 'options')),
      ligneDeBascules(
        bascule('livre', tr('Book view: the page turns', 'Vue livre : la page se tourne'), ICONE_LIVRE, options.guide),
      ),
    ]),
    // « Sens de lecture » devient « Lecture » et accueille la vue guidée (demandé) : lire case par
    // case est une façon de lire, pas une mise en page.
    section(tr('Reading', 'Lecture'), [
      // « Vers la gauche » à gauche, « Vers la droite » à droite (demandé).
      // En grand comme « Une page / Deux pages » (demandé : la même hauteur) : ce sont les deux choix
      // principaux du menu.
      choix('sens', [['rtl', tr('To the left', 'Vers la gauche'), ICONES_SENS.rtl], ['ltr', tr('To the right', 'Vers la droite'), ICONES_SENS.ltr]], false, 'types'),
      ligneDeBascules(
        bascule('guide', tr('Guided view, panel by panel', 'Vue guidée, case par case'), ICONE_GUIDE),
      ),
    ]),
    // Le bouton de lecture SOUS le réglage de la vitesse (demandé).
    section(tr('Automatic scrolling', 'Défilement automatique'), [vitesse, lecture]),
    section(tr('Look', 'Apparence'), [
      choix('fond', [['sombre', tr('Dark', 'Sombre')], ['gris', tr('Grey', 'Gris')], ['clair', tr('Light', 'Clair')]]),
      // Une bascule de toute la largeur plutôt qu'une case à cocher (demandé), comme les vues.
      ligneDeBascules(bascule('miniatures', tr('Thumbnail strip', 'Bandeau de miniatures'), ICONE_MINIATURES)),
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
  // Recalé tout de suite (la barre et le menu viennent de disparaître ou de revenir), redessiné une
  // fois la taille stable.
  surRedimension();
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
