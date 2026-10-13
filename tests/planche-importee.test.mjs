/**
 * tests/planche-importee.test.mjs : les Planches importées (demandé le 12 octobre 2026), la partie
 * pure. Détection des Cases sur des planches synthétiques, cadrage de l'ensemble, placement des
 * Cases, champs persistés.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  detecterCases, niveauxDeGris, poseDeLImage, ancrageApresGlisserPlanche,
  placerCasesImportees, creerPlancheImportee, estPlancheImportee, estCaseImportee, imageDeLaPlanche,
  cadrageLu, cadragePlancheParDefaut, recentrerPlanche, regionValide, ordreDeLecture, retoucherRegion, regionTracee, REGION_MIN,
} from '../src/planche-importee.js';

/** Une planche synthétique : fond `fond`, des Cases (rectangles en pixels) bordées de noir, remplies de `dedans`. */
function planche(w, h, cases, { fond = 255, dedans = 200, bord = 3, motif = false } = {}){
  const g = new Uint8Array(w * h).fill(fond);
  for (const [x0, y0, cw, ch] of cases) {
    for (let y = y0; y < y0 + ch; y++) {
      for (let x = x0; x < x0 + cw; x++) {
        const surBord = x < x0 + bord || x >= x0 + cw - bord || y < y0 + bord || y >= y0 + ch - bord;
        g[y * w + x] = surBord ? 0 : (motif && (x + y) % 7 === 0 ? 30 : dedans);
      }
    }
  }
  return g;
}
const enPixels = (r, w, h) => [Math.round(r.x * w), Math.round(r.y * h), Math.round(r.w * w), Math.round(r.h * h)];

describe('La détection des Cases', () => {
  const W = 600, H = 800;
  // Trois bandes : 2 Cases, 1 Case large, 3 Cases. Marges de 30 px, gouttières de 12 px.
  const CASES = [
    [30, 30, 264, 230], [306, 30, 264, 230],
    [30, 272, 540, 220],
    [30, 504, 172, 266], [214, 504, 172, 266], [398, 504, 172, 266],
  ];

  test('une grille classique : six Cases, dans l\'ordre de lecture, à leur place', () => {
    const r = detecterCases(planche(W, H, CASES, { motif: true }), W, H);
    assert.equal(r.length, 6);
    r.forEach((c, i) => assert.deepEqual(enPixels(c, W, H), CASES[i], `Case ${i + 1}`));
  });

  test('une capture d\'écran : son cadre sombre n\'est pas pris pour le papier (planches réelles, 13 octobre 2026)', () => {
    const g = planche(W, H, CASES);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 20 || x >= W - 20 || y < 15 || y >= H - 15) g[y * W + x] = 25;
    assert.equal(detecterCases(g, W, H).length, 6);
  });

  test('un manga : l\'intérieur blanc d\'une Case, enfermé par son cadre, reste à la Case', () => {
    const g = planche(W, H, CASES, { dedans: 255 });
    const r = detecterCases(g, W, H);
    assert.equal(r.length, 6);
    r.forEach((c, i) => assert.deepEqual(enPixels(c, W, H), CASES[i]));
  });

  test('deux Cases JOINTIVES d\'un fond perdu, séparées par leur seul trait encré', () => {
    // Une page sans gouttière : deux aplats différents, un trait noir de 3 px entre eux.
    const g = new Uint8Array(W * H).fill(255);
    for (let y = 30; y < 770; y++) for (let x = 30; x < 570; x++) g[y * W + x] = y < 398 ? 120 : (y < 401 ? 10 : 170);
    const r = detecterCases(g, W, H);
    assert.equal(r.length, 2);
    assert.ok(Math.abs(r[0].y + r[0].h - 398 / H) < 0.01);
  });

  test('un peu de poussière dans une gouttière ne la bouche pas', () => {
    const g = planche(W, H, CASES);
    g[266 * W + 100] = 0; g[266 * W + 400] = 0;   // deux points dans la gouttière horizontale
    assert.equal(detecterCases(g, W, H).length, 6);
  });

  test('une bulle qui enjambe une gouttière ne soude plus les deux Cases (planches réelles, 13 octobre 2026)', () => {
    // La gouttière reste du « papier du dehors » de part et d'autre de la bulle : la boîte soudée est recoupée.
    const g = planche(W, H, CASES);
    for (let y = 200; y < 300; y++) for (let x = 250; x < 350; x++) g[y * W + x] = 0;
    assert.equal(detecterCases(g, W, H).length, 6);
  });

  test('les petits restes (numéro de page, signature) ne deviennent pas des Cases', () => {
    const g = planche(W, H, CASES);
    for (let y = 780; y < 790; y++) for (let x = 295; x < 305; x++) g[y * W + x] = 0;
    assert.equal(detecterCases(g, W, H).length, 6);
  });

  test('une image sans gouttière : une seule Case ; une image vide : aucune', () => {
    assert.equal(detecterCases(planche(W, H, [[30, 30, 540, 740]]), W, H).length, 1);
    assert.deepEqual(detecterCases(new Uint8Array(W * H).fill(255), W, H), []);
    assert.deepEqual(detecterCases(null, W, H), []);
  });

  test('la tolérance : un intérieur proche du fond se confond avec lui si on l\'élargit', () => {
    const g = planche(W, H, CASES, { dedans: 230, bord: 0 });
    assert.equal(detecterCases(g, W, H, { tolerance: 10 }).length, 6);
    assert.equal(detecterCases(g, W, H, { tolerance: 40 }).length, 0);
  });

  test('niveaux de gris : la luminance, et la transparence vaut du papier blanc', () => {
    const g = niveauxDeGris(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 255]), 3, 1);
    assert.deepEqual([...g], [76, 255, 0]);
  });
});

