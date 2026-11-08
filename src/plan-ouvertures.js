/**
 * @file plan-ouvertures.js
 * #456c, LES OUVERTURES d'un plan d'architecte. Fonctions PURES, vérifiées sous Node
 * (tests/plan-ouvertures.test.mjs). Elles prennent les segments de `vectoriserLesMurs`
 * (plan-vecteurs.js) et l'ENCRE d'origine de `detecterLesMurs` (plan-murs.js), et rendent des murs
 * continus portant des ouvertures.
 *
 * Ce que la recherche a établi (docs/en/plan-sources.md) :
 *   - le plan est coupé à hauteur d'appui : une baie est une INTERRUPTION du mur ;
 *   - une porte s'y signale par l'ARC que décrit son vantail (un quart de cercle, ISO 7519 et HABS),
 *     parfois par rien du tout (les plans anciens) ;
 *   - une fenêtre, par deux ou trois TRAITS FINS parallèles au mur, dans son épaisseur.
 *
 * D'où trois temps :
 *   1. les TROUS : deux bouts libres face à face, sur le même axe, font UN mur et une ouverture ; un
 *      bout libre qui regarde un mur perpendiculaire proche (une porte contre un angle) est prolongé
 *      jusqu'à lui, l'ouverture occupant l'espace entre les deux ;
 *   2. leur NATURE, lue dans l'encre : un trait continu le long du trou → fenêtre ; un arc d'un quart
 *      de cercle à l'un des bouts → porte, dont l'arc donne la charnière et le côté ; deux arcs →
 *      porte à deux battants ; rien → passage ;
 *   3. les FENÊTRES DANS UN MUR PLEIN : la détection comble les traits fins d'une fenêtre (c'est voulu,
 *      cf. plan-murs.js) ; un tronçon où l'encre n'est plus faite que de traits parallèles, dans un
 *      mur plein ailleurs, est une fenêtre.
 *
 * Conventions de l'éditeur (batiment-editeur-ui.js, `dessinerOuverture`) : u va de a vers b, la
 * normale est n = (-u.y, u.x) ; `sens` +1 ouvre du côté de n ; `charniere` 'debut' pivote côté a.
 */

const DEG = Math.PI / 180;
const sous = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const norme = (v) => Math.hypot(v.x, v.y);
const unitaire = (s) => { const d = sous(s.b, s.a), L = norme(d); return { x: d.x / L, y: d.y / L }; };
const longueurDe = (s) => norme(sous(s.b, s.a));

/**
 * Le plus large trou accepté, en épaisseurs TYPIQUES des murs du plan (la médiane), et non du mur
 * concerné : sur un vrai plan, des fragments minces étiraient la limite au point de relier des murs
 * sans rapport par de faux trous (plan de test n° 1). Une porte de 0,9 m dans des murs de 20 cm fait
 * 4,5 épaisseurs ; une baie de 2,4 m, 12. (Ramené à 6 quand les murs détectés étaient encore
 * pleins de fragments ; remonté à 12 une fois la détection nettoyée, pour les baies des façades.)
 */
const TROU_MAX = 12;
/** Jusqu'à trois fois plus large, quand le trou porte du vitrage (une baie, une façade vitrée). */
const VITRAGE_MAX = 3;
let _epaisseurType = 0;
/**
 * Avec une SEGMENTATION (`ouverturesDesMasques`), les baies sont déjà dans le mur : un trou restant
 * n'est qu'une cassure du masque, de deux ou trois épaisseurs au plus. Lui laisser les 12 des règles
 * jetait des « murs » à travers les couloirs et les cuisines (plan de test n° 2).
 */
let _trouMax = TROU_MAX;
const trouMax = (t) => _trouMax * (_epaisseurType || t);

/** Le segment retourné (a et b échangés), ses ouvertures avec lui. */
function retourner(s){
  const L = longueurDe(s);
  return { ...s, a: s.b, b: s.a, ouv: s.ouv.map(o => ({ s0: L - o.s1, s1: L - o.s0 })) };
}

/** Les bouts libres : ceux qu'aucun autre segment ne partage. */
function boutsLibres(segs){
  const libres = [];
  segs.forEach((s, i) => {
    for (const bout of ['a', 'b']) {
      const p = s[bout];
      const partage = segs.some((o, j) => j !== i && (norme(sous(o.a, p)) < 1 || norme(sous(o.b, p)) < 1));
      if (!partage) libres.push({ i, bout });
    }
  });
  return libres;
}

