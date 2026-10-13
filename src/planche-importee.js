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
/**
 * Les QUATRE COINS d'une Case DÉFORMÉE (demandé : déformer par les coins, comme une Case ordinaire),
 * en fractions de l'image, dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche (celui de
 * `pts`). Champ AJOUTÉ, absent pour un rectangle ; `regionImage` reste toujours écrit (la boîte
 * englobante), pour qu'une version qui ignore les coins lise une Case à sa place.
 */
export const CHAMP_POINTS_IMAGE = 'pointsImage';

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

/** Les quatre coins d'une Case importée, toujours utilisables (le rectangle si elle n'est pas déformée). PURE. */
export function pointsDeLaCase(o){
  const p = o && o[CHAMP_POINTS_IMAGE];
  if (Array.isArray(p) && p.length === 4 && p.every(q => q && Number.isFinite(Number(q.x)) && Number.isFinite(Number(q.y)))) {
    return p.map(q => ({ x: Number(q.x), y: Number(q.y) }));
  }
  const r = regionValide(o && o[CHAMP_REGION_IMAGE]);
  if (!r) return null;
  return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
}

/**
 * Pose les coins d'une Case : bornés à l'image, et la boîte englobante réécrite dans `regionImage`.
 * Un rectangle droit SUPPRIME `pointsImage` : une Case redressée redevient identique à une Case
 * jamais déformée. PURE vis-à-vis du DOM (modifie `o`).
 */
export function poserPointsDeLaCase(o, pts){
  const c = (v) => Math.min(1, Math.max(0, v));
  const q = pts.map(p => ({ x: c(p.x), y: c(p.y) }));
  const xs = q.map(p => p.x), ys = q.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  o[CHAMP_REGION_IMAGE] = { x: x0, y: y0, w: Math.max(REGION_MIN, x1 - x0), h: Math.max(REGION_MIN, y1 - y0) };
  const droit = q[0].x === q[3].x && q[1].x === q[2].x && q[0].y === q[1].y && q[3].y === q[2].y;
  if (droit) delete o[CHAMP_POINTS_IMAGE]; else o[CHAMP_POINTS_IMAGE] = q;
}

/** Translate des coins sans qu'aucun ne sorte de l'image. PURE. */
export function translaterPoints(pts, dx, dy){
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const ddx = Math.min(1 - Math.max(...xs), Math.max(-Math.min(...xs), dx));
  const ddy = Math.min(1 - Math.max(...ys), Math.max(-Math.min(...ys), dy));
  return pts.map(p => ({ x: p.x + ddx, y: p.y + ddy }));
}

/** Le point (fractions) est-il dans le quadrilatère ? PURE. */
export function dansLesPoints(pts, x, y){
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) dedans = !dedans;
  }
  return dedans;
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
    // Les coins : ceux d'une Case déformée, sinon ceux de son rectangle.
    o.pts = pointsDeLaCase(o).map(q => ({ x: pose.x + q.x * pose.w, y: pose.y + q.y * pose.h }));
  });
  return pose;
}

