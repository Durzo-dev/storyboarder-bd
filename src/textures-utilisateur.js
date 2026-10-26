/**
 * @file src/textures-utilisateur.js
 * LES TEXTURES DE « MES TEXTURES » SUR LE SOL ET LES TRACÉS (#446d).
 *
 * Une texture téléchargée (ou importée) est proposée là où ses USAGES le disent, et nulle part
 * ailleurs (décidé : « c'est leur catégorie qui dicte leur usage ») :
 *   - l'usage `sol` : une matière du Sol d'une Case ou d'une Scène, et d'une Zone de terrain ;
 *   - les usages `route`, `chemin`, `muret`, `cloture`, `haie` : la texture d'un Tracé de ce type ;
 *   - les usages de bâtiment attendent #446e.
 *
 * ⚠️ ON S'INSCRIT DANS LES TABLES QUE LE RENDU LIT DÉJÀ, AU LIEU D'EN AJOUTER UNE. Tout le code
 * du Sol (rendu 3D, plan 2D, menus de la section Sol et de la Zone de terrain) cherche sa matière
 * dans `GROUND_TYPE_DEFS` par son identifiant. Une texture de l'utilisateur y est donc AJOUTÉE,
 * marquée `importee`, et chaque lecteur la trouve sans rien savoir d'elle. Une seconde table aurait
 * demandé de retoucher chacun d'eux, et d'en oublier un.
 *
 * ⚠️ L'IDENTIFIANT EST PERSISTÉ (le `groundType` d'une Case, le `terrainType` d'une Zone, le
 * `traceTexture` d'un Tracé) : `tex:<dossier>`, le nom de son dossier dans `Textures/`, stable
 * d'une session à l'autre. Une texture absente (supprimée, autre machine) n'est pas trouvée, et
 * chaque lecteur retombe sur ce qu'il faisait déjà pour un identifiant inconnu : la première matière
 * du Sol, la texture d'origine du Tracé. Le fichier garde l'identifiant : la retélécharger la rend.
 *
 * La moitié impure (lire « Mes textures » et charger les grains par l'IPC) est en fin de fichier ;
 * tout ce qui décide est pur, et testé sous Node.
 */
import { GROUND_TYPE_DEFS, TRACÉ_TEXTURES } from './constants.js';
import { definirAdresseDuGrain3D, prechargerGrains3D, grainCharge3D } from './bubble-grain.js';

/** Le préfixe des identifiants : rien de ce qui est livré ne commence ainsi. */
export const PREFIXE = 'tex:';

/** Les types de Tracé qui prennent une texture de l'utilisateur, et l'usage qui les ouvre. */
export const USAGE_DU_TRACE = { route: 'route', chemin: 'chemin', muret: 'muret', cloture: 'cloture', haie: 'haie' };

/**
 * Les matières à MOTIF RÉGULIER, que l'anti-répétition du Sol couperait (des lames désalignées, des
 * joints interrompus, cf. `pavage` dans GROUND_TYPE_DEFS). Une texture qui en porte une n'y a pas droit.
 */
const MOTIF_REGULIER = ['paves', 'brique', 'bois', 'parquet', 'carrelage', 'marbre', 'tuiles', 'papier-peint', 'metal'];

/** La rugosité d'une matière (le grain fait le reste) ; 0,9 par défaut, comme la plupart du Sol. */
const RUGOSITE = { neige: 0.98, sable: 0.98, terre: 0.99, moquette: 0.99, asphalte: 0.85, carrelage: 0.3, marbre: 0.18, metal: 0.45 };

/** La taille d'une tuile de Tracé quand la source ne la donne pas : deux mètres, comme l'import. */
const TUILE_PAR_DEFAUT = [2, 2];

export const estTextureUtilisateur = (id) => typeof id === 'string' && id.startsWith(PREFIXE);

/** L'identifiant persisté d'une entrée de « Mes textures ». */
export const idDe = (entree) => PREFIXE + entree.dossier;

