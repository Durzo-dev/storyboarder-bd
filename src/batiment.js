/**
 * @file batiment.js
 * LE FICHIER DE BÂTIMENT (#454a, décisions de Valentin du 22 octobre 2026, cf.
 * docs/en/building-research.md). Fonctions PURES : créer, relire, nommer, écrire.
 *
 * Un bâtiment se construit dans l'ÉDITEUR DE BÂTIMENTS, pas dans la Scène, et il est un MODÈLE :
 * rangé dans `<dossier de Projets>/Batiments`, listé avec les modèles importés. Le placer dans une
 * Scène en fait une COPIE indépendante (l'Élément embarque le bâtiment entier) ; « Enregistrer dans
 * la bibliothèque » refait un Modèle d'une copie retouchée.
 *
 * LES UNITÉS SONT DES MÈTRES, dans le repère du bâtiment (x vers la droite, z vers le bas en vue de
 * dessus, origine libre). Pas les px de la Scène : un bâtiment se place dans plusieurs Scènes, et
 * c'est l'Élément qui le pose qui fait la conversion.
 *
 * LA FORME (version 1) :
 *   { version, nom,
 *     niveaux:    [{ id, nom, elevation, hauteur, dalle }]   ordonnés ; elevation = bas du niveau
 *     murs:       [{ id, niveauId, a:{x,z}, b:{x,z}, epaisseur, hauteurPropre?,
 *                    revetement:{ interieur, exterieur } }]  un mur PAR ÉTAGE (décision 5)
 *     ouvertures: [{ id, murId, type, le, y, largeur, hauteur }]   `le` : fraction le long du mur
 *     escaliers:  [{ id, niveauId, ... }]
 *     pieces:     [{ id, niveauId, nom, sol, plafond }]      déduites des murs, NOMMÉES
 *     toit:       { type, pente, debord, matiere, couleur, terrasse, gardeCorps }
 *     elements:   [ ... ]                                    le mobilier fixe, la cheminée }
 *
 * LA RÈGLE DE LECTURE, la même que celle des Projets (docs/en/persisted-data.md) : un champ inconnu
 * est GARDÉ tel quel (un fichier écrit par une version plus récente ne perd rien en passant par
 * celle-ci), une valeur illisible prend sa valeur par défaut, un mur illisible est écarté plutôt
 * que de faire refuser tout le bâtiment.
 */

import { normaliserEscalier } from './batiment-escaliers.js';

/** La version du format que cette application écrit. */
export const VERSION_BATIMENT = 1;
/** L'extension d'un fichier de bâtiment ; le pont Electron n'accepte qu'elle. */
export const EXTENSION_BATIMENT = '.batiment.json';

/** Les bornes, en mètres. */
export const BORNES_BATIMENT = {
  hauteur: [2, 10], dalle: [0.05, 1], epaisseur: [0.05, 1], elevation: [-100, 1000],
  coordonnee: [-10000, 10000], longueurMin: 0.05,
};
/** Les valeurs par défaut d'un niveau et d'un mur. */
export const DEFAUTS_BATIMENT = { hauteur: 2.8, dalle: 0.2, epaisseur: 0.2 };
/** Les types de toit (#458). */
export const TYPES_DE_TOIT = ['plat', 'un-pan', 'deux-pans', 'quatre-pans'];
/**
 * Les types d'ouverture (#454a-3c, décidé avec Valentin le 23 octobre 2026). Gardés pour plus tard,
 * dans TACHES.md : porte de garage, vitrine, œil-de-bœuf, bow-window, verrière ; et l'option « haut
 * cintré », les volets.
 */
export const TYPES_D_OUVERTURE = ['porte', 'fenetre', 'baie', 'passage'];
/**
 * Les valeurs d'une ouverture neuve, par type. `y` : la hauteur d'allège (le bas de l'ouverture,
 * depuis le sol du niveau) ; `battants` : 1 ou 2 ; `coulissant` : coulisse au lieu de pivoter ;
 * `vitre` : vitrée ou pleine ; `sens` : de quel côté du mur elle s'ouvre (1 ou -1) ; `charniere` :
 * à quel bout elle pivote ('debut' ou 'fin', le long du mur).
 */
