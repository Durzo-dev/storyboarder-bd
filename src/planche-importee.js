/**
 * @file planche-importee.js
 * Les PLANCHES IMPORTÉES : une image de planche déjà dessinée, découpée en Cases que l'application
 * reconnaît. Demandé par Valentin le 12 octobre 2026 ; cf. docs/en/planche-importee.md.
 *
 * Ce module DÉCIDE (détection des Cases, cadrage, placement, champs persistés) ; il ne touche ni au
 * DOM ni au disque, et tout y est vérifiable sous Node. L'interface est dans import-planche-ui.js,
 * le dessin dans draw.js.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * LE MODÈLE
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   Planche : `importee: { largeur, hauteur, imageAnchorX?, imageAnchorY?, imageZoom? }`
 *             les dimensions de l'image en pixels, et le cadrage de l'ENSEMBLE ;
 *   Case    : `imageFile` (l'image de la Planche) et `regionImage: { x, y, w, h }`, sa zone dans
 *             l'image, en FRACTIONS de l'image (0 à 1).
 *
 * ⚠️ LE NOM DE L'IMAGE VIT SUR LES CASES, PAS SUR LA PLANCHE. C'est ce qui donne gratuitement, à
 * une Planche importée, tout ce que les images de Case savent déjà faire : préchargement, section
 * Images (usages, renommage, suppression), Fichiers introuvables. Le garder aussi sur la Planche en
 * ferait deux copies, et le premier renommage d'image n'en mettrait qu'une à jour.
 *
 * ⚠️ LA POSITION D'UNE CASE SE DÉDUIT, ELLE NE SE SAISIT PAS. `x`, `y`, `w`, `h` et `pts` sont
 * recalculés à chaque dessin depuis la région et le cadrage (`placerCasesImportees`) : rien ne peut
 * les déplacer, et une version de l'application qui ignore tout cela lit des Cases ordinaires, à
 * leur place.
 */

/** Les champs AJOUTÉS (rien n'est renommé) : sur la Planche, et sur chacune de ses Cases. */
export const CHAMP_PLANCHE_IMPORTEE = 'importee';
export const CHAMP_REGION_IMAGE = 'regionImage';

/** Le cadrage de l'ensemble : mêmes noms que celui d'une image de Case, mêmes bornes de zoom. */
export const ZOOM_PLANCHE_MIN = 1;
export const ZOOM_PLANCHE_MAX = 4;

