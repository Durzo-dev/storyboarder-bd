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
 * La couleur MOYENNE de la bande extérieure de chaque côté `{ g, d, h, b }` (3 % de la plus petite
 * dimension). ⚠️ UNE MOYENNE, PAS LA BANDE ÉTIRÉE (signalé) : étirer la bande recopiait ses variations
 * (vignettage, fond photo) en traînées. Une couleur par côté, fondue dans ses voisines, n'en fait aucune.
 */
export function couleursDesBords(rgba, w, h){
  const n = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  const moy = (x0, y0, x1, y1) => {
    const s = [0, 0, 0];
    let c = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      s[0] += rgba[i]; s[1] += rgba[i + 1]; s[2] += rgba[i + 2]; c++;
    }
    return s.map(v => v / Math.max(1, c));
  };
  return { g: moy(0, 0, n, h), d: moy(w - n, 0, w, h), h: moy(0, 0, w, n), b: moy(0, h - n, w, h) };
}

/** Au-delà de cet écart-type de luminosité sur la bande de bord, le fond n'est plus « uni ». */
export const SEUIL_FOND_UNI = 15;
/** Un fond varié couvre la carte si l'on en garde au moins cette part (sinon il prend toute la largeur). */
export const PART_COUVERTE_MIN = 0.8;

/**
 * Le fond de l'image est-il UNI sur son pourtour ? Mesuré sur de vraies vignettes Sketchfab (10 nov.
 * 2026) : écart-type de 5 à 11 pour un fond uni ou un dégradé doux, de 20 à 63 pour un vignettage ou
 * une photo floue. Seul un fond uni se prolonge sans raccord visible autour de l'image.
 * Un pourtour surtout TRANSPARENT (les vignettes de Poly Haven, sujet détouré qui touche ses bords) est
 * uni : la transparence ne se mesure pas, seuls les pixels opaques comptent, et s'ils sont moins d'un
 * tiers du pourtour, le fond est uni.
 */
export function bordsUnis(rgba, w, h, seuil = SEUIL_FOND_UNI){
  const n = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  let s = 0, s2 = 0, c = 0, total = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= n && x < w - n && y >= n && y < h - n) continue;
    const i = (y * w + x) * 4;
    total++;
    if (rgba[i + 3] < 250) continue;
    const l = 0.3 * rgba[i] + 0.59 * rgba[i + 1] + 0.11 * rgba[i + 2];
    s += l; s2 += l * l; c++;
  }
  if (!c || c < total / 3) return true;
  const m = s / c;
  return Math.sqrt(Math.max(0, s2 / c - m * m)) <= seuil;
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
export function cadrageDuSujet(boite, imgL, imgH, L, H, marge = MARGE, max = AGRANDISSEMENT_MAX, unis = true){
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
  // The margin is checked AFTER the image is held against the card's edges (seen: a head touching the
  // top of its thumbnail ended up touching the top of the record).
  const tientCouvert = () => {
    const ec = echelleCouvrante, l0 = imgL * ec, h0 = imgH * ec;
    const x0 = Math.min(0, Math.max(L - l0, L / 2 - ((b.x0 + b.x1) / 2) * ec));
    const y0 = Math.min(0, Math.max(H - h0, H / 2 - ((b.y0 + b.y1) / 2) * ec));
    const d = m / 2;
    return x0 + b.x0 * ec >= d - 1e-6 && x0 + b.x1 * ec <= L - d + 1e-6 && y0 + b.y0 * ec >= d - 1e-6 && y0 + b.y1 * ec <= H - d + 1e-6;
  };
  if (boite && e < echelleCouvrante && echelleCouvrante <= echelleImage * max && tientCouvert()) e = echelleCouvrante;
  // ⚠️ UN FOND VARIÉ (vignettage, photo floue) NE SE PROLONGE PAS : aucun remplissage ne s'y raccorde
  // (signalé à trois reprises). L'image n'est donc jamais réduite sous sa taille contenue pour ménager
  // une marge, et elle couvre la carte dès qu'on en garde au moins 80 % (une carte 3:2 d'une image
  // 16:9 : 84 %). Seule une fiche haute garde un vide, en haut et en bas seulement.
  if (!unis) {
    e = Math.max(e, echelleImage);
    if (e < echelleCouvrante && echelleImage / echelleCouvrante >= PART_COUVERTE_MIN) e = echelleCouvrante;
  }
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  let x = L / 2 - cx * e, y = H / 2 - cy * e;
  const l = imgL * e, h = imgH * e;
  // Sur un fond VARIÉ, une image qui couvre la carte n'en découvre aucun bord : le centrage sur le sujet
  // est borné. Sur un fond UNI, le sujet garde sa marge, quitte à découvrir un bord qui se comble sans
  // raccord (signalé : une tête qui touchait le haut de sa vignette touchait celui de la fiche).
  // Une image qui couvre la carte en entier (le cas « couvrir » ci-dessus) est toujours bornée.
  const borner = !unis || e === echelleCouvrante;
  if (borner && l >= L) x = Math.min(0, Math.max(L - l, x));
  if (borner && h >= H) y = Math.min(0, Math.max(H - h, y));
  return { x, y, l, h };
}

