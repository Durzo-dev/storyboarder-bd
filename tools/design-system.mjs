/**
 * tools/design-system.mjs — le SYSTÈME DE DESIGN de l'application, généré depuis le code.
 *
 *   node tools/design-system.mjs            → docs/design-system.html
 *
 * Une page autonome qui montre TOUTE l'interface : jetons des quatre rendus, typographie, écarts,
 * rayons, contrôles, puis chaque écran (en-tête, menu de gauche, menus de droite, menus contextuels,
 * modales, store, éditeurs, Lecteur, polices), pour s'en servir hors de l'application : maquettes,
 * site de présentation, visuels. Une barre en haut bascule entre les quatre rendus, comme la
 * Configuration de l'application.
 *
 * ⚠️ RIEN N'Y EST RECOPIÉ. La page EMBARQUE `src/style.css` tel quel, et ses spécimens sont les
 * FRAGMENTS de `src/index.html`, extraits par identifiant. Seul ce que le code remplit à l'exécution
 * (les listes de Tomes, les cartes du store, les curseurs d'articulations…) est simulé, avec les
 * classes exactes que posent les fonctions qui les construisent. Une première version réécrivait les
 * règles à la main pour le seul éditeur de bâtiment : elle oubliait tout le reste et aurait divergé
 * au premier écart retouché. Les règles d'usage sont dans docs/en/interface.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ICONES from '../src/batiment-icones.js';
import { icone, ICONE_EMOTION } from '../src/icones.js';
import * as LI from '../src/lecteur-icones.js';
import { EMOTIONS } from '../src/constants.js';
import { HELP_MANUAL_EN, HELP_MANUAL_FR } from '../src/help-content.js';

// Les TRADUCTIONS DE L'APPLICATION, lues dans src/i18n.js (et non recopiées) : la page les rejoue
// sur ses fragments quand on bascule en anglais, comme applyI18n le fait dans l'application.
// i18n.js charge au passage des modules qui touchent au DOM au chargement : le même bouchon que les
// tests (tests/helpers/dom-stub.mjs) le leur fournit.
await import('../tests/helpers/dom-stub.mjs');
const I18N = await import('../src/i18n.js');

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (c) => readFileSync(join(RACINE, c), 'utf8');

/** #460k : chaque icône de menu contextuel, une fois, avec le premier libellé qui la porte. */
function iconesDeMenu(html){
  const vues = new Map();
  for (const m of html.matchAll(/<span class="ctx-icon">(<svg[\s\S]*?<\/svg>)<\/span>\s*([^<]*)/g)) {
    if (!vues.has(m[1])) vues.set(m[1], m[2].trim());
  }
  return [...vues].map(([svg, lib]) => `<button type="button"><span class="ctx-icon">${svg}</span>${lib}</button>`).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LES JETONS
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Un texte de la page dans les deux langues ; la barre du haut montre l'une ou l'autre. */
const L = (fr, en) => `<span class="ds-fr">${fr}</span><span class="ds-en">${en}</span>`;

/** Les jetons `--nom: valeur` d'un bloc de style.css, dans l'ordre. */
export function jetonsDuBloc(css, selecteur){
  const i = css.indexOf(`\n${selecteur}{`);
  if (i < 0) throw new Error(`bloc ${selecteur} introuvable dans style.css`);
  const corps = css.slice(i, css.indexOf('\n}', i)).replace(/\/\*[\s\S]*?\*\//g, '');
  return Object.fromEntries([...corps.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}

/** Les quatre rendus, résolus comme la cascade les résout. */
export function themes(css){
  const sombre = jetonsDuBloc(css, ':root');
  const clair = { ...sombre, ...jetonsDuBloc(css, 'body.theme-light') };
  const contraste = { ...sombre, ...jetonsDuBloc(css, 'body.theme-contraste') };
  const clairContraste = { ...clair, ...jetonsDuBloc(css, 'body.theme-contraste'), ...jetonsDuBloc(css, 'body.theme-light.theme-contraste') };
  return [
    ['Sombre', '', sombre, 'Dark'], ['Clair', 'theme-light', clair, 'Light'],
    ['Sombre contrasté', 'theme-contraste', contraste, 'Dark, high contrast'], ['Clair contrasté', 'theme-light theme-contraste', clairContraste, 'Light, high contrast'],
  ];
}

/** Les jetons de couleur montrés, par rôle (les autres, comme --echelle-ui, ne sont pas des couleurs). */
const ROLES = [
  [L('Surfaces', 'Surfaces'), [['paper', L('Papier : fond des sections, de la page', 'Paper: sections and page background')], ['paper-dark', L('Papier foncé : fond des panneaux, des modales', 'Dark paper: panels and modals background')], ['creux', L('Creux : fond des sous-sections', 'Well: sub-section background')], ['white', L('Champs, menus contextuels, boutons de choix', 'Fields, context menus, choice buttons')], ['nav-bg', L('Bouton gris', 'Grey button')], ['nav-bg-hover', L('Bouton gris survolé', 'Grey button, hovered')], ['fond-3d', L('Fond des aperçus 3D', '3D preview background')]]],
  [L('Encres', 'Inks'), [['ink', L('Texte', 'Text')], ['ink-mid', L('Titres de sous-section', 'Sub-section titles')], ['ink-soft', L('Libellés, titres de section', 'Labels, section titles')], ['sepia', L('Texte secondaire (format d\'un Tome…)', 'Secondary text (a Volume\'s format…)')]]],
  [L('Rôles', 'Roles'), [['accent', L('Orange : créer, valider, actif', 'Orange: create, confirm, active')], ['accent-soft', L('Fond de ce qui est actif', 'Background of what is active')], ['danger', L('Rouge : supprimer', 'Red: delete')], ['warn', L('Jaune : renommer, éditer', 'Yellow: rename, edit')], ['focus', L('Bague de focus', 'Focus ring')], ['nord-boussole', L('Le « N » de la boussole', 'The compass "N"')]]],
  [L('Sur les rôles', 'On roles'), [['sur-accent', L('Texte sur orange', 'Text on orange')], ['sur-danger', L('Texte sur rouge', 'Text on red')], ['sur-warn', L('Texte sur jaune', 'Text on yellow')]]],
  [L('Filets', 'Rules'), [['line', L('Filet qui encadre (décoratif)', 'Framing rule (decorative)')], ['line-strong', L('Délimiteur, bord des boutons', 'Divider, button borders')], ['bord-actif', L('Bord de ce qui se clique ou se saisit', 'Border of what is clicked or typed into')]]],
  [L('Ascenseurs', 'Scrollbars'), [['scroll-thumb', L('Poignée', 'Thumb')], ['scroll-thumb-hover', L('Poignée survolée', 'Thumb, hovered')]]],
];


function nuancier(nom, classe, j, en){
  const lignes = ROLES.map(([titre, liste]) => `<h4>${titre}</h4>${liste.map(([k, usage]) => `
      <div class="ds-nuance"><span class="ds-pastille" style="background:${j[k]}"></span><code>--${k}</code><span class="ds-valeur">${esc(j[k])}</span><span class="ds-usage">${usage}</span></div>`).join('')}`).join('');
  return `<div class="ds-carte"><h3>${L(nom, en)} <small>${classe || L('défaut', 'default')}</small></h3>${lignes}</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LES FRAGMENTS D'index.html
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** L'élément qui commence à `debut` (un `<` de balise ouvrante), balises de même nom équilibrées. */
function elementA(html, debut){
  const nom = /^<([a-z0-9]+)/i.exec(html.slice(debut))[1];
  const re = new RegExp(`<${nom}\\b[^>]*>|</${nom}>`, 'gi');
  re.lastIndex = debut;
  let niveau = 0, m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') niveau--; else if (!m[0].endsWith('/>')) niveau++;
    if (niveau === 0) return html.slice(debut, m.index + m[0].length);
  }
  throw new Error(`élément non fermé à ${debut}`);
}
/** L'élément d'identifiant `id`. */
export function fragment(html, id){
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) throw new Error(`#${id} introuvable dans index.html`);
  return elementA(html, html.lastIndexOf('<', i));
}
/** Le premier élément qui commence par `ouverture` (pour ceux qui n'ont pas d'identifiant). */
function fragmentPar(html, ouverture){
  const i = html.indexOf(ouverture);
  if (i < 0) throw new Error(`« ${ouverture} » introuvable dans index.html`);
  return elementA(html, i);
}

/**
 * Un fragment prêt à montrer : sans commentaires, ses sections rendues visibles (le code les
 * affiche selon l'écran), ses listes déroulantes vides garnies d'une option.
 * `tout` : TOUT ce qui est masqué se montre (petits fragments). Sinon, seuls les sections, en-têtes
 * de menu et superpositions : les champs conditionnels (une option qui ne vaut que pour un type)
 * restent masqués, comme dans l'application.
 */
function montrer(f, { tout = false } = {}){
  let h = f.replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/<[a-z][a-z0-9]*\b[^>]*>/gi, (balise) => {
    const visible = tout || /class="[^"]*\b(side-section|menu-header|modal-overlay|context-menu)\b/.test(balise) || /id="[^"]*(Section|MenuHeader)"/.test(balise);
    if (!visible) return balise;
    return balise
      .replace(/\s*style="display:\s*none;?"/i, '')
      .replace(/(class="[^"]*?)\s*\bhidden\b/, '$1')
      .replace(/\shidden(?=[\s>])/, '');
  });
  return h.replace(/(<select\b[^>]*>)\s*<\/select>/g, '$1<option>Choisir…</option></select>');
}
/** Retire les `</div>` en trop à la fin d'une tranche (le HTML de l'application en tolère un isolé). */
function equilibrer(h){
  let exces = (h.match(/<\/div>/g) || []).length - (h.match(/<div\b/g) || []).length;
  while (exces-- > 0) { const i = h.lastIndexOf('</div>'); h = h.slice(0, i) + h.slice(i + 6); }
  return h;
}
/** Remplit l'élément VIDE d'identifiant `id` avec `contenu` (ce que le code y écrirait). */
function remplir(h, id, contenu){
  const i = h.indexOf(`id="${id}"`);
  if (i < 0) throw new Error(`#${id} introuvable dans le fragment`);
  const fin = h.indexOf('>', i) + 1;
  const ferme = h.indexOf('</', fin);
  return h.slice(0, fin) + contenu + h.slice(ferme);
}
/** Retire l'élément d'identifiant `id` (un autre état du même écran). */
function retirer(h, id){
  const f = fragment(h, id);
  return h.replace(f, '');
}
/** Donne un texte à l'élément `id` (un titre ou un message posé par le code), dans les deux langues. */
const texte = (h, id, fr, en = fr) => remplir(h, id, fr === en ? esc(fr) : L(esc(fr), esc(en)));

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CE QUE LE CODE ÉCRIT À L'EXÉCUTION, avec les classes de ses constructeurs
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// project-tree.js : renderTree, renderSceneList, renderImageList.
const TOMES = `
<div class="tome-row active"><span>${L('Le Phare', 'The Lighthouse')} <small style="color:var(--sepia)">— A4 portrait</small></span><span class="caret">▾</span></div>
<div class="tome-format active"><label>${L('Format du tome', 'Volume format')}</label><select><option>A4 portrait</option></select></div>
<div class="tome-pages active"><label>${L('Planches', 'Pages')}</label>
  <div class="chapter-row"><span class="caret">▾</span><span class="chapter-name">${L('Chapitre 1 — L\'arrivée', 'Chapter 1 — Arrival')}</span><small class="chapter-count">(3)</small></div>
  <div class="chapter-pages"><div class="page-row">${L('Planche', 'Page')} 1</div><div class="page-row active">${L('Planche', 'Page')} 2</div><div class="page-row">${L('Planche', 'Page')} 3</div></div>
  <div class="chapter-row"><span class="caret">▸</span><span class="chapter-name">${L('Chapitre 2 — La tempête', 'Chapter 2 — The storm')}</span><small class="chapter-count">(4)</small></div>
  <button class="add-page-btn">${L('Ajouter une planche', 'Add a page')}</button><button class="add-page-btn add-chapter-btn">${L('Ajouter un chapitre', 'Add a chapter')}</button>
</div>
<div class="tome-row"><span>${L('Carnet de croquis', 'Sketchbook')} <small style="color:var(--sepia)">— ${L('Carré', 'Square')}</small></span><span class="caret">▸</span></div>`;
const SCENES = `<div class="tome-row"><span>${L('Cuisine du phare', 'Lighthouse kitchen')}</span></div><div class="tome-row"><span>${L('Falaise, nuit', 'Cliff, night')}</span></div>`;
const IMAGES = `
<div class="side-group-title model-group-title"><span class="model-group-caret">▾</span><span class="model-group-nom">${L('Dans les Cases', 'In panels')}</span><span class="model-group-nombre">2</span></div>
<div class="model-group">
  <div class="tome-row model-row"><div class="model-row-name">croquis-falaise.png</div><button type="button" class="image-row-where">${L('Le Phare · Planche 2 · Case 1', 'The Lighthouse · Page 2 · Panel 1')}</button></div>
  <div class="tome-row model-row"><div class="model-row-name">reference-lampe.jpg</div><button type="button" class="image-row-where">${L('Le Phare · Planche 3 · Case 4', 'The Lighthouse · Page 3 · Panel 4')}</button></div>
</div>
<div class="side-group-title model-group-title"><span class="model-group-caret">▸</span><span class="model-group-nom">${L('Non utilisées', 'Unused')}</span><span class="model-group-nombre">1</span></div>`;

