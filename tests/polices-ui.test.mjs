/**
 * tests/polices-ui.test.mjs : les polices de l'utilisateur côté interface (#423) — ce qu'on dessine
 * pour un nom lu dans une Bulle, les variantes d'une police importée, les descripteurs FontFace —
 * et le câblage de la fenêtre des Polices (inspecté : le DOM et Electron sont hors de portée).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers/dom-stub.mjs';

const U = await import('../src/polices-utilisateur.js');
const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

describe('les décisions', () => {
  test('le nom à dessiner : renommages suivis, puis remplaçantes des intégrées retirées', () => {
    U.definirPolicesImportees({ familles: [{ nom: 'Komika 2', gras: 'vrai', italique: 'simule', fichiers: [] }], renommages: { Komika: 'Komika 2' } });
    assert.equal(U.policeADessiner('Komika'), 'Komika 2');
    assert.equal(U.policeADessiner('Kalam'), 'Shantell Sans');
    assert.equal(U.policeADessiner(undefined), 'Comic Neue');
    assert.equal(U.nomApresRenommages('A', { A: 'B', B: 'A' }), 'A', 'une boucle ne tourne pas sans fin');
  });

  test('les variantes d\'une police importée ; une inconnue est simulée', () => {
    U.definirPolicesImportees({ familles: [{ nom: 'Komika', gras: 'vrai', italique: 'simule', fichiers: [] }], renommages: {} });
    assert.deepEqual(U.variantesDeLaPolice('Komika'), { gras: 'vrai', italique: 'simule' });
    assert.deepEqual(U.variantesDeLaPolice('Comic Neue'), { gras: 'vrai', italique: 'vrai' });
    assert.deepEqual(U.variantesDeLaPolice('Disparue'), { gras: 'simule', italique: 'simule' });
  });

  test('une liste mal formée ne casse rien', () => {
    U.definirPolicesImportees(null);
    assert.deepEqual(U.policesImportees(), []);
    U.definirPolicesImportees({ familles: [null, { nom: 3 }, { nom: 'Ok', fichiers: [] }] });
    assert.deepEqual(U.policesImportees().map(f => f.nom), ['Ok']);
  });

  test('descripteurs FontFace : la plage d\'une variable, l\'italique déclaré', () => {
    assert.deepEqual(U.descripteursFontFace({ graisse: 700, italique: true }), { weight: '700', style: 'italic', display: 'block' });
    assert.deepEqual(U.descripteursFontFace({ graisse: 200, graisses: [200, 1000] }).weight, '200 1000');
  });

  test('les noms intégrés, que l\'import ne peut pas prendre', () => {
    assert.ok(U.NOMS_INTEGRES.includes('Bangers') && U.NOMS_INTEGRES.length === 10);
  });

  test('le détail montre tous les caractères (demandé)', () => {
    const tous = U.JEUX_DE_CARACTERES.map(j => j.texte).join('');
    for (const c of 'AZaz09éÉçœ«»!?') assert.ok(tous.includes(c), c);
  });
});

describe('le câblage', () => {
  const html = lire('src/index.html');
  const ui = lire('src/polices-ui.js');
  const ev = lire('src/events.js');

  test('le bouton « Aa » à droite de l\'Éditeur de modèle (demandé)', () => {
    const i = html.indexOf('id="openPoseEditorBtn"');
    const j = html.indexOf('id="policesOuvrirBtn"');
    assert.ok(i > 0 && j > i && j - i < 1200, 'le bouton des Polices doit suivre celui de l\'Éditeur');
    assert.match(ui, /\$\('policesOuvrirBtn'\)\.onclick/);
  });

  test('grille ou liste, retenue ; un clic ouvre la fiche, un clic droit le menu (importées seulement)', () => {
    assert.match(ui, /globalThis\.localStorage\.setItem\(CLE_VUE, v\)/);
    assert.match(ui, /c\.onclick = \(\) => ouvrirFiche\(p\);/);
    assert.match(ui, /if \(!p\.integree\) \{\n\s+c\.addEventListener\('contextmenu'/);
    assert.match(ev, /menuPolice: \(e, nom\) => openFontContextMenu\(e, nom\)/);
  });

  test('l\'ajout : depuis un fichier ; en ligne, annoncé mais pas encore là', () => {
    assert.match(ui, /\$\('policesAjoutFichier'\)\.onclick = ajouterDepuisFichiers;/);
    assert.match(html, /<button type="button" id="policesAjoutEnLigne" disabled/);
    assert.match(ui, /await pont\.pickFonts\(NOMS_INTEGRES\)/);
    assert.match(ui, /await pont\.commitFonts\(r\.jeton, choix, NOMS_INTEGRES\)/);
  });

  test('renommer et supprimer passent par le menu, puis rechargent et redessinent', () => {
    assert.match(ev, /openRenameEntityModal\('police', nom, nom, \{ pris, appliquer: \(nouveau\) => renommerPolice\(nom, nouveau\) \}\)/);
    assert.match(ev, /if \(nom\) supprimerPolice\(nom\);/);
    assert.match(ev, /chargerPolicesUtilisateur\(\)\.then\(\(\) => \{ updateSidePanel\(\); drawCurrentPage\(\); \}\)/);
  });

  test('les Bulles : la police dessinée et le groupe « Mes polices »', () => {
    assert.match(lire('src/draw.js'), /const fontFamily = policeADessiner\(o\.bulleFont\);/);
    assert.match(html, /<optgroup id="sideBubbleFontMesPolices" label="Mes polices" hidden><\/optgroup>/);
    assert.match(lire('src/sidebar.js'), /remplirMesPolicesDuSelecteur\(\);\n\s+sideBubbleFontSelect\.value = policeADessiner\(sel\.bulleFont\);/);
  });
});

describe('retours à l\'écran (12 octobre 2026)', () => {
  const html = lire('src/index.html');
  const ui = lire('src/polices-ui.js');

  test('la fenêtre s\'appelle « Mes polices », sans groupe vide ni message quand rien n\'est ajouté', () => {
    assert.match(html, /<h3 id="policesTitre">Mes polices<\/h3>/);
    assert.doesNotMatch(ui, /Aucune police ajoutée/);
    assert.match(ui, /const groupes = toutesImportees\.length;/);
  });

  test('le détail cache la barre, et « Retour » reste en bas, hors de la zone qui défile', () => {
    assert.match(ui, /\$\('policesBarre'\)\.hidden = true;\n\s+\$\('policesPied'\)\.hidden = false;/);
    const pied = html.indexOf('id="policesPied"');
    assert.ok(pied > html.indexOf('id="policesDefilement"') && html.slice(html.indexOf('id="policesDefilement"'), pied).includes('</div>\n    </div>'), 'le pied doit être hors de la zone qui défile');
    assert.match(html, /<button type="button" id="policesRetour" class="nav-btn">Retour<\/button>/);
  });

  test('plus de vide sous le libellé d\'un jeu de caractères', () => {
    assert.match(lire('src/style.css'), /\.police-jeu > \.police-info-cle\{ flex:none; \}/);
  });

  test('les usages d\'origine (revus par Valentin le 12 octobre 2026), et le filtre', () => {
    const o = U.usagesDOrigine('fr');
    const noms = (police) => o.usagesDesPolices[police].map(id => o.usages.find(u => u.id === id).nom);
    assert.deepEqual(o.usages.map(u => u.nom), ['Dialogue', 'Narration', 'Écrit à la main', 'Cris', 'Onomatopées', 'Robotique', 'Machine à écrire', 'Horreur']);
    const attendus = {
      'Comic Neue': ['Dialogue', 'Narration'], 'Shantell Sans': ['Écrit à la main'], Nunito: ['Narration'], Kanit: ['Cris'],
      Grandstander: ['Onomatopées'], Bangers: ['Onomatopées'], 'Chakra Petch': ['Robotique'], 'EB Garamond': ['Narration'],
      'Courier Prime': ['Machine à écrire'], Creepster: ['Horreur'],
    };
    for (const [police, u] of Object.entries(attendus)) assert.deepEqual(noms(police), u, police);
    assert.equal(U.usagesDOrigine('en').usages[0].nom, 'Dialogue');
    const polices = [{ nom: 'A' }, { nom: 'B' }, { nom: 'C' }];
    const attr = { A: ['u1'], B: ['u2'], C: ['u1', 'u3'] };
    assert.deepEqual(U.filtrerParUsages(polices, ['u1', 'u2'], attr).map(p => p.nom), ['A', 'B', 'C']);
    assert.deepEqual(U.filtrerParUsages(polices, ['u3'], attr).map(p => p.nom), ['C']);
    assert.equal(U.filtrerParUsages(polices, [], attr).length, 3);
  });

  test('les usages se gèrent comme les tags du store : la même liste', () => {
    assert.match(ui, /remplirListeEtiquettes\(menu, \{/);
    assert.match(lire('src/store-ui.js'), /remplirListeEtiquettes\(menu, \{/);
    assert.match(ui, /cocher: \(u, actif\) => operationUsage\('poser', \{ police: nom, id: u\.id, actif \}, langue\(\)\)/);
    assert.match(html, /id="policesUsagesBtn"/);
  });
});

describe('la phrase d\'exemple en liste (demandé)', () => {
  const ui = lire('src/polices-ui.js');
  test('un champ à côté du filtre, visible en liste seulement, partagé avec le détail', () => {
    const html = lire('src/index.html');
    assert.ok(html.indexOf('id="policesPhrase"') > html.indexOf('id="policesUsagesBtn"'));
    assert.match(ui, /champ\.hidden = vue\(\) !== 'liste';/);
    assert.match(ui, /\$\('policesPhrase'\)\.addEventListener\('input', majPhraseDExemple\);/);
    assert.match(ui, /texte: liste \? phraseDExemple\(\) : 'Aa'/);
    assert.match(ui, /essai\.value = phraseDExemple\(\);/);
  });
});

describe('la rangée d\'outils en liste (rendu cassé, signalé)', () => {
  const css = lire('src/style.css');
  test('le champ pèse plus que .modal-box input[type=text] : pas de largeur 100 % ni de marge basse', () => {
    assert.match(css, /\.modal-box \.polices-vue input\.polices-phrase\{ flex:1 1 auto; min-width:120px; width:auto; height:34px; margin:0 0 0 8px;/);
  });
  test('les boutons et le filtre gardent leur taille, alignés sur 34 px', () => {
    assert.match(css, /\.polices-vue > \*\{ flex:none; \}/);
    assert.match(css, /\.polices-vue \.polices-vue-btn\{ height:34px; width:34px; \}/);
    assert.match(css, /\.polices-vue\{ display:flex; gap:4px; align-items:center; flex:1 1 auto; min-width:0; \}/);
  });
});

describe('retouches du détail et des pastilles', () => {
  const css = lire('src/style.css');
  test('le nom de la police n\'hérite plus de la marge haute de .store-fiche h4', () => {
    assert.match(css, /\.store-fiche h4\.police-fiche-titre\{ font-size:34px; line-height:1\.15; margin:0 0 10px;/);
  });
  test('G et I centrés verticalement dans la vignette', () => {
    assert.match(css, /\.police-variantes\{ display:inline-flex; gap:3px; position:absolute; right:8px; top:50%; transform:translateY\(-50%\); \}/);
  });
});