/** Fusionne deux segments alignés séparés par un trou (le meilleur couple), ou rend faux. */
function fusionnerUnTrou(segs, lire = null){
  const libres = boutsLibres(segs);
  let meilleur = null;
  for (const A of libres) for (const B of libres) {
    if (A.i >= B.i) continue;
    const s = segs[A.i], o = segs[B.i];
    const us = unitaire(s), uo = unitaire(o);
    if (Math.abs(us.x * uo.y - us.y * uo.x) > Math.sin(3 * DEG)) continue;
    const P = s[A.bout], Q = o[B.bout], PQ = sous(Q, P), g = norme(PQ);
    const t = Math.max(s.epaisseur, o.epaisseur);
    if (g < 2 || g > VITRAGE_MAX * trouMax(t)) continue;
    // Sur le même axe : l'écart perpendiculaire est petit devant l'épaisseur.
    if (Math.abs(PQ.x * us.y - PQ.y * us.x) > t / 2) continue;
    // ⚠️ Au-delà de la limite ordinaire, le trou n'est accepté que s'il porte du VITRAGE : une baie,
    // une façade vitrée (plan n° 4, des baies de 5 m entre de petits trumeaux que la détection perd).
    if (g > trouMax(t) && !(lire && Math.max(0, ...rangees({ a: P, b: Q, epaisseur: t }, 0, g, lire)) >= 0.5)) continue;
    // Et face à face : Q est au-delà de P en sortant de s, et inversement.
    const sortieS = A.bout === 'b' ? us : { x: -us.x, y: -us.y };
    const sortieO = B.bout === 'b' ? uo : { x: -uo.x, y: -uo.y };
    if (PQ.x * sortieS.x + PQ.y * sortieS.y <= 0 || -(PQ.x * sortieO.x + PQ.y * sortieO.y) <= 0) continue;
    if (!meilleur || g < meilleur.g) meilleur = { A, B, g };
  }
  if (!meilleur) return false;
  // s se termine en P (son bout b), o commence en Q (son bout a).
  let s = segs[meilleur.A.i], o = segs[meilleur.B.i];
  if (meilleur.A.bout === 'a') s = retourner(s);
  if (meilleur.B.bout === 'b') o = retourner(o);
  const Ls = longueurDe(s), decalage = Ls + meilleur.g;
  const fusion = {
    a: s.a, b: o.b, epaisseur: Math.max(s.epaisseur, o.epaisseur),
    ouv: [...s.ouv, { s0: Ls, s1: decalage }, ...o.ouv.map(x => ({ s0: x.s0 + decalage, s1: x.s1 + decalage }))],
  };
  const reste = segs.filter((_, k) => k !== meilleur.A.i && k !== meilleur.B.i);
  segs.length = 0; segs.push(...reste, fusion);
  return true;
}

/** Prolonge les bouts libres qui regardent un mur proche ; l'espace gagné est une ouverture. */
function prolongerVersUnMur(segs){
  const coupes = new Map();
  for (const { i, bout } of boutsLibres(segs)) {
    const s = segs[i], u = unitaire(s), sortie = bout === 'b' ? u : { x: -u.x, y: -u.y }, P = s[bout];
    let meilleur = null;
    segs.forEach((c, j) => {
      if (j === i || longueurDe(c) < 1) return;
      const uc = unitaire(c), det = sortie.x * uc.y - sortie.y * uc.x;
      if (Math.abs(det) < Math.sin(30 * DEG)) return;
      // P + d·sortie = c.a + t·uc
      const w = sous(c.a, P), d = (w.x * uc.y - w.y * uc.x) / det, t = (w.x * sortie.y - w.y * sortie.x) / det;
      const Lc = longueurDe(c);
      if (t < -c.epaisseur / 2 || t > Lc + c.epaisseur / 2) return;
      // ⚠️ Un bout qui s'arrête DANS l'épaisseur du mur visé, ou juste avant (g < 2), n'est pas une
      // ouverture mais une JONCTION : il est raccordé à l'axe, sans trou. L'écarter laissait les
      // cloisons d'un vrai plan à deux pixels de leur mur, et les pièces ouvertes (plan n° 3).
      const g = d - c.epaisseur / 2;
      if (d < -c.epaisseur || d <= 1 - longueurDe(s) || g > trouMax(s.epaisseur)) return;
      if (!meilleur || d < meilleur.d) meilleur = { j, d, g, X: { x: P.x + sortie.x * d, y: P.y + sortie.y * d }, t, Lc };
    });
    if (!meilleur) continue;
    const L = longueurDe(s);
    const trou = meilleur.g >= 2;
    if (bout === 'b') { if (trou) s.ouv.push({ s0: L, s1: L + meilleur.g }); s.b = meilleur.X; }
    else {
      s.ouv = s.ouv.map(o => ({ s0: o.s0 + meilleur.d, s1: o.s1 + meilleur.d }));
      if (trou) s.ouv.push({ s0: meilleur.d - meilleur.g, s1: meilleur.d });
      s.a = meilleur.X;
    }
    // Tombé au milieu du mur atteint, il le coupe (jonction en T) ; près d'un bout, il le rejoint.
    const c = segs[meilleur.j];
    if (meilleur.t < c.epaisseur) c.a = meilleur.X;
    else if (meilleur.t > meilleur.Lc - c.epaisseur) c.b = meilleur.X;
    else { if (!coupes.has(meilleur.j)) coupes.set(meilleur.j, []); coupes.get(meilleur.j).push(meilleur.X); }
  }
  for (const [j, points] of [...coupes].sort((x, y) => y[0] - x[0])) {
    const c = segs[j], u = unitaire(c);
    const tri = points.map(X => ({ X, t: (X.x - c.a.x) * u.x + (X.y - c.a.y) * u.y })).sort((p, q) => p.t - q.t);
    const morceaux = [];
    let depart = c.a, t0 = 0;
    for (const { X, t } of tri) { morceaux.push({ a: depart, b: X, epaisseur: c.epaisseur, ouv: c.ouv.filter(o => o.s0 >= t0 && o.s1 <= t).map(o => ({ s0: o.s0 - t0, s1: o.s1 - t0 })) }); depart = X; t0 = t; }
    morceaux.push({ a: depart, b: c.b, epaisseur: c.epaisseur, ouv: c.ouv.filter(o => o.s0 >= t0).map(o => ({ s0: o.s0 - t0, s1: o.s1 - t0 })) });
    segs.splice(j, 1, ...morceaux);
  }
}

