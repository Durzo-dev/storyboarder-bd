/**
 * tests/interface.test.mjs, les règles d'interface qui se vérifient (cf. docs/en/interface.md).
 *
 * Elles ont été posées une à une par l'utilisateur, sur captures, pendant l'éditeur de bâtiment
 * (#454). Rien ne les tenait en dehors de la mémoire de la conversation : une règle CSS réécrite
 * pour une autre raison, ou un message ajouté « pour aider », les aurait défaites sans un signal.
 * Ce qui n'est pas vérifiable (une icône lisible, un libellé clair) reste dans le document.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const CSS = lire('src/style.css');
const HTML = lire('src/index.html');
const EDITEUR = lire('src/batiment-editeur-ui.js');
const ICONES = lire('src/batiment-icones.js');

/** Le corps de la PREMIÈRE règle dont le sélecteur est exactement `selecteur`. */
function regle(selecteur){
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = CSS.match(new RegExp(`(^|\\n)${echappe}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `la règle « ${selecteur} » a disparu de style.css`);
  return m[2];
}
/** Le corps d'une fonction de l'éditeur, de sa déclaration à la suivante. */
function fonction(nom){
  const i = EDITEUR.indexOf(`function ${nom}(`);
  assert.ok(i >= 0, `la fonction ${nom} a disparu`);
  const j = EDITEUR.indexOf('\nfunction ', i + 1);
  return EDITEUR.slice(i, j > 0 ? j : undefined);
}

describe('les quatre écarts', () => {
  test('14 px entre deux sections', () => {
    assert.match(regle('.side-section'), /margin-bottom:\s*14px/);
  });
  test('10 px entre deux sous-sections, 8 px entre leurs rangées', () => {
    const r = regle('.batiment-sous-section');
    assert.match(r, /margin:\s*0 0 10px/);
    assert.match(r, /gap:\s*8px/);
  });
  test('dans une sous-section, seul le gap espace : les marges propres des rangées sont à zéro', () => {
    assert.match(CSS, /\.batiment-sous-section > \.choix, \.batiment-sous-section > \.batiment-case,\s*\n\.batiment-sous-section > \.batiment-champ\{ margin:0; \}/);
  });
  test('6 px entre deux boutons, voisins ou empilés', () => {
    assert.match(regle('.batiment-boutons'), /gap:\s*6px/);
    assert.match(regle('.batiment-boutons-ligne'), /gap:6px/);
    assert.match(regle('.batiment-boutons-ligne > button'), /margin:0/, 'la marge propre du bouton doublerait l\'écart');
  });
});

describe('un seul menu, sans message d\'état', () => {
  test('RÉGRESSION : plus de ligne de statut dans le menu de l\'éditeur de bâtiment', () => {
    assert.ok(!HTML.includes('batimentStatut'), 'la ligne de statut est revenue dans index.html');
    assert.ok(!/\bstatut\(/.test(EDITEUR), 'un message d\'état est revenu dans l\'éditeur');
  });
  test('RÉGRESSION : pas de bouton « Fermer l\'outil »', () => {
    assert.ok(!HTML.includes('batimentFermerOutilBtn'));
  });
  test('RÉGRESSION : un mur et une pièce n\'ont pas de section à eux', () => {
    assert.ok(!HTML.includes('batimentSelectionMur'));
    assert.ok(!HTML.includes('batimentSelectionPiece'));
  });
  test('un échec d\'enregistrement ouvre une modale', () => {
    assert.match(fonction('enregistrer'), /_rappels\.alerter\(/);
  });
});

describe('Commandes : une action par ligne', () => {
  test('les lignes sont jointes par un seul retour, sans ligne vide', () => {
    const f = fonction('commandes');
    assert.match(f, /join\('\\n'\)/);
    assert.ok(!f.includes("join('\\n\\n')"), 'une ligne vide est revenue entre les actions');
  });
});

describe('icônes et infobulles', () => {
  test('une icône n\'a pas de libellé : son nom passe en infobulle et en aria-label', () => {
    const choix = EDITEUR.match(/if \(icone\) \{[^\n]*\n/g) || [];
    assert.ok(choix.length >= 2, 'les choix à pictogramme ont disparu');
    choix.forEach(l => {
      assert.match(l, /aria-label/);
      assert.ok(!/createElement\('span'\)/.test(l), 'un libellé est revenu sous l\'icône');
    });
  });
  test('RÉGRESSION : une infobulle ne dit jamais un déplacement (elle n\'est pas contextuelle)', () => {
    assert.ok(!/title\s*=[^;\n]*\.note\b/.test(EDITEUR), 'une infobulle affiche de nouveau la note de déplacement');
  });
  test('un choix impossible donne sa raison en infobulle', () => {
    assert.match(EDITEUR, /b\.title = essai && essai\.erreur \?/);
  });
  test('les icônes sont au trait, dans la couleur du bouton', () => {
    assert.match(ICONES, /stroke="currentColor"/);
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(ICONES), 'une couleur écrite en dur dans une icône ne suivrait pas le thème');
  });
});

describe('les boutons qui créent sont orange', () => {
  test('« Ajouter un étage » et « Dupliquer l\'étage » portent .full-btn', () => {
    const f = fonction('remplirNiveaux');
    assert.match(f, /ajouter\.className = 'full-btn'/);
    assert.match(f, /dupliquer\.className = 'full-btn'/);
  });
});

describe('#460i : l\'échelle typographique', () => {
  test('aucune taille de texte en pixels hors des jetons, sauf les exceptions voulues', () => {
    // Les exceptions : aperçus de polices (22, 24, 26, 34, 42), titre d'une fiche du store et
    // résultat de la Mesure (20), séparateur de liste (6), zone de clic du Lecteur (46).
    const EXCEPTIONS = new Set(['6', '20', '22', '24', '26', '34', '42', '46']);
    const tailles = [...(CSS + HTML).matchAll(/font-size:\s*([\d.]+)px/g)].map(m => m[1]);
    const hors = [...new Set(tailles.filter(t => !EXCEPTIONS.has(t)))];
    assert.deepEqual(hors, [], 'une taille hors échelle : utiliser --texte-micro, -capitales, -libelle, -courant, -titre-modale ou -titre');
  });
  test('les six jetons existent', () => {
    for (const j of ['micro', 'capitales', 'libelle', 'courant', 'titre-modale', 'titre']) assert.match(CSS, new RegExp(`--texte-${j}:`));
  });
});

describe('#460k : une seule famille d\'icônes au trait', () => {
  test('chaque entrée de menu contextuel porte une icône SVG, plus aucun emoji', () => {
    const icones = [...HTML.matchAll(/<span class="ctx-icon">([\s\S]*?)<\/span>/g)].map(m => m[1]);
    assert.ok(icones.length > 100, 'les icônes des menus contextuels ont disparu');
    const emojis = icones.filter(i => !/^<svg viewBox="0 0 24 24"/.test(i));
    assert.deepEqual(emojis, [], 'une entrée de menu est revenue à un caractère ou un emoji');
  });
  test('les boutons ronds du bandeau sont tous des icônes, aucun en lettres (Aa, ↺, ?)', () => {
    const bandeau = HTML.slice(HTML.indexOf('<header>'), HTML.indexOf('</header>'));
    const boutons = [...bandeau.matchAll(/<button class="help-round-btn[^"]*"[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1].trim());
    assert.ok(boutons.length >= 8);
    boutons.forEach(b => assert.match(b, /^<svg /, `un bouton du bandeau n'est pas une icône : ${b.slice(0, 20)}`));
  });
  test('l\'icône prend la couleur du libellé (trait de 2 en currentColor)', () => {
    assert.match(regle('.ctx-icon svg, svg.icone'), /stroke:currentColor; stroke-width:2;/);
  });
  test('chaque icône d\'un menu contextuel est l\'une de celles de src/icones.js (une seule source)', async () => {
    const { ICONES } = await import('../src/icones.js');
    const connues = new Set(Object.values(ICONES));
    const corps = [...HTML.matchAll(/<span class="ctx-icon"><svg viewBox="0 0 24 24" aria-hidden="true">([\s\S]*?)<\/svg>/g)].map(m => m[1]);
    assert.deepEqual([...new Set(corps.filter(c => !connues.has(c)))], [], 'une icône de menu dessinée hors de src/icones.js');
  });
});

