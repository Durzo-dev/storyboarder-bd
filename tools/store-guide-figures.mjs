/**
 * tools/store-guide-figures.mjs — les MAQUETTES du guide « Faire un store » (docs/en/store-guide.md, et sa version française).
 *
 *   node tools/store-guide-figures.mjs      → les maquettes *.fr.svg et *.en.svg, dans le dossier img/store-guide de docs
 *
 * Des SCHÉMAS, pas des captures : ils montrent l'organisation (ce qui va où, dans quel ordre) que le
 * guide décrit, avec des repères numérotés que le texte reprend. Les valeurs exactes (couleurs,
 * écarts, rayons) restent celles de src/style.css et du système de design (docs/design-system.html) :
 * un schéma qui divergerait d'un pixel n'en serait pas moins juste sur ce qu'il explique.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = join(RACINE, 'docs', 'img', 'store-guide');

// Une palette proche du rendu sombre de l'application ; le bleu des repères n'existe pas dans
// l'application, exprès : on ne le confond pas avec l'interface.
const C = { fond: '#18191c', papier: '#23252a', creux: '#2c2e34', ligne: '#3b3e45', encre: '#e7e7e9',
  doux: '#9aa0a8', orange: '#e8833a', gris: '#4a4d55', repere: '#5aa9ff', sujet: '#b5794a' };

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rect = (x, y, l, h, f, { r = 6, trait = null, pointille = false } = {}) =>
  `<rect x="${x}" y="${y}" width="${l}" height="${h}" rx="${r}" fill="${f}"${trait ? ` stroke="${trait}" stroke-width="1.2"` : ''}${pointille ? ' stroke-dasharray="5 4"' : ''}/>`;
const texte = (x, y, t, { taille = 12, c = C.encre, gras = false, ancre = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${taille}" fill="${c}"${gras ? ' font-weight="700"' : ''} text-anchor="${ancre}">${esc(t)}</text>`;
/** Un repère numéroté (le texte du guide renvoie à ces numéros). */
const repere = (x, y, n) => `<circle cx="${x}" cy="${y}" r="9" fill="${C.repere}"/>${texte(x, y + 4, n, { taille: 11, c: '#0b1a2b', gras: true, ancre: 'middle' })}`;
const fleche = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.repere}" stroke-width="1.4" marker-end="url(#pointe)"/>`;
const svg = (l, h, corps) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l} ${h}" width="${l}" height="${h}" font-family="Inter, Segoe UI, Arial, sans-serif">
<defs><marker id="pointe" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${C.repere}"/></marker></defs>
${rect(0, 0, l, h, C.fond, { r: 10 })}
${corps}
</svg>
`;
/** Une vignette schématique : fond, et un sujet (une commode) centré avec sa marge. */
const vignette = (x, y, l, h, { fondu = C.creux } = {}) => {
  const sl = h * 0.42, sh = h * 0.8;
  return rect(x, y, l, h, fondu, { r: 4 }) + rect(x + l / 2 - sl / 2, y + h * 0.1, sl, sh, C.sujet, { r: 3 })
    + [0, 1, 2].map(i => rect(x + l / 2 - sl / 2 + sl * 0.12, y + h * 0.16 + i * sh * 0.3, sl * 0.76, sh * 0.2, '#d4a874', { r: 2 })).join('');
};
/** Une carte du store (3:2), à la position et à la largeur données. */
const carte = (x, y, l, t, { possedee = false, nom = 'Gothic Commode 01' } = {}) => {
  const h = l * 2 / 3;
  return rect(x, y, l, h + 62, C.papier, { trait: C.ligne })
    + vignette(x + 8, y + 8, l - 16, h - 16)
    + (possedee ? `<g opacity=".55">${rect(x + 8, y + 8, l - 16, h - 16, C.fond, { r: 4 })}</g>` + rect(x + l - 34, y + 12, 22, 18, C.orange, { r: 9 }) + texte(x + l - 23, y + 25, '✓', { taille: 11, c: '#1a1a1a', gras: true, ancre: 'middle' }) : '')
    + texte(x + 10, y + h + 16, nom, { gras: true })
    + texte(x + 10, y + h + 32, `${t.par} Studio Exemple`, { taille: 11, c: C.doux })
    + rect(x + 10, y + h + 40, 34, 16, C.orange, { r: 8 }) + texte(x + 27, y + h + 52, 'CC0', { taille: 10, c: '#1a1a1a', gras: true, ancre: 'middle' })
    + texte(x + 52, y + h + 52, '2,4 Mo'.replace(',', t.virgule), { taille: 11, c: C.doux });
};

const TEXTES = {
  fr: { par: 'par', virgule: ',', titre: 'Bibliothèque de modèles', onglets: ['Sketchfab', 'Poly Haven', 'Mes modèles'],
    recherche: 'Rechercher un modèle', filtres: ['Toutes les catégories', 'Toutes les licences', 'Pertinence'], importer: 'Importer un modèle',
    credit: 'Modèles de Sketchfab — licence et auteur sur chaque fiche', bandeau: 'Bandeau de l\'application',
    fenetre: ['Une fenêtre à part, ouverte par son bouton du bandeau', 'Un onglet par source, puis « Mes … »', 'Filtres et recherche (la page se recharge)',
      'La carte « Importer » en tête, de même hauteur', 'Le crédit de la source, cliquable, sous la grille', 'Page suivante demandée près du bas'],
    carteNotes: ['Vignette 3:2 recadrée (sujet + marge)', 'Nom, puis « par auteur »', 'Licence (et catégorie) en orange, poids', 'Possédée : pastille et vignette atténuée', 'Jamais d\'étiquettes sur une carte'],
    fiche: { voir3d: 'Voir en 3D', voirSur: 'Voir sur Poly Haven', sections: ['Utilisée dans ce projet', 'Licence', 'Caractéristiques'],
      lignes: [['Utilisée nulle part dans ce Projet.'], ['Domaine public (CC0) : aucune attribution exigée.', 'CC0 1.0'], ['Matières : Bois, Parquet', 'Taille réelle : 2 × 2 m', 'Poids : 9,1 Mo']],
      retour: 'Retour', telecharger: 'Télécharger 1K', supprimer: 'Supprimer',
      notes: ['Le visuel, puis ses boutons (aucun texte dessous)', 'Les sections, toujours dans cet ordre', 'Le poids en dernier', 'Retour, puis l\'action : Télécharger (bouton scindé) ou Supprimer si possédée'] },
    vig: { etapes: ['1. La vignette de la source (512 px)', '2. Le sujet, repéré par ses contours', '3. Recomposée en 3:2 : marge, fond prolongé'],
      regles: ['L\'originale n\'est jamais montrée : la carte reste vide puis la vignette apparaît en fondu.',
        'Gardée en mémoire par adresse : la grille, refaite à chaque page, la reprend avant affichage.',
        'Hôte d\'une nouvelle source : à ajouter à HOTES_RECADRAGE (store.js), sinon vignette brute.'] } },
  en: { par: 'by', virgule: '.', titre: 'Model library', onglets: ['Sketchfab', 'Poly Haven', 'My models'],
    recherche: 'Search for a model', filtres: ['All categories', 'All licences', 'Relevance'], importer: 'Import a model',
    credit: 'Models from Sketchfab — licence and author on each page', bandeau: 'Application header',
    fenetre: ['A window of its own, opened by its header button', 'One tab per source, then “My …”', 'Filters and search (the page reloads)',
      'The “Import” card first, as tall as the others', 'The source credit, clickable, below the grid', 'Next page requested near the bottom'],
    carteNotes: ['3:2 recomposed thumbnail (subject + margin)', 'Name, then “by author”', 'Licence (and category) in orange, weight', 'Owned: a chip and a dimmed thumbnail', 'Never any tags on a card'],
    fiche: { voir3d: 'View in 3D', voirSur: 'View on Poly Haven', sections: ['Used in this project', 'Licence', 'Characteristics'],
      lignes: [['Used nowhere in this Project.'], ['Public domain (CC0): no attribution required.', 'CC0 1.0'], ['Materials: Wood, Parquet', 'Real size: 2 × 2 m', 'Weight: 9.1 MB']],
      retour: 'Back', telecharger: 'Download 1K', supprimer: 'Delete',
      notes: ['The visual, then its buttons (no text under them)', 'The sections, always in this order', 'Weight last', 'Back, then the action: Download (split button) or Delete once owned'] },
    vig: { etapes: ['1. The source thumbnail (512 px)', '2. The subject, found by its edges', '3. Recomposed in 3:2: margin, extended background'],
      regles: ['The original is never shown: the card stays empty, then the thumbnail fades in.',
        'Kept in memory by address: the grid, rebuilt on every page, reuses it before display.',
        'A new source\'s host goes in HOTES_RECADRAGE (store.js), or the thumbnail stays raw.'] } },
};

/** La fenêtre : bandeau, onglets, filtres, grille, crédit. */
function fenetre(t){
  const L = 930, H = 560;
  let s = rect(20, 16, 860, 34, C.papier, { trait: C.ligne }) + texte(34, 38, t.bandeau, { taille: 11, c: C.doux });
  s += [0, 1, 2].map(i => rect(700 + i * 40, 22, 28, 22, i === 2 ? C.orange : C.gris, { r: 6 })).join('') + repere(686, 33, 1);
  s += rect(20, 64, 700, 480, C.papier, { r: 10, trait: C.ligne }) + texte(370, 90, t.titre, { taille: 14, gras: true, ancre: 'middle' });
  t.onglets.forEach((o, i) => { s += rect(40 + i * 120, 104, 110, 26, i === 0 ? C.orange : C.creux, { r: 8 }) + texte(95 + i * 120, 121, o, { taille: 11, c: i === 0 ? '#1a1a1a' : C.encre, gras: i === 0, ancre: 'middle' }); });
  s += repere(408, 117, 2);
  s += rect(40, 140, 200, 26, C.creux, { r: 8 }) + texte(52, 157, t.recherche, { taille: 11, c: C.doux });
  t.filtres.forEach((f, i) => { s += rect(250 + i * 140, 140, 130, 26, C.creux, { r: 8 }) + texte(262 + i * 140, 157, f + ' ▾', { taille: 11 }); });
  s += repere(700, 153, 3);
  const l = 150;
  s += rect(40, 180, l, l * 2 / 3 + 62, C.creux, { r: 6, trait: C.ligne, pointille: true }) + texte(115, 245, '+', { taille: 28, c: C.doux, ancre: 'middle' }) + texte(115, 280, t.importer, { taille: 11, ancre: 'middle' });
  s += repere(40, 180, 4);
  for (let i = 1; i < 4; i++) s += carte(40 + i * 165, 180, l, t, { possedee: i === 2 });
  for (let i = 0; i < 4; i++) s += `<g opacity=".45">${rect(40 + i * 165, 352, l, 100, C.papier, { trait: C.ligne })}</g>`;
  s += rect(30, 470, 680, 30, 'url(#degrade)', { r: 0 });
  s += `<defs><linearGradient id="degrade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.papier}" stop-opacity="0"/><stop offset="1" stop-color="${C.papier}"/></linearGradient></defs>`;
  s += repere(690, 452, 6);
  s += texte(370, 525, t.credit, { taille: 11, c: C.doux, ancre: 'middle' }) + `<line x1="270" y1="528" x2="470" y2="528" stroke="${C.doux}" stroke-width=".6"/>` + repere(510, 521, 5);
  t.fenetre.forEach((n, i) => { s += repere(744, 110 + i * 46, i + 1) + `<foreignObject x="758" y="${100 + i * 46}" width="165" height="44"><div xmlns="http://www.w3.org/1999/xhtml" style="font:11px Inter,Segoe UI,Arial,sans-serif;color:${C.encre};line-height:1.3">${esc(n)}</div></foreignObject>`; });
  return svg(L, H, s);
}

/** Une carte, agrandie, et ses repères. */
function anatomie(t){
  const L = 720, H = 330, l = 260, h = l * 2 / 3;
  let s = carte(30, 30, l, t) + carte(320, 30, 150, t, { possedee: true, nom: 'Wooden Chair' });
  s += repere(30 + l - 4, 34, 1) + repere(30 + l - 4, 30 + h + 14, 2) + repere(30 + l - 4, 30 + h + 48, 3) + repere(470, 34, 4);
  t.carteNotes.forEach((n, i) => { s += repere(500, 60 + i * 50, i + 1) + texte(516, 64 + i * 50, n, { taille: 11 }); });
  return svg(L, H, s);
}

/** La fiche : deux colonnes, l'ordre des sections, le pied. */
function fiche(t){
  const L = 900, H = 470, f = t.fiche;
  let s = rect(20, 20, 640, 430, C.papier, { r: 10, trait: C.ligne });
  s += texte(40, 52, 'Oak Floor', { taille: 18, gras: true });
  // Une texture se montre sur une sphère (ou à plat) : des lames de parquet sur un disque.
  s += rect(40, 68, 280, 230, '#3a3530', { r: 4 }) + `<clipPath id="boule"><circle cx="180" cy="183" r="92"/></clipPath><g clip-path="url(#boule)">${[0, 1, 2, 3, 4, 5, 6].map(i => rect(80 + i * 29, 80, 27, 210, i % 2 ? '#a06a3c' : '#b67d4a', { r: 1 })).join('')}</g><circle cx="150" cy="150" r="92" fill="url(#reflet)"/><defs><radialGradient id="reflet" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>`.replace('cx="150" cy="150"', 'cx="180" cy="183"');
  s += rect(40, 310, 120, 28, C.gris, { r: 8 }) + texte(100, 328, f.voir3d, { taille: 11, ancre: 'middle' });
  s += rect(168, 310, 152, 28, C.gris, { r: 8 }) + texte(244, 328, f.voirSur, { taille: 11, ancre: 'middle' });
  s += repere(330, 324, 1);
  let y = 68;
  f.sections.forEach((titre, i) => {
    const lignes = f.lignes[i], hs = 34 + lignes.length * 17;
    s += rect(340, y, 300, hs, C.creux, { r: 8 }) + `<circle cx="354" cy="${y + 16}" r="3" fill="${C.orange}"/>` + texte(364, y + 20, titre.toUpperCase(), { taille: 10, c: C.doux, gras: true });
    lignes.forEach((ln, k) => { s += texte(354, y + 40 + k * 17, ln, { taille: 11, c: k === 1 && i === 1 ? C.orange : C.encre }); });
    y += hs + 10;
  });
  s += repere(650, 78, 2) + repere(650, y - 26, 3);
  s += `<line x1="40" y1="390" x2="640" y2="390" stroke="${C.ligne}"/>`;
  s += rect(380, 404, 80, 30, C.gris, { r: 8 }) + texte(420, 423, f.retour, { taille: 11, ancre: 'middle' });
  s += rect(470, 404, 140, 30, C.orange, { r: 8 }) + texte(530, 423, f.telecharger, { taille: 11, c: '#1a1a1a', gras: true, ancre: 'middle' })
    + `<line x1="590" y1="408" x2="590" y2="430" stroke="#1a1a1a" stroke-opacity=".4"/>` + texte(600, 423, '▾', { taille: 11, c: '#1a1a1a', ancre: 'middle' });
  s += repere(620, 404, 4);
  f.notes.forEach((n, i) => { s += repere(686, 90 + i * 70, i + 1) + `<foreignObject x="700" y="${80 + i * 70}" width="190" height="64"><div xmlns="http://www.w3.org/1999/xhtml" style="font:11px Inter,Segoe UI,Arial,sans-serif;color:${C.encre};line-height:1.35">${esc(n)}</div></foreignObject>`; });
  return svg(L, H, s);
}

/** Le recadrage d'une vignette, et ce qui évite le clignotement. */
function recadrage(t){
  const L = 900, H = 360, v = t.vig;
  let s = '';
  // 1. La vignette d'origine : un petit sujet dans un grand fond.
  s += rect(30, 40, 200, 200, '#cfd2d6', { r: 4 }) + rect(112, 120, 36, 64, C.sujet, { r: 2 });
  s += texte(30, 30, v.etapes[0], { taille: 11, gras: true });
  // 2. La boîte du sujet.
  s += rect(300, 40, 200, 200, '#cfd2d6', { r: 4 }) + rect(382, 120, 36, 64, C.sujet, { r: 2 }) + rect(378, 116, 44, 72, 'none', { r: 0, trait: C.repere, pointille: true });
  s += texte(300, 30, v.etapes[1], { taille: 11, gras: true });
  // 3. Recomposée en 3:2.
  s += rect(570, 60, 300, 200, '#cfd2d6', { r: 4 }) + rect(675, 80, 90, 160, C.sujet, { r: 3 })   /* 36 × 64 agrandi : mêmes proportions */;
  s += `<line x1="570" y1="80" x2="870" y2="80" stroke="${C.repere}" stroke-dasharray="3 3"/><line x1="570" y1="240" x2="870" y2="240" stroke="${C.repere}" stroke-dasharray="3 3"/>`;
  s += texte(574, 76, 'marge', { taille: 9, c: C.repere }).replace('marge', t === TEXTES.en ? 'margin' : 'marge');
  s += texte(570, 30, v.etapes[2], { taille: 11, gras: true });
  s += fleche(238, 140, 292, 140) + fleche(508, 140, 562, 150);
  v.regles.forEach((r, i) => { s += repere(40, 290 + i * 24, '•') + texte(56, 294 + i * 24, r, { taille: 11 }); });
  return svg(L, H, s);
}

const FIGURES = { fenetre, carte: anatomie, fiche, vignette: recadrage };

export function figures(){
  const sortie = {};
  for (const [langue, t] of Object.entries(TEXTES)) for (const [nom, f] of Object.entries(FIGURES)) sortie[`${nom}.${langue}.svg`] = f(t);
  return sortie;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(SORTIE, { recursive: true });
  for (const [nom, contenu] of Object.entries(figures())) writeFileSync(join(SORTIE, nom), contenu);
  console.log(`${Object.keys(FIGURES).length * 2} maquettes écrites.`);
}