/** Un segment coupé aux points `points` (sur son axe), ses ouvertures réparties sur les morceaux. */
function couperAux(c, points){
  const u = unitaire(c);
  const tri = points.map(X => ({ X, t: (X.x - c.a.x) * u.x + (X.y - c.a.y) * u.y })).sort((p, q) => p.t - q.t);
  const morceaux = [];
  let depart = c.a, t0 = 0;
  for (const { X, t } of tri) {
    morceaux.push({ a: depart, b: X, epaisseur: c.epaisseur, ouv: c.ouv.filter(o => o.s0 >= t0 && o.s1 <= t).map(o => ({ s0: o.s0 - t0, s1: o.s1 - t0 })) });
    depart = X; t0 = t;
  }
  morceaux.push({ a: depart, b: c.b, epaisseur: c.epaisseur, ouv: c.ouv.filter(o => o.s0 >= t0).map(o => ({ s0: o.s0 - t0, s1: o.s1 - t0 })) });
  return morceaux.filter(m => longueurDe(m) >= 1);
}

/**
 * LA SOUDURE FINALE : les étapes précédentes déplacent des bouts APRÈS la fusion des sommets, et des
 * murs qui se touchent à l'œil restaient à un pixel l'un de l'autre (plan n° 4) : pour l'éditeur, ils
 * ne se touchent pas, et les pièces restent ouvertes. Les bouts à moins de `tol` se confondent ; un
 * bout seul qui tombe, à `tol` près, sur le milieu d'un autre mur le coupe (jonction en T).
 */
function souder(segs, tol){
  const bouts = [];
  segs.forEach(s => { bouts.push({ s, k: 'a' }, { s, k: 'b' }); });
  // 1. Les bouts proches se confondent (au premier venu).
  const reperes = [];
  for (const b of bouts) {
    const p = b.s[b.k], r = reperes.find(q => norme(sous(p, q)) < tol);
    if (r) b.s[b.k] = r; else reperes.push(p);
  }
  // ⚠️ Un segment court dont les deux bouts se sont confondus est tombé à longueur nulle : il part
  // ICI. Laissé, son orientation (NaN) se propageait au bout d'un vrai mur qu'il « accueillait », et
  // ce mur disparaissait (la cloison des chambres du haut de l'immeuble, signalée par Valentin).
  const vivants = new Set(segs.filter(c => longueurDe(c) >= 1));
  for (let k = bouts.length - 1; k >= 0; k--) if (!vivants.has(bouts[k].s)) bouts.splice(k, 1);
  segs = segs.filter(c => vivants.has(c));
  // 2. Un bout que personne ne partage, posé sur le milieu d'un autre mur, le coupe.
  const coupes = new Map();
  for (const b of bouts) {
    const p = b.s[b.k];
    if (bouts.some(o => o !== b && o.s[o.k] === p)) continue;
    for (const c of segs) {
      if (c === b.s) continue;
      const u = unitaire(c), t = (p.x - c.a.x) * u.x + (p.y - c.a.y) * u.y, L = longueurDe(c);
      if (t <= tol || t >= L - tol) continue;
      const n = Math.abs(-(p.x - c.a.x) * u.y + (p.y - c.a.y) * u.x);
      if (n > Math.max(tol, c.epaisseur / 2)) continue;
      const X = { x: c.a.x + u.x * t, y: c.a.y + u.y * t };
      b.s[b.k] = X;
      if (!coupes.has(c)) coupes.set(c, []);
      coupes.get(c).push(X);
      break;
    }
  }
  return segs.flatMap(c => (coupes.has(c) ? couperAux(c, coupes.get(c)) : [c]));
}