describe('Le cadrage de l\'ensemble', () => {
  test('à 1×, l\'image est ENTIÈRE et centrée (contenir, pas couvrir)', () => {
    // Une planche US (170×260) dans un Tome franco-belge (550×725 unités).
    const p = poseDeLImage(550, 725, 1700, 2600, {});
    assert.ok(Math.abs(p.h - 725) < 1e-9, 'la hauteur remplit');
    assert.ok(p.w < 550 && Math.abs(p.x - (550 - p.w) / 2) < 1e-9, 'centrée en largeur');
  });

  test('zoom et ancrage : bornés, absents = défaut', () => {
    assert.deepEqual(cadrageLu({}), { ancrage: { x: 0.5, y: 0.5 }, zoom: 1 });
    assert.deepEqual(cadrageLu({ imageAnchorX: 7, imageAnchorY: null, imageZoom: 0.2 }), { ancrage: { x: 1, y: 0.5 }, zoom: 1 });
    assert.equal(cadrageLu({ imageZoom: 9 }).zoom, 4);
  });

  test('glisser : le jeu se lit dans les deux sens, un axe sans jeu ne bouge pas', () => {
    const pose = poseDeLImage(500, 500, 1000, 1000, { imageZoom: 2 });   // 1000×1000, déborde de 500
    const a = ancrageApresGlisserPlanche({ x: 0.5, y: 0.5 }, { x: 100, y: 0 }, 500, 500, pose);
    assert.ok(Math.abs(a.x - 0.3) < 1e-9, 'tirer vers la droite prend plus à gauche');
    const plat = poseDeLImage(500, 500, 1000, 1000, {});                // tombe juste
    assert.deepEqual(ancrageApresGlisserPlanche({ x: 0.5, y: 0.5 }, { x: 100, y: 100 }, 500, 500, plat), { x: 0.5, y: 0.5 });
  });

  test('recentrer SUPPRIME les champs', () => {
    const i = { largeur: 10, hauteur: 10, imageAnchorX: 0.2, imageZoom: 2 };
    assert.equal(cadragePlancheParDefaut(i), false);
    assert.equal(recentrerPlanche(i), true);
    assert.deepEqual(i, { largeur: 10, hauteur: 10 });
    assert.equal(recentrerPlanche(i), false);
  });
});

