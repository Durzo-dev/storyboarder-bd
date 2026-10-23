/**
 * @file batiment-geometrie.js
 * LA FORME DES MURS, JONCTIONS COMPRISES (#454a-3). Fonction PURE, partagée par la vue de dessus et
 * l'aperçu 3D : les deux dessinent le MÊME polygone, sans quoi l'un montrerait un angle que l'autre
 * n'a pas.
 *
 * LE DÉFAUT QU'ELLE CORRIGE (signalé sur la première capture de l'éditeur) : un mur rectangle qui
 * s'arrête au bout de son axe laisse une encoche à chaque angle, vue de dessus, et une fente en 3D.
 *
 * LA MÉTHODE, celle des logiciels de plan : à chaque SOMMET (un point où des murs se touchent par
 * un bout), on range les murs par angle autour de lui ; entre deux murs voisins, le bord de l'un
 * et le bord de l'autre qui se font face se prolongent jusqu'à se couper. Ce point d'intersection
 * est le coin commun. Un angle droit donne une coupe d'onglet, un T donne un mur qui vient buter
 * contre la face de l'autre (les deux moitiés du mur traversant restent alignées), un bout libre
 * reste carré. Deux murs dans le prolongement l'un de l'autre se raccordent sans coin. Un angle très
 * aigu, dont l'onglet partirait au loin, est coupé net.
 */

/** La distance sous laquelle deux bouts sont le même sommet, en mètres. */
export const TOLERANCE_SOMMET = 1e-3;
/** L'onglet le plus long admis, en épaisseurs de mur : au-delà, l'angle est coupé carré. */
const ONGLET_MAX = 4;

const cle = (p) => `${Math.round(p.x / TOLERANCE_SOMMET)},${Math.round(p.z / TOLERANCE_SOMMET)}`;

/** L'intersection des droites (p + t·u) et (q + s·v), ou null si elles sont parallèles. */
function intersection(p, u, q, v){
  const d = u.x * v.z - u.z * v.x;
  if (Math.abs(d) < 1e-9) return null;
  const t = ((q.x - p.x) * v.z - (q.z - p.z) * v.x) / d;
  return { x: p.x + t * u.x, z: p.z + t * u.z };
}

/**
 * Les polygones des murs `murs` (ceux d'un même niveau), jonctions résolues. Rend une Map
 * id → [quatre points], dans l'ordre : départ côté +n, arrivée côté +n, arrivée côté −n, départ
 * côté −n (n : la normale gauche de a→b, (−dz, dx)).
 */