// sidebar.js : les dimensions d'une Case.
const DIMENSIONS = `<span class="dim-chip">${L('Largeur', 'Width')} <b>182</b> mm</span><span class="dim-chip">${L('Hauteur', 'Height')} <b>96</b> mm</span>`;

// persona-editor.js : les groupes d'articulations ; modals.js : une ligne de curseur.
const curseur = (nom, v) => `<div class="joint-slider-row"><span class="joint-slider-label">${nom}</span><input type="range" min="-90" max="90" value="${v}"><span class="joint-slider-val">${v}°</span></div>`;
const ARTICULATIONS = `
<details class="joint-group-details" open><summary>${L('Bras gauche', 'Left arm')}</summary>${curseur(L('Épaule — lever', 'Shoulder — raise'), 35)}${curseur(L('Épaule — tourner', 'Shoulder — turn'), -10)}${curseur(L('Coude', 'Elbow'), 60)}</details>
<details class="joint-group-details"><summary>${L('Bras droit', 'Right arm')}</summary></details>
<details class="joint-group-details"><summary>${L('Tête et cou', 'Head and neck')}</summary></details>`;

// store-ui.js : rendreOnglets, carteAjout, carte.
const ONGLETS = `<button type="button" class="onglet actif">${L('Mes modèles', 'My models')}</button><button type="button" class="onglet">Sketchfab</button><button type="button" class="onglet">Poly Haven</button>`;
const carte = (nom, auteur, licence, nc = false) => `<button type="button" class="store-carte"><div class="store-sans-vignette"></div><span class="store-carte-nom">${nom}</span><span class="store-carte-auteur">${L('par', 'by')} ${auteur}</span><span class="store-carte-infos"><span class="store-badge${nc ? ' store-badge-nc' : ''}">${licence}</span><span>${L('2,4 Mo', '2.4 MB')}</span></span></button>`;
const AJOUT = `<button type="button" class="store-carte store-carte-ajout"><svg viewBox="0 0 24 24" aria-hidden="true" class="store-ajout-icone">${['M12 3v12', 'M7 10l5 5 5-5', 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'].map(d => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg><span class="store-carte-nom">${L('Importer un modèle', 'Import a model')}</span></button>`;
const GRILLE = AJOUT + carte(L('Lampe tempête', 'Storm lantern'), 'atelier_k', 'CC BY') + carte(L('Chaise en bois', 'Wooden chair'), 'polyhaven', 'CC0') + carte(L('Vieux gréement', 'Old rigging'), 'naval3d', 'CC BY-NC', true)
  + carte(L('Phare côtier', 'Coastal lighthouse'), 'mer_et_pierre', 'CC BY') + carte(L('Chat noir', 'Black cat'), 'félin', 'CC BY');

