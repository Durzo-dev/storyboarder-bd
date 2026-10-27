/**
 * @file batiment-revetements.js
 * LES REVÊTEMENTS D'UN BÂTIMENT (#454d avec #446e) : ce qui habille ses murs, ses sols, ses plafonds.
 *
 * Un revêtement est `{ texture, couleur }` :
 *   - `texture` : `int:<id>` pour une texture livrée (textures-integrees.js), `tex:<dossier>` pour
 *     une texture de « Mes textures », null pour aucune (la couleur unie d'avant, rien ne change) ;
 *   - `couleur` : `#rrggbb` qui teint la texture (ou colore l'uni), null pour la couleur naturelle.
 *
 * OÙ ILS VIVENT (décision 5 de #454 : « chaque étage habille l'intérieur de ses murs à sa façon ») :
 *   - une PIÈCE : `murs` (la face de chaque mur tournée vers elle), `sol`, `plafond` ;
 *   - le BÂTIMENT : `facade` (les faces de tous ses murs tournées vers l'extérieur, tous étages
 *     confondus : demandé, pas de façade par étage) ;
 *   - un MUR peut l'emporter sur sa face extérieure (`revetement.exterieur`, champ du format d'origine).
 * Tous AJOUTÉS, absents par défaut : un bâtiment existant se dessine comme avant.
 *
 * La première moitié est PURE (les règles, testées) ; la fabrique de matières, en fin de fichier,
 * touche au canevas et à three.
 */
import { COULEURS_BATIMENT, texturesIntegrees } from './textures-integrees.js';
import { textureDeBatiment } from './textures-utilisateur.js';
import { grainCharge3D, prechargerGrains3D } from './bubble-grain.js';
import { appliquerTeinteAuMotif3D, rvbDeCouleur3D, natureDuNom3D } from './bubble-texture.js';
import { GROUND_PLANE_SIZE_3D } from './constants.js';
import { dansLaFace } from './batiment-pieces.js';

const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : null);

/** Un revêtement propre `{ texture, couleur }`, ou null s'il n'y a rien à appliquer. PURE. */
export function normaliserRevetement(v){
  if (!v || typeof v !== 'object') return null;
  const texture = typeof v.texture === 'string' && /^(int|tex):/.test(v.texture) ? v.texture : null;
  const couleur = hex(v.couleur);
  return texture || couleur ? { texture, couleur } : null;
}

/** Le revêtement d'une face de mur tournée vers `pieceId` (null : l'extérieur). PURE. */
export function revetementDeLaFace(b, niveauId, mur, pieceId){
  if (pieceId) {
    const p = (b.pieces || []).find(x => x.id === pieceId);
    return normaliserRevetement(p && p.murs);
  }
  const propre = normaliserRevetement(mur && mur.revetement && mur.revetement.exterieur);
  if (propre) return propre;
  return normaliserRevetement(b && b.facade);
}

/** Le revêtement du sol ou du plafond d'une pièce. PURE. */
export function revetementDeLaPiece(b, pieceId, quoi){
  const p = (b.pieces || []).find(x => x.id === pieceId);
  return normaliserRevetement(p && p[quoi]);
}

/**
 * De quel côté regarde une face de mur : la pièce qu'on trouve juste devant elle (à 6 cm, moins que
 * la plus fine des cloisons), ou null pour l'extérieur. `formes` : les formes des pièces du niveau
 * (formesDesPieces). PURE.
 */
export function pieceDevantLaFace(formes, milieu, normale, ecart = 0.06){
  const p = { x: milieu.x + normale.x * ecart, z: milieu.z + normale.z * ecart };
  let meilleur = null;
  for (const [id, f] of formes) if (dansLaFace(p, f) && (!meilleur || f.aire < meilleur.aire)) meilleur = { id, aire: f.aire };
  return meilleur ? meilleur.id : null;
}

/**
 * Ce qu'il faut pour peindre un revêtement : `{ grain, teinte, tuile }` (tuile en mètres), ou
 * `{ couleur }` pour un uni. `usage` : 'mur-ext', 'mur-int', 'sol-int', 'plafond', 'toit' (#458). PURE, sauf la
 * lecture du registre de « Mes textures » (textures-utilisateur.js).
 */
