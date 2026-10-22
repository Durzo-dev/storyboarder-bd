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
      if (bouts.length > 1) {
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
