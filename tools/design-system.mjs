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

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (c) => readFileSync(join(RACINE, c), 'utf8');

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LES JETONS
// ═══════════════════════════════════════════════════════════════════════════════════════════════

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
    ['Sombre', '', sombre], ['Clair', 'theme-light', clair],
    ['Sombre contrasté', 'theme-contraste', contraste], ['Clair contrasté', 'theme-light theme-contraste', clairContraste],
  ];
}

/** Les jetons de couleur montrés, par rôle (les autres, comme --echelle-ui, ne sont pas des couleurs). */
const ROLES = [
  ['Surfaces', [['paper', 'Papier : fond des sections, de la page'], ['paper-dark', 'Papier foncé : fond des panneaux, des modales'], ['creux', 'Creux : fond des sous-sections'], ['white', 'Champs, menus contextuels, boutons de choix'], ['nav-bg', 'Bouton gris'], ['nav-bg-hover', 'Bouton gris survolé'], ['fond-3d', 'Fond des aperçus 3D']]],
  ['Encres', [['ink', 'Texte'], ['ink-mid', 'Titres de sous-section'], ['ink-soft', 'Libellés, titres de section'], ['sepia', 'Texte secondaire (format d\'un Tome…)']]],
  ['Rôles', [['accent', 'Orange : créer, valider, actif'], ['accent-soft', 'Fond de ce qui est actif'], ['danger', 'Rouge : supprimer'], ['warn', 'Jaune : renommer, éditer'], ['focus', 'Bague de focus'], ['nord-boussole', 'Le « N » de la boussole']]],
  ['Sur les rôles', [['sur-accent', 'Texte sur orange'], ['sur-danger', 'Texte sur rouge'], ['sur-warn', 'Texte sur jaune']]],
  ['Filets', [['line', 'Filet qui encadre (décoratif)'], ['line-strong', 'Délimiteur, bord des boutons'], ['bord-actif', 'Bord de ce qui se clique ou se saisit']]],
  ['Ascenseurs', [['scroll-thumb', 'Poignée'], ['scroll-thumb-hover', 'Poignée survolée']]],
];

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function nuancier(nom, classe, j){
  const lignes = ROLES.map(([titre, liste]) => `<h4>${titre}</h4>${liste.map(([k, usage]) => `
      <div class="ds-nuance"><span class="ds-pastille" style="background:${j[k]}"></span><code>--${k}</code><span class="ds-valeur">${esc(j[k])}</span><span class="ds-usage">${usage}</span></div>`).join('')}`).join('');
  return `<div class="ds-carte"><h3>${nom} <small>${classe || 'défaut'}</small></h3>${lignes}</div>`;
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
/** Donne un texte à l'élément `id` (un titre ou un message posé par le code). */
const texte = (h, id, t) => remplir(h, id, esc(t));

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CE QUE LE CODE ÉCRIT À L'EXÉCUTION, avec les classes de ses constructeurs
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// project-tree.js : renderTree, renderSceneList, renderImageList.
const TOMES = `
<div class="tome-row active"><span>Le Phare <small style="color:var(--sepia)">— A4 portrait</small></span><span class="caret">▾</span></div>
<div class="tome-format active"><label>Format du tome</label><select><option>A4 portrait</option></select></div>
<div class="tome-pages active"><label>Planches</label>
  <div class="chapter-row"><span class="caret">▾</span><span class="chapter-name">Chapitre 1 — L'arrivée</span><small class="chapter-count">(3)</small></div>
  <div class="chapter-pages"><div class="page-row">Planche 1</div><div class="page-row active">Planche 2</div><div class="page-row">Planche 3</div></div>
  <div class="chapter-row"><span class="caret">▸</span><span class="chapter-name">Chapitre 2 — La tempête</span><small class="chapter-count">(4)</small></div>
  <button class="add-page-btn">Ajouter une planche</button><button class="add-page-btn add-chapter-btn">Ajouter un chapitre</button>
</div>
<div class="tome-row"><span>Carnet de croquis <small style="color:var(--sepia)">— Carré</small></span><span class="caret">▸</span></div>`;
const SCENES = '<div class="tome-row"><span>Cuisine du phare</span></div><div class="tome-row"><span>Falaise, nuit</span></div>';
const IMAGES = `
<div class="side-group-title model-group-title"><span class="model-group-caret">▾</span><span class="model-group-nom">Dans les Cases</span><span class="model-group-nombre">2</span></div>
<div class="model-group">
  <div class="tome-row model-row"><div class="model-row-name">croquis-falaise.png</div><button type="button" class="image-row-where">Le Phare · Planche 2 · Case 1</button></div>
  <div class="tome-row model-row"><div class="model-row-name">reference-lampe.jpg</div><button type="button" class="image-row-where">Le Phare · Planche 3 · Case 4</button></div>
</div>
<div class="side-group-title model-group-title"><span class="model-group-caret">▸</span><span class="model-group-nom">Non utilisées</span><span class="model-group-nombre">1</span></div>`;

// sidebar.js : les dimensions d'une Case.
const DIMENSIONS = '<span class="dim-chip">Largeur <b>182</b> mm</span><span class="dim-chip">Hauteur <b>96</b> mm</span>';

// persona-editor.js : les groupes d'articulations ; modals.js : une ligne de curseur.
const curseur = (nom, v) => `<div class="joint-slider-row"><span class="joint-slider-label">${nom}</span><input type="range" min="-90" max="90" value="${v}"><span class="joint-slider-val">${v}°</span></div>`;
const ARTICULATIONS = `
<details class="joint-group-details" open><summary>Bras gauche</summary>${curseur('Épaule — lever', 35)}${curseur('Épaule — tourner', -10)}${curseur('Coude', 60)}</details>
<details class="joint-group-details"><summary>Bras droit</summary></details>
<details class="joint-group-details"><summary>Tête et cou</summary></details>`;

// store-ui.js : rendreOnglets, carteAjout, carte.
const ONGLETS = '<button type="button" class="store-onglet actif">Mes modèles</button><button type="button" class="store-onglet">Sketchfab</button><button type="button" class="store-onglet">Poly Haven</button>';
const carte = (nom, auteur, licence, nc = false) => `<button type="button" class="store-carte"><div class="store-sans-vignette"></div><span class="store-carte-nom">${nom}</span><span class="store-carte-auteur">par ${auteur}</span><span class="store-carte-infos"><span class="store-badge${nc ? ' store-badge-nc' : ''}">${licence}</span><span>2,4 Mo</span></span></button>`;
const AJOUT = `<button type="button" class="store-carte store-carte-ajout"><svg viewBox="0 0 24 24" aria-hidden="true" class="store-ajout-icone">${['M12 3v12', 'M7 10l5 5 5-5', 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2'].map(d => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg><span class="store-carte-nom">Importer un modèle</span></button>`;
const GRILLE = AJOUT + carte('Lampe tempête', 'atelier_k', 'CC BY') + carte('Chaise en bois', 'polyhaven', 'CC0') + carte('Vieux gréement', 'naval3d', 'CC BY-NC', true)
  + carte('Phare côtier', 'mer_et_pierre', 'CC BY') + carte('Chat noir', 'félin', 'CC BY');

// batiment-editeur-ui.js : remplirNiveaux, la liste des pièces, formulaireEscalier, commandes.
const niveau = (court, nom, actif) => `<div class="batiment-ligne batiment-ligne-niveau cliquable${actif ? ' actif' : ''}"><div class="batiment-niveau-gauche"><span class="batiment-niveau-pastille">${court}</span><button type="button" class="batiment-niveau-suppr">×</button></div><div class="batiment-niveau-droite"><input type="text" class="batiment-niveau-nom" value="${nom}"><span class="batiment-champ-valeur"><input type="number" value="280"> cm</span></div></div>`;
const NIVEAUX = `${niveau('1', 'Étage 1', false)}${niveau('RDC', 'Rez-de-chaussée', true)}<div class="batiment-boutons-pile"><button type="button" class="full-btn">Ajouter un étage</button><button type="button" class="full-btn">Dupliquer l'étage</button></div>`;
const PIECES = '<div class="batiment-ligne cliquable"><span>Séjour</span><small>32,4 m²</small></div><div class="batiment-ligne cliquable"><span>Cuisine</span><small>12,1 m²</small></div>';
const choixIcones = (liste, actif = -1, eteint = -1) => `<div class="batiment-choix">${liste.map(([icone, titre], i) =>
  `<button type="button" class="icone${i === actif ? ' actif' : ''}" title="${esc(titre)}" aria-label="${esc(titre)}"${i === eteint ? ' disabled' : ''}>${icone}</button>`).join('')}</div>`;
const I = ICONES;
const ESCALIER = `
<div class="batiment-sous-section"><h3>Type</h3>${choixIcones([[I.ICONES_TYPE_ESCALIER.droit, 'Escalier droit'], [I.ICONES_TYPE_ESCALIER.L, 'Escalier en L'], [I.ICONES_TYPE_ESCALIER.U, 'Escalier en U : il ne tient pas dans cette pièce']], 1, 2)}
${choixIcones([[I.ICONES_SENS_ESCALIER[1], 'Tourne à gauche'], [I.ICONES_SENS_ESCALIER[-1], 'Tourne à droite']], 0)}</div>
<div class="batiment-sous-section"><h3>Marches</h3>${choixIcones([[I.ICONES_RAMPE.aucune, 'Sans rampe'], [I.ICONES_RAMPE.gauche, 'Rampe à gauche'], [I.ICONES_RAMPE.droite, 'Rampe à droite'], [I.ICONES_RAMPE.deux, 'Rampe des deux côtés']], 2)}
${choixIcones([[I.ICONES_MARCHES.true, 'Marches pleines'], [I.ICONES_MARCHES.false, 'Marches ouvertes']], 0)}</div>
<label class="batiment-champ batiment-champ-large"><span>Largeur</span><span class="batiment-champ-valeur"><input type="number" value="90"> cm</span></label>`;
const OUVERTURE = `
<div class="batiment-sous-section"><h3>Type</h3>${choixIcones(['porte', 'fenetre', 'baie', 'passage'].map(t => [I.ICONES_OUVERTURE[t], t]), 0)}
${choixIcones([[I.ICONES_MANOEUVRE[1], 'Un battant'], [I.ICONES_MANOEUVRE[2], 'Deux battants'], [I.ICONES_MANOEUVRE.coulissant, 'Coulissante']], 0)}
${choixIcones([[I.ICONES_REMPLISSAGE.pleine, 'Porte pleine'], [I.ICONES_REMPLISSAGE.vitree, 'Porte vitrée']], 0)}
${choixIcones([[I.ICONES_INVERSER.cote, 'Ouvrir de l\'autre côté du mur'], [I.ICONES_INVERSER.charniere, 'Passer la charnière de l\'autre bord']])}</div>
<div class="batiment-sous-section"><h3>Dimensions</h3><label class="batiment-champ"><span>Largeur</span><span class="batiment-champ-valeur"><input type="number" value="90"> cm</span></label><label class="batiment-champ"><span>Hauteur</span><span class="batiment-champ-valeur"><input type="number" value="210"> cm</span></label><label class="batiment-champ"><span>Élévation</span><span class="batiment-champ-valeur"><input type="number" value="0"> cm</span></label></div>`;

// lecteur-ui.js : construirePanneau.
const lchoix = (liste, actif) => `<div class="lecteur-choix">${liste.map((l, i) => `<button type="button" class="lecteur-choix-btn${i === actif ? ' actif' : ''}">${l}</button>`).join('')}</div>`;
const lsection = (t, c) => `<section class="side-section lecteur-section"><h2>${t}</h2>${c}</section>`;
const LECTEUR = lsection('Affichage', lchoix(['Une page', 'Deux pages'], 1) + lchoix(['Première page à droite', 'Première page à gauche'], 0) + lchoix(['Page entière', 'Largeur'], 0)
    + '<label class="modal-checkbox-line lecteur-case"><input type="checkbox" checked> Vue livre</label><label class="modal-checkbox-line lecteur-case"><input type="checkbox"> Vue guidée, case par case</label>')
  + lsection('Sens de lecture', lchoix(['Vers la gauche', 'Vers la droite'], 1))
  + lsection('Défilement automatique', '<div class="lecteur-vitesse"><label>Vitesse : 6 s par page</label><input type="range" min="2" max="20" value="6"></div><button type="button" class="full-btn lecteur-lecture">▶ Lecture (Espace)</button>')
  + lsection('Apparence', lchoix(['Sombre', 'Gris', 'Clair'], 0))
  + '<button type="button" class="nav-btn">⛶ Plein écran (F)</button><p class="side-hint">← → ou clic sur les bords pour tourner les pages · Origine / Fin · Échap pour sortir.</p>';

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
  case_ = texte(case_, 'sideStackLevel', 'Encrage');
  case_ = texte(case_, 'panelMenuNumber', ' 3');

  let gauche = montrer(fragmentPar(html, '<div class="sidebar">'));
  gauche = remplir(gauche, 'volumeList', TOMES);
  gauche = remplir(gauche, 'sceneList', SCENES);
  gauche = remplir(gauche, 'imageList', IMAGES);
  gauche = texte(gauche, 'lastSavedIndicator', 'Enregistré il y a 2 minutes');
  gauche = texte(gauche, 'projectNameText', 'Les Gardiens du phare');
  let entete = montrer(fragmentPar(html, '<header>'));
  entete = entete.replace(/<span id="appVersionText" class="app-version"><\/span>/, '<span id="appVersionText" class="app-version">v1.11</span>');
  const planche = `<main><div class="canvas-wrap"><div class="canvas-stack ds-planche"><div class="zoom-indicator">100%</div>
    <div class="ds-feuille"><div class="ds-case" style="grid-column:1/3"></div><div class="ds-case ds-case-active"></div><div class="ds-case"></div><div class="ds-case" style="grid-column:1/3"></div></div></div></div></main>`;
  s.ensemble = scene('L\'application', 'en-tête, menu de gauche (Projet, Tomes, Scènes, Images), Planche, menu de droite (une Case choisie)',
    `${entete}<div class="app">${gauche}${planche}<div class="right-panel" id="rightPanel"><div class="right-panel-scroll" id="rightPanelScroll">${case_}</div></div></div>`, { hauteur: 900, classe: 'ds-scene-app' });

  // Les autres menus de droite.
  let planche_ = texte(montrer(groupes.pageMenuHeader), 'pageMenuNumber', ' 2');
  planche_ = remplir(planche_, 'sidePagePanels', '<div class="tome-row"><span>Case 1</span></div><div class="tome-row active"><span>Case 2</span></div><div class="tome-row"><span>Case 3</span></div>');
  s.droite = [
    scene('Planche', 'une Planche choisie', panneau(planche_), { classe: 'ds-scene-panneau' }),
    scene('Bulle', 'une Bulle choisie', panneau(texte(groupes.bubbleMenuHeader, 'sideBubbleStackLevel', 'Lettrage')), { classe: 'ds-scene-panneau' }),
    scene('Caméra', 'le mode Caméra d\'une Case', panneau(groupes.sideCameraSection), { classe: 'ds-scene-panneau' }),
    scene('Manuel d\'utilisation', 'quand rien n\'est choisi', panneau(groupes.helpMenuHeader), { classe: 'ds-scene-panneau' }),
  ].join('');

  // Les menus contextuels.
  s.contextuels = scene('Menus contextuels', 'clic droit sur une Case, son sous-menu « Ajouter », double-clic sur la Planche',
    `<div class="ds-rangee">${montrer(fragment(html, 'panelContextMenu'))}${montrer(fragment(html, 'addSubmenu'))}${montrer(fragment(html, 'dblclickChoiceMenu'))}</div>`, { classe: 'ds-scene-libre' });

  // Les modales.
  let confirmer = montrer(fragment(html, 'confirmActionModal'));
  confirmer = texte(confirmer, 'confirmActionTitle', 'Supprimer la Planche');
  confirmer = texte(confirmer, 'confirmActionMessage', 'Supprimer la Planche 3 et ses 6 Cases ?\nCette action peut être annulée avec Ctrl+Z.');
  confirmer = confirmer.replace('id="confirmActionOk" type="button">Confirmer', 'id="confirmActionOk" type="button">Supprimer').replace('class="full-btn" id="confirmActionOk"', 'class="full-btn delete-btn" id="confirmActionOk"');
  let renommer = montrer(fragment(html, 'renameEntityModal'));
  s.modales = [
    scene('Modale de confirmation', 'information, confirmation, suppression', confirmer, { hauteur: 300 }),
    scene('Modale de renommage', 'Tome, Planche, Scène, format…', renommer, { hauteur: 320 }),
    scene('Modale Projet', 'clic sur le nom du Projet', montrer(fragment(html, 'projectModal')), { hauteur: 480 }),
    scene('Modale Configuration', 'trois onglets', montrer(fragment(html, 'settingsModal')), { hauteur: 820 }),
    scene('Modale d\'un Élément', 'un objet : sections repliables, deux colonnes quand la place le permet', montrer(fragment(html, 'objectModal')), { hauteur: 900 }),
    scene('Modale d\'un Personnage', 'même charpente que celle d\'un objet', montrer(fragment(html, 'descModal')), { hauteur: 900 }),
    scene('Modale des formats', 'les formats du Projet', montrer(fragment(html, 'formatsModal')), { hauteur: 520 }),
  ].join('');

  // Le store.
  let store = montrer(fragment(html, 'storeModal'));
  store = texte(store, 'storeTitre', 'Bibliothèque de modèles');
  store = remplir(store, 'storeOnglets', ONGLETS);
  store = remplir(store, 'storeGrille', GRILLE);
  store = texte(store, 'storeCredit', 'Modèles des sources externes : licence et auteur affichés sur chaque fiche.');
  // Les filtres : le code écrit leurs options ; on montre la première de chacune.
  const FILTRES = { storeCategorie: 'Toutes les catégories', storeLicence: 'Toutes les licences', storeFaces: 'Toutes les tailles',
    storeTri: 'Pertinence', storeUsage: 'Partout', storeSquelette: 'Articulés et statues' };
  for (const [id, t] of Object.entries(FILTRES)) store = store.replace(new RegExp(`(<select id="${id}"[^>]*>)<option>Choisir…</option>`), `$1<option>${t}</option>`);
  store = texte(store, 'storeCommercialLibelle', 'Usage commercial');
  store = store.replace('id="storeTexte" class="modal-input" type="search"', 'id="storeTexte" class="modal-input" type="search" placeholder="Rechercher un modèle"');
  s.store = scene('Bibliothèque de modèles (store)', 'onglets par source, filtres, grille de cartes, import', store, { hauteur: 760 });
  s.polices = scene('Fenêtre des polices', 'sa charpente ; les polices sont listées par le code', montrer(fragment(html, 'policesModal')), { hauteur: 560 });

  // Les éditeurs.
  let modele = montrer(fragmentPar(html, '<aside class="persona-editor-panel">'));
  modele = texte(modele, 'personaEditorFigure', 'Mannequin — humanoïde');
  modele = texte(modele, 'personaEditorPoseLabel', 'Assis, mains sur les genoux');
  modele = remplir(modele, 'personaEditorJointsContainer', ARTICULATIONS);
  let batiment = montrer(fragment(html, 'batimentPanneau'));
  batiment = batiment.replace('id="batimentNom" class="modal-input batiment-nom"', 'id="batimentNom" class="modal-input batiment-nom" value="Maison du gardien"');
  batiment = remplir(batiment, 'batimentNiveaux', NIVEAUX);
  batiment = remplir(batiment, 'batimentPieces', PIECES);
  // L'état montré : l'outil Sélection, un escalier choisi. Les sections des outils de pose sont
  // retirées ici et montrées à part (un seul état à la fois, comme dans l'éditeur).
  batiment = retirer(retirer(batiment, 'batimentContexteOuverture'), 'batimentContexteEscalier');
  batiment = texte(batiment, 'batimentSelectionTitre', 'Escalier sélectionné');
  batiment = remplir(batiment, 'batimentFormEscalier', ESCALIER);
  batiment = retirer(batiment, 'batimentSelectionOuverture');
  batiment = texte(batiment, 'batimentAide', 'Tirer : le déplacer.\nR : le tourner de 90°.\nSuppr : le supprimer.\nÉchap : désélectionner.');
  const poser = `<aside class="batiment-editeur-panneau"><section class="side-section"><h2>Ouverture à poser</h2>${OUVERTURE}</section>
    <section class="side-section"><h2>Commandes</h2><p class="batiment-aide">Clic : la poser et la choisir.\nClic droit : changer le sens d'une porte.\nMolette : changer de type.\nCtrl + molette : zoomer.\nÉchap : quitter l'outil.</p></section></aside>`;
  let lecteur = montrer(fragmentPar(html, '<aside class="lecteur-panneau">'));
  lecteur = texte(lecteur, 'lecteurTitre', 'Le Phare');
  lecteur = texte(lecteur, 'lecteurPosition', ' · Planches 2-3 / 24');
  lecteur = remplir(lecteur, 'lecteurPanneau', LECTEUR);
  s.editeurs = [
    scene('Éditeur de modèle', 'son menu de droite : modèle, pose, articulations, sorties', `<div class="persona-editor ds-editeur">${modele}</div>`, { classe: 'ds-scene-panneau' }),
    scene('Éditeur de bâtiment', 'un seul menu ; ici un escalier choisi avec l\'outil Sélection', `<div class="batiment-editeur ds-editeur">${batiment}</div>`, { classe: 'ds-scene-panneau' }),
    scene('Éditeur de bâtiment, outil Ouverture', 'la section contextuelle de l\'outil et ses Commandes', `<div class="batiment-editeur ds-editeur">${poser}</div>`, { classe: 'ds-scene-panneau' }),
    scene('Lecteur', 'le menu du Lecteur d\'un Tome', `<div class="lecteur ds-editeur" data-fond="sombre">${lecteur}</div>`, { classe: 'ds-scene-panneau' }),
  ].join('');
  return s;
}