// ─────────────────────────────────────────────────────────────────────────────
// La détection des Cases
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les réglages de la détection. La TOLÉRANCE est le seul que l'utilisateur voit (le curseur
 * « Sensibilité » de la vérification) : l'écart de gris en deçà duquel un pixel compte comme du papier.
 *
 * ⚠️ CES SEUILS ONT ÉTÉ RÉGLÉS SUR QUINZE PLANCHES RÉELLES fournies par Valentin le 13 octobre 2026
 * (manga, BD franco-belge, comics, doubles pages, captures d'écran avec leur cadre), gardées hors
 * dépôt dans `apercus/planches-test/`. C'est peu : la vérification à l'import reste ce qui rend la
 * détection acceptable, une erreur se corrige avant de valider.
 */
export const DETECTION = Object.freeze({
  tolerance: 40,          // écart de gris (0 à 255) toléré autour de la couleur du papier
  erosion: 0.0025,        // rayon d'érosion, en part du petit côté : coupe les traits fins qui enjambent une gouttière
  gouttiere: 0.006,       // épaisseur minimale d'une gouttière, en part du petit côté
  caseMin: 0.04,          // côté minimal d'une Case, en part du côté correspondant
  surfaceMin: 0.006,      // surface minimale d'une Case, en part de l'image
  partDehors: 0.6,        // part de « papier du dehors » qui fait d'une ligne un morceau de gouttière
  bandeUniformeMax: 0.035, // épaisseur maximale d'une gouttière de couleur (au-delà : un aplat du dessin)
  papierArete: 0.3,       // au-delà de cette part de papier dans une boîte, on n'y coupe pas sur une arête
});

/**
 * La couleur du PAPIER (marges et gouttières), en niveau de gris. PURE.
 *
 * On ne lit plus le pourtour, qui est souvent le CADRE d'une capture d'écran ou le fond noir d'une
 * visionneuse : on compte, à l'intérieur de l'image, les longues plages uniformes de chaque niveau, et
 * on préfère le clair, puis le sombre, pourvu qu'ils pèsent assez. Un grand aplat coloré du dessin ne
 * doit pas passer pour du papier.
 */
function couleurDuPapier(g, w, h){
  const hist = new Float64Array(64);
  const x0 = Math.floor(w * 0.02), x1 = Math.ceil(w * 0.98), y0 = Math.floor(h * 0.02), y1 = Math.ceil(h * 0.98);
  const plageMin = Math.max(8, Math.round(w * 0.02));
  for (let y = y0; y < y1; y += 2) {
    let debut = x0, ref = g[y * w + x0];
    for (let x = x0 + 1; x <= x1; x++) {
      const v = x < x1 ? g[y * w + x] : -999;
      if (Math.abs(v - ref) > 6) {
        if (x - debut >= plageMin) hist[ref >> 2] += x - debut;
        debut = x; ref = v;
      }
    }
  }
  let total = 0; for (let i = 0; i < 64; i++) total += hist[i];
  // Le papier est le PLUS CLAIR des niveaux qui pèsent assez (un gris clair d'aplat peut peser plus
  // lourd que les gouttières, il n'est pas plus clair qu'elles) ; à défaut, le plus sombre.
  const pese = (i) => hist[i] + (i > 0 ? hist[i - 1] : 0) + (i < 63 ? hist[i + 1] : 0) >= total * 0.03;
  for (let i = 63; i >= 56; i--) if (hist[i] > 0 && pese(i)) return i * 4 + 2;
  for (let i = 0; i <= 12; i++) if (hist[i] > 0 && pese(i)) return i * 4 + 2;
  let k = 0; for (let i = 0; i < 64; i++) if (hist[i] > hist[k]) k = i;
  return k * 4 + 2;
}

/**
 * Le CADRE à retirer : les bandes uniformes du bord qui ne sont pas du papier (cadre d'une capture
 * d'écran, fond d'une visionneuse). Rend la zone utile `{ x0, y0, x1, y1 }`. PURE.
 */
function zoneUtile(g, w, h, papier, tolerance){
  const uniforme = (vals) => {
    const t = vals.slice().sort((a, b) => a - b); const m = t[t.length >> 1];
    let n = 0; for (const v of vals) if (Math.abs(v - m) <= 14) n++;
    return n / vals.length > 0.9 && Math.abs(m - papier) > tolerance;
  };
  const ligne = (y) => { const v = []; for (let x = 0; x < w; x += 2) v.push(g[y * w + x]); return v; };
  const colonne = (x, a, b) => { const v = []; for (let y = a; y < b; y += 2) v.push(g[y * w + x]); return v; };
  let t = 0, b = h, l = 0, r = w;
  while (t < h * 0.25 && uniforme(ligne(t))) t++;
  while (b > h * 0.75 && uniforme(ligne(b - 1))) b--;
  while (l < w * 0.25 && uniforme(colonne(l, t, b))) l++;
  while (r > w * 0.75 && uniforme(colonne(r - 1, t, b))) r--;
  return { x0: l, y0: t, x1: r, y1: b };
}

/**
 * Les Cases d'une image en niveaux de gris (`gris` : un octet par pixel, `w` × `h`), en FRACTIONS de
 * l'image, dans l'ordre de lecture. PURE.
 *
 * LA MÉTHODE, en trois temps (la première version, une découpe XY sur les seules lignes de papier
 * pleines, échouait sur la plupart des vraies planches : cadre de capture, fonds perdus, bulles
 * qui débordent) :
 *
 *   1. le PAPIER DU DEHORS : le papier qu'on atteint depuis le bord sans traverser d'encre, c'est-à-
 *      dire les marges et les gouttières. Tout le reste appartient aux Cases, y compris l'intérieur
 *      blanc d'une Case de manga, que son cadre enferme ;
 *   2. les COMPOSANTES de ce reste, après une légère érosion qui coupe les traits fins enjambant une
 *      gouttière (queue de bulle, trait de vitesse). Chacune est une Case, ou plusieurs Cases soudées ;
 *   3. chaque composante est RECOUPÉE le long des séparateurs qu'elle contient encore : bande de papier
 *      du dehors qu'un débord a refermée, bande mince d'une couleur uniforme (gouttière sombre), ou,
 *      dans une boîte presque sans papier, ARÊTE droite encrée qui la traverse (Cases jointives d'un
 *      comics à fond perdu). Une boîte bien cadrée n'est pas recoupée : c'est une Case.
 *
 * ⚠️ CE QU'ELLE NE SAIT TOUJOURS PAS FAIRE : une illustration pleine page où des Cases se posent par-
 * dessus, des Cases inclinées (rendues par leur rectangle), une Case incrustée dans une autre (elle
 * s'y fond), et des Cases sans bordure sur papier blanc (elles s'émiettent).
 */
export function detecterCases(gris, w, h, options = {}){
  const o = { ...DETECTION, ...options };
  if (!gris || !(w > 0) || !(h > 0) || gris.length < w * h) return [];
  const papier = couleurDuPapier(gris, w, h);
  const z = zoneUtile(gris, w, h, papier, o.tolerance);
  const W = z.x1 - z.x0, H = z.y1 - z.y0;
  if (W < 10 || H < 10) return [];
  const gv = (x, y) => gris[(y + z.y0) * w + x + z.x0];
  const estPapier = (x, y) => Math.abs(gv(x, y) - papier) <= o.tolerance;

  // 1. Le papier du dehors, par remplissage depuis le bord.
  const dehors = new Uint8Array(W * H);
  const pile = new Int32Array(W * H);
  let sp = 0;
  const pousser = (p) => { if (!dehors[p] && estPapier(p % W, (p / W) | 0)) { dehors[p] = 1; pile[sp++] = p; } };
  for (let x = 0; x < W; x++) { pousser(x); pousser((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { pousser(y * W); pousser(y * W + W - 1); }
  while (sp) {
    const p = pile[--sp], x = p % W;
    if (x > 0) pousser(p - 1);
    if (x < W - 1) pousser(p + 1);
    if (p >= W) pousser(p - W);
    if (p < W * (H - 1)) pousser(p + W);
  }

  // 2. Le reste, érodé, puis ses composantes.
  const r = Math.max(1, Math.round(Math.min(W, H) * o.erosion));
  const tmp = new Uint8Array(W * H), erode = new Uint8Array(W * H);
  const somme = new Int32Array(Math.max(W, H) + 1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) somme[x + 1] = somme[x] + (dehors[y * W + x] ? 0 : 1);
    for (let x = 0; x < W; x++) { const a = Math.max(0, x - r), b = Math.min(W, x + r + 1); tmp[y * W + x] = somme[b] - somme[a] === b - a ? 1 : 0; }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) somme[y + 1] = somme[y] + tmp[y * W + x];
    for (let y = 0; y < H; y++) { const a = Math.max(0, y - r), b = Math.min(H, y + r + 1); erode[y * W + x] = somme[b] - somme[a] === b - a ? 1 : 0; }
  }
  const etiquette = new Int32Array(W * H);
  let boites = [];
  for (let i = 0; i < W * H; i++) {
    if (!erode[i] || etiquette[i]) continue;
    const id = boites.length + 1;
    let xa = W, xb = 0, ya = H, yb = 0;
    sp = 0; pile[sp++] = i; etiquette[i] = id;
    while (sp) {
      const p = pile[--sp], x = p % W, y = (p / W) | 0;
      if (x < xa) xa = x; if (x > xb) xb = x; if (y < ya) ya = y; if (y > yb) yb = y;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && erode[q] && !etiquette[q]) { etiquette[q] = id; pile[sp++] = q; }
      }
    }
    boites.push({ x0: Math.max(0, xa - r), y0: Math.max(0, ya - r), x1: Math.min(W, xb + r + 1), y1: Math.min(H, yb + r + 1) });
  }
  const assez = (b) => (b.x1 - b.x0) >= W * o.caseMin && (b.y1 - b.y0) >= H * o.caseMin
    && (b.x1 - b.x0) * (b.y1 - b.y0) >= W * H * o.surfaceMin;
  boites = boites.filter(assez);

  // 3. Recouper chaque boîte le long de ses séparateurs.
  const gout = Math.max(2, Math.round(Math.min(W, H) * o.gouttiere));
  // Une ligne : 1 papier du dehors, 2 bande uniforme d'une autre couleur que le papier, 0 rien.
  const ligne = (b, sens, k) => {
    const v = []; let n = 0;
    if (sens === 'h') for (let x = b.x0; x < b.x1; x += 2) { v.push(gv(x, k)); if (dehors[k * W + x]) n++; }
    else for (let y = b.y0; y < b.y1; y += 2) { v.push(gv(k, y)); if (dehors[y * W + k]) n++; }
    if (n / v.length >= o.partDehors) return 1;
    const t = v.slice().sort((p, q) => p - q), m = t[t.length >> 1];
    let u = 0; for (const x of v) if (Math.abs(x - m) <= 12) u++;
    return u / v.length >= 0.9 && Math.abs(m - papier) > o.tolerance ? 2 : 0;
  };
  // La part d'une ligne où l'image change franchement de part et d'autre (une arête droite).
  const arete = (b, sens, k) => {
    const lim = sens === 'h' ? H : W;
    if (k < 1 || k >= lim - 1) return 0;
    let n = 0, t = 0;
    for (let i = (sens === 'h' ? b.x0 : b.y0); i < (sens === 'h' ? b.x1 : b.y1); i += 2) {
      t++;
      const d = sens === 'h' ? gv(i, k + 1) - gv(i, k - 1) : gv(k + 1, i) - gv(k - 1, i);
      if (Math.abs(d) > 28) n++;
    }
    return t ? n / t : 0;
  };
  // … et cette arête est un TRAIT encré sur au moins la moitié de sa longueur : le bord d'une Case
  // l'est, une ligne d'horizon ou la limite d'un aplat ne l'est pas.
  const trait = (b, sens, k) => {
    const lim = sens === 'h' ? H : W;
    let n = 0, t = 0;
    for (let i = (sens === 'h' ? b.x0 : b.y0); i < (sens === 'h' ? b.x1 : b.y1); i += 2) {
      t++;
      let m = 255;
      for (let d = -2; d <= 2; d++) {
        const kk = k + d;
        if (kk >= 0 && kk < lim) m = Math.min(m, sens === 'h' ? gv(i, kk) : gv(kk, i));
      }
      if (m < 90) n++;
    }
    return t ? n / t : 0;
  };
  const partDePapier = (b) => {
    let n = 0, t = 0;
    for (let y = b.y0; y < b.y1; y += 6) for (let x = b.x0; x < b.x1; x += 6) { t++; if (estPapier(x, y)) n++; }
    return t ? n / t : 0;
  };
  const couper = (b, sens, seulementTraits = false) => {
    const a0 = sens === 'h' ? b.y0 : b.x0, a1 = sens === 'h' ? b.y1 : b.x1;
    const maxUni = Math.round((sens === 'h' ? H : W) * o.bandeUniformeMax);
    const f = [];
    for (let k = a0; k < a1; k++) f.push(ligne(b, sens, k));
    const coupes = [];
    for (let k = 0; k < f.length && !seulementTraits;) {
      if (!f[k]) { k++; continue; }
      let e = k, n1 = 0;
      while (e < f.length && f[e]) { if (f[e] === 1) n1++; e++; }
      if (k > 0 && e < f.length && e - k >= gout && (n1 * 2 >= e - k || e - k <= maxUni)) coupes.push([k, e]);
      k = e;
    }
    if (partDePapier(b) < o.papierArete) {
      const marge = Math.round((a1 - a0) * 0.15);
      let dernier = -1e9;
      for (let k = a0 + marge; k < a1 - marge; k++) {
        const v = arete(b, sens, k);
        if (v >= 0.6 && v >= arete(b, sens, k - 1) && v >= arete(b, sens, k + 1) && k - a0 - dernier > gout
          && !coupes.some(([p, q]) => k - a0 >= p - gout && k - a0 <= q + gout) && trait(b, sens, k) >= (seulementTraits ? 0.85 : 0.5)) {
          coupes.push([k - a0, k - a0 + 1]);
          dernier = k - a0;
        }
      }
      coupes.sort((p, q) => p[0] - q[0]);
    }
    if (!coupes.length) return [b];
    const morceaux = [];
    let debut = 0;
    for (const [p, q] of coupes) { morceaux.push([debut, p]); debut = q; }
    morceaux.push([debut, f.length]);
    return morceaux.map(([p, q]) => (sens === 'h' ? { ...b, y0: a0 + p, y1: a0 + q } : { ...b, x0: a0 + p, x1: a0 + q }));
  };
  // Une boîte BIEN CADRÉE : son pourtour intérieur est encré, son pourtour extérieur est du papier.
  const tour = (b, d, test) => {
    let n = 0, t = 0;
    for (let x = b.x0; x < b.x1; x += 2) for (const y of [b.y0 + d, b.y1 - 1 - d]) { if (y < 0 || y >= H) continue; t++; if (test(x, y)) n++; }
    for (let y = b.y0; y < b.y1; y += 2) for (const x of [b.x0 + d, b.x1 - 1 - d]) { if (x < 0 || x >= W) continue; t++; if (test(x, y)) n++; }
    return t ? n / t : 1;
  };
  const bienCadree = (b) => tour(b, 2, (x, y) => !estPapier(x, y)) >= 0.85 && tour(b, -3, estPapier) >= 0.5;
  // Un morceau sans ses bords de papier du dehors (ce qui reste d'une gouttière coupée).
  const rogner = (b) => {
    const vide = (sens, k) => {
      let n = 0, t = 0;
      if (sens === 'h') for (let x = b.x0; x < b.x1; x += 3) { t++; if (dehors[k * W + x]) n++; }
      else for (let y = b.y0; y < b.y1; y += 3) { t++; if (dehors[y * W + k]) n++; }
      return t > 0 && n / t >= 0.9;
    };
    const c = { ...b };
    while (c.y1 - c.y0 > 2 && vide('h', c.y0)) c.y0++;
    while (c.y1 - c.y0 > 2 && vide('h', c.y1 - 1)) c.y1--;
    while (c.x1 - c.x0 > 2 && vide('v', c.x0)) c.x0++;
    while (c.x1 - c.x0 > 2 && vide('v', c.x1 - 1)) c.x1--;
    return c;
  };
  const decouper = (b0, profondeur) => {
    const b = profondeur ? rogner(b0) : b0;
    if (profondeur >= 8) return [b];
    // Bien cadrée, ce peut être une Case… ou plusieurs Cases jointives sous un même cadre : on n'y
    // coupe alors que sur un trait encré presque continu.
    const cadree = bienCadree(b);
    for (const sens of ['h', 'v']) {
      const m = couper(b, sens, cadree).filter(assez);
      if (m.length > 1) return m.flatMap(x => decouper(x, profondeur + 1));
    }
    return [b];
  };
  const cases = boites.flatMap(b => decouper(b, 0)).filter(assez)
    .map(b => ({ x: (b.x0 + z.x0) / w, y: (b.y0 + z.y0) / h, w: (b.x1 - b.x0) / w, h: (b.y1 - b.y0) / h }));
  return ordreDeLecture(cases, { double: w / h > 1.15 });
}