/** La moyenne de plusieurs couleurs `[r, g, b]`. */
const moyenneDe = (cs) => [0, 1, 2].map(k => cs.reduce((t, c) => t + c[k], 0) / cs.length);

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
  const pose = cadrageDuSujet(b, sl, sh, L, H, marge, AGRANDISSEMENT_MAX, bordsUnis(rgba, al, ah));

  const sortie = document.createElement('canvas');
  sortie.width = L; sortie.height = H;
  const c = sortie.getContext('2d');
  // Le fond : une grille 3 × 3 agrandie en un dégradé lisse. Les milieux des côtés ont la couleur
  // moyenne de la bande de bord de l'image (couleursDesBords), les coins celle des coins de l'image :
  // là où l'image ne couvre pas la carte, ses bords se fondent dans leurs propres couleurs.
  // ⚠️ Jamais l'image elle-même en fond (floutée : une copie floue du modèle ; bandes étirées : des traînées).
  const bords = couleursDesBords(rgba, al, ah);
  const grille = [coins[0], bords.h, coins[1], bords.g, moyenneDe([bords.g, bords.d, bords.h, bords.b]), bords.d, coins[2], bords.b, coins[3]];
  const g = document.createElement('canvas');
  g.width = 3; g.height = 3;
  const gc = g.getContext('2d');
  grille.forEach((col, i) => { gc.fillStyle = css(col); gc.fillRect(i % 3, Math.floor(i / 3), 1, 1); });
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(g, 0.5, 0.5, 2, 2, 0, 0, L, H);
  // L'image, aux bords fondus : un masque qui s'efface sur 8 % de sa plus petite dimension.
  const pose2 = document.createElement('canvas');
  pose2.width = Math.max(1, Math.round(pose.l)); pose2.height = Math.max(1, Math.round(pose.h));
  const pc = pose2.getContext('2d');
  pc.imageSmoothingQuality = 'high';
  pc.drawImage(source, 0, 0, pose2.width, pose2.height);
  // Le fondu s'arrête AVANT le sujet (mesuré : un sujet qui touchait le bord de l'image était effacé) :
  // de chaque côté, au plus 8 %, et jamais plus que la distance entre ce bord et la boîte du sujet.
  // Plus long (16 %) d'un côté où l'image laisse un vide à combler : le raccord y est plus doux.
  const base = Math.min(pose2.width, pose2.height);
  const fl = Math.max(2, base * 0.16);
  const vide = { g: pose.x > 0.5, d: pose.x + pose.l < L - 0.5, h: pose.y > 0.5, b: pose.y + pose.h < H - 0.5 };
  const e = pose2.width / sl;
  const cote = b ? { g: b.x0 * e, d: (sl - b.x1) * e, h: b.y0 * e, b: (sh - b.y1) * e } : { g: fl, d: fl, h: fl, b: fl };
  // No fade on a side without a gap: the image runs past the card there, a fade only let the gradient
  // beneath show through along the edge.
  const fg = vide.g ? Math.min(fl, cote.g) : 0, fd = vide.d ? Math.min(fl, cote.d) : 0;
  const fh = vide.h ? Math.min(fl, cote.h) : 0, fb = vide.b ? Math.min(fl, cote.b) : 0;
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