/** Les contrôles de base, avec leurs vraies classes, dans un panneau de l'application. */
const CONTROLES = `
<div class="right-panel ds-controles"><div class="right-panel-scroll">
  <section class="side-section"><h2>Boutons</h2>
    <button class="full-btn">Orange : valider, créer</button>
    <button class="nav-btn">Gris : naviguer, annuler</button>
    <button class="full-btn delete-btn">Rouge : supprimer</button>
    <button class="full-btn edit-btn">Jaune : renommer</button>
    <button class="full-btn" disabled>Désactivé (toutes classes)</button>
  </section>
  <section class="side-section"><h2>Champs</h2>
    <div class="tome-format"><label>Liste déroulante</label><select><option>A4 portrait</option></select></div>
    <div class="tome-format"><label>Nombre</label><input type="number" value="12"></div>
    <div class="tome-format"><label>Curseur (Zoom 1,5×)</label><input type="range" min="1" max="4" step="0.1" value="1.5"></div>
    <div class="tome-format side-border-color"><label>Couleur</label><input type="color" value="#ff7a45"></div>
    <label class="side-bulle-tail"><input type="checkbox" checked> Case à cocher</label>
  </section>
  <section class="side-section"><h2>Indications</h2>
    <span class="dim-chip">Largeur <b>182</b> mm</span>
    <div class="empty-hint">Aucune Scène pour l'instant.</div>
    <p class="side-aide">Une aide sous un réglage : maintenez le clic droit pour déplacer l'image.</p>
  </section>
</div></div>`;

