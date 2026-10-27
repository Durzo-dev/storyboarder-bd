/**
 * @file batiment-cours.js
 * LES COURS d'un bâtiment (#458c, décidé avec Valentin le 27 octobre 2026). Fonctions PURES.
 *
 * Une cour est une pièce devenue un VIDE (`piece.vide`, cf. batiment-pieces.js) : ouverte jusqu'au
 * ciel. Créée à un niveau qui a des étages au-dessus, elle doit donc s'y prolonger : à chaque étage
 * dont une pièce couvre son emprise, les murs de son contour sont tracés (ceux déjà en place sont
 * gardés) et la face fermée devient un vide. Là où l'étage ne la couvre pas, rien à faire.
 *
 * Un mur qui traverse l'emprise à un étage, un escalier posé dedans, la trémie d'un escalier qui y
 * monte : la cour ne peut pas monter. `prolongerLaCour` le dit (`erreur`) ; l'appelant travaille sur
 * une COPIE et n'applique rien.
 */
import { niveauxTries } from './batiment-niveaux.js';
import { formesDesPieces, pointDansPolygone, pointInterieur, actualiserPieces, dansLaFace } from './batiment-pieces.js';
import { ajouterContour } from './batiment-trace.js';
import { formeDeLEscalier, tremieDeLEscalier } from './batiment-escaliers.js';

/** La distance d'un point au bord d'un polygone. */
function distanceAuBord(p, poly){
  let m = Infinity;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
    m = Math.min(m, Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)));
  });
  return m;
}
const dedansStrict = (p, poly) => pointDansPolygone(p, poly) && distanceAuBord(p, poly) > 1e-3;

/** Le segment a → b passe-t-il À L'INTÉRIEUR du polygone (pas seulement le long de son bord) ? */
function segmentDedans(a, b, poly){
  const ts = [0, 1];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const r = { x: b.x - a.x, z: b.z - a.z }, s = { x: q.x - p.x, z: q.z - p.z };
    const den = r.x * s.z - r.z * s.x;
    if (Math.abs(den) < 1e-12) return;
    const t = ((p.x - a.x) * s.z - (p.z - a.z) * s.x) / den, u = ((p.x - a.x) * r.z - (p.z - a.z) * r.x) / den;
    if (t > 0 && t < 1 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
  });
  ts.sort((x, y) => x - y);
  for (let i = 0; i + 1 < ts.length; i++) {
    const t = (ts[i] + ts[i + 1]) / 2;
    if (dedansStrict({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, poly)) return true;
  }
  return false;
}

/** Deux polygones se recouvrent-ils (au-delà de leurs bords) ? */
function serecouvrent(A, B){
  if (A.some(p => dedansStrict(p, B)) || B.some(p => dedansStrict(p, A))) return true;
  return A.some((a, i) => segmentDedans(a, A[(i + 1) % A.length], B));
}

/** L'emprise d'une pièce (son contour en axes de murs), ou null. */
export function empriseDeLaPiece(b, niveauId, pieceId){
  const f = formesDesPieces(b, niveauId).get(pieceId);
  return f ? f.points : null;
}

/**
 * Les étages AU-DESSUS de `niveauId` dont une pièce recouvre l'emprise `poly` : ceux où la cour doit
 * monter (leurs ids, du plus bas au plus haut). PURE.
 */
export function etagesAuDessus(b, niveauId, poly){
  const tries = niveauxTries(b);
  const i = tries.findIndex(n => n.id === niveauId);
  return tries.slice(i + 1).filter(n => [...formesDesPieces(b, n.id).values()].some(f => serecouvrent(f.points, poly))).map(n => n.id);
}

/**
 * Prolonge la cour `pieceId` (déjà un vide) aux étages du dessus qui la couvrent. MODIFIE `b` :
 * l'appeler sur une copie. Rend `{ etages }` (ceux où elle est montée) ou `{ erreur: { niveauId,
 * raison } }`, raison : 'mur' | 'escalier' | 'tremie' | 'forme'. PURE (sur `b`).
 */
export function prolongerLaCour(b, niveauId, pieceId, epaisseur, traduire){
  const poly = empriseDeLaPiece(b, niveauId, pieceId);
  if (!poly) return { erreur: { niveauId, raison: 'forme' } };
  const repere = pointInterieur(poly);
  const etages = etagesAuDessus(b, niveauId, poly);
  const tries = niveauxTries(b);
  for (const id of etages) {
    // Un mur de l'étage qui passe dans l'emprise (pas le long de son bord).
    if ((b.murs || []).some(m => m.niveauId === id && segmentDedans(m.a, m.b, poly))) return { erreur: { niveauId: id, raison: 'mur' } };
    // Un escalier posé dedans, ou la trémie d'un escalier qui monte du niveau du dessous.
    if ((b.escaliers || []).some(x => x.niveauId === id && (() => { const f = formeDeLEscalier(b, x); return f && serecouvrent(f.emprise, poly); })())) {
      return { erreur: { niveauId: id, raison: 'escalier' } };
    }
    const dessous = tries[tries.findIndex(n => n.id === id) - 1];
    if (dessous && (b.escaliers || []).some(x => x.niveauId === dessous.id && (() => { const t = tremieDeLEscalier(b, x); return t && serecouvrent(t, poly); })())) {
      return { erreur: { niveauId: id, raison: 'tremie' } };
    }
    const r = ajouterContour(b, id, poly, epaisseur);
    if (r.erreur) return { erreur: { niveauId: id, raison: 'mur' } };
    actualiserPieces(b, id, traduire);
    const [pid] = [...formesDesPieces(b, id)].find(([, f]) => dansLaFace(repere, f)) || [];
    const piece = pid && (b.pieces || []).find(p => p.id === pid);
    if (!piece) return { erreur: { niveauId: id, raison: 'forme' } };
    piece.vide = true;
  }
  return { etages };
}
