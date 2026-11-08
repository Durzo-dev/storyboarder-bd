/**
 * @file plan-import-ui.js
 * #456e, L'ÉCRAN « IMPORTER UN PLAN », ouvert depuis l'Éditeur de bâtiment (section Niveaux) : un plan
 * d'architecte photographié ou scanné devient les murs et les ouvertures du NIVEAU COURANT.
 *
 * Tout ce qui décide est pur et testé ailleurs : la détection des murs (plan-murs.js), leur
 * vectorisation et le bâtiment (plan-vecteurs.js), les ouvertures (plan-ouvertures.js), l'échelle
 * (plan-echelle.js). Ce fichier ne fait que lire l'image, montrer le résultat et demander l'échelle.
 *
 * LE PLUS AUTOMATIQUE POSSIBLE (décision de Valentin, docs/en/plan-sources.md) : la détection se fait
 * seule, sans réglage ; la seule chose demandée est l'ÉCHELLE, faute de pouvoir la lire sûrement sur
 * une photo, et elle arrive PRÉ-REMPLIE : les deux points sont posés aux bouts du plus long mur, et
 * la longueur est l'estimation (par la largeur des portes). On la valide, ou on clique deux autres
 * points (une cote, l'échelle graphique) et on tape la vraie longueur.
 *
 * UNE PHOTO DE BIAIS est redressée d'elle-même (#456e3, plan-feuille.js) : la feuille est trouvée
 * sur son fond et ramenée à un rectangle, sans rien demander.
 *
 * LA CORRECTION se fait ensuite dans l'éditeur lui-même, avec ses outils (déplacer un sommet,
 * supprimer un mur, changer le type d'une ouverture) : un import se défait d'un Ctrl+Z.
 */

import { tr } from './state.js';
import { choisirImage } from './image-store.js';
import { enregistrerFermeture } from './modal-stack.js';
import { detecterLesMurs } from './plan-murs.js';
import { vectoriserLesMurs, batimentDuPlan } from './plan-vecteurs.js';
import { ouverturesDuPlan } from './plan-ouvertures.js';
import { redresserLaFeuille } from './plan-feuille.js';
import { UNITES_DE_LONGUEUR, estimerLEchelle, echelleDeuxPoints, longueurEntre, controlerLEchelle } from './plan-echelle.js';

const $ = (id) => document.getElementById(id);

/** Les couleurs du calque de détection, sur le plan. */
const TEINTES = { mur: 'rgba(234, 88, 12, 0.55)', porte: '#2563eb', fenetre: '#0891b2', passage: '#6b7280', point: '#dc2626' };

/** L'import en cours : l'image, l'analyse, l'échelle, le rappel de construction ; ou null. */
let I = null;

/** L'unité choisie, gardée d'un import à l'autre pendant la session. */
let uniteRetenue = 'm';

/** Les octets d'une image en ImageData (taille d'origine). */
async function lirePixels(data, nom){
  const type = /\.png$/i.test(nom) ? 'image/png' : /\.webp$/i.test(nom) ? 'image/webp' : 'image/jpeg';
  const bitmap = await createImageBitmap(new Blob([data], { type }));
  const c = document.createElement('canvas');
  c.width = bitmap.width; c.height = bitmap.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bitmap, 0, 0);
  const pixels = g.getImageData(0, 0, c.width, c.height);
  // #456e3 : une PHOTO de plan (une feuille sur un fond, vue de biais) est redressée d'elle-même ;
  // un scan reste tel quel. On montre et on mesure l'image REDRESSÉE : l'échelle se clique dessus.
  const feuille = redresserLaFeuille(pixels.data, pixels.width, pixels.height);
  if (!feuille.coins) return { bitmap, pixels };
  bitmap.close();
  const redressee = g.createImageData(feuille.largeur, feuille.hauteur);
  redressee.data.set(feuille.rgba);
  return { bitmap: await createImageBitmap(redressee), pixels: redressee };
}

/** L'analyse complète : murs, segments, ouvertures, estimation de l'échelle. */
function analyser(pixels){
  const d = detecterLesMurs(pixels.data, pixels.width, pixels.height);
  const { segments } = vectoriserLesMurs(d.murs, d.largeur, d.hauteur);
  const avecOuvertures = ouverturesDuPlan(segments, d.encre, d.largeur, d.hauteur, d.murs);
  return { facteur: d.facteur, segments: avecOuvertures, estimation: estimerLEchelle(avecOuvertures) };
}

/** Les points d'échelle par défaut : les bouts du plus long mur, en pixels de l'image d'origine. */
function pointsParDefaut(a){
  let meilleur = null, L = 0;
  for (const s of a.segments) {
    const l = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    if (l > L) { L = l; meilleur = s; }
  }
  if (!meilleur) return [];
  return [{ x: meilleur.a.x * a.facteur, y: meilleur.a.y * a.facteur }, { x: meilleur.b.x * a.facteur, y: meilleur.b.y * a.facteur }];
}