export const DEFAUTS_OUVERTURE = {
  porte: { largeur: 0.9, hauteur: 2.1, y: 0, battants: 1, coulissant: false, vitre: false },
  fenetre: { largeur: 1.2, hauteur: 1.2, y: 0.9, battants: 2, coulissant: false, vitre: true },
  baie: { largeur: 2.4, hauteur: 2.2, y: 0, battants: 2, coulissant: true, vitre: true },
  passage: { largeur: 1.2, hauteur: 2.3, y: 0, battants: 0, coulissant: false, vitre: false },
};

const TOIT_DEFAUT = { type: 'deux-pans', pente: 35, debord: 0.3, matiere: null, couleur: null, terrasse: false, gardeCorps: false };

const fini = v => typeof v === 'number' && Number.isFinite(v);
const borne = (v, [min, max], defaut) => (fini(v) ? Math.min(max, Math.max(min, v)) : defaut);
const objet = v => !!v && typeof v === 'object' && !Array.isArray(v);
const texte = (v, defaut) => (typeof v === 'string' && v.trim() ? v.trim() : defaut);

/** Le nom par défaut d'un niveau, selon son rang (0 = rez-de-chaussée, négatif = sous-sol). */
export function nomDuNiveauParDefaut(rang, traduire){
  const t = traduire || ((en, fr) => fr);
  if (rang === 0) return t('Ground floor', 'Rez-de-chaussée');
  if (rang < 0) return rang === -1 ? t('Basement', 'Sous-sol') : t(`Basement ${-rang}`, `Sous-sol ${-rang}`);
  return t(`Floor ${rang}`, `Étage ${rang}`);
}

/** Un bâtiment neuf : un rez-de-chaussée, rien dessus. */
export function creerBatiment(nom, traduire){
  const t = traduire || ((en, fr) => fr);
  return {
    version: VERSION_BATIMENT,
    nom: texte(nom, t('Building', 'Bâtiment')),
    niveaux: [{ id: 'n0', nom: nomDuNiveauParDefaut(0, t), elevation: 0, hauteur: DEFAUTS_BATIMENT.hauteur, dalle: DEFAUTS_BATIMENT.dalle }],
    murs: [], ouvertures: [], escaliers: [], pieces: [],
    toit: { ...TOIT_DEFAUT },
    elements: [],
  };
}

function point(p){
  if (!objet(p) || !fini(p.x) || !fini(p.z)) return null;
  const [min, max] = BORNES_BATIMENT.coordonnee;
  if (p.x < min || p.x > max || p.z < min || p.z > max) return null;
  return { x: p.x, z: p.z };
}

/** Les entrées d'une liste qui ont un id texte, sans doublon (le premier gagne). */
function avecIdentifiants(liste){
  const vus = new Set();
  return (Array.isArray(liste) ? liste : []).filter(e => {
    if (!objet(e) || typeof e.id !== 'string' || !e.id || vus.has(e.id)) return false;
    vus.add(e.id);
    return true;
  });
}

function normaliserNiveaux(liste, traduire){
  const niveaux = avecIdentifiants(liste).map(n => ({
    ...n,
    nom: texte(n.nom, ''),
    elevation: borne(n.elevation, BORNES_BATIMENT.elevation, NaN),
    hauteur: borne(n.hauteur, BORNES_BATIMENT.hauteur, DEFAUTS_BATIMENT.hauteur),
    dalle: borne(n.dalle, BORNES_BATIMENT.dalle, DEFAUTS_BATIMENT.dalle),
  }));
  if (!niveaux.length) return creerBatiment('', traduire).niveaux;
  // Une élévation illisible : posé sur le niveau précédent (ou à 0 pour le premier).
  niveaux.forEach((n, i) => {
    if (Number.isFinite(n.elevation)) return;
    const prec = niveaux[i - 1];
    n.elevation = prec ? prec.elevation + prec.hauteur : 0;
  });
  niveaux.sort((a, b) => a.elevation - b.elevation);
  const rdc = niveaux.findIndex(n => n.elevation >= 0);
  const base = rdc < 0 ? niveaux.length - 1 : rdc;
  niveaux.forEach((n, i) => { if (!n.nom) n.nom = nomDuNiveauParDefaut(i - base, traduire); });
  return niveaux;
}

