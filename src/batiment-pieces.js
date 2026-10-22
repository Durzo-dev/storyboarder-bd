/**
 * @file batiment-pieces.js
 * LES PIÈCES de l'éditeur de bâtiment (#454a-3b). Fonctions PURES.
 *
 * UNE PIÈCE N'EST PAS DESSINÉE, ELLE SE DÉDUIT : c'est une face fermée du réseau des murs d'un niveau
 * (le graphe dont les sommets sont les bouts des murs et les arêtes leurs axes). Le tracé garantit
 * que deux murs ne se touchent que par leurs bouts (une jonction en T coupe le mur touché, cf.
 * batiment-trace.js), ce qui fait de ce réseau un graphe plan dont on parcourt les faces.
 *
 * CE QUI EST GARDÉ, c'est ce que l'utilisateur a choisi : le NOM. Chaque pièce porte un `repere`, un
 * point à l'intérieur ; après une modification, la nouvelle face qui contient le repère d'une pièce
 * en hérite le nom (et l'id, et ses revêtements de sol et de plafond). Déplacer un angle, ajouter un
 * mur à l'intérieur : la pièce garde son nom. La couper en deux : la moitié qui garde le repère garde
 * le nom, l'autre devient « Pièce N ». Une pièce ouverte (un mur supprimé) disparaît ; la refermer en
 * crée une nouvelle.
 *
 * LIMITE CONNUE : une pièce posée au milieu d'une autre, sans mur qui les relie (un îlot), ne perce
 * pas celle qui l'entoure. Les deux existent, l'une par-dessus l'autre.
 */
import { TOLERANCE_SOMMET } from './batiment-geometrie.js';

const cle = (p) => `${Math.round(p.x / TOLERANCE_SOMMET)},${Math.round(p.z / TOLERANCE_SOMMET)}`;

/** L'aire signée d'un polygone (formule du lacet), en m². */
function aireSignee(pts){
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

/** p est-il à l'intérieur du polygone ? (rayon horizontal, règle pair-impair) */
export function pointDansPolygone(p, pts){
  let dedans = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) dedans = !dedans;
  }
  return dedans;
}

/**
 * Un point À L'INTÉRIEUR du polygone, où poser son nom : le centre de gravité s'il y est (une pièce
 * rectangulaire), sinon le milieu du plus large passage horizontal à sa hauteur (une pièce en L, dont
 * le centre de gravité tombe dehors).
 */
export function pointInterieur(pts){
  const a = aireSignee(pts);
  let cx = 0, cz = 0;
  if (Math.abs(a) > 1e-9) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], f = p.x * q.z - q.x * p.z;
      cx += (p.x + q.x) * f; cz += (p.z + q.z) * f;
    }
    cx /= 6 * a; cz /= 6 * a;
  } else {
    cx = pts.reduce((s, p) => s + p.x, 0) / pts.length; cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
  }
  const c = { x: cx, z: cz };
  if (pointDansPolygone(c, pts)) return c;
  // Les traversées de la ligne horizontale z = cz, puis le plus large intervalle intérieur.
  const zs = pts.map(p => p.z);
  const essais = [cz, (Math.min(...zs) + Math.max(...zs)) / 2];
  for (const z of essais) {
    const xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const p = pts[i], q = pts[j];
      if ((p.z > z) !== (q.z > z)) xs.push(p.x + (z - p.z) * (q.x - p.x) / (q.z - p.z));
    }
    xs.sort((u, v) => u - v);
    let meilleur = null;
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (!meilleur || xs[i + 1] - xs[i] > meilleur.l) meilleur = { l: xs[i + 1] - xs[i], x: (xs[i] + xs[i + 1]) / 2 };
    }
    if (meilleur) return { x: meilleur.x, z };
  }
  return c;
}

/**
 * Les faces fermées du réseau de murs `murs` (un niveau) : `[{ points, aire }]`, sans la face
 * extérieure de chaque groupe de murs. Les murs isolés ou en impasse ne ferment rien.
 *
 * LA MÉTHODE : chaque mur donne deux demi-arêtes (a→b et b→a). Arrivé au sommet v par u→v, on
 * repart par la première arête rencontrée en tournant depuis v→u dans le sens des angles croissants
 * (atan2(z, x)). Chaque demi-arête n'appartient qu'à une face : on les parcourt toutes une fois.
 * Avec cette règle, les faces intérieures ont une aire signée NÉGATIVE ; la face extérieure d'un
 * groupe, positive, est écartée (vérifié par les tests : un mur de refend donne bien deux pièces).
 */
