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
  const echelleCouvrante = Math.max(L / imgL, H / imgH);   // l'image qui couvre toute la carte
  let e = boite ? Math.min((L - 2 * m) / bl, (H - 2 * m) / bh, echelleImage * max) : echelleImage;
  // ⚠️ COUVRIR QUAND ON LE PEUT (signalé : bords mal raccordés sur Sketchfab, dont les fonds sont des
  // dégradés radiaux, des photos floues ou deux couleurs). Une image qui ne couvre pas la carte laisse
  // voir le fond reconstitué, et le raccord se voit. Si le sujet tient encore dans la carte, avec au
  // moins la moitié de la marge, à l'échelle qui couvre, on la prend : plus aucun fond reconstitué.
  if (boite && e < echelleCouvrante && echelleCouvrante <= echelleImage * max
    && bl * echelleCouvrante <= L - m && bh * echelleCouvrante <= H - m) e = echelleCouvrante;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  let x = L / 2 - cx * e, y = H / 2 - cy * e;
  const l = imgL * e, h = imgH * e;
  // Une image qui couvre la carte n'en découvre aucun bord : le centrage sur le sujet est borné.
  if (l >= L) x = Math.min(0, Math.max(L - l, x));
  if (h >= H) y = Math.min(0, Math.max(H - h, y));
  return { x, y, l, h };
}

/**
 * Draws, around `pose`, the image's outer band of pixels stretched to the card's edges (each side,
 * and its corners), softened by a light blur. The bands also run a little INSIDE the image, under its
 * faded edge, so that the fade shows the same colours. A side the SUBJECT touches (`b`, in source
 * pixels) is not extended: its band would streak the subject across the card; the corner gradient
 * shows there instead. The work canvas is wider than the card so that the blur does not darken its edges.
 */
function prolongerLesBords(c, source, sl, sh, pose, L, H, b){
  const P = Math.max(4, Math.round(Math.max(L, H) / 20));   // padding beyond the card, for the blur
  const t = document.createElement('canvas');
  t.width = L + 2 * P; t.height = H + 2 * P;
  const tc = t.getContext('2d');
  const x = pose.x + P, y = pose.y + P, l = pose.l, h = pose.h;
  const s = Math.max(1, Math.round(Math.min(sl, sh) * 0.01));   // the band taken, in source pixels
  const f = Math.min(l, h) * 0.08;                               // how far it runs under the faded edge
  const touche = (d) => d <= 2 * s;
  const ok = { g: !(b && touche(b.x0)), d: !(b && touche(sl - b.x1)), h: !(b && touche(b.y0)), b: !(b && touche(sh - b.y1)) };
  const W = t.width, Ht = t.height;
  const gx0 = Math.max(0, x), gx1 = Math.max(0, W - (x + l)), gy0 = Math.max(0, y), gy1 = Math.max(0, Ht - (y + h));
  const dessiner = (sx, sy, sw, sh2, dx, dy, dw, dh) => { if (dw > 0 && dh > 0) tc.drawImage(source, sx, sy, sw, sh2, dx, dy, dw, dh); };
  if (gx0 > 0 && ok.g) dessiner(0, 0, s, sh, 0, y, gx0 + f, h);
  if (gx1 > 0 && ok.d) dessiner(sl - s, 0, s, sh, x + l - f, y, gx1 + f, h);
  if (gy0 > 0 && ok.h) dessiner(0, 0, sl, s, x, 0, l, gy0 + f);
  if (gy1 > 0 && ok.b) dessiner(0, sh - s, sl, s, x, y + h - f, l, gy1 + f);
  if (gx0 > 0 && gy0 > 0 && ok.g && ok.h) dessiner(0, 0, s, s, 0, 0, gx0 + f, gy0 + f);
  if (gx1 > 0 && gy0 > 0 && ok.d && ok.h) dessiner(sl - s, 0, s, s, x + l - f, 0, gx1 + f, gy0 + f);
  if (gx0 > 0 && gy1 > 0 && ok.g && ok.b) dessiner(0, sh - s, s, s, 0, y + h - f, gx0 + f, gy1 + f);
  if (gx1 > 0 && gy1 > 0 && ok.d && ok.b) dessiner(sl - s, sh - s, s, s, x + l - f, y + h - f, gx1 + f, gy1 + f);
  c.save();
  c.filter = `blur(${Math.max(2, Math.round(Math.max(L, H) / 60))}px)`;
  c.drawImage(t, -P, -P);
  c.restore();
}

/** Une couleur `[r, g, b]` en chaîne CSS. */
const css = (c) => `rgb(${c.map(v => Math.round(v)).join(',')})`;

/**
 * Recompose `source` (une image ou un ImageBitmap décodé) dans un canevas `L × H` : fond en dégradé
 * des coins, sujet cadré, bords de l'image fondus dans le fond. Rend le canevas.
 */
export function recomposer(source, L, H, marge = MARGE){
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
  const pose = cadrageDuSujet(b, sl, sh, L, H, marge);

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
  // Puis, quand l'image ne couvre pas la carte, SES BORDS PROLONGÉS : la dernière bande de pixels de
  // chaque côté, étirée jusqu'au bord de la carte puis adoucie. Ses propres couleurs de fond bordent
  // ses bords (le dégradé des coins se raccordait mal sur Sketchfab), et le sujet n'est jamais recopié
  // (⚠️ signalé : l'image entière floutée en fond montrait le modèle flou derrière lui-même).
  if (pose.l < L || pose.h < H) prolongerLesBords(c, source, sl, sh, pose, L, H, b);
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