export function page(){
  const css = lire('src/style.css');
  const html = lire('src/index.html');
  // La feuille de l'application, TELLE QUELLE, sans ses @import (les polices sont embarquées dessous).
  const feuille = css.replace(/@import url\([^)]*\);/g, '');
  const inter = readFileSync(join(RACINE, 'assets/fonts/Inter-latin.woff2')).toString('base64');
  const liste = themes(css);
  const s = specimens(html);
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Storyboarder BD — système de design</title>
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
.ds-icones .batiment-choix{ width:420px; }
.ds-regles{ max-width:900px; padding-left:20px; } .ds-regles li{ margin:5px 0; }
</style></head>
<body>
<div class="ds-barre"><b>Storyboarder BD — système de design</b>
  ${liste.map(([nom, classe], i) => `<button type="button" data-theme="${classe}"${i === 0 ? ' class="actif"' : ''}>${nom}</button>`).join('')}
</div>
<div class="ds-page">
<h1>Système de design</h1>
<p class="ds-intro">Généré depuis le code par <code>node tools/design-system.mjs</code> ; un test vérifie qu'il est à jour. La page embarque <code>src/style.css</code> tel quel, et chaque écran ci-dessous est un fragment de <code>src/index.html</code> : seules les listes que le code remplit à l'exécution sont simulées. Les règles d'usage : <code>docs/en/interface.md</code> (et sa version française). La barre du haut bascule entre les quatre rendus.</p>

