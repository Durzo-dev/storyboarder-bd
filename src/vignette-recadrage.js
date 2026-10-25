/**
 * @file vignette-recadrage.js
 * LE RECADRAGE AUTOMATIQUE DES VIGNETTES DES STORES (demandé : « les modèles n'occupent pas assez
 * l'espace », « trop proches des bords, le fond devient horrible »).
 *
 * Les vignettes des sources sont faites pour LEUR site : un objet minuscule au milieu d'un grand
 * fond (Sketchfab), une sphère qui touche le haut et le bas d'un carré (Poly Haven). On les recompose
 * au format de la carte :
 *
 *   1. le FOND est estimé sur le pourtour de l'image : la couleur de chaque coin, pour suivre un
 *      dégradé (fondDesCoins) ;
 *   2. le SUJET est ce qui s'en écarte nettement : sa boîte, à bas prix sur une image réduite
 *      (boiteDuSujet) ;
 *   3. le CADRAGE agrandit (ou réduit) l'image pour que la boîte remplisse la carte moins une marge,
 *      centrée (cadrageDuSujet) ;
 *   4. le fond de la carte est le dégradé des quatre coins, et l'image y est posée avec des bords
 *      FONDUS : là où elle ne couvre pas la carte, on ne voit ni ligne ni traînée.
 *
 * Les trois premières étapes sont PURES et testées ; seule la dernière touche un canevas.
 */

/** La marge autour du sujet, en part de la hauteur de la carte (demandé : rien ne colle au bord). */
export const MARGE = 0.1;
/** On n'agrandit pas au-delà : une vignette de 512 px grossie davantage deviendrait floue. */
export const AGRANDISSEMENT_MAX = 2.6;
/** Le saut de couleur entre deux pixels voisins (somme des trois canaux) qui marque un contour. */
export const SEUIL_SUJET = 40;

const moyenne = (rgba, w, x0, y0, n) => {
  const s = [0, 0, 0];
  let c = 0;
  for (let y = y0; y < y0 + n; y++) for (let x = x0; x < x0 + n; x++) {
    const i = (y * w + x) * 4;
    s[0] += rgba[i]; s[1] += rgba[i + 1]; s[2] += rgba[i + 2]; c++;
  }
  return s.map(v => v / Math.max(1, c));
};

/** La couleur des quatre coins `[hautG, hautD, basG, basD]`, chacune moyennée sur un petit carré. */
export function fondDesCoins(rgba, w, h){
  const n = Math.max(1, Math.round(Math.min(w, h) * 0.04));
  return [moyenne(rgba, w, 0, 0, n), moyenne(rgba, w, w - n, 0, n), moyenne(rgba, w, 0, h - n, n), moyenne(rgba, w, w - n, h - n, n)];
}


/**
 * La boîte du sujet `{ x0, y0, x1, y1 }` (en pixels de l'image analysée), ou null s'il n'y a rien
 * qui se distingue du fond.
 *
 * ⚠️ PAR LES CONTOURS, PAS PAR LA COULEUR. Un fond en dégradé RADIAL (Sketchfab : clair au centre,
 * sombre aux coins) s'écarte partout de la couleur de ses coins, et la boîte prenait toute l'image
 * (mesuré : un petit sujet n'était pas agrandi). Un dégradé change LENTEMENT d'un pixel à l'autre ;
 * le bord d'un objet, brusquement. On garde donc les pixels où la couleur saute. Un fond texturé
 * (une photo) saute partout : la boîte couvre tout, et rien n'est agrandi, ce qui est le bon repli.
 * Une rangée ou une colonne ne compte que si plus de 1 % de ses pixels sautent (le bruit ne compte pas).
 */
export function boiteDuSujet(rgba, w, h, seuil = SEUIL_SUJET){
  const parLigne = new Array(h).fill(0), parColonne = new Array(w).fill(0);
  const ecart = (i, j) => Math.abs(rgba[i] - rgba[j]) + Math.abs(rgba[i + 1] - rgba[j + 1]) + Math.abs(rgba[i + 2] - rgba[j + 2]);
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (Math.max(ecart(i, i + 4), ecart(i, i + w * 4)) > seuil) { parLigne[y]++; parColonne[x]++; }
  }
  const minL = Math.max(1, w * 0.01), minC = Math.max(1, h * 0.01);
  const y0 = parLigne.findIndex(n => n >= minL), x0 = parColonne.findIndex(n => n >= minC);
  if (y0 < 0 || x0 < 0) return null;
  const y1 = h - 1 - [...parLigne].reverse().findIndex(n => n >= minL);
  const x1 = w - 1 - [...parColonne].reverse().findIndex(n => n >= minC);
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/**
 * Où poser l'image (`{ x, y, l, h }` en pixels de la carte) pour que la boîte du sujet remplisse la
 * carte `L × H` moins la marge, centrée. Sans sujet : l'image entière, contenue et centrée.
 */
