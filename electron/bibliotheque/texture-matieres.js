/**
 * texture-matieres.js, LES MATIÈRES ET LEURS USAGES du store de textures (#446a, table validée par
 * Valentin le 25 octobre 2026).
 *
 * Deux niveaux :
 *   - la MATIÈRE est la catégorie qu'on parcourt (comme les 18 catégories communes des modèles).
 *     Une texture peut en avoir PLUSIEURS (« pierre » et « pavés ») : c'est voulu (demandé) ;
 *   - l'USAGE découle des matières, jamais de la texture elle-même (demandé : « c'est leur
 *     catégorie qui dictera leur usage ») : il décide où la texture est proposée (liste des Sols,
 *     un Tracé, un revêtement de bâtiment).
 *
 * Une texture sans aucune matière reconnue est ÉCARTÉE : tissus, cuir, nourriture, plastique,
 * décalques, HDRI, matières fantaisistes ne se posent sur aucune de nos surfaces.
 *
 * CommonJS, comme les autres modules du store : lu par le processus principal (les sources) ET
 * par l'interface (les filtres), via store:infos.
 */
'use strict';

/** Les usages, dans l'ordre de l'interface. `cible` : où l'application le propose. */
const USAGES = [
  ['sol', 'Sol extérieur', 'Outdoor ground', 'sol'],
  ['route', 'Route', 'Road', 'trace'],
  ['chemin', 'Chemin', 'Path', 'trace'],
  ['muret', 'Muret', 'Low wall', 'trace'],
  ['cloture', 'Clôture', 'Fence', 'trace'],
  ['haie', 'Haie', 'Hedge', 'trace'],
  ['mur-ext', 'Mur extérieur', 'Exterior wall', 'batiment'],
  ['mur-int', 'Mur intérieur', 'Interior wall', 'batiment'],
  ['sol-int', 'Sol intérieur', 'Interior floor', 'batiment'],
  ['plafond', 'Plafond', 'Ceiling', 'batiment'],
  ['toit', 'Toit', 'Roof', 'batiment'],
].map(([slug, fr, en, cible]) => ({ slug, fr, en, cible }));

/**
 * Les matières, leurs usages (la table validée), et ce qui les reconnaît :
 *   - `ambientcg` : les catégories ambientCG (`displayCategory`, comparées sans espaces) ;
 *   - `polyhaven` : les catégories Poly Haven (le tableau `categories`) ;
 *   - `mots` : des mots entiers cherchés dans les tags et le nom, pour toutes les sources.
 */
const MATIERES = [
  ['herbe', 'Herbe & mousse', 'Grass & moss', ['sol', 'haie'],
    ['Grass', 'Moss'], [], ['grass', 'lawn', 'moss', 'turf', 'meadow']],
  ['terre', 'Terre & boue', 'Dirt & mud', ['sol', 'chemin'],
    ['Ground'], [], ['dirt', 'mud', 'soil', 'muddy', 'forest floor']],
  ['sable', 'Sable', 'Sand', ['sol', 'chemin'],
    [], ['sand'], ['sand', 'beach', 'dune']],
  ['gravier', 'Gravier', 'Gravel', ['sol', 'chemin'],
    ['Gravel'], ['gravel'], ['gravel', 'pebbles', 'shingle']],
  ['roche', 'Roche & pierre', 'Rock & stone', ['sol', 'muret', 'mur-ext', 'mur-int'],
    ['Rock', 'Rocks'], ['rock', 'sandstone'], ['rock', 'rocks', 'stone wall', 'cliff', 'boulder']],
  ['neige', 'Neige & glace', 'Snow & ice', ['sol', 'route', 'chemin'],
    ['Snow', 'Ice'], ['snow'], ['snow', 'ice', 'frost']],
  ['asphalte', 'Asphalte', 'Asphalt', ['sol', 'route'],
    ['Asphalt', 'Road'], ['asphalt'], ['asphalt', 'tarmac', 'bitumen']],
  ['paves', 'Pavés & dalles', 'Paving & slabs', ['sol', 'route', 'chemin', 'sol-int'],
    ['PavingStones', 'Pathway', 'TactilePaving'], ['cobblestone'], ['cobblestone', 'cobble', 'paving', 'pavers', 'flagstone']],
  ['brique', 'Brique', 'Brick', ['muret', 'mur-ext', 'mur-int'],
    ['Bricks', 'PaintedBricks'], ['brick'], ['brick', 'bricks']],
  ['beton', 'Béton', 'Concrete', ['sol', 'route', 'muret', 'mur-ext', 'mur-int', 'sol-int', 'plafond'],
    ['Concrete'], ['concrete'], ['concrete', 'cement']],
  ['enduit', 'Enduit & plâtre', 'Render & plaster', ['muret', 'mur-ext', 'mur-int', 'plafond'],
    ['Plaster', 'PaintedPlaster', 'Facade', 'OfficeCeiling'], ['plaster', 'plaster-concrete'], ['plaster', 'stucco', 'render']],
  ['bois', 'Bois brut & bardage', 'Raw wood & siding', ['cloture', 'mur-ext', 'mur-int', 'plafond'],
    ['Wood', 'WoodSiding', 'PaintedWood'], ['raw wood'], ['siding', 'weatherboard', 'timber']],
  ['parquet', 'Parquet & planches', 'Parquet & planks', ['chemin', 'cloture', 'mur-int', 'sol-int', 'plafond'],
    ['WoodFloor', 'Planks'], [], ['parquet', 'planks', 'floorboards', 'wood floor', 'laminate']],
  ['carrelage', 'Carrelage', 'Tiles', ['mur-int', 'sol-int'],
    ['Tiles', 'Terrazzo', 'GlazedTerracotta'], ['tiles'], ['tiles', 'tile', 'terrazzo', 'mosaic']],
  ['marbre', 'Marbre & pierre polie', 'Marble & polished stone', ['mur-int', 'sol-int'],
    ['Marble', 'Granite', 'Travertine', 'Onyx'], [], ['marble', 'granite', 'travertine', 'onyx']],
  ['moquette', 'Moquette & tapis', 'Carpet & rugs', ['sol-int'],
    ['Carpet', 'Tatami'], ['carpet'], ['carpet', 'rug', 'tatami']],
  ['papier-peint', 'Papier peint', 'Wallpaper', ['mur-int'],
    ['Wallpaper'], [], ['wallpaper']],
  ['metal', 'Métal & tôle', 'Metal & sheet metal', ['cloture', 'mur-ext', 'plafond', 'toit'],
    ['Metal', 'MetalPlates', 'CorrugatedSteel', 'SheetMetal', 'PaintedMetal', 'DiamondPlate', 'Fence'], ['metal'],
    ['corrugated', 'sheet metal', 'chain link']],
  ['tuiles', 'Tuiles & ardoises', 'Roof tiles & slate', ['toit'],
    ['RoofingTiles', 'ThatchedRoof'], ['roofing'], ['roof', 'roofing', 'shingles', 'slate', 'thatch']],
  ['feuillage', 'Feuillage', 'Foliage', ['sol', 'haie'],
    ['ScatteredLeaves', 'Leaf'], [], ['leaves', 'foliage', 'hedge', 'ivy']],
].map(([slug, fr, en, usages, ambientcg, polyhaven, mots]) => ({ slug, fr, en, usages, ambientcg, polyhaven, mots }));