export function peintureDuRevetement(rev, usage){
  const r = normaliserRevetement(rev);
  const uni = { couleur: (r && r.couleur) || COULEURS_BATIMENT[usage] || COULEURS_BATIMENT['mur-int'] };
  if (!r || !r.texture) return uni;
  if (r.texture.startsWith('int:')) {
    const t = texturesIntegrees().find(x => x.id === r.texture.slice(4));
    if (!t || !t.grain) return uni;
    const cote = t.dimensions ? null : (t.repeat ? GROUND_PLANE_SIZE_3D / t.repeat : 2);
    return { grain: t.grain, teinte: r.couleur || t.teinte, tuile: t.dimensions || [cote, cote] };
  }
  const t = textureDeBatiment(r.texture);
  if (!t) return uni;   // absente sur cette machine : l'uni, le fichier garde la référence
  return { grain: t.grain, teinte: r.couleur || t.teinte, tuile: t.tuile };
}

// ── La fabrique de matières ─────────────────────────────────────────────────────────────────────

/**
 * ⚠️ PLAFONNÉE : la couleur d'un revêtement s'applique en direct au glissé du sélecteur, et chaque
 * nuance traversée ferait une tuile (4 Mo) et une matière. Les plus anciennes sont libérées ; un
 * bâtiment qui en employait une la refait à son prochain rendu.
 */
const MATIERES_MAX = 48;

/**
 * La fabrique des matières de revêtement d'un renderer : `(rev, usage) => MeshStandardMaterial`.
 * Les UV des faces sont en MÈTRES : la texture se répète une fois par tuile. Une texture dont le
 * grain n'est pas encore chargé est peinte unie de sa teinte, et sa clé le dit : elle sera refaite.
 */
/**
 * Les grains demandés et pas encore là. ⚠️ Une texture posée avant que son grain soit chargé était
 * peinte unie et le restait jusqu'au prochain rebâtiment (signalé : le sol n'apparaissait qu'en
 * changeant sa couleur). On demande le grain ; à son arrivée, `grains-batiment` fait refaire les
 * bâtiments (l'aperçu de l'éditeur l'écoute).
 */
const demandes = new Set();
function demanderLeGrain(grain){
  if (demandes.has(grain) || typeof window === 'undefined') return;
  demandes.add(grain);
  prechargerGrains3D([grain], () => { demandes.delete(grain); window.dispatchEvent(new window.CustomEvent('grains-batiment')); })
    .then(n => { if (!n) demandes.delete(grain); });
}

export function fabriqueDeRevetements(T){
  const cache = new Map();
  return (rev, usage) => {
    const p = peintureDuRevetement(rev, usage);
    const img = p.grain ? grainCharge3D(p.grain) : null;
    if (p.grain && !img) demanderLeGrain(p.grain);
    const cle = p.grain ? `${p.grain}|${p.teinte}|${p.tuile.join('x')}|${img ? 'pret' : 'attente'}|${usage}` : `uni|${p.couleur}|${usage}`;
    if (cache.has(cle)) { const m = cache.get(cle); cache.delete(cle); cache.set(cle, m); return m; }
    const doubleFace = usage === 'sol-int' || usage === 'plafond' || usage === 'toit';
    let m;
    if (img && typeof document !== 'undefined') {
      const toile = document.createElement('canvas');
      toile.width = img.width; toile.height = img.height;
      const c = toile.getContext('2d', { willReadFrequently: true });
      c.drawImage(img, 0, 0);
      const d = c.getImageData(0, 0, toile.width, toile.height);
      const rvb = rvbDeCouleur3D(p.teinte);
      if (rvb) appliquerTeinteAuMotif3D(d.data, rvb, natureDuNom3D(p.grain));
      c.putImageData(d, 0, 0);
      const carte = new T.CanvasTexture(toile);
      carte.wrapS = carte.wrapT = T.RepeatWrapping;
      carte.repeat.set(1 / p.tuile[0], 1 / p.tuile[1]);
      carte.anisotropy = 4;
      m = new T.MeshStandardMaterial({ map: carte, roughness: 0.9, side: doubleFace ? T.DoubleSide : T.FrontSide });
    } else {
      m = new T.MeshStandardMaterial({ color: new T.Color(p.teinte || p.couleur), roughness: 0.9, side: doubleFace ? T.DoubleSide : T.FrontSide });
    }
    m.userData.revetement = true;
    while (cache.size >= MATIERES_MAX) {
      const [k, vieille] = cache.entries().next().value;
      cache.delete(k);
      if (vieille.map) vieille.map.dispose();
      vieille.dispose();
    }
    cache.set(cle, m);
    return m;
  };
}