export function cadrageDuSujet(boite, imgL, imgH, L, H, marge = MARGE, max = AGRANDISSEMENT_MAX){
  const m = H * marge;
  const b = boite || { x0: 0, y0: 0, x1: imgL, y1: imgH };
  const bl = Math.max(1, b.x1 - b.x0), bh = Math.max(1, b.y1 - b.y0);
  const echelleImage = Math.min(L / imgL, H / imgH);   // l'image entière, contenue
  const e = boite ? Math.min((L - 2 * m) / bl, (H - 2 * m) / bh, echelleImage * max) : echelleImage;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return { x: L / 2 - cx * e, y: H / 2 - cy * e, l: imgL * e, h: imgH * e };
}

/** Une couleur `[r, g, b]` en chaîne CSS. */
const css = (c) => `rgb(${c.map(v => Math.round(v)).join(',')})`;

/**
 * Recompose `source` (une image ou un ImageBitmap décodé) dans un canevas `L × H` : fond en dégradé
 * des coins, sujet cadré, bords de l'image fondus dans le fond. Rend le canevas.
 */
export function recomposer(source, L, H){
  // ⚠️ LA TAILLE NATURELLE, PAS CELLE AFFICHÉE : `width` d'une <img> est sa largeur à l'écran (la
  // carte), et l'image en était déformée (signalé : la commode étirée). Un ImageBitmap n'a que `width`.
  const sl = source.naturalWidth || source.width, sh = source.naturalHeight || source.height;
  // L'analyse se fait sur une réduction (128 px de large) : assez pour une boîte, sans coût.
  const al = Math.min(128, sl), ah = Math.max(1, Math.round(sh * al / sl));
  const analyse = document.createElement('canvas');
  analyse.width = al; analyse.height = ah;
  const ac = analyse.getContext('2d', { willReadFrequently: true });
  ac.drawImage(source, 0, 0, al, ah);
  const rgba = ac.getImageData(0, 0, al, ah).data;
  const coins = fondDesCoins(rgba, al, ah);
  const boite = boiteDuSujet(rgba, al, ah);
  const k = sl / al;
  const b = boite && { x0: boite.x0 * k, y0: boite.y0 * k, x1: boite.x1 * k, y1: boite.y1 * k };
  const pose = cadrageDuSujet(b, sl, sh, L, H);

  const sortie = document.createElement('canvas');
  sortie.width = L; sortie.height = H;
  const c = sortie.getContext('2d');
  // Le fond : les quatre coins, étirés en un dégradé lisse (une image de 2 × 2 agrandie).
  const g = document.createElement('canvas');
  g.width = 2; g.height = 2;
  const gc = g.getContext('2d');
  coins.forEach((col, i) => { gc.fillStyle = css(col); gc.fillRect(i % 2, i > 1 ? 1 : 0, 1, 1); });
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(g, 0.5, 0.5, 1, 1, 0, 0, L, H);
  // L'image, aux bords fondus : un masque qui s'efface sur 8 % de sa plus petite dimension.
  const pose2 = document.createElement('canvas');
  pose2.width = Math.max(1, Math.round(pose.l)); pose2.height = Math.max(1, Math.round(pose.h));
  const pc = pose2.getContext('2d');
  pc.imageSmoothingQuality = 'high';
  pc.drawImage(source, 0, 0, pose2.width, pose2.height);
  // Le fondu s'arrête AVANT le sujet (mesuré : un sujet qui touchait le bord de l'image était effacé) :
  // de chaque côté, au plus 8 %, et jamais plus que la distance entre ce bord et la boîte du sujet.
  const f = Math.max(2, Math.min(pose2.width, pose2.height) * 0.08);
  const e = pose2.width / sl;
  const cote = b ? { g: b.x0 * e, d: (sl - b.x1) * e, h: b.y0 * e, b: (sh - b.y1) * e } : { g: f, d: f, h: f, b: f };
  const fg = Math.min(f, cote.g), fd = Math.min(f, cote.d), fh = Math.min(f, cote.h), fb = Math.min(f, cote.b);
  pc.globalCompositeOperation = 'destination-out';
  const fondu = (x0, y0, x1, y1, rx, ry, rl, rh) => {
    const d = pc.createLinearGradient(x0, y0, x1, y1);
    d.addColorStop(0, 'rgba(0,0,0,1)'); d.addColorStop(1, 'rgba(0,0,0,0)');
    pc.fillStyle = d; pc.fillRect(rx, ry, rl, rh);
  };
  const W = pose2.width, Hh = pose2.height;
  if (fg >= 1) fondu(0, 0, fg, 0, 0, 0, fg, Hh);
  if (fd >= 1) fondu(W, 0, W - fd, 0, W - fd, 0, fd, Hh);
  if (fh >= 1) fondu(0, 0, 0, fh, 0, 0, W, fh);
  if (fb >= 1) fondu(0, Hh, 0, Hh - fb, 0, Hh - fb, W, fb);
  c.drawImage(pose2, pose.x, pose.y);
  return sortie;
}
