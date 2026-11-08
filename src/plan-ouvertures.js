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
let _epaisseurType = 0;
const trouMax = (t) => TROU_MAX * (_epaisseurType || t);

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
function fusionnerUnTrou(segs){
  const libres = boutsLibres(segs);
  let meilleur = null;
  for (const A of libres) for (const B of libres) {
    if (A.i >= B.i) continue;
    const s = segs[A.i], o = segs[B.i];
    const us = unitaire(s), uo = unitaire(o);
    if (Math.abs(us.x * uo.y - us.y * uo.x) > Math.sin(3 * DEG)) continue;
    const P = s[A.bout], Q = o[B.bout], PQ = sous(Q, P), g = norme(PQ);
    const t = Math.max(s.epaisseur, o.epaisseur);
    if (g < 2 || g > trouMax(t)) continue;
    // Sur le même axe : l'écart perpendiculaire est petit devant l'épaisseur.
    if (Math.abs(PQ.x * us.y - PQ.y * us.x) > t / 2) continue;
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
  let touches = 0, n = 0;
  // De 20° à 80° : plus près du mur, l'arc se confond avec les appuis et les traits le long du mur.
  for (let phi = 20; phi <= 80; phi += 5, n++) {
    const d = { x: Math.cos(phi * DEG) * le.x + Math.sin(phi * DEG) * cote.x, y: Math.cos(phi * DEG) * le.y + Math.sin(phi * DEG) * cote.y };
    for (let rho = 0.7 * r; rho <= 1.15 * r; rho += 0.5) {
      if (lire(H.x + d.x * rho, H.y + d.y * rho)) { touches++; break; }
    }
  }
  return touches / n;
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
function fenetresComblees(s, lire){
  const u = unitaire(s), n = { x: -u.y, y: u.x }, e = s.epaisseur, L = longueurDe(s);
  if (e < 5) return [];
  const remplissage = [];
  for (let t = 0; t < L; t++) {
    let plein = 0, total = 0;
    for (let k = -e / 2 + 0.5; k <= e / 2 - 0.5; k += 1, total++) {
      if (lire(s.a.x + u.x * t + n.x * k, s.a.y + u.y * t + n.y * k)) plein++;
    }
    remplissage.push(plein / total);
  }
  const base = [...remplissage].sort((a, b) => a - b)[remplissage.length >> 1];
  if (base < 0.8) return [];   // un mur hachuré, ou en double trait : rien à comparer
  const res = [];
  let t = 0;
  while (t < L) {
    if (remplissage[t] >= 0.6 * base || s.ouv.some(o => t >= o.s0 - 1 && t <= o.s1 + 1)) { t++; continue; }
    let f = t; while (f < L && remplissage[f] < 0.6 * base) f++;
    if (f - t >= Math.max(3, e) && Math.max(0, ...rangees(s, t - 1, f + 1, lire)) >= 0.8) res.push({ s0: t, s1: f, type: 'fenetre' });
    t = f;
  }
  return res;
}

/**
 * Les ouvertures du plan. `segments` : ceux de `vectoriserLesMurs` ; `encre` : le masque d'encre
 * d'origine de `detecterLesMurs`, de taille w × h. Rend des segments `{ a, b, epaisseur, ouvertures:
 * [{ s0, s1, type, sens?, charniere?, battants? }] }`, s0 et s1 en pixels depuis a.
 */
export function ouverturesDuPlan(segments, encre, w, h){
  const segs = segments.filter(s => longueurDe(s) >= 1).map(s => ({ a: { ...s.a }, b: { ...s.b }, epaisseur: s.epaisseur, ouv: [] }));
  const ep = segs.map(s => s.epaisseur).sort((x, y) => x - y);
  _epaisseurType = ep.length ? ep[ep.length >> 1] : 0;
  while (fusionnerUnTrou(segs)) { /* jusqu'au dernier trou */ }
  prolongerVersUnMur(segs);
  const lire = lecteur(encre, w, h);
  return segs.filter(s => longueurDe(s) >= 1 && Number.isFinite(s.a.x + s.a.y + s.b.x + s.b.y)).map(s => {
    const ouvertures = s.ouv.map(o => ({ ...o, ...natureDe(s, o, lire) }));
    ouvertures.push(...fenetresComblees(s, lire));
    ouvertures.sort((p, q) => p.s0 - q.s0);
    return { a: s.a, b: s.b, epaisseur: s.epaisseur, ouvertures };
  });
}