const nombre = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
const borne = (v, min, max, defaut) => {
  const n = nombre(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
};

/** Cette Planche (données persistées, ou vue fusionnée de currentPage) est-elle importée ? PURE. */
export function estPlancheImportee(page){
  const i = page && page[CHAMP_PLANCHE_IMPORTEE];
  return !!i && nombre(i.largeur) > 0 && nombre(i.hauteur) > 0;
}

/** Une région lisible, ou null. PURE. */
export function regionValide(r){
  if (!r || typeof r !== 'object') return null;
  const x = nombre(r.x), y = nombre(r.y), w = nombre(r.w), h = nombre(r.h);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/** Cette Case appartient-elle à une Planche importée ? PURE. */
export function estCaseImportee(o){
  return !!o && o.type === 'panel' && regionValide(o[CHAMP_REGION_IMAGE]) !== null;
}

/** L'image d'une Planche importée : celle de sa première Case, ou null. PURE. */
export function imageDeLaPlanche(page){
  const c = (page && page.objects || []).find(o => estCaseImportee(o) && typeof o.imageFile === 'string' && o.imageFile);
  return c ? c.imageFile : null;
}

/** L'ancrage et le zoom de l'ensemble, toujours utilisables (absents = centré, 1). PURE. */
export function cadrageLu(importee){
  const i = importee || {};
  return {
    ancrage: { x: borne(i.imageAnchorX, 0, 1, 0.5), y: borne(i.imageAnchorY, 0, 1, 0.5) },
    zoom: borne(i.imageZoom, ZOOM_PLANCHE_MIN, ZOOM_PLANCHE_MAX, ZOOM_PLANCHE_MIN),
  };
}

/** Le cadrage est-il celui d'origine (rien à « Recentrer ») ? PURE. */
export function cadragePlancheParDefaut(importee){
  const c = cadrageLu(importee);
  return c.ancrage.x === 0.5 && c.ancrage.y === 0.5 && c.zoom === ZOOM_PLANCHE_MIN;
}

/** Recentrer : les trois champs SUPPRIMÉS, comme pour une image de Case. Rend true si quelque chose a changé. */
export function recentrerPlanche(importee){
  if (!importee) return false;
  const avant = cadragePlancheParDefaut(importee);
  delete importee.imageAnchorX; delete importee.imageAnchorY; delete importee.imageZoom;
  return !avant;
}

/**
 * Où l'image se pose sur la Planche : `{ x, y, w, h, echelle }`, en unités de Planche. PURE.
 *
 * ⚠️ À 1×, L'IMAGE EST ENTIÈRE (« contenir »), PAS « couvrir » comme une image de Case. Une planche
 * scannée n'a presque jamais les proportions exactes du format du Tome (US dans un Tome franco-belge :
 * 14 % de hauteur en trop) ; la couvrir rognerait les Cases du bord, ce qui serait le pire défaut ici.
 * Les bandes qui restent prennent la couleur de fond de la Planche. Zoomer agrandit, et l'ancrage
 * dit alors quelle part du débord est prise à gauche ou en haut ; à 1×, il place l'image dans
 * l'espace libre. La même formule couvre les deux cas, d'où un seul réglage.
 */
export function poseDeLImage(pageW, pageH, imgW, imgH, importee){
  const pw = Number(pageW), ph = Number(pageH), iw = Number(imgW), ih = Number(imgH);
  if (![pw, ph, iw, ih].every(v => Number.isFinite(v) && v > 0)) return null;
  const { ancrage, zoom } = cadrageLu(importee);
  const echelle = Math.min(pw / iw, ph / ih) * zoom;
  const w = iw * echelle, h = ih * echelle;
  return { x: (pw - w) * ancrage.x, y: (ph - h) * ancrage.y, w, h, echelle };
}

/**
 * L'ancrage après un glisser de `delta` (unités de Planche) commencé à `ancrage0`. PURE.
 * Un axe sans jeu (l'image a exactement la taille de la Planche sur cet axe) ne bouge pas.
 */
export function ancrageApresGlisserPlanche(ancrage0, delta, pageW, pageH, pose){
  const a = { x: borne(ancrage0 && ancrage0.x, 0, 1, 0.5), y: borne(ancrage0 && ancrage0.y, 0, 1, 0.5) };
  if (!pose || !delta) return a;
  const jeuX = Number(pageW) - pose.w, jeuY = Number(pageH) - pose.h;
  const dx = Number(delta.x) || 0, dy = Number(delta.y) || 0;
  return {
    x: Math.abs(jeuX) > 1e-6 ? Math.min(1, Math.max(0, a.x + dx / jeuX)) : a.x,
    y: Math.abs(jeuY) > 1e-6 ? Math.min(1, Math.max(0, a.y + dy / jeuY)) : a.y,
  };
}

/**
 * Pose chaque Case importée à sa place : ses `x`, `y`, `w`, `h` et `pts` suivent sa région et le
 * cadrage. `page` : une vue avec `w`, `h`, `importee` et `objects` (les objets sont modifiés). Rend
 * la pose de l'image, ou null si la Planche n'est pas importée.
 */
export function placerCasesImportees(page){
  if (!estPlancheImportee(page)) return null;
  const i = page[CHAMP_PLANCHE_IMPORTEE];
  const pose = poseDeLImage(page.w, page.h, i.largeur, i.hauteur, i);
  if (!pose) return null;
  (page.objects || []).forEach(o => {
    if (!estCaseImportee(o)) return;
    const r = regionValide(o[CHAMP_REGION_IMAGE]);
    o.x = pose.x + r.x * pose.w;
    o.y = pose.y + r.y * pose.h;
    o.w = r.w * pose.w;
    o.h = r.h * pose.h;
    o.pts = [{ x: o.x, y: o.y }, { x: o.x + o.w, y: o.y }, { x: o.x + o.w, y: o.y + o.h }, { x: o.x, y: o.y + o.h }];
  });
  return pose;
}

// ─────────────────────────────────────────────────────────────────────────────
// La détection des Cases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les réglages de la détection. La TOLÉRANCE est le seul que l'utilisateur voit (le curseur de la
 * vérification) : l'écart de gris en deçà duquel un pixel compte comme du fond.
 *
 * ⚠️ AUCUN DE CES SEUILS N'EST MESURÉ SUR UN CORPUS, et c'est écrit : ils ont été posés sur des
 * planches synthétiques et quelques cas d'école (gouttières blanches, bordures noires, Case pleine
 * page). La vérification à l'import est précisément ce qui rend cette approximation acceptable :
 * une erreur de détection se corrige avant de valider, jamais après.
 */