/** Une lecture de l'encre : `encre(x, y)` vaut 1 sur un pixel d'encre, 0 ailleurs et hors image. */
function lecteur(encre, w, h){
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y);
    return i >= 0 && j >= 0 && i < w && j < h ? encre[j * w + i] : 0;
  };
}

/**
 * Le profil d'encre d'un tronçon [s0, s1] d'un segment : pour chaque rangée parallèle au mur (de -e/2
 * à +e/2), la part des sections où elle porte de l'encre. Une fenêtre, c'est une rangée CONTINUE.
 */
function rangees(s, s0, s1, lire){
  const u = unitaire(s), n = { x: -u.y, y: u.x }, e = s.epaisseur, res = [];
  const n0 = Math.ceil(s0 + 1), n1 = Math.floor(s1 - 1);
  if (n1 < n0) return res;
  // Deux pixels de plus de chaque côté : le châssis et l'appui sont souvent tracés SUR les faces du
  // mur, à la limite de l'épaisseur détectée (plan n° 3).
  for (let k = -e / 2 - 1.5; k <= e / 2 + 1.5; k += 1) {
    let encre = 0;
    for (let t = n0; t <= n1; t++) {
      const x = s.a.x + u.x * t + n.x * k, y = s.a.y + u.y * t + n.y * k;
      // Un pixel de tolérance de part et d'autre : un trait fin tombe rarement pile sur la rangée.
      if (lire(x, y) || lire(x + n.x, y + n.y) || lire(x - n.x, y - n.y)) encre++;
    }
    res.push(encre / (n1 - n0 + 1));
  }
  return res;
}

/** Le nombre de TRAITS continus du profil (des rangées voisines à 70 % ou plus comptent pour un). */
function traitsContinus(profil){
  let n = 0, dedans = false;
  for (const v of profil) { if (v >= 0.7 && !dedans) n++; dedans = v >= 0.7; }
  return n;
}

/** La part d'un quart de cercle de rayon `r`, autour de la charnière `H`, qui porte de l'encre. */
function couvertureDArc(H, le, cote, r, lire){
  const anneau = (rho0, rho1, phi0, phi1) => {
    let touches = 0, n = 0;
    for (let phi = phi0; phi <= phi1; phi += 5, n++) {
      const d = { x: Math.cos(phi * DEG) * le.x + Math.sin(phi * DEG) * cote.x, y: Math.cos(phi * DEG) * le.y + Math.sin(phi * DEG) * cote.y };
      for (let rho = rho0 * r; rho <= rho1 * r; rho += 0.5) {
        if (lire(H.x + d.x * rho, H.y + d.y * rho)) { touches++; break; }
      }
    }
    return touches / n;
  };
  // De 20° à 80° : plus près du mur, l'arc se confond avec les appuis et les traits le long du mur.
  const arc = anneau(0.7, 1.15, 20, 80);
  // ⚠️ L'INTÉRIEUR DU QUART DE CERCLE doit être VIDE : l'arc d'une porte est centré sur sa
  // charnière ; le demi-cercle pointillé qui dessine le débattement d'une fenêtre à battants (plan
  // n° 3), centré au milieu de la baie, traverse aussi l'anneau extérieur, mais passe à mi-rayon.
  const dedans = anneau(0.3, 0.55, 30, 60);
  return dedans > 0.3 ? 0 : arc;
}