describe('La Planche importée et ses Cases', () => {
  let n = 0;
  const newId = (p = 'o') => `${p}${++n}`;
  const pd = creerPlancheImportee({ nomImage: 'planche.png', largeur: 1000, hauteur: 2000,
    regions: [{ x: 0.1, y: 0.1, w: 0.8, h: 0.4 }, { x: 0.1, y: 0.55, w: 0.8, h: 0.35 }, { x: 'x' }], newId });

  test('la forme persistée : l\'image sur les Cases, les dimensions sur la Planche', () => {
    assert.deepEqual(pd.importee, { largeur: 1000, hauteur: 2000 });
    assert.equal(pd.objects.length, 2, 'une région illisible est écartée');
    assert.deepEqual(pd.objects.map(o => [o.type, o.caseNumber, o.imageFile]), [['panel', 1, 'planche.png'], ['panel', 2, 'planche.png']]);
    assert.ok(estPlancheImportee(pd) && pd.objects.every(estCaseImportee));
    assert.equal(imageDeLaPlanche(pd), 'planche.png');
    assert.equal(estCaseImportee({ type: 'panel' }), false);
    assert.equal(regionValide({ x: 0, y: 0, w: 0, h: 1 }), null);
  });

  test('aucune région validée : une seule Case, l\'image entière', () => {
    const p = creerPlancheImportee({ nomImage: 'a.png', largeur: 10, hauteur: 10, regions: [], newId });
    assert.deepEqual(p.objects.map(o => o.regionImage), [{ x: 0, y: 0, w: 1, h: 1 }]);
  });

  test('les Cases se posent d\'après leur région et le cadrage, et le suivent', () => {
    const vue = { w: 500, h: 1000, importee: pd.importee, objects: pd.objects };
    placerCasesImportees(vue);
    const c = pd.objects[0];
    assert.deepEqual([c.x, c.y, c.w, c.h], [50, 100, 400, 400]);
    assert.deepEqual(c.pts[2], { x: 450, y: 500 });
    pd.importee.imageZoom = 2; pd.importee.imageAnchorX = 0;
    placerCasesImportees(vue);
    assert.deepEqual([c.x, c.w], [100, 800], 'zoomée et collée à gauche');
    assert.equal(placerCasesImportees({ w: 1, h: 1, objects: [] }), null);
  });
});


describe('La vérification : retouches et ordre de lecture', () => {
  test('l\'ordre de lecture : par rangées, puis de gauche à droite', () => {
    const r = ordreDeLecture([
      { x: 0.55, y: 0.52, w: 0.4, h: 0.4 }, { x: 0.05, y: 0.05, w: 0.9, h: 0.4 },
      { x: 0.05, y: 0.5, w: 0.45, h: 0.45 },
    ]);
    assert.deepEqual(r.map(x => x.x), [0.05, 0.05, 0.55]);
  });

  test('déplacer reste dans l\'image ; un coin garde une taille minimale', () => {
    assert.deepEqual(retoucherRegion({ x: 0.5, y: 0.5, w: 0.4, h: 0.4 }, 'deplacer', 0.5, -0.9), { x: 0.6, y: 0, w: 0.4, h: 0.4 });
    const r = retoucherRegion({ x: 0.2, y: 0.2, w: 0.3, h: 0.3 }, 'se', -0.5, -0.5);
    assert.ok(Math.abs(r.w - REGION_MIN) < 1e-9 && Math.abs(r.h - REGION_MIN) < 1e-9);
    const nw = retoucherRegion({ x: 0.2, y: 0.2, w: 0.3, h: 0.3 }, 'nw', -0.1, -0.1);
    assert.ok(Math.abs(nw.x - 0.1) < 1e-9 && Math.abs(nw.w - 0.4) < 1e-9);
  });

  test('tracer : dans n\'importe quel sens, rogné à l\'image, refusé s\'il est trop petit', () => {
    assert.deepEqual(regionTracee({ x: 0.6, y: 0.8 }, { x: 0.2, y: 1.3 }), { x: 0.2, y: 0.8, w: 0.39999999999999997, h: 0.19999999999999996 });
    assert.equal(regionTracee({ x: 0.5, y: 0.5 }, { x: 0.505, y: 0.6 }), null);
  });
});