// batiment-editeur-ui.js : remplirNiveaux, la liste des pièces, formulaireEscalier, commandes.
const niveau = (court, nom, nomEn, actif) => `<div class="batiment-ligne batiment-ligne-niveau cliquable${actif ? ' actif' : ''}"><div class="batiment-niveau-gauche"><span class="batiment-niveau-pastille">${court}</span><button type="button" class="batiment-niveau-suppr">×</button></div><div class="batiment-niveau-droite"><input type="text" class="batiment-niveau-nom" value="${nom}" data-ds-valeur-fr="${nom}" data-ds-valeur-en="${nomEn}"><span class="batiment-champ-valeur"><input type="number" value="280"> cm</span></div></div>`;
const NIVEAUX = `${niveau('1', 'Étage 1', 'Floor 1', false)}${niveau('RDC', 'Rez-de-chaussée', 'Ground floor', true)}<div class="batiment-boutons-ligne"><button type="button" class="full-btn">${L('Ajouter', 'Add')}</button><button type="button" class="full-btn">${L('Dupliquer', 'Duplicate')}</button></div>`;
const PIECES = `<div class="batiment-ligne cliquable"><span>${L('Séjour', 'Living room')}</span><small>32,4 m²</small></div><div class="batiment-ligne cliquable"><span>${L('Cuisine', 'Kitchen')}</span><small>12,1 m²</small></div>`;
const choixIcones = (liste, actif = -1, eteint = -1, genre = 'type') => `<div class="choix ${genre === 'option' ? 'choix-options' : 'choix-types'}">${liste.map(([icone, titre, en = titre], i) =>
  `<button type="button" class="icone${i === actif ? ' actif' : ''}" title="${esc(titre)}" aria-label="${esc(titre)}" data-ds-titre-fr="${esc(titre)}" data-ds-titre-en="${esc(en)}"${i === eteint ? ' disabled' : ''}>${icone}</button>`).join('')}</div>`;
const I = ICONES;
const ESCALIER = `
<div class="batiment-sous-section"><h3>Type</h3>${choixIcones([[I.ICONES_TYPE_ESCALIER.droit, 'Escalier droit', 'Straight staircase'], [I.ICONES_TYPE_ESCALIER.L, 'Escalier en L', 'L-shaped staircase'], [I.ICONES_TYPE_ESCALIER.U, 'Escalier en U : il ne tient pas dans cette pièce', 'U-shaped staircase: it does not fit in this room']], 1, 2)}
<div class="choix-options-groupe">${choixIcones([[I.ICONES_SENS_ESCALIER[1], 'Tourne à gauche', 'Turns left'], [I.ICONES_SENS_ESCALIER[-1], 'Tourne à droite', 'Turns right']], 0, -1, 'option')}</div></div>
<div class="batiment-sous-section"><h3>${L('Marches', 'Steps')}</h3>${choixIcones([[I.ICONES_RAMPE.aucune, 'Sans rampe', 'No rail'], [I.ICONES_RAMPE.gauche, 'Rampe à gauche', 'Rail on the left'], [I.ICONES_RAMPE.droite, 'Rampe à droite', 'Rail on the right'], [I.ICONES_RAMPE.deux, 'Rampe des deux côtés', 'Rails on both sides']], 2)}
${choixIcones([[I.ICONES_MARCHES.true, 'Marches pleines', 'Solid steps'], [I.ICONES_MARCHES.false, 'Marches ouvertes', 'Open steps']], 0)}</div>
<label class="batiment-champ batiment-champ-large"><span>${L('Largeur', 'Width')}</span><span class="batiment-champ-valeur"><input type="number" value="90"> cm</span></label>`;
const OUVERTURE = `
<div class="batiment-sous-section"><h3>Type</h3>${choixIcones([['porte', 'Porte', 'Door'], ['fenetre', 'Fenêtre', 'Window'], ['baie', 'Baie vitrée', 'Bay window'], ['passage', 'Passage', 'Passage']].map(([t, fr, en]) => [I.ICONES_OUVERTURE[t], fr, en]), 0)}
<div class="choix-options-groupe">${choixIcones([[I.ICONES_MANOEUVRE[1], 'Un battant', 'One leaf'], [I.ICONES_MANOEUVRE[2], 'Deux battants', 'Two leaves'], [I.ICONES_MANOEUVRE.coulissant, 'Coulissante', 'Sliding']], 0, -1, 'option')}
${choixIcones([[I.ICONES_REMPLISSAGE.pleine, 'Porte pleine', 'Solid door'], [I.ICONES_REMPLISSAGE.vitree, 'Porte vitrée', 'Glazed door']], 0, -1, 'option')}</div></div>
<div class="batiment-sous-section"><h3>${L('Sens d\'ouverture', 'Opening direction')}</h3>${choixIcones([[I.iconeSensPorte(-1, 'debut', 'cote'), 'Ouvrir de l\'autre côté du mur', 'Open to the other side of the wall'], [I.iconeSensPorte(1, 'fin', 'charniere'), 'Passer la charnière de l\'autre bord', 'Move the hinge to the other edge']]).replace('choix-types', 'choix-bascules')}</div>
<div class="batiment-sous-section"><h3>Dimensions</h3><label class="batiment-champ"><span>${L('Largeur', 'Width')}</span><span class="batiment-champ-valeur"><input type="number" value="90"> cm</span></label><label class="batiment-champ"><span>${L('Hauteur', 'Height')}</span><span class="batiment-champ-valeur"><input type="number" value="210"> cm</span></label><label class="batiment-champ"><span>${L('Élévation', 'Elevation')}</span><span class="batiment-champ-valeur"><input type="number" value="0"> cm</span></label></div>`;

// lecteur-ui.js : construirePanneau.
const lchoix = (liste, actif) => `<div class="choix">${liste.map((l, i) => `<button type="button" class="${i === actif ? 'actif' : ''}">${l}</button>`).join('')}</div>`;
const lsection = (t, c) => `<section class="side-section lecteur-section"><h2>${t}</h2>${c}</section>`;
const licone = (liste, actif, classe = '') => `<div class="choix${classe}">${liste.map(([svg, fr, en], i) => `<button type="button" class="icone${(Array.isArray(actif) ? actif.includes(i) : i === actif) ? ' actif' : ''}" title="${fr}" aria-label="${fr}" data-ds-titre-fr="${fr}" data-ds-titre-en="${en}">${svg}</button>`).join('')}</div>`;
const LECTEUR = lsection(L('Affichage', 'Display'),
  licone([[LI.ICONES_DOUBLE.false, 'Une page', 'One page'], [LI.ICONES_DOUBLE.true, 'Deux pages', 'Two pages']], 1, ' choix-types')
  + `<div class="choix-options-groupe">${licone([[LI.ICONES_DEBUT.droite, 'Première page à droite', 'First page on the right'], [LI.ICONES_DEBUT.gauche, 'Première page à gauche', 'First page on the left']], 0, ' choix-options')}</div>`
  + licone([[LI.ICONE_LIVRE, 'Vue livre : la page se tourne', 'Book view: the page turns']], [0]))
  + lsection(L('Lecture', 'Reading'), licone([[LI.ICONES_SENS.rtl, 'Vers la gauche', 'To the left'], [LI.ICONES_SENS.ltr, 'Vers la droite', 'To the right']], 1, ' choix-types')
    + licone([[LI.ICONE_GUIDE, 'Vue guidée, case par case', 'Guided view, panel by panel']], []))
  + lsection(L('Défilement automatique', 'Automatic scrolling'), `<div class="lecteur-vitesse"><label>${L('Vitesse : 6 s par page', 'Speed: 6 s per page')}</label><input type="range" min="2" max="20" value="6"></div><button type="button" class="full-btn lecteur-lecture">${L('▶ Lecture (Espace)', '▶ Play (Space)')}</button>`)
  + lsection(L('Apparence', 'Look'), lchoix([L('Sombre', 'Dark'), L('Gris', 'Grey'), L('Clair', 'Light')], 0))
  + `<button type="button" class="nav-btn">${L('⛶ Plein écran (F)', '⛶ Full screen (F)')}</button><p class="side-hint">${L('← → ou clic sur les bords pour tourner les pages · Origine / Fin · Échap pour sortir.', '← → or click the edges to turn pages · Home / End · Esc to leave.')}</p>`;

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LES SPÉCIMENS
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** Une scène : un cadre où `position:fixed` se rapporte au cadre (modales, menus contextuels). */
const scene = (titre, note, contenu, { hauteur = null, classe = '' } = {}) => `
<figure class="ds-figure">
  <figcaption><b>${titre}</b>${note ? ` — ${note}` : ''}</figcaption>
  <div class="ds-scene ${classe}" style="${hauteur ? `height:${hauteur}px` : ''}">${contenu}</div>
</figure>`;