/** L'échelle en cours (mètres par pixel de travail), d'après les points et la longueur saisie. */
function echelleCourante(){
  if (!I || I.points.length < 2) return null;
  return echelleDeuxPoints(I.points[0], I.points[1], parseFloat($('planImportLongueur').value), $('planImportUnite').value, I.analyse.facteur);
}

/** Le passage image → canevas : le plan entier, centré, à la plus grande taille qui tient. */
function pose(){
  const c = $('planImportCanvas'), r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  const iw = I.bitmap.width, ih = I.bitmap.height;
  const k = Math.min(r.width / iw, r.height / ih);
  return { k, ox: (r.width - iw * k) / 2, oy: (r.height - ih * k) / 2, dpr };
}

function dessiner(){
  if (!I) return;
  const c = $('planImportCanvas'), g = c.getContext('2d'), { k, ox, oy, dpr } = pose();
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(I.bitmap, ox, oy, I.bitmap.width * k, I.bitmap.height * k);
  if (!I.analyse) return;
  const f = I.analyse.facteur, P = (p) => ({ x: ox + p.x * f * k, y: oy + p.y * f * k });
  g.lineCap = 'butt';
  for (const s of I.analyse.segments) {
    const a = P(s.a), b = P(s.b), L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) || 1;
    const le = (t) => P({ x: s.a.x + (s.b.x - s.a.x) * t / L, y: s.a.y + (s.b.y - s.a.y) * t / L });
    g.strokeStyle = TEINTES.mur; g.lineWidth = Math.max(2, s.epaisseur * f * k);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    for (const o of s.ouvertures) {
      const p = le(o.s0), q = le(o.s1);
      g.strokeStyle = TEINTES[o.type] || TEINTES.passage; g.lineWidth = Math.max(3, s.epaisseur * f * k);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
    }
  }
  // Les deux points de l'échelle, et le trait qui les relie.
  const pts = I.points.map(p => ({ x: ox + p.x * k, y: oy + p.y * k }));
  g.strokeStyle = TEINTES.point; g.fillStyle = TEINTES.point; g.lineWidth = 2;
  if (pts.length === 2) { g.setLineDash([6, 4]); g.beginPath(); g.moveTo(pts[0].x, pts[0].y); g.lineTo(pts[1].x, pts[1].y); g.stroke(); g.setLineDash([]); }
  for (const p of pts) { g.beginPath(); g.arc(p.x, p.y, 5, 0, Math.PI * 2); g.fill(); }
}

/** Le résumé, les alertes, l'état du bouton Construire. */
function majTextes(){
  if (!I || !I.analyse) return;
  const segs = I.analyse.segments, ouv = segs.flatMap(s => s.ouvertures);
  const n = (t) => ouv.filter(o => o.type === t).length;
  $('planImportResume').textContent = tr(
    `Found: ${segs.length} walls, ${n('porte')} doors, ${n('fenetre')} windows, ${n('passage')} openings.`,
    `Trouvé : ${segs.length} murs, ${n('porte')} portes, ${n('fenetre')} fenêtres, ${n('passage')} passages.`);
  const mpp = echelleCourante();
  const textes = {
    'murs-minces': tr('At this scale the walls are under 4 cm thick: check the length.', 'À cette échelle, les murs font moins de 4 cm : vérifiez la longueur.'),
    'murs-epais': tr('At this scale the walls are over 3 m thick: check the length.', 'À cette échelle, les murs font plus de 3 m : vérifiez la longueur.'),
    'trop-petit': tr('At this scale the building is under 2 m wide: check the length.', 'À cette échelle, le bâtiment fait moins de 2 m : vérifiez la longueur.'),
    'trop-grand': tr('At this scale the building is over 500 m wide: check the length.', 'À cette échelle, le bâtiment dépasse 500 m : vérifiez la longueur.'),
  };
  const alertes = mpp ? controlerLEchelle(segs, mpp).map(c => textes[c]) : [];
  if (!segs.length) alertes.push(tr('No wall was found on this image.', 'Aucun mur n\'a été trouvé sur cette image.'));
  $('planImportAlertes').textContent = alertes.join(' ');
  $('planImportConstruire').disabled = !mpp || !segs.length;
  if (I.points.length < 2) $('planImportEchelleAide').textContent = tr('Click the second point.', 'Cliquez le second point.');
  else $('planImportEchelleAide').textContent = I.analyse.estimation.source === 'portes'
    ? tr('Estimated from the doors. Check the length between the two red points, or click two other points (a dimension, the scale bar) and type their real distance.',
      'Estimée d\'après les portes. Vérifiez la longueur entre les deux points rouges, ou cliquez deux autres points (une cote, l\'échelle graphique) et tapez leur vraie distance.')
    : tr('Click two points whose real distance you know (a dimension, the scale bar, a wall) and type it.',
      'Cliquez deux points dont vous connaissez la vraie distance (une cote, l\'échelle graphique, un mur) et tapez-la.');
}