/**
 * Les régions dans l'ordre de LECTURE, celui qui numérote les Cases : par rangées (deux régions
 * dont les hauteurs se recouvrent de moitié au moins sont sur la même rangée), puis de gauche à
 * droite. Sert après la vérification, où l'utilisateur a pu ajouter une Case n'importe où. PURE.
 */
export function ordreDeLecture(regions, { double = false } = {}){
  // Une DOUBLE PAGE se lit page par page : toute la page de gauche, puis celle de droite. Une Case
  // à cheval va du côté de son centre.
  if (double) {
    const liste = (regions || []).map(regionValide).filter(Boolean);
    const gauche = liste.filter(r => r.x + r.w / 2 < 0.5), droite = liste.filter(r => r.x + r.w / 2 >= 0.5);
    return [...ordreDeLecture(gauche), ...ordreDeLecture(droite)];
  }
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

/** Une région tracée entre deux points (fractions), ou null si elle est trop petite. PURE. */
export function regionTracee(a, b){
  const x0 = Math.max(0, Math.min(a.x, b.x)), x1 = Math.min(1, Math.max(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y)), y1 = Math.min(1, Math.max(a.y, b.y));
  return (x1 - x0 >= REGION_MIN && y1 - y0 >= REGION_MIN) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/**
 * La luminosité moyenne (0 à 255) de l'image LE LONG DU CONTOUR d'une Case, `pts` en fractions :
 * ce sur quoi sa bordure se dessine. Échantillonnée tous les ~3 pixels de l'image analysée. PURE.
 */
export function luminositeDuContour(gris, w, h, pts){
  if (!gris || !pts || pts.length < 2) return null;
  let somme = 0, n = 0;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    const pas = Math.max(1, Math.round(Math.hypot((b.x - a.x) * w, (b.y - a.y) * h) / 3));
    for (let i = 0; i < pas; i++) {
      const t = i / pas;
      const x = Math.min(w - 1, Math.max(0, Math.round((a.x + (b.x - a.x) * t) * w)));
      const y = Math.min(h - 1, Math.max(0, Math.round((a.y + (b.y - a.y) * t) * h)));
      somme += gris[y * w + x]; n++;
    }
  }
  return n ? somme / n : null;
}

/** Le seuil de luminosité au-delà duquel le dessin est « clair ». */
export const SEUIL_CLAIR = 128;

/**
 * La couleur qui alterne avec l'orange quand une Case clignote : NOIRE sur un dessin clair, BLANCHE
 * sur un dessin sombre (demandé). Inconnue (image pas encore lue) : noire, le cas le plus fréquent. PURE.
 */
export function couleurDeContraste(luminosite){
  return (luminosite === null || luminosite === undefined || luminosite >= SEUIL_CLAIR) ? '#000' : '#fff';
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

/** L'écart de proportions toléré entre une planche importée et le format de son Tome (3 %). */
export const ECART_DE_FORMAT = 0.03;

/**
 * Le format qu'il faudrait au Tome pour accueillir cette planche sans bandes : `{ w, h }` en unités
 * de Planche, à la HAUTEUR du Tome (la mise en page garde son échelle), ou null si les proportions
 * s'accordent déjà. PURE.
 */
export function formatPourLaPlanche(tome, largeur, hauteur){
  const tw = Number(tome && tome.w), th = Number(tome && tome.h), lw = Number(largeur), lh = Number(hauteur);
  if (![tw, th, lw, lh].every(v => Number.isFinite(v) && v > 0)) return null;
  const rTome = tw / th, rPlanche = lw / lh;
  if (Math.abs(rPlanche / rTome - 1) <= ECART_DE_FORMAT) return null;
  return { w: Math.max(100, Math.round(th * rPlanche)), h: th };
}

/**
 * Le Tome peut-il changer de format sans rien déranger ? Oui si ses AUTRES Planches sont vides ou
 * importées (celles-ci se reposent d'elles-mêmes) ; une Planche dessinée à la main garderait ses
 * Cases à des positions faites pour l'ancien format. PURE.
 */
export function tomeAdaptable(tome, pageId){
  return (tome && tome.pages || []).every(p => p.id === pageId || estPlancheImportee(p) || !(p.objects || []).length);
}