function specimens(html){
  const s = {};
  // L'en-tête et l'application entière : menu de gauche, Planche, menu de droite (la Case).
  const scroll = fragment(html, 'rightPanelScroll');
  const marqueurs = ['pageMenuHeader', 'panelMenuHeader', 'bubbleMenuHeader', 'sideCameraSection', 'helpMenuHeader'];
  const debuts = marqueurs.map(id => scroll.lastIndexOf('<', scroll.indexOf(`id="${id}"`)));
  const groupes = Object.fromEntries(marqueurs.map((id, k) => [id, scroll.slice(debuts[k], k + 1 < debuts.length ? debuts[k + 1] : scroll.lastIndexOf('</div>'))]));
  const panneau = (contenu) => `<div class="right-panel" id="rightPanel"><div class="right-panel-scroll" id="rightPanelScroll">${equilibrer(montrer(contenu))}</div></div>`;
  let case_ = remplir(montrer(groupes.panelMenuHeader), 'sideDims', DIMENSIONS);
  case_ = texte(case_, 'sideStackLevel', 'Encrage', 'Inking');
  // #460l : la liste des Éléments d'une Case, remplie par sidebar.js (renderSideElementRow), avec
  // ses icônes au trait : le visage d'un Personnage selon son émotion, le type d'un Objet.
  const ligneElement = (ic, fr, en, actif, sous = '') => `<div class="perso-row${actif ? ' active' : ''}"><span class="perso-icone">${icone(ic)}</span><span class="perso-name"><span class="perso-name-main">${L(fr, en)}</span>${sous}</span></div>`;
  case_ = remplir(case_, 'sidePersonas', [
    ligneElement('visage_content', 'Lina', 'Lina', true),
    ligneElement('visage_surpris', 'Le gardien', 'The keeper', false),
    ligneElement('chaise', 'Objet', 'Object', false),
    ligneElement('porte', 'Porte', 'Door', false, `<span class="perso-link">${L('Lié à : Mur 2', 'Linked to: Wall 2')}</span>`),
  ].join(''));
  case_ = texte(case_, 'panelMenuNumber', ' 3');
  case_ = texte(case_, 'panelMenuTitle', 'Case', 'Panel');   // posé par sidebar.js selon la langue

  let gauche = montrer(fragmentPar(html, '<div class="sidebar">'));
  gauche = remplir(gauche, 'volumeList', TOMES);
  gauche = remplir(gauche, 'sceneList', SCENES);
  gauche = remplir(gauche, 'imageList', IMAGES);
  gauche = texte(gauche, 'lastSavedIndicator', 'Enregistré il y a 2 minutes', 'Saved 2 minutes ago');
  gauche = texte(gauche, 'projectNameText', 'Les Gardiens du phare', 'The Lighthouse Keepers');
  let entete = montrer(fragmentPar(html, '<header>'));
  entete = entete.replace(/<span id="appVersionText" class="app-version"><\/span>/, '<span id="appVersionText" class="app-version">v1.11</span>');
  const planche = `<main><div class="canvas-wrap"><div class="canvas-stack ds-planche"><div class="zoom-indicator">100%</div>
    <div class="ds-feuille"><div class="ds-case" style="grid-column:1/3"></div><div class="ds-case ds-case-active"></div><div class="ds-case"></div><div class="ds-case" style="grid-column:1/3"></div></div></div></div></main>`;
  s.ensemble = scene(L('L\'application', 'The application'), L('en-tête, menu de gauche (Projet, Tomes, Scènes, Images), Planche, menu de droite (une Case choisie)', 'header, left menu (Project, Volumes, Scenes, Images), Page, right-hand menu (a Panel selected)'),
    `${entete}<div class="app">${gauche}${planche}<div class="right-panel" id="rightPanel"><div class="right-panel-scroll" id="rightPanelScroll">${case_}</div></div></div>`, { hauteur: 900, classe: 'ds-scene-app' });

  // Les autres menus de droite.
  let planche_ = texte(montrer(groupes.pageMenuHeader), 'pageMenuNumber', ' 2');
  planche_ = remplir(planche_, 'sidePagePanels', [1, 2, 3].map(n => `<div class="tome-row${n === 2 ? ' active' : ''}"><span>${L('Case', 'Panel')} ${n}</span></div>`).join(''));
  s.droite = [
    scene(L('Planche', 'Page'), L('une Planche choisie', 'a Page selected'), panneau(planche_), { classe: 'ds-scene-panneau' }),
    scene(L('Bulle', 'Bubble'), L('une Bulle choisie', 'a Bubble selected'), panneau(texte(groupes.bubbleMenuHeader, 'sideBubbleStackLevel', 'Lettrage', 'Lettering')), { classe: 'ds-scene-panneau' }),
    scene(L('Caméra', 'Camera'), L('le mode Caméra d\'une Case', 'a Panel\'s Camera mode'), panneau(groupes.sideCameraSection), { classe: 'ds-scene-panneau' }),
    scene(L('Manuel d\'utilisation', 'User manual'), L('quand rien n\'est choisi', 'when nothing is selected'), panneau(groupes.helpMenuHeader), { classe: 'ds-scene-panneau' }),
  ].join('');

  // Les menus contextuels.
  s.contextuels = scene(L('Menus contextuels', 'Context menus'), L('clic droit sur une Case, son sous-menu « Ajouter », double-clic sur la Planche', 'right-click on a Panel, its "Add" submenu, double-click on the Page'),
    `<div class="ds-rangee">${montrer(fragment(html, 'panelContextMenu'))}${montrer(fragment(html, 'addSubmenu'))}${montrer(fragment(html, 'dblclickChoiceMenu'))}</div>`, { classe: 'ds-scene-libre' });

  // Les modales.
  let confirmer = montrer(fragment(html, 'confirmActionModal'));
  confirmer = texte(confirmer, 'confirmActionTitle', 'Supprimer la Planche', 'Delete the Page');
  confirmer = texte(confirmer, 'confirmActionMessage', 'Supprimer la Planche 3 et ses 6 Cases ?\nCette action peut être annulée avec Ctrl+Z.', 'Delete Page 3 and its 6 Panels?\nThis can be undone with Ctrl+Z.');
  confirmer = confirmer.replace('id="confirmActionOk" type="button">Confirmer', `id="confirmActionOk" type="button" data-ds-sans-i18n>${L('Supprimer', 'Delete')}`).replace('class="full-btn" id="confirmActionOk"', 'class="full-btn delete-btn" id="confirmActionOk"');
  let renommer = montrer(fragment(html, 'renameEntityModal'));
  s.modales = [
    scene(L('Modale de confirmation', 'Confirmation modal'), L('information, confirmation, suppression', 'information, confirmation, deletion'), confirmer, { hauteur: 300 }),
    scene(L('Modale de renommage', 'Rename modal'), L('Tome, Planche, Scène, format…', 'Volume, Page, Scene, format…'), renommer, { hauteur: 320 }),
    scene(L('Modale Projet', 'Project modal'), L('clic sur le nom du Projet', 'click on the Project name'), montrer(fragment(html, 'projectModal')), { hauteur: 480 }),
    scene(L('Modale Configuration', 'Settings modal'), L('trois onglets', 'three tabs'), montrer(fragment(html, 'settingsModal')), { hauteur: 820 }),
    scene(L('Modale d\'un Élément', 'An Element\'s modal'), L('un objet : sections repliables, deux colonnes quand la place le permet', 'an object: folding sections, two columns when there is room'), montrer(fragment(html, 'objectModal')), { hauteur: 900 }),
    scene(L('Modale d\'un Personnage', 'A Character\'s modal'), L('même charpente que celle d\'un objet', 'same structure as an object\'s'), montrer(fragment(html, 'descModal')), { hauteur: 900 }),
    scene(L('Modale des formats', 'Formats modal'), L('les formats du Projet', 'the Project\'s formats'), montrer(fragment(html, 'formatsModal')), { hauteur: 520 }),
  ].join('');

  // Le store.
  let store = montrer(fragment(html, 'storeModal'));
  store = texte(store, 'storeTitre', 'Bibliothèque de modèles', 'Model library');
  store = remplir(store, 'storeOnglets', ONGLETS);
  store = remplir(store, 'storeGrille', GRILLE);
  store = texte(store, 'storeCredit', 'Modèles des sources externes : licence et auteur affichés sur chaque fiche.', 'Models from external sources: licence and author shown on each page.');
  // Les filtres : le code écrit leurs options ; on montre la première de chacune.
  const FILTRES = { storeCategorie: ['Toutes les catégories', 'All categories'], storeLicence: ['Toutes les licences', 'All licences'], storeFaces: ['Toutes les tailles', 'All sizes'],
    storeTri: ['Pertinence', 'Relevance'], storeUsage: ['Partout', 'Everywhere'], storeSquelette: ['Articulés et statues', 'Rigged and statues'] };
  for (const [id, [fr, en]] of Object.entries(FILTRES)) store = store.replace(new RegExp(`(<select id="${id}"[^>]*>)<option>Choisir…</option>`), `$1<option data-ds-fr="${fr}" data-ds-en="${en}">${fr}</option>`);
  store = texte(store, 'storeCommercialLibelle', 'Usage commercial', 'Commercial use');
  store = store.replace('id="storeTexte" class="modal-input" type="search"', 'id="storeTexte" class="modal-input" type="search" placeholder="Rechercher un modèle" data-ds-placeholder-fr="Rechercher un modèle" data-ds-placeholder-en="Search for a model"');
  s.store = scene(L('Bibliothèque de modèles (store)', 'Model library (store)'), L('onglets par source, filtres, grille de cartes, import', 'one tab per source, filters, card grid, import'), store, { hauteur: 760 });
  s.polices = scene(L('Fenêtre des polices', 'Fonts window'), L('sa charpente ; les polices sont listées par le code', 'its frame; the fonts are listed by the code'), montrer(fragment(html, 'policesModal')), { hauteur: 560 });

  // Les éditeurs.
  let modele = montrer(fragmentPar(html, '<aside class="persona-editor-panel">'));
  modele = texte(modele, 'personaEditorFigure', 'Mannequin — humanoïde', 'Mannequin — humanoid');
  modele = texte(modele, 'personaEditorPoseLabel', 'Assis, mains sur les genoux', 'Sitting, hands on knees');
  modele = remplir(modele, 'personaEditorJointsContainer', ARTICULATIONS);
  let batiment = montrer(fragment(html, 'batimentPanneau'));
  batiment = batiment.replace('id="batimentNom" class="modal-input batiment-nom"', 'id="batimentNom" class="modal-input batiment-nom" value="Maison du gardien" data-ds-valeur-fr="Maison du gardien" data-ds-valeur-en="Keeper\'s house"');
  batiment = remplir(batiment, 'batimentNiveaux', NIVEAUX);
  batiment = remplir(batiment, 'batimentPieces', PIECES);
  // L'état montré : l'outil Sélection, un escalier choisi. Les sections des outils de pose sont
  // retirées ici et montrées à part (un seul état à la fois, comme dans l'éditeur).
  batiment = retirer(retirer(batiment, 'batimentContexteOuverture'), 'batimentContexteEscalier');
  batiment = texte(batiment, 'batimentSelectionTitre', 'Escalier sélectionné', 'Selected staircase');
  batiment = remplir(batiment, 'batimentFormEscalier', ESCALIER);
  batiment = retirer(batiment, 'batimentSelectionOuverture');
  batiment = texte(batiment, 'batimentAide', 'Tirer : le déplacer.\nR : le tourner de 90°.\nSuppr : le supprimer.\nÉchap : désélectionner.', 'Drag: move it.\nR: turn it by 90°.\nDel: delete it.\nEsc: deselect.');
  const poser = `<aside class="batiment-editeur-panneau"><section class="side-section"><h2>${L('Ouverture à poser', 'Opening to place')}</h2>${OUVERTURE}</section>
    <section class="side-section"><h2>${L('Commandes', 'Controls')}</h2><p class="batiment-aide">${L('Clic : la poser et la choisir.\nClic droit : changer le sens d\'une porte.\nMolette : changer de type.\nCtrl + molette : zoomer.\nÉchap : quitter l\'outil.', 'Click: place and select it.\nRight-click: change how a door opens.\nWheel: change the type.\nCtrl + wheel: zoom.\nEsc: leave the tool.')}</p></section></aside>`;
  let lecteur = montrer(fragmentPar(html, '<aside class="lecteur-panneau">'));
  lecteur = texte(lecteur, 'lecteurTitre', 'Le Phare', 'The Lighthouse');
  lecteur = texte(lecteur, 'lecteurPosition', ' · Planches 2-3 / 24', ' · Pages 2-3 / 24');
  lecteur = remplir(lecteur, 'lecteurPanneau', LECTEUR);
  s.editeurs = [
    scene(L('Éditeur de modèle', 'Model editor'), L('son menu de droite : modèle, pose, articulations, sorties', 'its right-hand menu: model, pose, joints, exits'), `<div class="persona-editor ds-editeur">${modele}</div>`, { classe: 'ds-scene-panneau' }),
    scene(L('Éditeur de bâtiment', 'Building editor'), L('un seul menu ; ici un escalier choisi avec l\'outil Sélection', 'one menu; here a staircase selected with the Selection tool'), `<div class="batiment-editeur ds-editeur">${batiment}</div>`, { classe: 'ds-scene-panneau' }),
    scene(L('Éditeur de bâtiment, outil Ouverture', 'Building editor, Opening tool'), L('la section contextuelle de l\'outil et ses Commandes', 'the tool\'s contextual section and its Controls'), `<div class="batiment-editeur ds-editeur">${poser}</div>`, { classe: 'ds-scene-panneau' }),
    scene(L('Lecteur', 'Reader'), L('le menu du Lecteur d\'un Tome', 'a Volume\'s Reader menu'), `<div class="lecteur ds-editeur" data-fond="sombre">${lecteur}</div>`, { classe: 'ds-scene-panneau' }),
  ].join('');
  return s;
}

