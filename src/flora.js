/**
 * @file flora.js
 * THE PLANTS OF A PLACE (#480b): which trees and shrubs grow around it, so that a tree OSM says nothing about
 * (no `genus`, `species`, `leaf_type`), or one read on the aerial photo, takes a form of the place (an olive
 * tree in Nice, a conifer in the Vosges) instead of always the same broadleaved tree.
 *
 * The source: GBIF (gbif.org), the world's open record of observed species (CC0 / CC-BY data, no key). One
 * request, made by the main process (real-place.js flora), counts the vascular plants observed within 5 km
 * by genus; the genera known here (GENERA, the common trees and shrubs of towns and their countryside) are
 * summed by form. MEASURED (13 Nov. 2026, 0.3 to 0.5 s): Montpellier, trees 84 % broadleaved, 7 % conifers,
 * 5 % olive trees, 2 % cypresses, 1 % palms, 1 % stone pines; Nice, 16 % olive trees; Eguisheim, 16 %
 * conifers; Brest, 3 % conifers, no palm. Read here, PURE.
 */

/**
 * The genera known, their form (a built-in object) and their GBIF backbone key (`genusKey`, MEASURED with
 * /species/match on 13 Nov. 2026; Cedrus and Washingtonia, homonyms of animal genera, through one of their species).
 */
export const GENERA = Object.freeze({
  // Broadleaved trees.
  Acer: ['arbre', 3189834], Aesculus: ['arbre', 3189801], Ailanthus: ['arbre', 3190652], Albizia: ['arbre', 2972897],
  Alnus: ['arbre', 2876099], Betula: ['arbre', 2875008], Carpinus: ['arbre', 2875770], Castanea: ['arbre', 2882140],
  Catalpa: ['arbre', 3172611], Celtis: ['arbre', 2984479], Cercis: ['arbre', 2955919],
  Eucalyptus: ['arbre', 7493935], Fagus: ['arbre', 2874875], Ficus: ['arbre', 2984588], Fraxinus: ['arbre', 3172323],
  Ginkgo: ['arbre', 2687884], Gleditsia: ['arbre', 2959442], Jacaranda: ['arbre', 3172498],
  Juglans: ['arbre', 3054350], Koelreuteria: ['arbre', 3190053], Lagerstroemia: ['arbre', 3188723],
  Liquidambar: ['arbre', 3152823], Liriodendron: ['arbre', 3152860], Magnolia: ['arbre', 2888195],
  Malus: ['arbre', 3001068], Melia: ['arbre', 3190496], Morus: ['arbre', 2984545], Paulownia: ['arbre', 3170822],
  Platanus: ['arbre', 3152811], Populus: ['arbre', 3040183], Prunus: ['arbre', 3020559], Pyrus: ['arbre', 2986532],
  Quercus: ['arbre', 2877951], Robinia: ['arbre', 2952066], Salix: ['arbre', 3039576], Sophora: ['arbre', 2958901],
  Sorbus: ['arbre', 3012146], Styphnolobium: ['arbre', 2963568], Tilia: ['arbre', 3152041],
  Ulmus: ['arbre', 2984510], Zelkova: ['arbre', 2984531],
  // Conifers, cypresses, olive trees, palms.
  Abies: ['conifere', 2684876], Araucaria: ['conifere', 2684910], Cedrus: ['conifere', 2685742],
  Cryptomeria: ['conifere', 2683915], Juniperus: ['conifere', 2684359], Larix: ['conifere', 2686156],
  Metasequoia: ['conifere', 8307747], Picea: ['conifere', 7606064], Pinus: ['conifere', 2684241],
  Pseudotsuga: ['conifere', 2685775], Sequoia: ['conifere', 2683908], Sequoiadendron: ['conifere', 2684119],
  Taxus: ['conifere', 2684902], Tsuga: ['conifere', 8527396], Calocedrus: ['cypres', 2683935],
  Chamaecyparis: ['cypres', 2683848], Cupressus: ['cypres', 10225588], Thuja: ['cypres', 2684168],
  Olea: ['olivier', 3172244], Butia: ['palmier', 2736210], Chamaerops: ['palmier', 2736624],
  Phoenix: ['palmier', 2732076], Syagrus: ['palmier', 2737041], Trachycarpus: ['palmier', 2739070],
  Washingtonia: ['palmier', 2684137],
  // Shrubs (a small trunk) and bushes.
  Arbutus: ['arbuste', 2882796], Buxus: ['arbuste', 2984666], Cornus: ['arbuste', 3082226],
  Corylus: ['arbuste', 2875967], Crataegus: ['arbuste', 3013395], Euonymus: ['arbuste', 3169115],
  Ilex: ['arbuste', 10792217], Laurus: ['arbuste', 2988444], Ligustrum: ['arbuste', 3172289],
  Myrtus: ['arbuste', 3032317], Nerium: ['arbuste', 3169755], Phillyrea: ['arbuste', 7325888],
  Photinia: ['arbuste', 3000268], Pistacia: ['arbuste', 3190459], Pittosporum: ['arbuste', 7363256],
  Rhamnus: ['arbuste', 3039471], Sambucus: ['arbuste', 2888721], Viburnum: ['arbuste', 2888580],
  Calluna: ['buisson', 2882481], Cistus: ['buisson', 2874026], Erica: ['buisson', 2882780],
  Genista: ['buisson', 2940025], Lavandula: ['buisson', 2927302], Rosa: ['buisson', 8395064],
  Rubus: ['buisson', 2988638], Ruscus: ['buisson', 2769754], Salvia: ['buisson', 2926981],
  Spartium: ['buisson', 8109416], Thymus: ['buisson', 2926960], Ulex: ['buisson', 2951953],
});
/** The stone pine's key (`speciesKey` of Pinus pinea): its own form among the pines. */
export const STONE_PINE_KEY = 5285165;
/** The radius looked at around the place (km): a town's parks and its countryside, enough observations. */
export const FLORA_RADIUS_KM = 5;
/**
 * How much more a genus is planted in streets and squares than GBIF's observations say (they count the wild
 * flora too: at Montpellier, Prunus first, the blackthorns of the scrubland; seen: a pink Japanese cherry in the
 * middle of the Comédie). An ASSUMPTION, from what towns plant (planes, limes, nettle trees, maples, horse
 * chestnuts): 1 for a genus not named.
 */