export const DETECTION = Object.freeze({
  tolerance: 40,          // écart de gris (0 à 255) toléré autour de la couleur du fond
  bruitLigne: 0.01,       // part d'encre tolérée dans une ligne de gouttière (poussière, trait de scan)
  gouttiereMin: 0.004,    // épaisseur minimale d'une gouttière, en part du petit côté de l'image
  caseMin: 0.03,          // côté minimal d'une Case, en part du côté correspondant de l'image
  surfaceMin: 0.006,      // surface minimale d'une Case, en part de l'image
});

/** La médiane d'une liste de nombres. PURE. */
function mediane(v){
  if (!v.length) return 255;
  const t = v.slice().sort((a, b) => a - b);
  return t[Math.floor(t.length / 2)];
}

/**
 * La couleur du FOND : la médiane des pixels du pourtour. Les planches ont presque toujours une
 * marge, et les gouttières sont de la même couleur qu'elle. PURE.
 */
export function couleurDuFond(gris, w, h){
  const bord = [];
  for (let x = 0; x < w; x++) { bord.push(gris[x], gris[(h - 1) * w + x]); }
  for (let y = 0; y < h; y++) { bord.push(gris[y * w], gris[y * w + w - 1]); }
  return mediane(bord);
}

/**
 * Les Cases d'une image en niveaux de gris (`gris` : un octet par pixel, `w` × `h`), en FRACTIONS de
 * l'image, dans l'ordre de lecture (de haut en bas, puis de gauche à droite). PURE.
 *
 * LA MÉTHODE : la découpe récursive « XY-cut ». Une gouttière est une bande de lignes (ou de
 * colonnes) presque entièrement de la couleur du fond ; on coupe la zone le long des bandes
 * horizontales, puis chaque morceau le long des verticales, et ainsi de suite tant qu'une coupe
 * existe. Ce qui reste, rogné de ses marges, est une Case.
 *
 * ⚠️ CE QU'ELLE NE SAIT PAS FAIRE, et la vérification est là pour ça : une bulle ou un dessin qui
 * enjambe une gouttière la bouche (les deux Cases n'en font qu'une) ; une Case sans bordure sur fond
 * blanc perd ses marges vides ; les Cases inclinées ou qui se chevauchent sont rendues par leur
 * rectangle englobant.
 */