/** La nature d'une ouverture [s0, s1] du segment `s`. */
function natureDe(s, o, lire){
  // LE VITRAGE D'ABORD, compté en TRAITS : une fenêtre en a deux ou trois dans l'épaisseur du mur,
  // le seuil d'une porte un seul. L'arc ne départage pas : les fenêtres à battants du plan n° 3 ont
  // le leur (en pointillés, dehors). Puis l'arc (porte), puis un trait seul (fenêtre), puis rien
  // (passage).
  const traits = traitsContinus(rangees(s, o.s0, o.s1, lire));
  if (traits >= 2) return { type: 'fenetre' };
  const u = unitaire(s), n = { x: -u.y, y: u.x }, e = s.epaisseur / 2, g = o.s1 - o.s0;
  const point = (t, k) => ({ x: s.a.x + u.x * t + n.x * k, y: s.a.y + u.y * t + n.y * k });
  const moinsU = { x: -u.x, y: -u.y };
  let meilleur = { score: 0 };
  for (const sens of [1, -1]) {
    const cote = { x: n.x * sens, y: n.y * sens };
    const debut = couvertureDArc(point(o.s0, sens * e), u, cote, g, lire);
    const fin = couvertureDArc(point(o.s1, sens * e), moinsU, cote, g, lire);
    const deux = Math.min(couvertureDArc(point(o.s0, sens * e), u, cote, g / 2, lire),
      couvertureDArc(point(o.s1, sens * e), moinsU, cote, g / 2, lire));
    for (const c of [
      { score: debut, sens, charniere: 'debut', battants: 1 },
      { score: fin, sens, charniere: 'fin', battants: 1 },
      { score: deux + 0.01, sens, charniere: 'debut', battants: 2 },
    ]) if (c.score > meilleur.score) meilleur = c;
  }
  if (meilleur.score >= 0.6) return { type: 'porte', sens: meilleur.sens, charniere: meilleur.charniere, battants: meilleur.battants };
  if (traits === 1) return { type: 'fenetre' };
  return { type: 'passage' };
}

/** Les fenêtres comblées d'un mur plein : les tronçons où l'encre se réduit à des rangées continues. */
function fenetresComblees(s, lire, lireMasque){
  const u = unitaire(s), n = { x: -u.y, y: u.x }, e = s.epaisseur, L = longueurDe(s);
  if (e < 5) return [];
  // Le remplissage se lit sur le MASQUE DES MURS quand on l'a : plein sur un mur hachuré ou en double
  // trait comme sur un poché, il ne garde aux fenêtres que le châssis (plan n° 3). Sur l'encre, un
  // mur hachuré n'était plein qu'à moitié, et ses fenêtres ne se distinguaient plus.
  const lecture = lireMasque || lire;
  const remplissage = [];
  for (let t = 0; t < L; t++) {
    let plein = 0, total = 0;
    for (let k = -e / 2 + 0.5; k <= e / 2 - 0.5; k += 1, total++) {
      if (lecture(s.a.x + u.x * t + n.x * k, s.a.y + u.y * t + n.y * k)) plein++;
    }
    remplissage.push(plein / total);
  }
  const base = [...remplissage].sort((a, b) => a - b)[remplissage.length >> 1];
  if (base < 0.8) return [];   // rien de plein à quoi comparer
  const res = [];
  let t = 0;
  while (t < L) {
    if (remplissage[t] >= 0.6 * base || s.ouv.some(o => t >= o.s0 - 1 && t <= o.s1 + 1)) { t++; continue; }
    let f = t; while (f < L && remplissage[f] < 0.6 * base) f++;
    // Au moins une épaisseur de long. Un tronçon creux avec l'ARC d'un battant est une PORTE dont le
    // cadre et le seuil (des traits dans l'axe du mur) ont été comblés comme du mur (CubiCasa5K : les
    // portes étaient presque toutes ratées ainsi) ; sinon, un trait continu (châssis, vitrage) en
    // fait une fenêtre.
    if (f - t >= Math.max(3, e)) {
      const nature = natureDe(s, { s0: t, s1: f }, lire);
      if (nature.type === 'porte') res.push({ s0: t, s1: f, ...nature });
      else if (Math.max(0, ...rangees(s, t - 1, f + 1, lire)) >= 0.7) res.push({ s0: t, s1: f, type: 'fenetre' });
    }
    t = f;
  }
  return res;
}

/** Le battant d'une porte : un trait de la charnière H, dans la direction c, sur 15 à 90 % de R. */
function battant(H, c, R, lire){
  const t = { x: -c.y, y: c.x };   // de quoi tolérer un pixel de part et d'autre du trait
  let touches = 0, n = 0;
  for (let k = 0.15; k <= 0.9; k += 0.05, n++) {
    const x = H.x + c.x * k * R, y = H.y + c.y * k * R;
    if (lire(x, y) || lire(x + t.x, y + t.y) || lire(x - t.x, y - t.y)) touches++;
  }
  return touches / n >= 0.6;
}

/**
 * LES PORTES PAR LEUR ARC, sans attendre un trou dans le mur : le long du mur, de chaque côté et dans
 * les deux sens, on cherche un quart de cercle dessiné, centré sur une face du mur (la charnière) et
 * vide à mi-rayon. Son rayon est la largeur de la porte. (CubiCasa5K : le cadre et le seuil d'une
 * porte, des traits dans l'axe du mur, sont comblés comme du mur ; il n'y a donc souvent aucun trou à
 * classer, et 92 % des portes étaient ratées.)
 */
