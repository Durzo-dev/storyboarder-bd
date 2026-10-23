/**
 * @file manuel-recherche.js
 * Le Manuel d'utilisation, rangé et cherchable (demandé : 22 sections à plat devenaient longues à
 * parcourir). Fonctions PURES : les GROUPES repliables du menu, et la RECHERCHE par mots clés, que
 * src/events.js et src/modals.js appliquent au DOM.
 *
 * ⚠️ UN NOM DE GROUPE N'EST JAMAIS CELUI D'UNE SECTION (demandé) : « Projet » contenant « Projet »
 * se lisait comme un doublon. tests/manuel-recherche.test.mjs le vérifie dans les deux langues.
 */

/** Les groupes, dans l'ordre du menu, et les sections (clés de help-content.js) qu'ils rangent. */
export const GROUPES_MANUEL = Object.freeze([
  { id: 'application', en: 'Application', fr: 'Application', sections: ['projet', 'maj', 'ressources', 'raccourcis'] },
  { id: 'mise-en-page', en: 'Layout', fr: 'Mise en page', sections: ['tomes', 'cases', 'images'] },
  { id: 'dialogues', en: 'Dialogue', fr: 'Dialogues', sections: ['bulles', 'style', 'fusion', 'polices'] },
  { id: 'mise-en-scene', en: '3D staging', fr: 'Mise en scène 3D', sections: ['scenes', 'camera', 'lumiere', 'sources', 'ombres'] },
  { id: 'elements', en: 'Elements', fr: 'Éléments', sections: ['objets', 'personnages'] },
  { id: 'modeles-3d', en: '3D models', fr: 'Modèles 3D', sections: ['modeles', 'store', 'modeles_articules', 'correspondance', 'editeur', 'batiments', 'batiments_trace', 'batiments_ouvertures', 'batiments_niveaux', 'batiments_escaliers'] },
]);

/** Un caractère sans accent ni majuscule : « É » → « e ». Rend toujours UN caractère (ou vide). */
function pliee(c){
  return c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Un texte sans accents ni majuscules, pour comparer : « Caméra » → « camera ». */
export function normaliser(texte){
  return [...String(texte || '')].map(pliee).join('');
}

/** Les mots d'une recherche, normalisés, sans doublon ni mot vide. */
export function motsDeRecherche(requete){
  return [...new Set(normaliser(requete).split(/[\s,;.:!?'’"«»()]+/).filter(Boolean))];
}

/** Combien de fois `mot` (normalisé) apparaît dans `texte` (normalisé). */
function occurrences(texte, mot){
  let n = 0;
  for (let i = texte.indexOf(mot); i >= 0; i = texte.indexOf(mot, i + mot.length)) n++;
  return n;
}

/**
 * Les sections qui répondent à une recherche : celles qui contiennent TOUS ses mots, dans leur titre
 * ou leurs paragraphes, sans tenir compte des accents ni des majuscules. Rend `Map(id → nombre de
 * correspondances)`, vide si la recherche est vide.
 */
export function chercherDansLeManuel(sections, requete){
  const mots = motsDeRecherche(requete);
  const trouvees = new Map();
  if (!mots.length) return trouvees;
  for (const s of sections || []) {
    const texte = normaliser([s.title, ...(s.paragraphs || [])].join('\n'));
    const comptes = mots.map(m => occurrences(texte, m));
    if (comptes.every(n => n > 0)) trouvees.set(s.id, comptes.reduce((a, b) => a + b, 0));
  }
  return trouvees;
}

/**
 * Un texte découpé en morceaux à SURLIGNER ou non : `[{ texte, surligne }]`. La comparaison ignore
 * accents et majuscules, mais les morceaux rendus sont ceux du texte d'origine, accents compris.
 * Sans mot, un seul morceau non surligné.
 */
export function morceauxSurlignes(texte, requete){
  const source = String(texte || '');
  const mots = motsDeRecherche(requete);
  if (!mots.length || !source) return [{ texte: source, surligne: false }];
  // Le texte normalisé, et pour chacun de ses caractères l'indice du caractère d'origine.
  const chars = [...source];
  let norm = '';
  const origine = [];
  chars.forEach((c, i) => { const p = pliee(c); for (const x of p) { norm += x; origine.push(i); } });
  const marque = new Array(chars.length).fill(false);
  for (const m of mots) {
    for (let i = norm.indexOf(m); i >= 0; i = norm.indexOf(m, i + m.length)) {
      for (let k = i; k < i + m.length; k++) marque[origine[k]] = true;
    }
  }
  const out = [];
  chars.forEach((c, i) => {
    const dernier = out[out.length - 1];
    if (dernier && dernier.surligne === marque[i]) dernier.texte += c;
    else out.push({ texte: c, surligne: marque[i] });
  });
  return out;
}

/**
 * Ce que le menu montre pour une recherche : les groupes à afficher (et ouverts), et les sections
 * visibles avec leur nombre de correspondances. Sans recherche, `null` : le menu reprend ses groupes
 * dans l'état où on les avait laissés.
 */
export function vueDeRecherche(sections, requete){
  const trouvees = chercherDansLeManuel(sections, requete);
  if (!motsDeRecherche(requete).length) return null;
  const groupes = GROUPES_MANUEL.filter(g => g.sections.some(id => trouvees.has(id))).map(g => g.id);
  return { groupes, sections: trouvees };
}