<h2 class="ds-titre">Couleurs</h2>
<p class="ds-chapo">Toute couleur d'interface est un jeton. Les quatre rendus redéfinissent les mêmes jetons : Sombre (par défaut), Clair, et le contraste renforcé de chacun. L'orange <code>--accent</code> est la couleur de marque : il ne sert qu'à ce qui crée, valide ou est actif.</p>
<div class="ds-grille">${liste.map(([n, c, j]) => nuancier(n, c, j)).join('')}</div>

<h2 class="ds-titre">Typographie</h2>
<p class="ds-chapo">Une seule famille pour l'interface : <b>Inter</b>, embarquée. Les polices de lettrage des Bulles sont un autre sujet (fenêtre des polices).</p>
<table class="ds-table"><tr><th>Usage</th><th>Taille</th><th>Graisse</th><th>Encre</th><th>Aperçu</th></tr>
<tr><td>Nom de l'application, titre de menu</td><td>16 px</td><td>700</td><td><code>--ink</code></td><td style="font-size:16px;font-weight:700">Éditeur de bâtiment</td></tr>
<tr><td>Titre de modale</td><td>14,5 px</td><td>700</td><td><code>--ink</code></td><td style="font-size:14.5px;font-weight:700">Configuration</td></tr>
<tr><td>Titre de section</td><td>11 px, capitales, +0,05 em</td><td>600</td><td><code>--ink-soft</code></td><td style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft)">Bordure</td></tr>
<tr><td>Titre de sous-section</td><td>13 px</td><td>600</td><td><code>--ink-mid</code></td><td style="font-size:13px;font-weight:600;color:var(--ink-mid)">Dimensions</td></tr>
<tr><td>Bouton</td><td>12,5 px (11,5 dans une rangée)</td><td>600</td><td></td><td style="font-size:12.5px;font-weight:600">Enregistrer dans la bibliothèque</td></tr>
<tr><td>Ligne de liste, menu contextuel</td><td>12,5 px</td><td>400 à 600</td><td><code>--ink</code> / <code>--ink-soft</code></td><td style="font-size:12.5px">Planche 2</td></tr>
<tr><td>Libellé, texte</td><td>12 px</td><td>400</td><td><code>--ink</code></td><td style="font-size:12px">Épaisseur de la bordure</td></tr>
<tr><td>Aide, pied de page</td><td>11,5 px</td><td>400</td><td><code>--ink-soft</code></td><td style="font-size:11.5px;color:var(--ink-soft)">Enregistré il y a 2 minutes</td></tr></table>