const STREET_WEIGHT = Object.freeze({ Platanus: 3, Tilia: 3, Celtis: 3, Acer: 2, Aesculus: 2, Fraxinus: 1.5, Prunus: 0.4, Salix: 0.7 });

/** A form rarer than this share of its kind is left out (a palm in Paris: a greenhouse, an odd garden). */
const RARE = 0.01;
/** The credit of GBIF's data. */
export const FLORA_CREDIT = Object.freeze({ en: 'Local flora: GBIF.org', fr: 'Flore locale : GBIF.org' });

const TREE_FORMS = ['arbre', 'conifere', 'pin_parasol', 'cypres', 'olivier', 'palmier'];
const SHRUB_FORMS = ['arbuste', 'buisson'];

/** Shares (summing to 1) of the forms counted, those under RARE left out; null when nothing was counted. */
function shares(counts, forms){
  const total = forms.reduce((s, f) => s + (counts[f] || 0), 0);
  if (!(total > 0)) return null;
  const kept = forms.filter(f => (counts[f] || 0) / total >= RARE);
  const sum = kept.reduce((s, f) => s + counts[f], 0);
  return Object.fromEntries(kept.map(f => [f, Math.round(counts[f] / sum * 1000) / 1000]));
}

/**
 * THE FLORA OF A PLACE from GBIF's answer (an occurrence search, `facet=genusKey` and `facet=speciesKey`), or
 * null (no answer, nothing known counted). Returns { trees, shrubs, genusShares, genera }: the shares of the tree
 * forms and of the shrub forms, each form's genera in shares (weighted by STREET_WEIGHT), and the genera most
 * observed (their names, the most first: what to look for in the stores, #480c).
 */
export function floraOf(answer){
  const facets = answer && Array.isArray(answer.facets) ? answer.facets : [];
  const genus = facets.find(f => f.field === 'GENUS_KEY'), species = facets.find(f => f.field === 'SPECIES_KEY');
  if (!genus || !Array.isArray(genus.counts)) return null;
  const byKey = new Map(Object.entries(GENERA).map(([name, [form, key]]) => [String(key), { name, form }]));
  const counts = {}, seen = [], byForm = {};
  for (const c of genus.counts) {
    const g = byKey.get(String(c.name));
    if (!g || !(c.count > 0)) continue;
    counts[g.form] = (counts[g.form] || 0) + c.count;
    seen.push([g.name, c.count]);
    const w = c.count * (STREET_WEIGHT[g.name] || 1);
    (byForm[g.form] = byForm[g.form] || {})[g.name] = w;
  }
  // The genera of each form, in shares (a tree OSM names not draws its genus from them: model-bank.js).
  const genusShares = {};
  for (const [form, gs] of Object.entries(byForm)) {
    const sum = Object.values(gs).reduce((a, b) => a + b, 0);
    genusShares[form] = Object.fromEntries(Object.entries(gs).map(([g, v]) => [g, Math.round(v / sum * 1000) / 1000]).filter(([, v]) => v >= RARE));
  }
  // The stone pines, out of the pines.
  const pinea = species && Array.isArray(species.counts) ? species.counts.find(c => String(c.name) === String(STONE_PINE_KEY)) : null;
  if (pinea && pinea.count > 0) {
    const n = Math.min(pinea.count, counts.conifere || 0);
    counts.conifere = (counts.conifere || 0) - n;
    counts.pin_parasol = n;
  }
  const trees = shares(counts, TREE_FORMS), shrubs = shares(counts, SHRUB_FORMS);
  if (!trees && !shrubs) return null;
  return { trees, shrubs, genusShares, genera: seen.sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name]) => name) };
}

/** A number in [0, 1) from a place (x, z, metres): the same tree draws the same form at each import. */
function hash(x, z){
  let h = Math.imul(Math.round(x * 10) | 0, 73856093) ^ Math.imul(Math.round(z * 10) | 0, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
/** A form drawn from shares, for a place; null without shares. */
function draw(sh, x, z){
  if (!sh) return null;
  let u = hash(x, z), last = null;
  for (const [form, s] of Object.entries(sh)) {
    last = form;
    u -= s;
    if (u < 0) return form;
  }
  return last;
}

/**
 * THE FLORA GIVEN TO A TRANSLATION (osm-scene.js translateOsm, then the aerial reading): each tree or shrub
 * whose form no source said (`kindKnown` unset) takes a form drawn from the place's shares. Changes
 * `elements` in place; returns how many were drawn.
 */
export function applyFlora(elements, flora){
  if (!flora || !Array.isArray(elements)) return 0;
  let n = 0;
  for (const e of elements) {
    if (e.kindKnown) continue;
    const isTree = TREE_FORMS.includes(e.objType), isShrub = e.objType === 'buisson';
    if (!isTree && !isShrub) continue;
    const form = draw(isTree ? flora.trees : flora.shrubs, e.x, e.z);
    if (form && form !== e.objType) { e.objType = form; n++; }
  }
  return n;
}