export function detecterCases(gris, w, h, options = {}){
  const o = { ...DETECTION, ...options };
  if (!gris || !(w > 0) || !(h > 0) || gris.length < w * h) return [];
  const fond = couleurDuFond(gris, w, h);
  const encre = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) encre[i] = Math.abs(gris[i] - fond) > o.tolerance ? 1 : 0;
  const gouttiere = Math.max(2, Math.round(Math.min(w, h) * o.gouttiereMin));

  // Les lignes (sens 'h') ou colonnes ('v') de la zone qui sont du FOND.
  const lignesDeFond = (r, sens) => {
    const n = sens === 'h' ? r.y1 - r.y0 : r.x1 - r.x0;
    const long = sens === 'h' ? r.x1 - r.x0 : r.y1 - r.y0;
    const max = Math.floor(long * o.bruitLigne);
    const res = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      let s = 0;
      if (sens === 'h') { const y = r.y0 + k; for (let x = r.x0; x < r.x1 && s <= max; x++) s += encre[y * w + x]; }
      else { const x = r.x0 + k; for (let y = r.y0; y < r.y1 && s <= max; y++) s += encre[y * w + x]; }
      res[k] = s <= max ? 1 : 0;
    }
    return res;
  };
  // La zone sans ses marges de fond ; null si elle est vide.
  const rogner = (r) => {
    const lh = lignesDeFond(r, 'h'), lv = lignesDeFond(r, 'v');
    let a = 0, b = lh.length; while (a < b && lh[a]) a++; while (b > a && lh[b - 1]) b--;
    let c = 0, d = lv.length; while (c < d && lv[c]) c++; while (d > c && lv[d - 1]) d--;
    if (a >= b || c >= d) return null;
    return { x0: r.x0 + c, x1: r.x0 + d, y0: r.y0 + a, y1: r.y0 + b };
  };
  // Les morceaux de la zone séparés par une bande de fond d'au moins `gouttiere` lignes.
  const couper = (r, sens) => {
    const l = lignesDeFond(r, sens);
    const debut = sens === 'h' ? r.y0 : r.x0;
    const morceaux = [];
    let ouvert = null, vides = 0;
    for (let k = 0; k < l.length; k++) {
      if (!l[k]) {
        if (ouvert === null) ouvert = k;
        else if (vides >= gouttiere) { morceaux.push([ouvert, k - vides]); ouvert = k; }
        vides = 0;
      } else if (ouvert !== null) vides++;
    }
    if (ouvert !== null) morceaux.push([ouvert, l.length - vides]);
    return morceaux.map(([p, q]) => (sens === 'h'
      ? { x0: r.x0, x1: r.x1, y0: debut + p, y1: debut + q }
      : { x0: debut + p, x1: debut + q, y0: r.y0, y1: r.y1 }));
  };
  const feuilles = [];
  const decouper = (r0, profondeur) => {
    const r = rogner(r0);
    if (!r) return;
    if (profondeur < 12) {
      for (const sens of ['h', 'v']) {
        const m = couper(r, sens);
        if (m.length > 1) { m.forEach(x => decouper(x, profondeur + 1)); return; }
      }
    }
    feuilles.push(r);
  };
  decouper({ x0: 0, x1: w, y0: 0, y1: h }, 0);

  return feuilles
    .filter(r => (r.x1 - r.x0) >= w * o.caseMin && (r.y1 - r.y0) >= h * o.caseMin
      && (r.x1 - r.x0) * (r.y1 - r.y0) >= w * h * o.surfaceMin)
    .map(r => ({ x: r.x0 / w, y: r.y0 / h, w: (r.x1 - r.x0) / w, h: (r.y1 - r.y0) / h }));
}

/**
 * Les régions dans l'ordre de LECTURE, celui qui numérote les Cases : par rangées (deux régions
 * dont les hauteurs se recouvrent de moitié au moins sont sur la même rangée), puis de gauche à
 * droite. Sert après la vérification, où l'utilisateur a pu ajouter une Case n'importe où. PURE.
 */