function normaliserMurs(liste, niveaux){
  const ids = new Set(niveaux.map(n => n.id));
  const parDefaut = (niveaux.find(n => n.elevation === 0) || niveaux[0]).id;
  const murs = [];
  for (const m of avecIdentifiants(liste)) {
    const a = point(m.a), b = point(m.b);
    if (!a || !b || Math.hypot(b.x - a.x, b.z - a.z) < BORNES_BATIMENT.longueurMin) continue;
    const mur = {
      ...m, a, b,
      niveauId: ids.has(m.niveauId) ? m.niveauId : parDefaut,
      epaisseur: borne(m.epaisseur, BORNES_BATIMENT.epaisseur, DEFAUTS_BATIMENT.epaisseur),
      revetement: {
        interieur: objet(m.revetement) && m.revetement.interieur != null ? m.revetement.interieur : null,
        exterieur: objet(m.revetement) && m.revetement.exterieur != null ? m.revetement.exterieur : null,
      },
    };
    if (fini(m.hauteurPropre)) mur.hauteurPropre = borne(m.hauteurPropre, [0.1, BORNES_BATIMENT.hauteur[1]], undefined);
    else delete mur.hauteurPropre;
    murs.push(mur);
  }
  return murs;
}

function normaliserOuvertures(liste, murs){
  const ids = new Set(murs.map(m => m.id));
  return avecIdentifiants(liste)
    .filter(o => ids.has(o.murId))
    .map(o => {
      const type = TYPES_D_OUVERTURE.includes(o.type) ? o.type : 'porte';
      const d = DEFAUTS_OUVERTURE[type];
      return {
        ...o,
        type,
        le: borne(o.le, [0, 1], 0.5),
        y: borne(o.y, [0, BORNES_BATIMENT.hauteur[1]], d.y),
        largeur: borne(o.largeur, [0.2, 20], d.largeur),
        hauteur: borne(o.hauteur, [0.2, BORNES_BATIMENT.hauteur[1]], d.hauteur),
        battants: type === 'passage' ? 0 : (o.battants === 2 ? 2 : o.battants === 1 ? 1 : d.battants),
        coulissant: typeof o.coulissant === 'boolean' ? o.coulissant : d.coulissant,
        vitre: typeof o.vitre === 'boolean' ? o.vitre : d.vitre,
        sens: o.sens === -1 ? -1 : 1,
        charniere: o.charniere === 'fin' ? 'fin' : 'debut',
      };
    });
}

function rattacherAuNiveau(liste, niveaux){
  const ids = new Set(niveaux.map(n => n.id));
  return avecIdentifiants(liste).filter(e => ids.has(e.niveauId));
}

function normaliserToit(t){
  const s = objet(t) ? t : {};
  return {
    ...s,
    type: TYPES_DE_TOIT.includes(s.type) ? s.type : TOIT_DEFAUT.type,
    pente: borne(s.pente, [0, 75], TOIT_DEFAUT.pente),
    debord: borne(s.debord, [0, 3], TOIT_DEFAUT.debord),
    matiere: s.matiere != null ? s.matiere : null,
    couleur: typeof s.couleur === 'string' ? s.couleur : null,
    terrasse: s.terrasse === true,
    gardeCorps: s.gardeCorps === true,
  };
}

/**
 * Relit un bâtiment (un objet déjà décodé). Rend `{ batiment }`, avec `recent: true` si le fichier
 * vient d'une version plus récente du format (lu quand même, ses champs inconnus gardés), ou
 * `{ erreur: 'illisible' }` si ce n'est pas un bâtiment du tout.
 */