<h2 class="ds-titre">Espacements et rayons</h2>
<table class="ds-table"><tr><th>Écart</th><th></th><th>Entre</th></tr>
<tr><td>14 px</td><td><span class="ds-barre-ecart" style="width:56px"></span></td><td>deux sections ; padding d'une section ; dernière section et boutons du bas</td></tr>
<tr><td>10 px</td><td><span class="ds-barre-ecart" style="width:40px"></span></td><td>deux sous-sections ; sous-section et champ qui suit</td></tr>
<tr><td>8 px</td><td><span class="ds-barre-ecart" style="width:32px"></span></td><td>rangées d'une sous-section (son gap seul)</td></tr>
<tr><td>6 px</td><td><span class="ds-barre-ecart" style="width:24px"></span></td><td>deux boutons voisins ou empilés</td></tr></table>
<table class="ds-table"><tr><th>Rayon</th><th></th><th>Pour</th></tr>
<tr><td>10 px</td><td><span class="ds-rayon" style="border-radius:10px"></span></td><td>section, modale</td></tr>
<tr><td>8 px</td><td><span class="ds-rayon" style="border-radius:8px"></span></td><td>menu contextuel</td></tr>
<tr><td>7 px</td><td><span class="ds-rayon" style="border-radius:7px"></span></td><td>bouton, ligne de liste</td></tr>
<tr><td>6 px</td><td><span class="ds-rayon" style="border-radius:6px"></span></td><td>champ, bouton de choix</td></tr>
<tr><td>5 px</td><td><span class="ds-rayon" style="border-radius:5px"></span></td><td>sous-section, entrée de menu contextuel</td></tr>
<tr><td>50 %</td><td><span class="ds-rayon" style="border-radius:50%;width:28px"></span></td><td>boutons ronds de l'en-tête, pastilles de niveau</td></tr></table>

