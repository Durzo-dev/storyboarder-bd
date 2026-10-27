/**
 * @file src/textures-integrees.js
 * LES TEXTURES LIVRÉES AVEC L'APPLICATION, DANS « MES TEXTURES » (demandé : « les textures de base
 * de l'appli ne sont pas présentes dans le store »).
 *
 * Deux familles, lues dans les registres qui les font vivre (rien n'est recopié) :
 *   - les matières du Sol (GROUND_TYPE_DEFS, hors textures de l'utilisateur), usage `sol`. « Neutre »
 *     et « Eau » en font partie : ce sont des matières DESSINÉES (pas de photo), mais on doit pouvoir
 *     les choisir depuis le store comme les autres ;
 *   - les textures d'origine des Tracés (TRACÉ_TEXTURES), usage : leur type.
 *
 * Leur provenance (banque, ressource, page) est celle de assets/textures/LICENSES.md, recopiée ici
 * parce que le renderer ne lit pas ce fichier ; tests/textures-integrees.test.mjs vérifie que les
 * deux disent la même chose.
 *
 * Ce qu'on applique en les choisissant (`choix`) : pour le Sol, l'identifiant de la matière ; pour
 * un Tracé, `null`, sa texture d'origine. Fonctions PURES.
 */
import { GROUND_TYPE_DEFS, TRACÉ_TEXTURES } from './constants.js';

/** Le préfixe des clés : distinct des clés de « Mes textures » (`polyhaven:…`, `import:…`). */
export const SOURCE = 'integree';

/** D'où vient chaque grain livré (assets/textures/LICENSES.md) : [ressource, banque, page]. */
export const PROVENANCE = {
  'barriere.couleur': ['Metal055A', 'ambientCG', 'https://ambientcg.com/view?id=Metal055A'],
  'beton': ['Concrete030', 'ambientCG', 'https://ambientcg.com/view?id=Concrete030'],
  'bitume': ['Asphalt025C', 'ambientCG', 'https://ambientcg.com/view?id=Asphalt025C'],
  'carrelage.couleur': ['interior_tiles', 'Poly Haven', 'https://polyhaven.com/a/interior_tiles'],
  'chemin.couleur': ['Ground079L', 'ambientCG', 'https://ambientcg.com/view?id=Ground079L'],
  'cloture.couleur': ['PaintedWood007C', 'ambientCG', 'https://ambientcg.com/view?id=PaintedWood007C'],
  'gazon': ['Grass008', 'ambientCG', 'https://ambientcg.com/view?id=Grass008'],
  'gravier': ['Gravel023', 'ambientCG', 'https://ambientcg.com/view?id=Gravel023'],
  'haie': ['Grass003', 'ambientCG', 'https://ambientcg.com/view?id=Grass003'],
  'herbe': ['Grass001', 'ambientCG', 'https://ambientcg.com/view?id=Grass001'],
  'marbre.couleur': ['Marble023', 'ambientCG', 'https://ambientcg.com/view?id=Marble023'],
  'moquette': ['Carpet012', 'ambientCG', 'https://ambientcg.com/view?id=Carpet012'],
  'muret.couleur': ['Bricks102', 'ambientCG', 'https://ambientcg.com/view?id=Bricks102'],
  'neige': ['Snow005', 'ambientCG', 'https://ambientcg.com/view?id=Snow005'],
  'plancher': ['WoodFloor040', 'ambientCG', 'https://ambientcg.com/view?id=WoodFloor040'],
  'route': ['Asphalt033', 'ambientCG', 'https://ambientcg.com/view?id=Asphalt033'],
  'sable.couleur': ['Ground033', 'ambientCG', 'https://ambientcg.com/view?id=Ground033'],
  'terre.couleur': ['Ground103', 'ambientCG', 'https://ambientcg.com/view?id=Ground103'],
};

/** La matière (texture-matieres.js) de chaque texture livrée, pour le filtre « Toutes les matières ». */
const MATIERE = {
  herbe: 'herbe', gazon: 'herbe', terre: 'terre', sable: 'sable', gravier: 'gravier', bitume: 'asphalte',
  'béton': 'beton', neige: 'neige', carrelage: 'carrelage', plancher: 'parquet', marbre: 'marbre', moquette: 'moquette',
  route: 'asphalte', chemin: 'terre', muret: 'brique', cloture: 'bois', haie: 'feuillage', barriere: 'metal',
};

/** Les noms des textures d'origine des Tracés (TRACÉ_TEXTURES n'en porte pas). */
const NOMS_TRACE = {
  route: ['Road', 'Route'], chemin: ['Dirt path', 'Chemin de terre'], muret: ['Low wall', 'Muret'],
  cloture: ['Fence', 'Clôture'], haie: ['Hedge', 'Haie'], barriere: ['Road barrier', 'Barrière de route'],
};

/**
 * Les usages de BÂTIMENT (#446e) : où une texture habille un bâtiment. Ceux de la table du store
 * (texture-matieres.js), toit compris depuis #458.
 */
export const USAGES_BATIMENT = ['mur-ext', 'mur-int', 'sol-int', 'plafond', 'toit'];
export const estUsageBatiment = (u) => USAGES_BATIMENT.includes(u);

/**
 * Le JEU FOURNI D'EMBLÉE pour les bâtiments (décision 11 de #454) : les textures livrées qui s'y
 * prêtent, d'après leur matière (la table du store), par identifiant.
 */