export function normaliserBatiment(brut, traduire){
  if (!objet(brut)) return { erreur: 'illisible' };
  const version = fini(brut.version) ? brut.version : VERSION_BATIMENT;
  const niveaux = normaliserNiveaux(brut.niveaux, traduire);
  const murs = normaliserMurs(brut.murs, niveaux);
  const batiment = {
    ...brut,
    version: Math.max(version, VERSION_BATIMENT),
    nom: texte(brut.nom, creerBatiment('', traduire).nom),
    niveaux, murs,
    ouvertures: normaliserOuvertures(brut.ouvertures, murs),
    // #454c : relus avec leurs valeurs par défaut (cf. batiment-escaliers.js, normaliserEscalier).
    escaliers: rattacherAuNiveau(brut.escaliers, niveaux).map(normaliserEscalier),
    pieces: rattacherAuNiveau(brut.pieces, niveaux),
    toit: normaliserToit(brut.toit),
    elements: Array.isArray(brut.elements) ? brut.elements.filter(objet) : [],
  };
  return version > VERSION_BATIMENT ? { batiment, recent: true } : { batiment };
}

/** Le texte d'un fichier de bâtiment → `{ batiment }` ou `{ erreur: 'illisible' }`. */
export function lireBatiment(texteDuFichier, traduire){
  let brut;
  try { brut = JSON.parse(String(texteDuFichier)); } catch { return { erreur: 'illisible' }; }
  return normaliserBatiment(brut, traduire);
}

/** Le texte du fichier : indenté, pour rester lisible et comparable d'une version à l'autre. */
export function ecrireBatiment(batiment){
  return JSON.stringify(batiment, null, 2) + '\n';
}

/**
 * Un nom de fichier propre, sur le modèle de `sanitizeModelName` : ni séparateur de chemin, ni
 * caractère interdit sous Windows, ni point de tête, l'extension imposée une seule fois.
 */