/** Le bois en catégorie Poly Haven (« wood ») : du parquet s'il est aussi « floor », sinon du bois brut. */
const PH_BOIS = 'wood';

const compacte = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalise = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** Les matières que des mots (tags, nom) désignent, mots ENTIERS : « tile » ne trouve pas « textile ». */
function matieresParMots(textes){
  const sac = normalise((textes || []).join(' '));
  return MATIERES.filter(m => m.mots.some(mot => sac.includes(` ${mot} `))).map(m => m.slug);
}

const dansLOrdre = (slugs) => MATIERES.map(m => m.slug).filter(s => slugs.has(s));

/**
 * Les matières d'une texture Poly Haven : ses catégories, puis ses tags et son nom. Rend une liste
 * dans l'ordre de MATIERES, vide si la texture n'a rien à faire ici.
 */
function matieresPolyhaven({ categories = [], tags = [], nom = '' } = {}){
  const cats = (Array.isArray(categories) ? categories : []).map(c => String(c).toLowerCase());
  const s = new Set();
  for (const m of MATIERES) if (m.polyhaven.some(c => cats.includes(c))) s.add(m.slug);
  if (cats.includes(PH_BOIS)) s.add(cats.includes('floor') ? 'parquet' : 'bois');
  for (const slug of matieresParMots([...(Array.isArray(tags) ? tags : []), nom])) s.add(slug);
  return dansLOrdre(s);
}

/** Les matières d'une texture ambientCG : sa catégorie (`displayCategory`), puis ses tags et son nom. */
function matieresAmbientcg({ categorie = '', tags = [], nom = '' } = {}){
  const cat = compacte(categorie);
  const s = new Set();
  for (const m of MATIERES) if (m.ambientcg.some(c => compacte(c) === cat)) s.add(m.slug);
  for (const slug of matieresParMots([...(Array.isArray(tags) ? tags : []), nom])) s.add(slug);
  return dansLOrdre(s);
}

/** Les usages d'une liste de matières (l'union, dans l'ordre de USAGES). */
function usagesDe(matieres){
  const voulues = new Set(matieres || []);
  const s = new Set();
  for (const m of MATIERES) if (voulues.has(m.slug)) m.usages.forEach(u => s.add(u));
  return USAGES.map(u => u.slug).filter(u => s.has(u));
}

/** Les matières qui servent un usage (pour filtrer par usage). */
function matieresDeLUsage(usage){
  return MATIERES.filter(m => m.usages.includes(usage)).map(m => m.slug);
}

/** Les catégories ambientCG à demander pour des matières (le filtre côté serveur). */
function categoriesAmbientcg(matieres){
  const voulues = new Set(matieres || []);
  return [...new Set(MATIERES.filter(m => voulues.has(m.slug)).flatMap(m => m.ambientcg))];
}

const matiere = (slug) => MATIERES.find(m => m.slug === slug) || null;
const usage = (slug) => USAGES.find(u => u.slug === slug) || null;

module.exports = {
  USAGES, MATIERES, matiere, usage,
  matieresPolyhaven, matieresAmbientcg, matieresParMots,
  usagesDe, matieresDeLUsage, categoriesAmbientcg,
};
