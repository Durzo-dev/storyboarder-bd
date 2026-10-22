/**
 * @file batiment-plan.js
 * La VUE DE DESSUS de l'éditeur de bâtiments (#454a) : le repère, la grille, le cadrage, le zoom,
 * et la forme d'un mur. Fonctions PURES : l'écran (batiment-editeur-ui.js) dessine ce qu'elles
 * calculent, et les tests les vérifient sans canevas.
 *
 * LE REPÈRE. Le bâtiment est en mètres (x vers la droite, z vers le bas, cf. batiment.js). Une vue
 * est `{ cx, cz, echelle }` : le point du bâtiment au centre de l'écran, et des px par mètre.
 */

/** Les bornes du zoom, en px par mètre (de la ville à la poignée de porte). */
export const ECHELLE_MIN = 2, ECHELLE_MAX = 400;
/** L'écart minimal entre deux lignes de la grille fine, en px. */
const ECART_MIN = 14;
/** Les pas de grille possibles, en mètres. */
const PAS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100];

/** Un point du bâtiment (m) → un point de l'écran (px), pour un écran `l`×`h`. */
export function versEcran(vue, l, h, p){
  return { x: l / 2 + (p.x - vue.cx) * vue.echelle, y: h / 2 + (p.z - vue.cz) * vue.echelle };
}
/** Un point de l'écran (px) → un point du bâtiment (m). */
export function versBatiment(vue, l, h, e){
  return { x: vue.cx + (e.x - l / 2) / vue.echelle, z: vue.cz + (e.y - h / 2) / vue.echelle };
}

/**
 * La grille : un pas FIN (le plus petit dont les lignes restent à `ECART_MIN` px l'une de l'autre)
 * et un pas FORT (cinq fois le fin, sauf quand le fin vaut 0,25 m ou 25 m : alors quatre, pour
 * tomber sur le mètre).
 */
export function pasDeGrille(echelle){
  const fin = PAS.find(p => p * echelle >= ECART_MIN) || PAS[PAS.length - 1];
  const fort = fin * (String(fin).includes('25') ? 4 : 5);
  return { fin, fort };
}

/** Le zoom, borné, AUTOUR d'un point de l'écran (le point sous la souris ne bouge pas). */
export function zoomerAutour(vue, l, h, e, facteur){
  const avant = versBatiment(vue, l, h, e);
  const echelle = Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN, vue.echelle * facteur));
  const v = { ...vue, echelle };
  const apres = versBatiment(v, l, h, e);
  return { cx: v.cx + avant.x - apres.x, cz: v.cz + avant.z - apres.z, echelle };
}

/** Glisser la vue de `dx`, `dy` px (la main). */
export function glisserVue(vue, dx, dy){
  return { ...vue, cx: vue.cx - dx / vue.echelle, cz: vue.cz - dy / vue.echelle };
}

/** Les quatre coins d'un mur (rectangle de son épaisseur autour de son axe a→b), en mètres. */
export function polygoneDuMur(mur){
  const dx = mur.b.x - mur.a.x, dz = mur.b.z - mur.a.z;
  const L = Math.hypot(dx, dz) || 1;
  const nx = -dz / L * mur.epaisseur / 2, nz = dx / L * mur.epaisseur / 2;
  return [
    { x: mur.a.x + nx, z: mur.a.z + nz }, { x: mur.b.x + nx, z: mur.b.z + nz },
    { x: mur.b.x - nx, z: mur.b.z - nz }, { x: mur.a.x - nx, z: mur.a.z - nz },
  ];
}

/** La boîte des murs d'un niveau (tous niveaux si `niveauId` est absent), ou null s'il n'y en a pas. */
export function boiteDesMurs(batiment, niveauId){
  const pts = (batiment && batiment.murs || [])
    .filter(m => !niveauId || m.niveauId === niveauId)
    .flatMap(polygoneDuMur);
  if (!pts.length) return null;
  const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/**
 * La vue qui fait tenir `boite` dans un écran `l`×`h`, avec une marge. Sans boîte (bâtiment vide) :
 * un terrain de 20 m de côté, centré sur l'origine.
 */
export function cadrerSur(boite, l, h, marge = 40){
  const b = boite || { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const w = Math.max(1, b.maxX - b.minX), d = Math.max(1, b.maxZ - b.minZ);
  const echelle = Math.min(ECHELLE_MAX, Math.max(ECHELLE_MIN,
    Math.min((Math.max(1, l - 2 * marge)) / w, (Math.max(1, h - 2 * marge)) / d)));
  return { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, echelle };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// L'AFFICHAGE DE L'APERÇU 3D (demandé le 22 octobre 2026)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// La vue de dessus prend tout l'éditeur ; l'aperçu 3D est une fenêtre par-dessus, dans un des
// quatre coins (on la tire pour en changer : elle s'ancre au coin le plus proche), en plein écran,
// ou réduite à une icône qui la rouvre. Le choix se retient d'une ouverture à l'autre.

export const MODES_APERCU = ['fenetre', 'plein', 'reduit'];
export const COINS_APERCU = ['hg', 'hd', 'bg', 'bd'];   // haut-gauche, haut-droite, bas-gauche, bas-droite

/** Un affichage relu (localStorage) : un mode et un coin connus, sinon fenêtré en haut à droite. */
export function affichageApercuLu(brut){
  const a = brut && typeof brut === 'object' ? brut : {};
  return {
    mode: MODES_APERCU.includes(a.mode) ? a.mode : 'fenetre',
    coin: COINS_APERCU.includes(a.coin) ? a.coin : 'hd',
  };
}

/** Le coin d'un rectangle `l`×`h` le plus proche du point (x, y) : là où la fenêtre lâchée s'ancre. */
export function coinLePlusProche(x, y, l, h){
  return (y < h / 2 ? 'h' : 'b') + (x < l / 2 ? 'g' : 'd');
}
