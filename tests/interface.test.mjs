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
    assert.match(regle('.batiment-boutons-pile'), /gap:\s*6px/);
    assert.match(regle('.batiment-boutons-pile > button'), /margin:\s*0/, 'la marge propre du bouton doublerait l\'écart');
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