function portesParArcs(s, lire, deja, disques){
  const u = unitaire(s), n = { x: -u.y, y: u.x }, e = s.epaisseur / 2, L = longueurDe(s);
  const eT = _epaisseurType || s.epaisseur;
  const rMin = Math.max(10, 2 * eT), rMax = Math.max(rMin + 1, 12 * eT);
  const anneau = (H, d, c, R, r0, r1, phi0, phi1) => {
    let touches = 0, k = 0;
    for (let phi = phi0; phi <= phi1; phi += 5, k++) {
      const v = { x: Math.cos(phi * DEG) * d.x + Math.sin(phi * DEG) * c.x, y: Math.cos(phi * DEG) * d.y + Math.sin(phi * DEG) * c.y };
      for (let rho = R + r0; rho <= R + r1; rho += 0.75) if (lire(H.x + v.x * rho, H.y + v.y * rho)) { touches++; break; }
    }
    return touches / k;
  };
  const candidats = [];
  for (let t = 0; t <= L; t += 2) for (const sens of [1, -1]) for (const dir of [1, -1]) {
    const H = { x: s.a.x + u.x * t + n.x * sens * e, y: s.a.y + u.y * t + n.y * sens * e };
    const d = { x: u.x * dir, y: u.y * dir }, c = { x: n.x * sens, y: n.y * sens };
    for (let R = rMin; R <= rMax; R *= 1.08) {
      const fin = t + dir * R;
      if (fin < -2 || fin > L + 2) continue;
      const arc = anneau(H, d, c, R, -2, 2, 15, 75);
      if (arc < 0.8) continue;
      // Une COURBE FINE ISOLÉE : rien à mi-rayon, rien juste dedans, rien juste dehors. Sans cela, le
      // carrelage, les hachures et le mobilier denses offraient partout un « arc » couvert (2 674
      // portes trouvées pour 568 vraies).
      if (anneau(H, d, c, 0, 0.3 * R, 0.55 * R, 30, 60) > 0.25) continue;
      if (anneau(H, d, c, 0, 0.62 * R, 0.85 * R, 25, 65) > 0.25) continue;
      if (anneau(H, d, c, 0, 1.15 * R, 1.3 * R, 25, 65) > 0.25) continue;
      // Et son BATTANT, un trait droit de la charnière, perpendiculaire au mur, de la longueur du
      // rayon : un cercle en pointillés (l'aire de rotation d'un fauteuil roulant, CubiCasa5K) n'en a
      // pas. Exigé, il faisait perdre plus de vraies portes qu'il n'en écartait de fausses (bien des
      // plans ne le dessinent pas) : sans battant, l'arc doit être presque complet.
      if (arc < 0.95 && !battant(H, c, R, lire)) continue;
      // Une courbe DÉJÀ EXPLIQUÉE par une porte trouvée ne fait pas une seconde porte (l'arc d'une
      // porte, vu depuis le mur d'à côté) : si la moitié de ses points tombe SUR le cercle de
      // celle-ci, c'est la même courbe. (Exclure tout le quart de disque était trop large : de
      // fausses portes à grand rayon masquaient de vraies.)
      const memeCourbe = (q) => {
        let sur = 0;
        for (let phi = 15; phi <= 75; phi += 10) {
          const v = { x: Math.cos(phi * DEG) * d.x + Math.sin(phi * DEG) * c.x, y: Math.cos(phi * DEG) * d.y + Math.sin(phi * DEG) * c.y };
          if (Math.abs(Math.hypot(H.x + v.x * R - q.H.x, H.y + v.y * R - q.H.y) - q.R) < 3) sur++;
        }
        return sur >= 4;
      };
      if (disques.some(memeCourbe)) continue;
      candidats.push({ score: arc, s0: Math.min(t, fin), s1: Math.max(t, fin), sens, charniere: dir === 1 ? 'debut' : 'fin', H, R });
    }
  }
  // Les meilleurs d'abord, sans chevauchement entre eux ni avec les ouvertures déjà trouvées.
  candidats.sort((p, q) => q.score - p.score || (q.s1 - q.s0) - (p.s1 - p.s0));
  const res = [];
  for (const c of candidats) {
    const chevauche = (o) => c.s0 < o.s1 - 1 && o.s0 < c.s1 - 1;
    if (res.some(chevauche) || deja.some(chevauche)) continue;
    res.push({ s0: Math.max(0, c.s0), s1: Math.min(L, c.s1), type: 'porte', sens: c.sens, charniere: c.charniere, battants: 1 });
    disques.push({ H: c.H, R: c.R });
  }
  return res;
}