/**
 * La clé de son grain. ⚠️ ELLE PORTE LA NATURE, comme les fichiers livrés (`terre.couleur`) :
 * `natureDuNom3D` la lit dans le nom pour savoir s'il faut teinter une photo ou un relief gris.
 */
export const cleDuGrain = (entree) => idDe(entree) + (entree.nature === 'couleur' ? '.couleur' : '');

const utilisable = (e) => !!(e && typeof e.dossier === 'string' && e.dossier && e.grain && Array.isArray(e.usages));
const couleur = (t) => (typeof t === 'string' && /^#[0-9a-f]{6}$/i.test(t) ? t : '#8a8a8a');

/** La matière du Sol d'une texture (format de GROUND_TYPE_DEFS), ou null si elle ne sert pas au Sol. */
export function defSolDe(entree){
  if (!utilisable(entree) || !entree.usages.includes('sol')) return null;
  const matieres = Array.isArray(entree.matieres) ? entree.matieres : [];
  const rugosite = matieres.map(m => RUGOSITE[m]).find(v => v != null);
  return {
    id: idDe(entree), label: entree.nom || entree.dossier, labelEn: entree.nom || entree.dossier,
    // La teinte naturelle relevée à la cuisson : le grain teinté par elle rend la photo telle quelle.
    swatch: couleur(entree.teinte), roughness: rugosite != null ? rugosite : 0.9,
    metalness: matieres.includes('metal') ? 0.5 : 0,
    // La même densité que les matières livrées (#435i) : une texture de l'utilisateur ne doit pas
    // paraître plus grosse ou plus fine que l'herbe d'à côté.
    repeat: 3000, plaques: 0.12, grain: cleDuGrain(entree),
    pavage: !matieres.some(m => MOTIF_REGULIER.includes(m)),
    importee: true,
  };
}

/** La texture de Tracé d'une texture (format de TRACÉ_TEXTURES), ou null si aucun Tracé ne la prend. */
export function traceDe(entree){
  if (!utilisable(entree)) return null;
  const types = Object.keys(USAGE_DU_TRACE).filter(t => entree.usages.includes(USAGE_DU_TRACE[t]));
  if (!types.length) return null;
  const d = Array.isArray(entree.dimensions) && entree.dimensions.length === 2 && entree.dimensions.every(v => Number(v) > 0)
    ? entree.dimensions.map(Number) : TUILE_PAR_DEFAUT;
  return { id: idDe(entree), nom: entree.nom || entree.dossier, grain: cleDuGrain(entree), teinte: couleur(entree.teinte), tuile: d, types };
}

/** Les textures de Tracé de l'utilisateur, par identifiant. Remplie par `installerTexturesUtilisateur`. */
const _traces = new Map();

/** Les usages de bâtiment (#446e), comme dans textures-integrees.js (le toit attend #458). */
const USAGES_BATIMENT = ['mur-ext', 'mur-int', 'sol-int', 'plafond'];

/**
 * La texture de bâtiment d'une entrée (#446e) : `{ id, grain, teinte, tuile, usages }`, ou null si
 * aucun usage de bâtiment. La tuile : sa taille réelle, sinon deux mètres.
 */
export function batimentDe(entree){
  if (!utilisable(entree)) return null;
  const usages = entree.usages.filter(u => USAGES_BATIMENT.includes(u));
  if (!usages.length) return null;
  const d = Array.isArray(entree.dimensions) && entree.dimensions.length === 2 && entree.dimensions.every(v => Number(v) > 0)
    ? entree.dimensions.map(Number) : TUILE_PAR_DEFAUT;
  return { id: idDe(entree), grain: cleDuGrain(entree), teinte: couleur(entree.teinte), tuile: d, usages };
}

/** Les textures de bâtiment de l'utilisateur, par identifiant (`tex:<dossier>`). */
const _batiment = new Map();

/** La texture de bâtiment d'un identifiant `tex:…`, ou null (absente : le bâtiment reste uni). */
export const textureDeBatiment = (id) => _batiment.get(id) || null;

/**
 * Inscrit les textures de « Mes textures » : celles du Sol dans GROUND_TYPE_DEFS (les précédentes
 * en sont retirées, une texture supprimée disparaît des menus), celles des Tracés dans le registre.
 * Rend les grains à charger : `[{ cle, entree }]`.
 */
export function installerTexturesUtilisateur(entrees){
  for (let i = GROUND_TYPE_DEFS.length - 1; i >= 0; i--) if (GROUND_TYPE_DEFS[i].importee) GROUND_TYPE_DEFS.splice(i, 1);
  _traces.clear();
  _batiment.clear();
  const grains = new Map();
  for (const e of Array.isArray(entrees) ? entrees : []) {
    const sol = defSolDe(e), trace = traceDe(e), bati = batimentDe(e);
    if (sol) GROUND_TYPE_DEFS.push(sol);
    if (trace) _traces.set(trace.id, trace);
    if (bati) _batiment.set(bati.id, bati);
    if (sol || trace || bati) grains.set(cleDuGrain(e), e);
  }
  return [...grains].map(([cle, entree]) => ({ cle, entree }));
}

/** La texture qu'un Tracé de ce type doit porter : celle de l'utilisateur si elle le permet, sinon l'originale. */
export function textureDuTrace(type, texture){
  const t = estTextureUtilisateur(texture) ? _traces.get(texture) : null;
  return t && t.types.includes(type) ? t : (TRACÉ_TEXTURES[type] || null);
}

/**
 * Combien de fois une texture sert dans le Projet : `{ tomes, scenes }`. Une fois par Sol de Case,
 * par Zone de terrain et par Tracé qui la portent, comme `countModelUsages` compte les modèles. Les
 * Tracés et les Zones sont des objets de la page, pas des enfants d'une Case : compter « des
 * Cases » demanderait de deviner à laquelle chacun appartient.
 */
export function utilisationsDe(id, { tomes = [], scenes = [] } = {}){
  const porte = (o) => !!o && (o.groundType === id || o.terrainType === id || o.traceTexture === id);
  const compter = (volumes) => (volumes || []).reduce((n, v) => n
    + ((v && v.pages) || []).reduce((m, p) => m + ((p && p.objects) || []).filter(porte).length, 0), 0);
  return { tomes: compter(tomes), scenes: compter(scenes) };
}

// ── La moitié impure ───────────────────────────────────────────────────────────────────────────

/**
 * Lit « Mes textures », les inscrit, charge leurs grains (par l'IPC : le renderer ne lit pas le
 * disque), puis appelle `apres` (un redessin). Sans danger à rappeler : un grain déjà là n'est pas
 * relu. Rend le nombre de textures inscrites.
 */
let _signature = null;

export async function chargerTexturesUtilisateur(api, apres){
  if (!api || !api.texturesMes || !api.texturesImage) return 0;
  let entrees = [];
  try { entrees = await api.texturesMes(); } catch (e) { return 0; }
  const aCharger = installerTexturesUtilisateur(entrees);
  // Rien de changé pour le rendu (un tag ajouté, une fiche rouverte) : on ne refait pas les Cases.
  const signature = JSON.stringify([...GROUND_TYPE_DEFS.filter(d => d.importee), ..._traces.values(), ..._batiment.values()]);
  const change = signature !== _signature;
  _signature = signature;
  const cles = [];
  await Promise.all(aCharger.map(async ({ cle, entree }) => {
    if (grainCharge3D(cle)) return;
    try {
      const r = await api.texturesImage(entree.cle, 'grain');
      if (!r || !r.ok || !r.data) return;
      definirAdresseDuGrain3D(cle, URL.createObjectURL(new Blob([r.data], { type: r.type || 'image/png' })));
      cles.push(cle);
    } catch (e) { /* ce grain manque : la matière retombe sur son aplat */ }
  }));
  if (cles.length) await prechargerGrains3D(cles, apres);
  else if (change && typeof apres === 'function') apres();
  return aCharger.length;
}