export function nomDeFichierDuBatiment(nom){
  let n = String(nom || '').trim();
  n = n.replace(/^.*[\\/]/, '');
  n = n.replace(/[\\/:*?"<>|]/g, '_');
  n = n.replace(/^\.+/, '');
  n = n.replace(/\.batiment\.json$/i, '').replace(/\.json$/i, '');
  n = n.trim();
  if (!n) n = 'batiment';
  return n + EXTENSION_BATIMENT;
}

/** Un nom libre parmi ceux déjà pris : « maison.batiment.json », « maison (2).batiment.json »… */
export function nomDeFichierLibre(souhaite, existants = []){
  const propre = nomDeFichierDuBatiment(souhaite);
  const pris = new Set(existants.map(n => String(n).toLowerCase()));
  if (!pris.has(propre.toLowerCase())) return propre;
  const base = propre.slice(0, -EXTENSION_BATIMENT.length);
  for (let i = 2; ; i++) {
    const essai = `${base} (${i})${EXTENSION_BATIMENT}`;
    if (!pris.has(essai.toLowerCase())) return essai;
  }
}

/** Le nom affiché d'un fichier : sans son extension. */
export function nomAfficheDuFichier(fichier){
  return String(fichier || '').replace(/\.batiment\.json$/i, '');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LES BÂTIMENTS TRACÉS DANS UNE SCÈNE, AVANT L'ÉDITEUR
// ═══════════════════════════════════════════════════════════════════════════════════════════════
//
// Jusqu'à #454, un bâtiment était une poignée d'Éléments de la Scène : des murs `objet3d` d'objType
// 'mur' groupés par `pieceId`, et leurs ouvertures aimantées. « Modifier » sur un Bâtiment ou une
// Pièce du menu de droite en fait un bâtiment de l'éditeur, d'UN niveau. La Scène n'est pas touchée
// (c'est #454f qui remplacera ses murs par le bâtiment) : on travaille sur une copie.
//
// Un mur de la Scène : son CENTRE (`wxFloor`, `wzFloor`, en mètres), sa longueur (`realLenFloor`),
// son orientation (`rotY`) et sa hauteur (`realHeightFloor`, 3 m par défaut). Ses deux bouts sont
// ceux que calcule `getRoomConnectedComponents` (sidebar.js). Son épaisseur était 6 % de sa hauteur.

const OUVERTURES_DE_LA_SCENE = { porte_ouverte: 'porte', fenetre_ouverte: 'fenetre', baie_vitree: 'baie' };

/**
 * Le bâtiment d'un niveau qui reprend les pièces `pieceIds` des Éléments `objets` (ceux d'une Case
 * ou d'une Scène). Recentré sur l'origine : c'est la Scène qui le place. Rend un bâtiment normalisé.
 */
export function batimentDesPieces(objets, pieceIds, nom, traduire){
  const voulues = new Set(pieceIds || []);
  const tous = Array.isArray(objets) ? objets : [];
  const mursScene = tous.filter(o => o && o.objType === 'mur' && voulues.has(o.pieceId)
    && fini(o.wxFloor) && fini(o.wzFloor) && fini(o.realLenFloor) && o.realLenFloor > 0);
  const b = creerBatiment(nom, traduire);
  const bouts = mursScene.map(w => {
    const demi = w.realLenFloor / 2, ca = Math.cos(w.rotY || 0), sa = Math.sin(w.rotY || 0);
    return { w, a: { x: w.wxFloor - demi * ca, z: w.wzFloor + demi * sa }, b: { x: w.wxFloor + demi * ca, z: w.wzFloor - demi * sa } };
  });
  const xs = bouts.flatMap(m => [m.a.x, m.b.x]), zs = bouts.flatMap(m => [m.a.z, m.b.z]);
  const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
  const cz = zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0;
  const hauteurs = mursScene.map(w => (fini(w.realHeightFloor) && w.realHeightFloor > 0 ? w.realHeightFloor : 3));
  const hauteur = hauteurs.length ? Math.max(...hauteurs) : DEFAUTS_BATIMENT.hauteur;
  b.niveaux[0].hauteur = borne(hauteur, BORNES_BATIMENT.hauteur, DEFAUTS_BATIMENT.hauteur);
  const idDuMur = new Map();
  bouts.forEach((m, i) => {
    const id = 'm' + i;
    idDuMur.set(m.w.id, id);
    const h = hauteurs[i];
    const mur = {
      id, niveauId: b.niveaux[0].id,
      a: { x: m.a.x - cx, z: m.a.z - cz }, b: { x: m.b.x - cx, z: m.b.z - cz },
      epaisseur: h * 0.06, revetement: { interieur: null, exterieur: null },
    };
    if (Math.abs(h - b.niveaux[0].hauteur) > 1e-6) mur.hauteurPropre = h;
    b.murs.push(mur);
  });
  tous.forEach((o, i) => {
    const type = o && OUVERTURES_DE_LA_SCENE[o.objType];
    const murId = o && idDuMur.get(o.magnetWallId);
    if (!type || !murId) return;
    b.ouvertures.push({ id: 'o' + i, murId, type, le: fini(o.wallAlongFrac) ? o.wallAlongFrac : 0.5, ...DEFAUTS_OUVERTURE[type], sens: 1, charniere: 'debut' });
  });
  [...voulues].forEach((pid, i) => {
    const rep = tous.find(o => o && o.pieceId === pid && o.pieceLabel);
    // Le REPÈRE (#454a-3b) : le centre des bouts de ses murs. C'est par lui que la pièce détectée
    // dans l'éditeur retrouve ce nom (cf. batiment-pieces.js).
    const siens = bouts.map((m, j) => ({ m, j })).filter(x => x.m.w.pieceId === pid).flatMap(x => [b.murs[x.j].a, b.murs[x.j].b]);
    const piece = { id: 'p' + i, niveauId: b.niveaux[0].id, nom: rep ? String(rep.pieceLabel) : (traduire || ((en, fr) => fr))(`Room ${i + 1}`, `Pièce ${i + 1}`) };
    if (siens.length) piece.repere = { x: siens.reduce((t, p) => t + p.x, 0) / siens.length, z: siens.reduce((t, p) => t + p.z, 0) / siens.length };
    b.pieces.push(piece);
  });
  return normaliserBatiment(b, traduire).batiment;
}