/** La longueur pré-remplie entre les deux points, à l'échelle estimée, dans l'unité choisie. */
function preRemplir(){
  const mpp = I.analyse.estimation.metresParPixel;
  const champ = $('planImportLongueur');
  if (I.points.length === 2 && mpp) {
    const v = longueurEntre(I.points[0], I.points[1], mpp, $('planImportUnite').value, I.analyse.facteur);
    champ.value = String(Math.round(v * 100) / 100);
  } else champ.value = '';
}

/** Un clic sur le plan : premier point, puis second ; un troisième recommence. */
function cliquer(e){
  if (!I || !I.analyse) return;
  const r = $('planImportCanvas').getBoundingClientRect(), { k, ox, oy } = pose();
  const p = { x: (e.clientX - r.left - ox) / k, y: (e.clientY - r.top - oy) / k };
  if (p.x < 0 || p.y < 0 || p.x > I.bitmap.width || p.y > I.bitmap.height) return;
  I.points = I.points.length >= 2 ? [p] : [...I.points, p];
  if (I.points.length === 2) { preRemplir(); $('planImportLongueur').focus(); $('planImportLongueur').select(); }
  majTextes(); dessiner();
}

export function fermerImportDePlan(){
  $('planImportModal').classList.add('hidden');
  if (I && I.bitmap && I.bitmap.close) I.bitmap.close();
  I = null;
}

/**
 * Ouvre l'import : choisit une image, l'analyse, montre le résultat. `surConstruire(batiment)` reçoit
 * le bâtiment construit (un niveau, centré sur l'origine) et rend vrai s'il a été posé.
 */
export async function ouvrirImportDePlan({ surConstruire, alerter }){
  const choisi = await choisirImage();
  if (!choisi || choisi.canceled) return;
  if (!choisi.ok) { if (alerter) await alerter(tr(`The image could not be read: ${choisi.error}`, `L'image n'a pas pu être lue : ${choisi.error}`)); return; }
  let lu;
  try { lu = await lirePixels(choisi.data, choisi.name); }
  catch (err) { if (alerter) await alerter(tr(`The image could not be read: ${err}`, `L'image n'a pas pu être lue : ${err}`)); return; }
  I = { bitmap: lu.bitmap, analyse: null, points: [], surConstruire };
  $('planImportUnite').value = uniteRetenue;
  $('planImportLongueur').value = '';
  $('planImportResume').textContent = tr('Reading the plan…', 'Lecture du plan…');
  $('planImportAlertes').textContent = '';
  $('planImportEchelleAide').textContent = '';
  $('planImportConstruire').disabled = true;
  $('planImportModal').classList.remove('hidden');
  // L'analyse prend une seconde : laisser d'abord la modale et l'image s'afficher.
  requestAnimationFrame(() => {
    dessiner();
    setTimeout(() => {
      if (!I) return;
      I.analyse = analyser(lu.pixels);
      I.points = pointsParDefaut(I.analyse);
      preRemplir(); majTextes(); dessiner();
    }, 30);
  });
}

async function construire(){
  const mpp = echelleCourante();
  if (!I || !I.analyse || !mpp) return;
  const { batiment } = batimentDuPlan(I.analyse.segments, { metresParPixel: mpp, traduire: tr });
  if (await I.surConstruire(batiment)) fermerImportDePlan();
}

/** Le câblage, une fois : les listes, les champs, les boutons, Échap. */
export function initImportDePlan(){
  if (!$('planImportModal')) return;
  $('planImportUnite').replaceChildren(...UNITES_DE_LONGUEUR.map(u => {
    const o = document.createElement('option'); o.value = u.id; o.textContent = tr(u.en, u.fr); return o;
  }));
  $('planImportUnite').addEventListener('change', () => {
    // Changer d'unité CONVERTIT la longueur saisie (la distance reste la même), elle ne la garde pas.
    const ancienne = uniteRetenue;
    uniteRetenue = $('planImportUnite').value;
    const avant = I && I.analyse && I.points.length === 2
      ? echelleDeuxPoints(I.points[0], I.points[1], parseFloat($('planImportLongueur').value), ancienne, I.analyse.facteur) : null;
    if (avant && I && I.points.length === 2) {
      $('planImportLongueur').value = String(Math.round(longueurEntre(I.points[0], I.points[1], avant, uniteRetenue, I.analyse.facteur) * 100) / 100);
    }
    majTextes();
  });
  $('planImportLongueur').addEventListener('input', () => majTextes());
  $('planImportLongueur').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !$('planImportConstruire').disabled) construire(); });
  $('planImportCanvas').addEventListener('mousedown', cliquer);
  $('planImportAnnuler').onclick = () => fermerImportDePlan();
  $('planImportConstruire').onclick = () => construire();
  const planImportModal = document.getElementById('planImportModal');
  planImportModal.addEventListener('mousedown', (e) => { if (e.target === planImportModal) fermerImportDePlan(); });
  window.addEventListener('resize', () => { if (I) dessiner(); });
  enregistrerFermeture('planImportModal', fermerImportDePlan);
}