describe('Le câblage (inspecté : le DOM et le dessin sont hors de portée)', () => {
  const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const EV = lire('src/events.js'), DRAW = lire('src/draw.js'), SIDE = lire('src/sidebar.js');

  test('sur une Planche importée, le clic gauche est pris AVANT tout outil d\'édition', () => {
    const garde = EV.indexOf('if (e.button === 0 && estPlancheImportee(page)) {');
    assert.ok(garde > 0, 'la garde du clic gauche a disparu');
    assert.ok(garde < EV.indexOf('// ---- Measure tool: left-click = place a point ----'));
    assert.ok(garde < EV.indexOf("S.dragMode = 'panelCorner'"), 'une poignée pourrait encore redimensionner une Case importée');
    assert.match(EV, /if \(estPlancheImportee\(page\)\) \{ hideContextMenu\(\); return; \}/, 'le menu contextuel s\'ouvre encore');
    assert.match(EV, /if \(estCaseImportee\(deleted\)\) return;/, 'Suppr supprime encore une Case importée');
    assert.match(EV, /if \(estCaseImportee\(panel\)\) return;/, 'C allume encore le mode Caméra');
  });

  test('le dessin : l\'image sous tout le reste, rien pour la Case, les vues fusionnées la portent', () => {
    const i = DRAW.indexOf('if (estPlancheImportee(page)) dessinerImageDePlanche(c, page);');
    assert.ok(i > 0 && i < DRAW.indexOf("page.objects.forEach(o => {\n    // A WallOpening"), 'l\'image doit passer avant les objets');
    assert.match(DRAW, /if \(estCaseImportee\(o\)\) \{\n {8}if \(exportBadges\) drawPanelNumberBadge\(c, o\);\n {8}return;/);
    assert.equal((DRAW.match(/importee: pd\.importee/g) || []).length, 2, 'l\'export et le Lecteur doivent voir la Planche importée');
    assert.match(lire('src/state.js'), /importee: p\.importee/);
  });

  test('les menus : une Case importée n\'a que Dimensions et Description ; la Planche a son cadrage', () => {
    assert.match(SIDE, /if \(estCaseImportee\(sel\)\) \{/);
    assert.match(SIDE, /if \(estPlancheImportee\(page\)\) \{\n {8}const z = cadrageLu\(page\.importee\)\.zoom;/);
    assert.match(lire('src/index.html'), /<button id="ctxImportPageCanvas">/);
  });

  test('une Case importée n\'est pas une « Case à image » pour les menus, mais son image est comptée', async () => {
    const { casePorteUneImage3D, imageDeLaCase3D } = await import('../src/image-store.js');
    const c = { type: 'panel', imageFile: 'p.png', regionImage: { x: 0, y: 0, w: 1, h: 1 } };
    assert.equal(casePorteUneImage3D(c), false);
    assert.equal(imageDeLaCase3D(c), 'p.png');
  });
});

describe('L\'entrée « Importer une planche »', () => {
  test('SEULEMENT au clic droit dans le vide de la Planche, sous « Créer une case » et « Créer une bulle » (demandé)', () => {
    const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    const html = lire('src/index.html'), ev = lire('src/events.js');
    const menu = (id) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('</div>', html.indexOf(`id="${id}"`)));
    assert.doesNotMatch(menu('pageContextMenu'), /Import/, 'retirée du menu de gauche (demandé)');
    assert.match(menu('dblclickChoiceMenu'), /id="ctxCreatePanel"[\s\S]*id="ctxCreateBubble"[\s\S]*id="ctxImportPageCanvas"/);
    assert.equal((html.match(/Importer une planche<\/button>/g) || []).length, 1, 'une seule entrée');
    assert.match(ev, /getElementById\('ctxImportPageCanvas'\)\.onclick[\s\S]{0,200}ouvrirImportPlanche\(S\.currentTomeIndex, S\.currentPageIndex\)/);
  });
});

describe('La correction des Cases, sur la Planche (demandé le 13 octobre 2026)', () => {
  const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  test('plus de modale ; le geste passe par l\'édition avant le cadrage, et le menu Planche y ramène', () => {
    const html = lire('src/index.html'), ev = lire('src/events.js');
    assert.doesNotMatch(html, /id="importPlancheModal"/);
    assert.match(html, /id="sidePageEditionSection"[\s\S]{0,900}id="sidePageEditionBtn"/);
    const i = ev.indexOf('if (debutGesteEdition({ x, y }))');
    assert.ok(i > 0 && i < ev.indexOf("S.dragMode = 'plancheCadrage'; S.dragStart = { x, y };"), 'l\'édition doit passer avant le cadrage');
    assert.match(ev, /if \(editionDesCasesActive\(\)\) sortirEditionDesCases\(\); else entrerEditionDesCases\(\);/);
    assert.match(lire('src/import-planche-ui.js'), /await preloadImagesFor\(pd\.objects\);\n {2}\/\/ Elle s'ouvre directement en correction des Cases\.\n {2}entrerEditionDesCases\(\);/);
  });
});

describe('Retours du 13 octobre 2026 sur la Planche importée', () => {
  const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  test('plus de sensibilité : la correction suffit', () => {
    assert.doesNotMatch(lire('src/index.html'), /sidePageToleranceInput/);
    assert.doesNotMatch(lire('src/import-planche-ui.js'), /redetecter/);
  });
  test('le clic droit maintenu cadre la Planche, et les bordures s\'effacent pendant le geste', () => {
    const ev = lire('src/events.js');
    const i = ev.indexOf("if (estPlancheImportee(_pgImp)) {");
    assert.ok(i > 0 && i < ev.indexOf('S.isPanning = true; S.panMoved = false;'), 'le clic droit doit être pris avant le défilement');
    assert.match(lire('src/draw.js'), /S\.dragMode !== 'plancheCadrage'\n {4}&& \(editionDesCasesActive\(\) \|\| caseEnSurbrillance\(\)\)/);
  });
  test('menu Planche : surbrillance au clic, réordonner en glissant, champ au style des autres', () => {
    const side = lire('src/sidebar.js');
    assert.match(side, /row\.draggable = !dansLeChamp;/, 'la ligne entière se glisse, sauf depuis le champ');
    assert.match(side, /mettreEnSurbrillance\(deja \? null : p\.id\);/, 'un second clic désélectionne');
    assert.match(side, /setPanelNumber\(page, glissee, vers \+ 1\);/);
    assert.match(side, /saisie\.className = 'side-desc-input planche-case-saisie';/);
    assert.match(side, /sidePagePanels\.dataset\.signature === signature/, 'la liste ne doit pas se refaire à chaque clic');
  });
});

describe('Retours suivants (13 octobre 2026) : correction', () => {
  const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  test('une Case se crée au clic droit sans glisser, et seulement ainsi', () => {
    const ui = lire('src/import-planche-ui.js'), ev = lire('src/events.js');
    assert.doesNotMatch(ui, /trace: true/, 'le bouton gauche ne trace plus');
    assert.match(ev, /if \(S\.dragMode === 'plancheCadrage' && S\.dragOrig && S\.dragOrig\.creerCase && !S\.dragOrig\.bouge\) creerCaseAuPoint\(S\.dragStart\);/);
    assert.match(ev, /creerCase: editionDesCasesActive\(\)/);
  });
  test('quitter la correction ne laisse rien de sélectionné ; cliquer hors des Cases désélectionne', () => {
    const ui = lire('src/import-planche-ui.js');
    assert.match(ui, /edition = null;\n {2}surbrillance = null;\n {2}S\.selectedId = null;/);
    assert.match(ui, /edition\.sel = null;\n {4}surbrillance = null;/);
  });
  test('un seul trait de 1,5 (comme une sélection), tirets orange, blanc, noir en alternance', () => {
    const d = lire('src/draw.js');
    assert.match(d, /c\.lineCap = 'butt'; c\.lineWidth = 1\.5;/);
    assert.match(d, /\[SIGNAL_SELECTION, '#fff', '#000'\]\.forEach\(\(couleur, k\) => \{\n {6}c\.lineDashOffset = -k \* \(TIRET \+ ESPACE\);/);
  });
  test('un clic hors de la Planche quitte la correction ; l\'aide a une commande par ligne', () => {
    assert.match(lire('src/events.js'), /if \(e\.target === canvas\) return;\n[^\n]*\n {2}if \(editionDesCasesActive\(\)\) sortirEditionDesCases\(\);/);
    assert.match(lire('src/style.css'), /#sidePageEditionHint\{ white-space:pre-line;/);
  });
});

describe('Une planche qui n\'a pas le format du Tome', () => {
  const tome = { w: 550, h: 725, pages: [] };
  test('les proportions proches suffisent ; sinon un format à la hauteur du Tome', async () => {
    const { formatPourLaPlanche } = await import('../src/planche-importee.js');
    assert.equal(formatPourLaPlanche(tome, 1100, 1460), null, '1 % d\'écart');
    assert.deepEqual(formatPourLaPlanche(tome, 2000, 1400), { w: 1036, h: 725 }, 'une double page');
  });
  test('le Tome s\'adapte seulement si ses autres Planches sont vides ou importées', async () => {
    const { tomeAdaptable } = await import('../src/planche-importee.js');
    const imp = { id: 'p1', importee: { largeur: 1, hauteur: 1 }, objects: [] };
    assert.equal(tomeAdaptable({ pages: [imp, { id: 'p2', objects: [] }] }, 'p1'), true);
    assert.equal(tomeAdaptable({ pages: [imp, { id: 'p2', objects: [{ type: 'panel' }] }] }, 'p1'), false);
  });
  test('la question est posée à l\'import, avant la correction', () => {
    const ui = readFileSync(new URL('../src/import-planche-ui.js', import.meta.url), 'utf8');
    assert.match(ui, /await proposerUnFormat\(t, pd\);\n {2}await preloadImagesFor/);
    assert.match(readFileSync(new URL('../src/events.js', import.meta.url), 'utf8'), /confirmer: confirmAction \}\);/);
  });
});