export function facesDesMurs(murs){
  const sommets = new Map();     // clé → { p, sorties: [{ vers, angle }] }
  const ajouter = (de, vers) => {
    const k = cle(de);
    if (!sommets.has(k)) sommets.set(k, { p: de, sorties: [] });
    const s = sommets.get(k);
    const kv = cle(vers);
    if (s.sorties.some(o => o.k === kv)) return;   // deux murs superposés : une seule arête
    s.sorties.push({ k: kv, vers, angle: Math.atan2(vers.z - de.z, vers.x - de.x) });
  };
  for (const m of murs || []) {
    if (!m || !m.a || !m.b || cle(m.a) === cle(m.b)) continue;
    ajouter(m.a, m.b); ajouter(m.b, m.a);
  }
  const vues = new Set();
  const faces = [];
  for (const [k0, s0] of sommets) {
    for (const d0 of s0.sorties) {
      if (vues.has(`${k0}>${d0.k}`)) continue;
      const pts = [];
      let k = k0, d = d0, garde = 0;
      while (!vues.has(`${k}>${d.k}`) && garde++ < 10000) {
        vues.add(`${k}>${d.k}`);
        pts.push(sommets.get(k).p);
        const v = sommets.get(d.k);
        const retour = Math.atan2(sommets.get(k).p.z - v.p.z, sommets.get(k).p.x - v.p.x);
        // La première sortie après le retour, en tournant dans le sens des angles croissants.
        let meilleur = null;
        for (const o of v.sorties) {
          let delta = o.angle - retour;
          while (delta <= 1e-12) delta += Math.PI * 2;
          if (!meilleur || delta < meilleur.delta) meilleur = { o, delta };
        }
        k = d.k; d = meilleur.o;
      }
      const aire = aireSignee(pts);
      if (pts.length >= 3 && aire < -1e-6) faces.push({ points: pts, aire: -aire });
    }
  }
  return faces;
}

function nomLibre(pieces, traduire){
  const mot = traduire ? traduire('Room', 'Pièce') : 'Pièce';
  let max = 0;
  for (const p of pieces) {
    const m = new RegExp('^' + mot + '\\s+(\\d+)$').exec(String(p.nom || ''));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${mot} ${max + 1}`;
}

function nouvelId(pieces){
  const pris = new Set(pieces.map(p => p.id));
  let n = pieces.length;
  while (pris.has('p' + n)) n++;
  return 'p' + n;
}

/**
 * Remet les pièces du niveau `niveauId` d'accord avec ses murs : une pièce par face fermée, le nom
 * hérité par la face qui contient son repère. Modifie `batiment.pieces` ; les pièces des autres
 * niveaux ne sont pas touchées. Rend les pièces du niveau, chacune avec sa `forme` (non persistée,
 * ajoutée à part : cf. formesDesPieces).
 */
export function actualiserPieces(batiment, niveauId, traduire){
  const faces = facesDesMurs((batiment.murs || []).filter(m => m.niveauId === niveauId));
  const anciennes = (batiment.pieces || []).filter(p => p.niveauId === niveauId);
  const autres = (batiment.pieces || []).filter(p => p.niveauId !== niveauId);
  const prises = new Set();
  // Les grandes faces d'abord : à repère partagé, la pièce reste du côté le plus vaste.
  const ordre = faces.map((f, i) => ({ f, i })).sort((a, b) => b.f.aire - a.f.aire);
  const resultat = new Array(faces.length);
  for (const { f, i } of ordre) {
    const heritee = anciennes.find(p => !prises.has(p.id) && p.repere && pointDansPolygone(p.repere, f.points));
    if (heritee) prises.add(heritee.id);
    resultat[i] = { f, heritee };
  }
  const pieces = [];
  const toutes = () => [...autres, ...anciennes.filter(p => prises.has(p.id)), ...pieces];
  for (const { f, heritee } of resultat) {
    const repere = pointInterieur(f.points);
    const r = { x: Math.round(repere.x * 1000) / 1000, z: Math.round(repere.z * 1000) / 1000 };
    if (heritee) pieces.push({ ...heritee, repere: r });
    else pieces.push({ id: nouvelId(toutes()), niveauId, nom: nomLibre(toutes(), traduire), repere: r });
  }
  batiment.pieces = [...autres, ...pieces];
  return pieces;
}

/** Les formes des pièces d'un niveau, pour le dessin : id → { points, aire }. Recalculées, jamais persistées. */
export function formesDesPieces(batiment, niveauId){
  const faces = facesDesMurs((batiment.murs || []).filter(m => m.niveauId === niveauId));
  const formes = new Map();
  for (const p of (batiment.pieces || []).filter(q => q.niveauId === niveauId)) {
    const f = p.repere && faces.find(x => pointDansPolygone(p.repere, x.points));
    if (f) formes.set(p.id, f);
  }
  return formes;
}

/** La pièce du niveau qui contient p (la plus petite, si plusieurs s'emboîtent), ou null. */
export function pieceSous(batiment, niveauId, p){
  let meilleur = null;
  for (const [id, f] of formesDesPieces(batiment, niveauId)) {
    if (pointDansPolygone(p, f.points) && (!meilleur || f.aire < meilleur.aire)) meilleur = { id, aire: f.aire };
  }
  return meilleur ? meilleur.id : null;
}