export function polygonesDesMurs(murs){
  const liste = (murs || []).filter(m => m && m.a && m.b && Math.hypot(m.b.x - m.a.x, m.b.z - m.a.z) > TOLERANCE_SOMMET);
  // Pour chaque bout : le mur, la direction qui S'ÉLOIGNE du sommet, sa normale gauche.
  const sommets = new Map();
  const coins = new Map();   // `${id}:${bout}:${cote}` → point
  for (const m of liste) {
    const L = Math.hypot(m.b.x - m.a.x, m.b.z - m.a.z);
    const u = { x: (m.b.x - m.a.x) / L, z: (m.b.z - m.a.z) / L };
    for (const bout of ['a', 'b']) {
      const o = bout === 'a' ? u : { x: -u.x, z: -u.z };
      const p = m[bout];
      const k = cle(p);
      if (!sommets.has(k)) sommets.set(k, { p, bouts: [] });
      sommets.get(k).bouts.push({ m, bout, o, n: { x: -o.z, z: o.x }, angle: Math.atan2(o.z, o.x) });
    }
  }
  for (const { p, bouts } of sommets.values()) {
    bouts.sort((x, y) => x.angle - y.angle);
    bouts.forEach((bi, i) => {
      const e = bi.m.epaisseur / 2;
      const plus = { x: p.x + bi.n.x * e, z: p.z + bi.n.z * e };
      const moins = { x: p.x - bi.n.x * e, z: p.z - bi.n.z * e };
      let cPlus = plus, cMoins = moins;
      // ⚠️ UN MUR TRAVERSANT RESTE CARRÉ (signalé : des « triangles » aux jonctions en T). Une
      // jonction en T coupe le mur traversant en deux moitiés dans le prolongement l'une de l'autre.
      // Biseauter chaque moitié contre la branche laissait entre elles un triangle vide sous la
      // branche, visible en 3D sur le dessus des murs. Une moitié qui a un mur dans son prolongement
      // exact s'arrête donc net au sommet, des deux côtés : les deux moitiés se raccordent sans
      // jour, et c'est la branche qui vient buter contre leur face (son coin, calculé ci-dessous,
      // est l'intersection avec cette face).
      const traversant = bouts.some(bj => bj !== bi && Math.abs(Math.abs(bj.angle - bi.angle) - Math.PI) < 1e-3);
      if (bouts.length > 1 && !traversant) {
        // Le voisin suivant (sens trigonométrique) fait face au côté +, le précédent au côté −.
        const suivant = bouts[(i + 1) % bouts.length], precedent = bouts[(i - 1 + bouts.length) % bouts.length];
        const es = suivant.m.epaisseur / 2, ep = precedent.m.epaisseur / 2;
        const limite = ONGLET_MAX * Math.max(e, es, ep);
        const iPlus = intersection(plus, bi.o, { x: p.x - suivant.n.x * es, z: p.z - suivant.n.z * es }, suivant.o);
        const iMoins = intersection(moins, bi.o, { x: p.x + precedent.n.x * ep, z: p.z + precedent.n.z * ep }, precedent.o);
        if (iPlus && Math.hypot(iPlus.x - p.x, iPlus.z - p.z) <= limite) cPlus = iPlus;
        if (iMoins && Math.hypot(iMoins.x - p.x, iMoins.z - p.z) <= limite) cMoins = iMoins;
      }
      coins.set(`${bi.m.id}:${bi.bout}:+`, cPlus);
      coins.set(`${bi.m.id}:${bi.bout}:-`, cMoins);
    });
  }
  // Au bout b, la direction sortante est −u : son côté + est le côté −n du mur, et inversement.
  const resultat = new Map();
  for (const m of liste) {
    resultat.set(m.id, [
      coins.get(`${m.id}:a:+`), coins.get(`${m.id}:b:-`),
      coins.get(`${m.id}:b:+`), coins.get(`${m.id}:a:-`),
    ]);
  }
  return resultat;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LES MURS PERCÉS (#454a-3c)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// Une ouverture occupe un intervalle [s0, s1] le long de l'axe du mur (en mètres depuis `a`). Le
// polygone du mur (jonctions comprises) est TRANCHÉ par des droites perpendiculaires à l'axe : les
// tranches hors des ouvertures sont pleines sur toute la hauteur, celles des ouvertures ne gardent
// que l'allège (sous l'ouverture) et le linteau (au-dessus). La vue de dessus coupe le mur à chaque
// ouverture, comme un plan d'architecte ; l'aperçu 3D extrude chaque tranche sur sa hauteur.

/** Le polygone `poly` limité aux points dont l'abscisse le long de l'axe (a, u) est dans [s0, s1]. */
export function trancher(poly, a, u, s0, s1){
  const s = (p) => (p.x - a.x) * u.x + (p.z - a.z) * u.z;
  const couper = (pts, garder, limite) => {
    const r = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const sp = s(p), sq = s(q);
      if (garder(sp)) r.push(p);
      if (garder(sp) !== garder(sq)) {
        const t = (limite - sp) / (sq - sp);
        r.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
      }
    }
    return r;
  };
  let r = couper(poly, v => v >= s0, s0);
  if (r.length) r = couper(r, v => v <= s1, s1);
  return r.length >= 3 ? r : null;
}

/**
 * Les morceaux du mur `mur` (de polygone `poly`) autour des intervalles `intervalles` ([{ s0, s1 }],
 * en mètres le long de l'axe) : `pleins` (les tranches hors ouvertures) et `percees` (une tranche par
 * intervalle, dans le même ordre).
 */
export function morceauxDuMur(poly, mur, intervalles){
  const L = Math.hypot(mur.b.x - mur.a.x, mur.b.z - mur.a.z) || 1;
  const u = { x: (mur.b.x - mur.a.x) / L, z: (mur.b.z - mur.a.z) / L };
  const tries = intervalles.map((iv, i) => ({ ...iv, i })).sort((x, y) => x.s0 - y.s0);
  const pleins = [], percees = new Array(intervalles.length).fill(null);
  let debut = -1e9;
  for (const iv of tries) {
    const plein = trancher(poly, mur.a, u, debut, iv.s0);
    if (plein) pleins.push(plein);
    percees[iv.i] = trancher(poly, mur.a, u, iv.s0, iv.s1);
    debut = iv.s1;
  }
  const fin = trancher(poly, mur.a, u, debut, 1e9);
  if (fin) pleins.push(fin);
  return { pleins, percees };
}