/** Les contrôles de base, avec leurs vraies classes, dans un panneau de l'application. */
const CONTROLES = `
<div class="right-panel ds-controles"><div class="right-panel-scroll">
  <section class="side-section"><h2>${L('Boutons', 'Buttons')}</h2>
    <button class="full-btn">${L('Orange : valider, créer', 'Orange: confirm, create')}</button>
    <button class="nav-btn">${L('Gris : naviguer, annuler', 'Grey: navigate, cancel')}</button>
    <button class="full-btn delete-btn">${L('Rouge : supprimer', 'Red: delete')}</button>
    <button class="full-btn edit-btn">${L('Jaune : renommer', 'Yellow: rename')}</button>
    <button class="full-btn" disabled>${L('Désactivé (toutes classes)', 'Disabled (any class)')}</button>
  </section>
  <section class="side-section"><h2>${L('Champs', 'Fields')}</h2>
    <div class="tome-format"><label>${L('Liste déroulante', 'Drop-down list')}</label><select><option>A4 portrait</option></select></div>
    <div class="tome-format"><label>${L('Nombre', 'Number')}</label><input type="number" value="12"></div>
    <div class="tome-format"><label>${L('Curseur (Zoom 1,5×)', 'Slider (Zoom 1.5×)')}</label><input type="range" min="1" max="4" step="0.1" value="1.5"></div>
    <div class="tome-format side-border-color"><label>${L('Couleur', 'Colour')}</label><input type="color" value="#ff7a45"></div>
    <label class="side-bulle-tail"><input type="checkbox" checked> ${L('Case à cocher', 'Checkbox')}</label>
  </section>
  <section class="side-section"><h2>${L('Indications', 'Hints')}</h2>
    <span class="dim-chip">${L('Largeur', 'Width')} <b>182</b> mm</span>
    <div class="empty-hint">${L('Aucune Scène pour l\'instant.', 'No Scene yet.')}</div>
    <p class="side-aide">${L('Une aide sous un réglage : maintenez le clic droit pour déplacer l\'image.', 'A hint under a setting: hold the right button to move the image.')}</p>
  </section>
</div></div>`;

/**
 * Les traductions de l'application, réduites à ce que la page rejoue : les tables de src/i18n.js,
 * les titres des sections des modales d'Élément (lus dans le source d'applyI18nModalSectionTitles,
 * qui ne les exporte pas) et ceux des groupes du Manuel.
 */
function traductions(){
  const source = lire('src/i18n.js');
  const sections = Object.fromEntries([...source.matchAll(/^\s+(\w+):\s+\['([^']*)', '([^']*)'\],/gm)].map(m => [m[1], [m[2], m[3]]]));
  const aide = Object.fromEntries(HELP_MANUAL_EN.map(g => [g.id, [g.title, (HELP_MANUAL_FR.find(f => f.id === g.id) || {}).title || g.title]]));
  return { texte: I18N.I18N_TEXT, fin: I18N.I18N_TRAILING, debut: I18N.I18N_LEADING, modales: I18N.I18N_MODALS, avant: I18N.I18N_PREV_LABEL,
    cases: I18N.I18N_CASES, nombres: I18N.I18N_AVANT_NOMBRE, sections, aide };
}