/**
 * Les ouvertures du plan. `segments` : ceux de `vectoriserLesMurs` ; `encre` : le masque d'encre
 * d'origine de `detecterLesMurs`, de taille w × h ; `murs` (facultatif) : son masque des murs, où
 * les fenêtres comblées se lisent le mieux. Rend des segments `{ a, b, epaisseur, ouvertures:
 * [{ s0, s1, type, sens?, charniere?, battants? }] }`, s0 et s1 en pixels depuis a.
 */
export function ouverturesDuPlan(segments, encre, w, h, murs = null){
  const segs = segments.filter(s => longueurDe(s) >= 1).map(s => ({ a: { ...s.a }, b: { ...s.b }, epaisseur: s.epaisseur, ouv: [] }));
  const ep = segs.map(s => s.epaisseur).sort((x, y) => x - y);
  _epaisseurType = ep.length ? ep[ep.length >> 1] : 0;
  const lire = lecteur(encre, w, h), lireMasque = murs ? lecteur(murs, w, h) : null;
  while (fusionnerUnTrou(segs, lire)) { /* jusqu'au dernier trou */ }
  prolongerVersUnMur(segs);
  const soudes = souder(segs, Math.max(2, 0.5 * _epaisseurType));
  segs.length = 0; segs.push(...soudes);
  // Deux temps : les ouvertures des trous et des tronçons creux, puis les portes par leur arc, qui
  // savent quels arcs les premières ont déjà expliqués (leurs quarts de disque).
  const valides = segs.filter(s => longueurDe(s) >= 1 && Number.isFinite(s.a.x + s.a.y + s.b.x + s.b.y));
  const disques = [];
  const premiers = valides.map(s => {
    // Un trou sans arc ni vitrage (un « passage ») est le plus souvent un RATÉ de la détection, un
    // bout de mur manqué, et non une baie libre : CubiCasa5K, 9 % de justes. Il est REFERMÉ (le mur
    // reste continu) ; une vraie baie libre se rouvre à la main dans l'éditeur.
    const ouvertures = s.ouv.map(o => ({ ...o, ...natureDe(s, o, lire) })).filter(o => o.type !== 'passage');
    ouvertures.push(...fenetresComblees(s, lire, lireMasque));
    const u = unitaire(s), n = { x: -u.y, y: u.x };
    for (const o of ouvertures) {
      if (o.type !== 'porte') continue;
      const t = o.charniere === 'fin' ? o.s1 : o.s0, k = (o.sens || 1) * s.epaisseur / 2;
      disques.push({ H: { x: s.a.x + u.x * t + n.x * k, y: s.a.y + u.y * t + n.y * k }, R: o.s1 - o.s0 });
    }
    return ouvertures;
  });
  return valides.map((s, i) => {
    const ouvertures = premiers[i];
    ouvertures.push(...portesParArcs(s, lire, ouvertures, disques));
    ouvertures.sort((p, q) => p.s0 - q.s0);
    return { a: s.a, b: s.b, epaisseur: s.epaisseur, ouvertures };
  });
}

/**
 * Les masses d'un masque (4-connexité), de `minimum` pixels au moins : leurs pixels, en indices.
 * (Les portes et les fenêtres d'une SEGMENTATION, cf. `ouverturesDesMasques`.)
 */
function massesDe(masque, w, h, minimum){
  const vu = new Uint8Array(w * h), res = [], pile = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!masque[p0] || vu[p0]) continue;
    const pixels = [];
    vu[p0] = 1; pile.push(p0);
    while (pile.length) {
      const p = pile.pop(), x = p % w;
      pixels.push(p);
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q >= 0 && q < w * h && masque[q] && !vu[q]) { vu[q] = 1; pile.push(q); }
      }
    }
    if (pixels.length >= minimum) res.push(pixels);
  }
  return res;
}

/**
 * LES OUVERTURES D'UNE SEGMENTATION, quand un modèle entraîné a lu le plan (le greffon,
 * docs/en/plan-modele.md) : il rend, pixel par pixel, ce qui est mur, porte ou fenêtre. Les murs ont
 * été vectorisés sur « mur, porte ou fenêtre » réunis : ils sont CONTINUS au droit des baies, et les
 * pièces se ferment. Les trous restants sont refermés comme pour les règles (mêmes raccords), puis
 * chaque masse de porte ou de fenêtre est posée sur le mur qu'elle traverse, à la place et à la
 * largeur qu'elle y couvre. Le côté et la charnière d'une porte se lisent sur son ARC dans l'encre
 * (comme `natureDe`), quand il est dessiné ; sinon, valeurs par défaut.
 *
 * `masques` : `{ portes, fenetres }`, des Uint8Array de w × h (1 sur la classe) ; `encre` : comme
 * pour `ouverturesDuPlan`. Rend les mêmes segments `{ a, b, epaisseur, ouvertures }`.
 */