describe('#460l : plus aucun emoji dans l\'interface', () => {
  // Les signes typographiques restent : ils s'affichent comme une lettre, dans la couleur du texte.
  const PERMIS = new Set(['✓', '✖', '⚠', '⛶', '⚙']);
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B05}-\u{2B07}\u{2B1B}]/gu;
  const sansCommentaires = (t) => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  test('ni dans index.html ni dans le code de src/ (hors commentaires)', async () => {
    const { readdirSync } = await import('node:fs');
    const fichiers = ['src/index.html', ...readdirSync(new URL('../src/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => `src/${f}`)];
    const trouves = fichiers.flatMap(f => [...new Set((sansCommentaires(lire(f)).match(EMOJI) || []).filter(c => !PERMIS.has(c)))].map(c => `${f} : ${c}`));
    assert.deepEqual(trouves, [], 'un emoji est revenu : utiliser une icône de src/icones.js, ou le texte seul dans une liste déroulante');
  });
  test('chaque type d\'Élément, de Tracé et chaque émotion a son icône', async () => {
    const { ICONES, ICONE_TYPE_OBJET, ICONE_TRACÉ, ICONE_EMOTION } = await import('../src/icones.js');
    const { EMOTIONS } = await import('../src/constants.js');
    for (const table of [ICONE_TYPE_OBJET, ICONE_TRACÉ, ICONE_EMOTION]) {
      Object.values(table).forEach(n => assert.ok(ICONES[n], `icône inconnue : ${n}`));
    }
    EMOTIONS.forEach(e => assert.ok(ICONE_EMOTION[e.key], `émotion sans visage : ${e.key}`));
  });
});

describe('#460j : trois rayons', () => {
  test('aucun rayon hors des jetons, sauf les formes (rond, carré) et les très petits éléments', () => {
    // Exceptions : 50 % (rond), 0 (carré voulu), 3 px (pastille de sol de 14 px, surlignage du Manuel).
    const EXCEPTIONS = new Set(['50%', '0', '3px']);
    const rayons = [...(CSS + HTML).matchAll(/border-radius:\s*([^;}"]+?)\s*[;}"]/g)].map(m => m[1]);
    const hors = [...new Set(rayons.filter(r => !EXCEPTIONS.has(r) && !/^var\(--rayon-(petit|moyen|grand|pilule)\)$/.test(r)))];
    assert.deepEqual(hors, [], 'un rayon hors échelle : utiliser --rayon-petit, -moyen, -grand ou -pilule');
  });
  test('les quatre jetons valent 6, 8, 10 px et la pilule', () => {
    assert.match(CSS, /--rayon-petit:6px;/);
    assert.match(CSS, /--rayon-moyen:8px;/);
    assert.match(CSS, /--rayon-grand:10px;/);
    assert.match(CSS, /--rayon-pilule:999px;/);
  });
});

describe('retours du 24 octobre', () => {
  test('les badges du store restent orange (exception voulue à #460b)', () => {
    assert.match(regle('.store-badge'), /background:var\(--accent-soft\); color:var\(--accent\);/);
  });
  test('l\'aperçu 3D de l\'éditeur de bâtiment s\'ouvre coupé au niveau courant', () => {
    assert.match(EDITEUR, /coupe: true,/);
    assert.match(EDITEUR, /\$\('batimentApercuCoupe'\)\.classList\.toggle\('actif', E\.coupe\);/);
  });
});

describe('les menus contextuels passent devant tout', () => {
  test('RÉGRESSION : un seul z-index pour tous les menus, au-dessus des éditeurs (900) et des modales (1000)', () => {
    assert.match(regle('.context-menu'), /z-index:1100;/);
    assert.ok(!/#\w+(ContextMenu|Menu)\{ z-index:/.test(CSS), 'un menu a de nouveau son z-index à lui');
  });
});

describe('éditeur de bâtiment : un étage sans pièce ne se duplique pas (demandé)', () => {
  test('le bouton s\'éteint et dit pourquoi ; le raccourci D est refusé aussi', () => {
    assert.match(fonction('remplirNiveaux'), /if \(!niveauAvecPieces\(\)\) \{\n\s+dupliquer\.disabled = true;\n\s+dupliquer\.title = tr\(/);
    assert.match(fonction('dupliquerLEtage'), /if \(!niveauAvecPieces\(\)\) return;/);
  });
});

describe('les Commandes en tête du menu de droite (demandé)', () => {
  test('le Lecteur : une section Commandes, la première, une action par ligne ; plus d’aide en bas', () => {
    const src = readFileSync(new URL('../src/lecteur-ui.js', import.meta.url), 'utf8');
    assert.match(src, /p\.replaceChildren\(\s*section\(tr\('Controls', 'Commandes'\), \[aide\]\),/);
    assert.match(src, /aide\.className = 'commandes-aide';/);
    assert.ok(!/aide\.className = 'side-hint'/.test(src));
  });
  test('l’éditeur de bâtiment : Commandes est la première section, au même style', () => {
    const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
    const panneau = html.slice(html.indexOf('id="batimentPanneau"'));
    assert.ok(panneau.indexOf('id="batimentSecCommandes"') < panneau.indexOf('<section', panneau.indexOf('id="batimentSecCommandes"') + 1));
    assert.ok(panneau.indexOf('id="batimentSecCommandes"') === panneau.indexOf('<section') + panneau.slice(panneau.indexOf('<section')).indexOf('id="batimentSecCommandes"'));
    assert.match(html, /<p id="batimentAide" class="commandes-aide"><\/p>/);
  });
});

describe('les Commandes, partout raccord (demandé)', () => {
  test('la correction des Cases d’une Planche importée : la section s’appelle Commandes, une action par ligne', () => {
    const src = readFileSync(new URL('../src/sidebar.js', import.meta.url), 'utf8');
    assert.match(src, /\? tr\('Controls', 'Commandes'\) : tr\('Detected panels', 'Cases détectées'\)/);
    assert.match(src, /aideEdition\.className = enEdition \? 'commandes-aide' : 'side-aide';/);
    assert.ok(!/• Tirer une Case/.test(src), 'plus de puces ni d’intro « Sur la Planche »');
  });
  test('l’Éditeur de modèle : une section Commandes, en tête de son menu', () => {
    const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
    const panneau = html.slice(html.indexOf('<aside class="persona-editor-panel">'));
    assert.ok(panneau.indexOf('id="personaEditorCommandesSection"') < panneau.indexOf('id="personaEditorModelSection"'));
    assert.match(html, /<p id="personaEditorAide" class="commandes-aide"><\/p>/);
    const src = readFileSync(new URL('../src/persona-editor.js', import.meta.url), 'utf8');
    assert.match(src, /export function drawPersonaEditor\(\)\{\s*const cnv[^\n]*\n[^\n]*\n\s*majCommandesDeLEditeur\(\);/);
  });
});