export function page(){
  const css = lire('src/style.css');
  const html = lire('src/index.html');
  // La feuille de l'application, TELLE QUELLE, sans ses @import (les polices sont embarquées dessous).
  const feuille = css.replace(/@import url\([^)]*\);/g, '');
  const inter = readFileSync(join(RACINE, 'assets/fonts/Inter-latin.woff2')).toString('base64');
  const liste = themes(css);
  const s = specimens(html);
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Storyboarder BD — système de design / design system</title>
<style>
@font-face{ font-family:'Inter'; font-weight:100 900; src:url(data:font/woff2;base64,${inter}) format('woff2'); }
${feuille}
/* ── La page du système de design (préfixe ds-), posée SUR la feuille de l'application ── */
html, body{ height:auto !important; overflow:auto !important; }
body{ background:var(--paper); color:var(--ink); }
.ds-barre{ position:sticky; top:0; z-index:5000; display:flex; gap:8px; align-items:center; padding:10px 28px; background:var(--paper-dark); border-bottom:1px solid var(--line); }
.ds-barre b{ font-size:13px; margin-right:auto; }
.ds-barre button{ font:600 12px 'Inter',sans-serif; padding:6px 12px; border-radius:7px; border:1px solid var(--line-strong); background:var(--nav-bg); color:var(--ink); cursor:pointer; }
.ds-barre button.actif{ background:var(--accent); border-color:var(--accent); color:var(--sur-accent); }
.ds-page{ max-width:1500px; margin:0 auto; padding:28px 28px 80px; font-size:14px; line-height:1.55; }
.ds-page h1{ font-size:26px; margin:0 0 4px; } .ds-intro{ color:var(--ink-soft); margin:0 0 8px; max-width:900px; }
.ds-page h2.ds-titre{ all:unset; display:block; font-size:19px; font-weight:700; margin:44px 0 6px; padding-bottom:6px; border-bottom:1px solid var(--line); }
.ds-chapo{ color:var(--ink-soft); margin:0 0 16px; max-width:900px; }
.ds-page code{ font-family:ui-monospace,Consolas,monospace; font-size:12px; }
.ds-grille{ display:grid; grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); gap:16px; align-items:start; }
.ds-carte{ background:var(--paper-dark); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
.ds-carte h3{ margin:0 0 6px; font-size:15px; } .ds-carte h3 small{ color:var(--ink-soft); font-weight:400; font-size:11px; }
.ds-carte h4{ margin:12px 0 4px; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-soft); }
.ds-nuance{ display:grid; grid-template-columns:22px 1fr auto; column-gap:8px; align-items:center; padding:3px 0; }
.ds-pastille{ width:22px; height:22px; border-radius:6px; border:1px solid rgba(128,128,128,.4); grid-row:span 2; }
.ds-valeur{ font-size:11px; color:var(--ink-soft); font-family:ui-monospace,Consolas,monospace; }
.ds-usage{ grid-column:2 / 4; font-size:11.5px; color:var(--ink-soft); }
.ds-table{ border-collapse:collapse; background:var(--paper-dark); border:1px solid var(--line); border-radius:12px; overflow:hidden; margin-bottom:12px; }
.ds-table td, .ds-table th{ padding:8px 14px; border-bottom:1px solid var(--line); text-align:left; font-size:13px; vertical-align:middle; }
.ds-table th{ font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-soft); }
.ds-barre-ecart{ display:inline-block; height:12px; background:var(--accent); border-radius:2px; vertical-align:middle; }
.ds-rayon{ display:inline-block; width:44px; height:28px; border:2px solid var(--accent); background:var(--accent-soft); }
.ds-figure{ margin:0 0 26px; }
.ds-figure figcaption{ font-size:13px; color:var(--ink-soft); margin:0 0 8px; } .ds-figure figcaption b{ color:var(--ink); }
.ds-scene{ position:relative; transform:translateZ(0); overflow:hidden; border:1px dashed var(--line-strong); border-radius:10px; background:var(--paper); }
.ds-scene .modal-overlay{ z-index:1; }
.ds-scene .modal-box{ max-height:calc(100% - 40px); }
.ds-scene .app{ height:calc(100% - 54px); }
.ds-scene-panneau, .ds-scene-libre{ display:inline-block; vertical-align:top; border-style:solid; }
.ds-scene-panneau .right-panel{ height:auto; }
.ds-scene-panneau .right-panel-scroll{ overflow:visible; }
.ds-editeur{ position:static !important; display:flex; justify-content:flex-end; }
.ds-editeur > aside{ height:auto; max-height:none; overflow:visible; }
.ds-rangee{ display:flex; gap:18px; align-items:flex-start; padding:16px; }
.ds-scene-libre .context-menu{ position:relative; }
.ds-groupe{ display:flex; flex-wrap:wrap; gap:20px; align-items:flex-start; }
.ds-groupe > .ds-figure{ margin:0; }
.ds-planche{ display:flex; align-items:center; justify-content:center; height:100%; }
.ds-feuille{ width:420px; aspect-ratio:21/29.7; background:#fff; padding:18px; display:grid; grid-template-columns:1fr 1fr; grid-auto-rows:1fr; gap:10px; box-shadow:0 6px 24px rgba(0,0,0,.35); }
.ds-case{ border:2px solid #1B1C1F; } .ds-case-active{ outline:2px solid var(--accent); outline-offset:3px; }
.ds-controles{ width:300px; height:auto; }
.ds-icones .choix{ width:420px; }
.ds-regles{ max-width:900px; padding-left:20px; } .ds-regles li{ margin:5px 0; }
.ds-separateur{ width:1px; align-self:stretch; background:var(--line-strong); margin:0 6px; }
html[lang="fr"] .ds-en, html[lang="en"] .ds-fr{ display:none; }
</style></head>
<body>
<div class="ds-barre"><b>${L('Storyboarder BD — système de design', 'Storyboarder BD — design system')}</b>
  ${liste.map(([nom, classe, , en], i) => `<button type="button" data-theme="${classe}"${i === 0 ? ' class="actif"' : ''}>${L(nom, en)}</button>`).join('')}
  <span class="ds-separateur"></span>
  <button type="button" data-langue="fr" class="actif">Français</button><button type="button" data-langue="en">English</button>
</div>
<div class="ds-page">
<h1>${L('Système de design', 'Design system')}</h1>
<p class="ds-intro">${L(`Généré depuis le code par <code>node tools/design-system.mjs</code> ; un test vérifie qu'il est à jour. La page embarque <code>src/style.css</code> tel quel, et chaque écran ci-dessous est un fragment de <code>src/index.html</code> : seules les listes que le code remplit à l'exécution sont simulées. En anglais, les écrans reçoivent les traductions de l'application (<code>src/i18n.js</code>). Les quelques libellés que le code écrit à l'ouverture d'un écran (le titre d'une modale, d'un éditeur) restent ici en français : la page rejoue les tables, pas le code. Les règles d'usage : <code>docs/en/interface.md</code> et sa version française. La barre du haut bascule entre les quatre rendus et les deux langues.`,
  `Generated from the code by <code>node tools/design-system.mjs</code>; a test checks it is up to date. The page embeds <code>src/style.css</code> as is, and each screen below is a fragment of <code>src/index.html</code>: only the lists the code fills at run time are simulated. In English, the screens receive the application's own translations (<code>src/i18n.js</code>). The few labels the code writes when a screen opens (a modal's title, an editor's title) stay in French here: the page replays the tables, not the code. The usage rules: <code>docs/en/interface.md</code> and its French version. The bar at the top switches between the four renderings and the two languages.`)}</p>

<h2 class="ds-titre">${L('Couleurs', 'Colours')}</h2>
<p class="ds-chapo">${L(`Toute couleur d'interface est un jeton. Les quatre rendus redéfinissent les mêmes jetons : Sombre (par défaut), Clair, et le contraste renforcé de chacun. L'orange <code>--accent</code> est la couleur de marque : il ne sert qu'à ce qui crée, valide ou est actif.`,
  `Every interface colour is a token. The four renderings redefine the same tokens: Dark (default), Light, and each one's high contrast. The orange <code>--accent</code> is the brand colour: it only serves what creates, confirms or is active.`)}</p>
<div class="ds-grille">${liste.map(([n, c, j, en]) => nuancier(n, c, j, en)).join('')}</div>

<h2 class="ds-titre">${L('Typographie', 'Typography')}</h2>
<p class="ds-chapo">${L(`Une seule famille pour l'interface : <b>Inter</b>, embarquée. Les polices de lettrage des Bulles sont un autre sujet (fenêtre des polices).`,
  `One family for the interface: <b>Inter</b>, embedded. The Bubbles' lettering fonts are another matter (fonts window).`)}</p>
<table class="ds-table"><tr><th>${L('Jeton', 'Token')}</th><th>${L('Taille', 'Size')}</th><th>${L('Usage', 'Use')}</th><th>${L('Aperçu', 'Preview')}</th></tr>
<tr><td><code>--texte-titre</code></td><td>16 px</td><td>${L('titres de menu, nom de l\'application (700)', 'menu titles, application name (700)')}</td><td style="font-size:var(--texte-titre);font-weight:700">${L('Éditeur de bâtiment', 'Building editor')}</td></tr>
<tr><td><code>--texte-titre-modale</code></td><td>${L('14,5 px', '14.5 px')}</td><td>${L('titres de modale (700)', 'modal titles (700)')}</td><td style="font-size:var(--texte-titre-modale);font-weight:700">${L('Configuration', 'Settings')}</td></tr>
<tr><td><code>--texte-courant</code></td><td>13 px</td><td>${L('boutons, lignes de liste, menus contextuels, texte des modales', 'buttons, list rows, context menus, modal text')}</td><td style="font-size:var(--texte-courant);font-weight:600">${L('Enregistrer dans la bibliothèque', 'Save to the library')}</td></tr>
<tr><td><code>--texte-libelle</code></td><td>12 px</td><td>${L('libellés, aides, textes secondaires', 'labels, hints, secondary text')}</td><td style="font-size:var(--texte-libelle)">${L('Épaisseur de la bordure', 'Border thickness')}</td></tr>
<tr><td><code>--texte-capitales</code></td><td>11 px</td><td>${L('titres de section en capitales (600, +0,05 em), pastilles, comptes', 'upper-case section titles (600, +0.05 em), chips, counts')}</td><td style="font-size:var(--texte-capitales);font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft)">${L('Bordure', 'Border')}</td></tr>
<tr><td><code>--texte-micro</code></td><td>10 px</td><td>${L('libellés de champ en capitales, badges, flèches de sous-menu', 'upper-case field labels, badges, submenu arrows')}</td><td style="font-size:var(--texte-micro);font-weight:600;text-transform:uppercase;color:var(--ink-soft)">${L('Taille réelle', 'Actual size')}</td></tr></table>
<p class="ds-chapo">${L('Six tailles et pas une de plus (#460i) ; un test refuse toute autre taille. Hors échelle, et voulus : les aperçus de polices, le titre d\'une fiche du store et le résultat de la Mesure.', 'Six sizes and no more (#460i); a test refuses any other size. Off the scale, on purpose: font previews, a store page title and the Measure result.')}</p>

<h2 class="ds-titre">${L('Espacements et rayons', 'Spacing and radii')}</h2>
<table class="ds-table"><tr><th>${L('Écart', 'Gap')}</th><th></th><th>${L('Entre', 'Between')}</th></tr>
<tr><td>14 px</td><td><span class="ds-barre-ecart" style="width:56px"></span></td><td>${L('deux sections ; padding d\'une section ; dernière section et boutons du bas', 'two sections; a section\'s padding; last section and bottom buttons')}</td></tr>
<tr><td>10 px</td><td><span class="ds-barre-ecart" style="width:40px"></span></td><td>${L('deux sous-sections ; sous-section et champ qui suit', 'two sub-sections; a sub-section and the field after it')}</td></tr>
<tr><td>8 px</td><td><span class="ds-barre-ecart" style="width:32px"></span></td><td>${L('rangées d\'une sous-section (son gap seul)', 'rows of a sub-section (its gap only)')}</td></tr>
<tr><td>6 px</td><td><span class="ds-barre-ecart" style="width:24px"></span></td><td>${L('deux boutons voisins ou empilés', 'two neighbouring or stacked buttons')}</td></tr></table>
<table class="ds-table"><tr><th>${L('Rayon', 'Radius')}</th><th></th><th>${L('Pour', 'For')}</th></tr>
<tr><td><code>--rayon-grand</code> 10 px</td><td><span class="ds-rayon" style="border-radius:10px"></span></td><td>${L('section, modale, fenêtre', 'section, modal, window')}</td></tr>
<tr><td><code>--rayon-moyen</code> 8 px</td><td><span class="ds-rayon" style="border-radius:8px"></span></td><td>${L('bouton, ligne de liste, menu contextuel, sous-section', 'button, list row, context menu, sub-section')}</td></tr>
<tr><td><code>--rayon-petit</code> 6 px</td><td><span class="ds-rayon" style="border-radius:6px"></span></td><td>${L('champ, bouton de choix, entrée de menu contextuel', 'field, choice button, context menu entry')}</td></tr>
<tr><td><code>--rayon-pilule</code></td><td><span class="ds-rayon" style="border-radius:999px"></span></td><td>${L('badge, puce, poignée, bouton « Mise à jour »', 'badge, chip, thumb, “Update” button')}</td></tr>
<tr><td>50 %</td><td><span class="ds-rayon" style="border-radius:50%;width:28px"></span></td><td>${L('boutons ronds de l\'en-tête, pastilles de niveau', 'header round buttons, level badges')}</td></tr></table>

<h2 class="ds-titre">${L('Contrôles', 'Controls')}</h2>
<p class="ds-chapo">${L(`La couleur d'un bouton dit ce qu'il fait (orange valider ou créer, gris naviguer, rouge supprimer, jaune renommer) ; désactivé, il est gris quelle que soit sa classe, et le survol d'un bouton gris n'est jamais orange.`,
  `A button's colour says what it does (orange confirm or create, grey navigate, red delete, yellow rename); disabled, it is grey whatever its class, and hovering a grey button is never orange.`)}</p>
${scene(L('Contrôles de base', 'Basic controls'), L('avec leurs classes réelles, dans un panneau', 'with their real classes, in a panel'), CONTROLES, { classe: 'ds-scene-panneau' })}

<h2 class="ds-titre">${L('L\'application', 'The application')}</h2>
${s.ensemble}

<h2 class="ds-titre">${L('Menus de droite', 'Right-hand menus')}</h2>
<p class="ds-chapo">${L(`Un menu par chose choisie (Planche, Case, Bulle), un pour la Caméra, et le Manuel quand rien n'est choisi. En-tête centré avec sa croix ; sections en cartes, titre en capitales précédé d'un point orange, repliables d'un clic.`,
  `One menu per selected thing (Page, Panel, Bubble), one for the Camera, and the Manual when nothing is selected. A centred header with its cross; sections as cards, upper-case title after an orange dot, folding with a click.`)}</p>
<div class="ds-groupe">${s.droite}</div>

<h2 class="ds-titre">${L('Menus contextuels', 'Context menus')}</h2>
${s.contextuels}

<h2 class="ds-titre">${L('Modales', 'Modals')}</h2>
<p class="ds-chapo">${L(`Fond assombri, boîte en papier foncé, titre en haut, actions en bas à droite (Annuler en gris, l'action en couleur). Jamais deux modales d'affilée.`,
  `Darkened veil, dark-paper box, title on top, actions at the bottom right (Cancel in grey, the action in colour). Never two modals in a row.`)}</p>
${s.modales}

<h2 class="ds-titre">${L('Bibliothèques', 'Libraries')}</h2>
${s.store}
${s.polices}

<h2 class="ds-titre">${L('Éditeurs', 'Editors')}</h2>
<p class="ds-chapo">${L(`Chaque éditeur occupe la place de la Planche et garde un menu de droite construit avec les mêmes sections ; ses actions de sortie sont toujours en bas.`,
  `Each editor takes the Page's place and keeps a right-hand menu built with the same sections; its exit actions are always at the bottom.`)}</p>
<div class="ds-groupe">${s.editeurs}</div>

<h2 class="ds-titre">${L('Icônes', 'Icons')}</h2>
<p class="ds-chapo">${L(`Une seule famille, au trait et en <code>currentColor</code> (#460k). Le <b>bandeau</b> et les <b>menus contextuels</b> (<code>.ctx-icon</code>) : grille de 24, trait de 2, bouts arrondis ; une action garde la même icône partout. Les <b>choix visuels</b> : pictogrammes au trait de 1,6 px en <code>currentColor</code>, sans libellé (nom en infobulle), dessinés dans la vue où la différence se lit : de dessus pour le plan, de face pour les ouvertures, de profil pour les marches.`,
  `A single line family in <code>currentColor</code> (#460k). The <b>header</b> and <b>context menus</b> (<code>.ctx-icon</code>): 24 grid, 2 px stroke, round caps; an action keeps the same icon everywhere. <b>Visual choices</b>: 1.6 px line pictograms in <code>currentColor</code>, without a label (name in the tooltip), drawn in the view where the difference reads: from above for the plan, from the front for openings, from the side for steps.`)}</p>
<div class="context-menu ds-icones" style="position:static;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));width:auto;margin-bottom:12px">${iconesDeMenu(html)}</div>
<div class="side-persos ds-icones" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin-bottom:12px">${EMOTIONS.map(e => `<div class="perso-row"><span class="perso-icone">${icone(ICONE_EMOTION[e.key])}</span><span class="perso-name"><span class="perso-name-main">${L(e.label, e.labelEn)}</span></span></div>`).join('')}</div>
<div class="right-panel ds-icones" style="width:auto;height:auto"><div class="right-panel-scroll">${Object.entries(ICONES).filter(([, o]) => typeof o === 'object').map(([g, o]) => `<section class="side-section"><h2>${g}</h2>${choixIcones(Object.entries(o).map(([k, v]) => [v, k]), 0)}</section>`).join('')}<section class="side-section"><h2>iconeSensPorte(sens, charniere, geste)</h2>${choixIcones([[1, 'debut'], [1, 'fin'], [-1, 'debut'], [-1, 'fin']].map(([a, b]) => [ICONES.iconeSensPorte(a, b), `${a}, ${b}`]), 0)}</section></div></div>

<h2 class="ds-titre">${L('Règles d\'usage, en bref', 'Usage rules, in short')}</h2>
<ul class="ds-regles">
<li>${L('Un seul menu de droite par écran : ses sections restent, une section contextuelle s\'ajoute au besoin, les actions de sortie sont toujours en bas.', 'One right-hand menu per screen: its sections stay, a contextual section is added when needed, exit actions are always at the bottom.')}</li>
<li>${L('Aucun message d\'état dans un menu : un refus se voit dans l\'aperçu, une réussite dans l\'état du bouton, un échec grave en modale.', 'No status message in a menu: a refusal shows in the preview, a success in the button\'s state, a serious failure in a modal.')}</li>
<li>${L('Une infobulle nomme, elle n\'est pas contextuelle ; seule exception, la raison d\'un choix impossible. Un raccourci s\'écrit entre parenthèses à la fin.', 'A tooltip names, it is not contextual; the only exception is the reason for an impossible choice. A shortcut goes in parentheses at the end.')}</li>
<li>${L('Commandes : une action par ligne, « Geste : effet. »', 'Controls: one action per line, "Gesture: effect."')}</li>
<li>${L('Mêmes gestes d\'un outil à l\'autre : clic pose et sélectionne, clic droit tourne, molette change le type, Ctrl + molette zoome, Alt sans aimant, Échap recule d\'un cran.', 'The same gestures from one tool to the next: click places and selects, right-click turns, the wheel changes the type, Ctrl + wheel zooms, Alt without snapping, Esc steps back once.')}</li>
<li>${L('Jamais deux modales d\'affilée ; une modale qui bloque liste les causes et propose de les résoudre ; ses boutons sont courts.', 'Never two modals in a row; a blocking modal lists the causes and offers to resolve them; its buttons are short.')}</li>
<li>${L('Libellés courts ; un terme peu clair est remplacé et expliqué en infobulle. Les noms de l\'application gardent leur majuscule : Projet, Tome, Planche, Case, Bulle, Scène, Élément.', 'Short labels; an unclear term is replaced and explained in a tooltip. In French, the application\'s nouns keep their capital: Projet, Tome, Planche, Case, Bulle, Scène, Élément.')}</li>
</ul>
</div>
<script>
const I18N = ${JSON.stringify(traductions())};
const dansLaPage = (sel) => [...document.querySelectorAll(sel)].filter(e => e.closest('.ds-page') && !e.closest('.ds-barre'));
// La même logique qu'applyI18n (src/i18n.js), sur les fragments de la page.
function appliquerLangue(langue){
  const en = langue === 'en';
  document.documentElement.lang = langue;
  const poser = (el, a, b) => { if (el && a !== null && !el.hasAttribute('data-ds-sans-i18n')) el.textContent = en ? a : b; };
  I18N.texte.forEach(([sel, a, b, attr, aa, ab]) => dansLaPage(sel).forEach(el => { if (attr) el.setAttribute(attr, en ? aa : ab); else poser(el, a, b); }));
  I18N.modales.forEach(([sel, a, b]) => dansLaPage(sel).forEach(el => poser(el, a, b)));
  I18N.fin.forEach(([sel, a, b]) => dansLaPage(sel).forEach(el => { if (a === null) return; const t = ' ' + (en ? a : b);
    if (el.lastChild && el.lastChild.nodeType === 3) el.lastChild.textContent = t; else el.appendChild(document.createTextNode(t)); }));
  I18N.debut.forEach(([sel, a, b]) => dansLaPage(sel).forEach(el => { if (a === null) return; const t = (en ? a : b) + ' ';
    if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.textContent = t; else el.insertBefore(document.createTextNode(t), el.firstChild); }));
  // Le libellé d'un champ : la même recherche qu'etiquetteDuChamp (src/i18n.js).
  const etiquette = (c) => { const pour = document.querySelector('label[for="' + c.id + '"]'); if (pour) return pour;
    if (c.previousElementSibling) return c.previousElementSibling;
    for (let el = c.parentElement, k = 0; k < 3 && el; k++, el = el.parentElement) { const av = el.previousElementSibling; if (av) return av.tagName === 'LABEL' ? av : null; }
    return null; };
  I18N.avant.forEach(([id, a, b]) => dansLaPage('#' + id).forEach(el => poser(etiquette(el), a, b)));
  I18N.cases.forEach(([id, a, b]) => dansLaPage('#' + id).forEach(el => { const l = el.parentElement; const t = ' ' + (en ? a : b);
    if (l.lastChild && l.lastChild.nodeType === 3) l.lastChild.textContent = t; else l.appendChild(document.createTextNode(t)); }));
  I18N.nombres.forEach(([sel, a, b]) => dansLaPage(sel).forEach(el => { if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.textContent = en ? a : b; }));
  dansLaPage('#descModal .modal-section, #objectModal .modal-section').forEach(sec => {
    const paire = I18N.sections[sec.dataset.section]; const t = paire && sec.querySelector('.modal-section-title');
    if (t) t.textContent = en ? paire[0] : paire[1];
  });
  dansLaPage('#sideHelpSection .help-group').forEach(g => { const paire = I18N.aide[g.dataset.help]; const t = g.querySelector('.help-group-title'); if (paire && t) t.textContent = en ? paire[0] : paire[1]; });
  dansLaPage('#helpMenuHeader .menu-title').forEach(t => { t.textContent = en ? 'User manual' : "Manuel d'utilisation"; });
  // Ce que la page simule elle-même : infobulles, valeurs, options, textes d'exemple.
  document.querySelectorAll('[data-ds-titre-en]').forEach(el => { const t = el.getAttribute(en ? 'data-ds-titre-en' : 'data-ds-titre-fr'); el.title = t; el.setAttribute('aria-label', t); });
  document.querySelectorAll('[data-ds-valeur-en]').forEach(el => { el.value = el.getAttribute(en ? 'data-ds-valeur-en' : 'data-ds-valeur-fr'); });
  document.querySelectorAll('[data-ds-placeholder-en]').forEach(el => { el.placeholder = el.getAttribute(en ? 'data-ds-placeholder-en' : 'data-ds-placeholder-fr'); });
  document.querySelectorAll('option[data-ds-en]').forEach(el => { el.textContent = el.getAttribute(en ? 'data-ds-en' : 'data-ds-fr'); });
}
document.querySelectorAll('.ds-barre button[data-theme]').forEach(b => b.addEventListener('click', () => {
  document.body.className = b.dataset.theme;
  document.querySelectorAll('.ds-barre button[data-theme]').forEach(x => x.classList.toggle('actif', x === b));
}));
document.querySelectorAll('.ds-barre button[data-langue]').forEach(b => b.addEventListener('click', () => {
  appliquerLangue(b.dataset.langue);
  document.querySelectorAll('.ds-barre button[data-langue]').forEach(x => x.classList.toggle('actif', x === b));
}));
document.querySelectorAll('.side-section > h2').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed')));
document.querySelectorAll('.modal-section-header').forEach(h => h.removeAttribute('onclick'));
</script>
</body></html>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(RACINE, 'docs/design-system.html'), page());
  console.log('docs/design-system.html écrit.');
}