const TROU_MAX_MASQUES = 3;
export function ouverturesDesMasques(segments, masques, w, h, encre = null){
  const segs = segments.filter(s => longueurDe(s) >= 1).map(s => ({ a: { ...s.a }, b: { ...s.b }, epaisseur: s.epaisseur, ouv: [] }));
  const ep = segs.map(s => s.epaisseur).sort((x, y) => x - y);
  _epaisseurType = ep.length ? ep[ep.length >> 1] : 0;
  const lire = encre ? lecteur(encre, w, h) : null;
  _trouMax = TROU_MAX_MASQUES;
  try {
    while (fusionnerUnTrou(segs, null)) { /* jusqu'au dernier trou */ }
  } finally { _trouMax = TROU_MAX; }
  prolongerVersUnMur(segs);
  const soudes = souder(segs, Math.max(2, 0.5 * _epaisseurType)).filter(s => longueurDe(s) >= 1 && Number.isFinite(s.a.x + s.a.y + s.b.x + s.b.y));
  const res = soudes.map(s => ({ a: s.a, b: s.b, epaisseur: s.epaisseur, ouvertures: [] }));
  // Une masse plus petite qu'un carré d'une demi-épaisseur de mur est un reste de la segmentation.
  const minimum = Math.max(6, Math.round(0.25 * _epaisseurType * _epaisseurType));
  for (const [type, masque] of [['porte', masques.portes], ['fenetre', masques.fenetres]]) {
    if (!masque) continue;
    for (const pixels of massesDe(masque, w, h, minimum)) {
      // Le mur qu'elle traverse : celui où tombe le plus de ses pixels (dans son épaisseur, un peu
      // élargie : la masse déborde souvent le mur, l'arc d'une porte surtout).
      let meilleur = null;
      for (const s of res) {
        const u = unitaire(s), L = longueurDe(s), marge = Math.max(3, 0.75 * s.epaisseur);
        const ts = [];
        for (const p of pixels) {
          const x = p % w + 0.5 - s.a.x, y = Math.floor(p / w) + 0.5 - s.a.y;
          const t = x * u.x + y * u.y, k = -x * u.y + y * u.x;
          if (Math.abs(k) <= marge && t >= -2 && t <= L + 2) ts.push(t);
        }
        if (ts.length && (!meilleur || ts.length > meilleur.ts.length)) meilleur = { s, ts, L };
      }
      if (!meilleur || meilleur.ts.length < 0.3 * pixels.length) continue;
      const ts = meilleur.ts.sort((p, q) => p - q);
      const s0 = Math.max(0, ts[Math.floor(0.02 * (ts.length - 1))]), s1 = Math.min(meilleur.L, ts[Math.ceil(0.98 * (ts.length - 1))]);
      if (s1 - s0 < Math.max(4, _epaisseurType)) continue;
      const o = { s0, s1, type };
      if (type === 'porte') Object.assign(o, { sens: 1, charniere: 'debut', battants: 1 }, lire ? sensDeLaPorte(meilleur.s, o, lire) : {});
      const deja = meilleur.s.ouvertures;
      if (deja.some(q => o.s0 < q.s1 - 1 && q.s0 < o.s1 - 1)) continue;
      deja.push(o);
    }
  }
  for (const s of res) s.ouvertures.sort((p, q) => p.s0 - q.s0);
  return res;
}

/** Le côté, la charnière et les battants d'une porte d'après son arc (cf. `natureDe`), ou rien. */
function sensDeLaPorte(s, o, lire){
  const u = unitaire(s), n = { x: -u.y, y: u.x }, e = s.epaisseur / 2, g = o.s1 - o.s0;
  const point = (t, k) => ({ x: s.a.x + u.x * t + n.x * k, y: s.a.y + u.y * t + n.y * k });
  const moinsU = { x: -u.x, y: -u.y };
  let meilleur = { score: 0 };
  for (const sens of [1, -1]) {
    const cote = { x: n.x * sens, y: n.y * sens };
    const debut = couvertureDArc(point(o.s0, sens * e), u, cote, g, lire);
    const fin = couvertureDArc(point(o.s1, sens * e), moinsU, cote, g, lire);
    const deux = Math.min(couvertureDArc(point(o.s0, sens * e), u, cote, g / 2, lire),
      couvertureDArc(point(o.s1, sens * e), moinsU, cote, g / 2, lire));
    for (const c of [
      { score: debut, sens, charniere: 'debut', battants: 1 },
      { score: fin, sens, charniere: 'fin', battants: 1 },
      { score: deux + 0.01, sens, charniere: 'debut', battants: 2 },
    ]) if (c.score > meilleur.score) meilleur = c;
  }
  return meilleur.score >= 0.4 ? { sens: meilleur.sens, charniere: meilleur.charniere, battants: meilleur.battants } : {};
}
