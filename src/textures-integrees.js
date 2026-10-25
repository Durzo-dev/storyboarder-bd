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
    matieres: MATIERE[d.id] ? [MATIERE[d.id]] : [], usages: ['sol'],
    dessinee: !d.grain, provenance: provenance(d.grain), choix: { sol: d.id },
  }));
  const traces = Object.entries(TRACÉ_TEXTURES).map(([type, t]) => ({
    cle: `${SOURCE}:trace:${type}`, source: SOURCE, id: `trace:${type}`, integree: true,
    nom: NOMS_TRACE[type] ? NOMS_TRACE[type][1] : type, nomEn: NOMS_TRACE[type] ? NOMS_TRACE[type][0] : type,
    grain: t.grain, teinte: t.teinte, dimensions: t.tuile,
    matieres: MATIERE[type] ? [MATIERE[type]] : [],
    // La barrière n'a pas d'usage dans la table du store : elle n'est proposée nulle part, mais se voit.
    usages: type === 'barriere' ? [] : [type],
    dessinee: false, provenance: provenance(t.grain), choix: { trace: type },
  }));
  return [...sol, ...traces];
}

/**
 * Ce qu'applique une texture choisie pour un usage : l'identifiant à poser sur le Sol (`groundType`)
 * ou sur le Tracé (`traceTexture`, null pour l'originale). `undefined` si elle ne sert pas cet usage.
 */
export function valeurChoisie(t, usage){
  if (!t || !Array.isArray(t.usages) || !t.usages.includes(usage)) return undefined;
  if (t.integree) return usage === 'sol' ? t.choix.sol : null;
  return 'tex:' + t.dossier;
}

/** La texture (livrée ou de l'utilisateur) qui correspond à la valeur posée, pour l'afficher. */
export function textureDeLaValeur(valeur, usage, mes = []){
  const integrees = texturesIntegrees();
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