export function ordreDeLecture(regions){
  const reste = (regions || []).map(regionValide).filter(Boolean).sort((a, b) => a.y - b.y || a.x - b.x);
  const rangees = [];
  for (const r of reste) {
    const rangee = rangees.find(g => {
      const haut = Math.max(g.y0, r.y), bas = Math.min(g.y1, r.y + r.h);
      return bas - haut >= Math.min(r.h, g.y1 - g.y0) / 2;
    });
    if (rangee) { rangee.liste.push(r); rangee.y0 = Math.min(rangee.y0, r.y); rangee.y1 = Math.max(rangee.y1, r.y + r.h); }
    else rangees.push({ y0: r.y, y1: r.y + r.h, liste: [r] });
  }
  return rangees.sort((a, b) => a.y0 - b.y0).flatMap(g => g.liste.sort((a, b) => a.x - b.x));
}

/** Le côté minimal d'une région retouchée à la main, en part de l'image. */
export const REGION_MIN = 0.02;

/**
 * Une région retouchée pendant la vérification : `poignee` vaut 'deplacer' ou un coin ('nw', 'ne',
 * 'sw', 'se') ; `dx`, `dy` sont le déplacement depuis le DÉBUT du geste, en fractions de l'image
 * (on repart toujours de `r0`, jamais de la région courante). Elle reste dans l'image et garde une
 * taille minimale. PURE.
 */
export function retoucherRegion(r0, poignee, dx, dy){
  const r = regionValide(r0);
  if (!r) return null;
  const c = (v) => Math.min(1, Math.max(0, v));
  if (poignee === 'deplacer') {
    return { x: c(Math.min(r.x + dx, 1 - r.w)), y: c(Math.min(r.y + dy, 1 - r.h)), w: r.w, h: r.h };
  }
  let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
  if (poignee.includes('w')) x0 = c(Math.min(x0 + dx, x1 - REGION_MIN));
  if (poignee.includes('e')) x1 = c(Math.max(x1 + dx, x0 + REGION_MIN));
  if (poignee.includes('n')) y0 = c(Math.min(y0 + dy, y1 - REGION_MIN));
  if (poignee.includes('s')) y1 = c(Math.max(y1 + dy, y0 + REGION_MIN));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Une région tracée entre deux points (fractions), ou null si elle est trop petite. PURE. */
export function regionTracee(a, b){
  const x0 = Math.max(0, Math.min(a.x, b.x)), x1 = Math.min(1, Math.max(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y)), y1 = Math.min(1, Math.max(a.y, b.y));
  return (x1 - x0 >= REGION_MIN && y1 - y0 >= REGION_MIN) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** Une image RGBA (`ImageData.data`) en niveaux de gris, un octet par pixel. PURE. */
export function niveauxDeGris(rgba, w, h){
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    // Un pixel transparent compte comme du blanc : c'est le papier d'une image détourée.
    const a = rgba[j + 3] / 255;
    const l = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    g[i] = Math.round(l * a + 255 * (1 - a));
  }
  return g;
}

/**
 * La Planche importée, prête à ranger dans un Tome. `regions` : celles validées par l'utilisateur,
 * dans l'ordre voulu (elles donnent les numéros de Case) ; aucune région = une seule Case, l'image
 * entière, pour que la Planche porte toujours son image. `newId` : le générateur d'identifiants. PURE.
 */
export function creerPlancheImportee({ nomImage, largeur, hauteur, regions, newId }){
  const liste = (regions || []).map(regionValide).filter(Boolean);
  const cases = (liste.length ? liste : [{ x: 0, y: 0, w: 1, h: 1 }]).map((r, i) => ({
    id: newId(), type: 'panel', x: 0, y: 0, w: 1, h: 1, text: '', shape: 'rect', caseNumber: i + 1,
    imageFile: nomImage, [CHAMP_REGION_IMAGE]: { x: r.x, y: r.y, w: r.w, h: r.h },
  }));
  return { id: newId('p'), objects: cases, [CHAMP_PLANCHE_IMPORTEE]: { largeur, hauteur } };
}