<h2 class="ds-titre">Contrôles</h2>
<p class="ds-chapo">La couleur d'un bouton dit ce qu'il fait (orange valider ou créer, gris naviguer, rouge supprimer, jaune renommer) ; désactivé, il est gris quelle que soit sa classe, et le survol d'un bouton gris n'est jamais orange.</p>
${scene('Contrôles de base', 'avec leurs classes réelles, dans un panneau', CONTROLES, { classe: 'ds-scene-panneau' })}

<h2 class="ds-titre">L'application</h2>
${s.ensemble}

<h2 class="ds-titre">Menus de droite</h2>
<p class="ds-chapo">Un menu par chose choisie (Planche, Case, Bulle), un pour la Caméra, et le Manuel quand rien n'est choisi. En-tête centré avec sa croix ; sections en cartes, titre en capitales précédé d'un point orange, repliables d'un clic.</p>
<div class="ds-groupe">${s.droite}</div>

<h2 class="ds-titre">Menus contextuels</h2>
${s.contextuels}

<h2 class="ds-titre">Modales</h2>
<p class="ds-chapo">Fond assombri, boîte en papier foncé, titre en haut, actions en bas à droite (Annuler en gris, l'action en couleur). Jamais deux modales d'affilée.</p>
${s.modales}

<h2 class="ds-titre">Bibliothèques</h2>
${s.store}
${s.polices}

<h2 class="ds-titre">Éditeurs</h2>
<p class="ds-chapo">Chaque éditeur occupe la place de la Planche et garde un menu de droite construit avec les mêmes sections ; ses actions de sortie sont toujours en bas.</p>
<div class="ds-groupe">${s.editeurs}</div>

<h2 class="ds-titre">Icônes</h2>
<p class="ds-chapo">Deux familles. Les <b>menus contextuels</b> portent un emoji devant chaque entrée (<code>.ctx-icon</code>). Les <b>choix visuels</b> sont des pictogrammes au trait de 1,6 px en <code>currentColor</code>, sans libellé (nom en infobulle), dessinés dans la vue où la différence se lit : de dessus pour le plan, de face pour les ouvertures, de profil pour les marches.</p>
<div class="right-panel ds-icones" style="width:auto;height:auto"><div class="right-panel-scroll">${Object.entries(ICONES).map(([g, o]) => `<section class="side-section"><h2>${g}</h2>${choixIcones(Object.entries(o).map(([k, v]) => [v, k]), 0)}</section>`).join('')}</div></div>

<h2 class="ds-titre">Règles d'usage, en bref</h2>
<ul class="ds-regles">
<li>Un seul menu de droite par écran : ses sections restent, une section contextuelle s'ajoute au besoin, les actions de sortie sont toujours en bas.</li>
<li>Aucun message d'état dans un menu : un refus se voit dans l'aperçu, une réussite dans l'état du bouton, un échec grave en modale.</li>
<li>Une infobulle nomme, elle n'est pas contextuelle ; seule exception, la raison d'un choix impossible. Un raccourci s'écrit entre parenthèses à la fin.</li>
<li>Commandes : une action par ligne, « Geste : effet. »</li>
<li>Mêmes gestes d'un outil à l'autre : clic pose et sélectionne, clic droit tourne, molette change le type, Ctrl + molette zoome, Alt sans aimant, Échap recule d'un cran.</li>
<li>Jamais deux modales d'affilée ; une modale qui bloque liste les causes et propose de les résoudre ; ses boutons sont courts.</li>
<li>Libellés courts ; un terme peu clair est remplacé et expliqué en infobulle. Les noms de l'application gardent leur majuscule : Projet, Tome, Planche, Case, Bulle, Scène, Élément.</li>
</ul>
</div>
<script>
document.querySelectorAll('.ds-barre button').forEach(b => b.addEventListener('click', () => {
  document.body.className = b.dataset.theme;
  document.querySelectorAll('.ds-barre button').forEach(x => x.classList.toggle('actif', x === b));
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