const USAGES_BATIMENT_LIVREES = {
  'sol:carrelage': ['sol-int', 'mur-int'],
  'sol:plancher': ['sol-int', 'mur-int', 'plafond'],
  'sol:marbre': ['sol-int', 'mur-int'],
  'sol:moquette': ['sol-int'],
  'sol:béton': ['sol-int', 'mur-ext', 'mur-int', 'plafond'],
  'trace:muret': ['mur-ext', 'mur-int'],
  'trace:cloture': ['mur-ext', 'mur-int', 'plafond'],
};

/** La couleur d'un bâtiment sans revêtement, par usage (celle d'avant #446e : rien ne change à l'écran). */
export const COULEURS_BATIMENT = { 'mur-ext': '#d9d4c7', 'mur-int': '#d9d4c7', 'sol-int': '#a89c86', plafond: '#d9d4c7', toit: '#8e4f3c' };

const provenance = (grain) => {
  const p = grain && PROVENANCE[grain];
  return p ? { ressource: p[0], banque: p[1], url: p[2] } : null;
};

/**
 * Les textures livrées, dans le format de « Mes textures » enrichi : `integree: true`, `nom` dans
 * les deux langues, `grain` (clé de assets/textures, ou null pour une matière dessinée), `teinte`,
 * `provenance`, et `choix` (ce qu'on applique). Les clés sont stables : `integree:sol:herbe`.
 */
export function texturesIntegrees(){
  const sol = GROUND_TYPE_DEFS.filter(d => !d.importee).map(d => ({
    cle: `${SOURCE}:sol:${d.id}`, source: SOURCE, id: `sol:${d.id}`, integree: true,
    nom: d.label, nomEn: d.labelEn || d.label, grain: d.grain || null, teinte: d.swatch,
    matieres: MATIERE[d.id] ? [MATIERE[d.id]] : [], usages: ['sol', ...(USAGES_BATIMENT_LIVREES[`sol:${d.id}`] || [])],
    repeat: d.repeat, dessinee: !d.grain, provenance: provenance(d.grain), choix: { sol: d.id },
  }));
  const traces = Object.entries(TRACÉ_TEXTURES).map(([type, t]) => ({
    cle: `${SOURCE}:trace:${type}`, source: SOURCE, id: `trace:${type}`, integree: true,
    nom: NOMS_TRACE[type] ? NOMS_TRACE[type][1] : type, nomEn: NOMS_TRACE[type] ? NOMS_TRACE[type][0] : type,
    grain: t.grain, teinte: t.teinte, dimensions: t.tuile,
    matieres: MATIERE[type] ? [MATIERE[type]] : [],
    // La barrière n'a pas d'usage dans la table du store : elle n'est proposée nulle part, mais se voit.
    usages: [...(type === 'barriere' ? [] : [type]), ...(USAGES_BATIMENT_LIVREES[`trace:${type}`] || [])],
    dessinee: false, provenance: provenance(t.grain), choix: { trace: type },
  }));
  // « Sans texture » : la couleur unie d'un bâtiment, celle d'avant les revêtements. Proposée
  // seulement pour choisir (textures-store-ui.js la cache ailleurs).
  const uni = { cle: `${SOURCE}:uni`, source: SOURCE, id: 'uni', integree: true, uni: true,
    nom: 'Sans texture', nomEn: 'No texture', grain: null, teinte: COULEURS_BATIMENT['mur-ext'],
    matieres: [], usages: USAGES_BATIMENT.slice(), dessinee: true, provenance: null, choix: {} };
  return [...sol, ...traces, uni];
}

/**
 * Ce qu'applique une texture choisie pour un usage : l'identifiant à poser sur le Sol (`groundType`)
 * ou sur le Tracé (`traceTexture`, null pour l'originale). `undefined` si elle ne sert pas cet usage.
 */
export function valeurChoisie(t, usage){
  if (!t || !Array.isArray(t.usages) || !t.usages.includes(usage)) return undefined;
  // Un bâtiment : `int:<id>` pour une texture livrée, null pour « Sans texture ».
  if (estUsageBatiment(usage)) return t.integree ? (t.uni ? null : 'int:' + t.id) : 'tex:' + t.dossier;
  if (t.integree) return usage === 'sol' ? t.choix.sol : null;
  return 'tex:' + t.dossier;
}

/** La texture (livrée ou de l'utilisateur) qui correspond à la valeur posée, pour l'afficher. */
export function textureDeLaValeur(valeur, usage, mes = []){
  const integrees = texturesIntegrees();
  if (estUsageBatiment(usage)) {
    if (typeof valeur === 'string' && valeur.startsWith('tex:')) return mes.find(t => 'tex:' + t.dossier === valeur) || null;
    if (typeof valeur === 'string' && valeur.startsWith('int:')) return integrees.find(t => t.id === valeur.slice(4)) || null;
    return integrees.find(t => t.uni) || null;
  }
  if (usage === 'sol') {
    if (typeof valeur === 'string' && valeur.startsWith('tex:')) return mes.find(t => 'tex:' + t.dossier === valeur) || null;
    return integrees.find(t => t.choix.sol === (valeur || 'herbe')) || null;
  }
  if (typeof valeur === 'string' && valeur.startsWith('tex:')) {
    const t = mes.find(x => 'tex:' + x.dossier === valeur);
    if (t) return t;
  }
  return integrees.find(t => t.choix.trace === usage) || null;
}
