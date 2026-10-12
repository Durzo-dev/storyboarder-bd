/**
 * tests/store-polices.test.mjs : le store de polices (#423), source Fontsource. La traduction du
 * catalogue (licence, complétude), la recherche locale, le choix des fichiers à télécharger, et le
 * câblage de l'onglet « En ligne » (inspecté : le réseau et le DOM sont hors de portée).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const F = require('../electron/bibliotheque/store-fontsource.js');
const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const CATALOGUE = JSON.parse(lire('tests/fixtures/fontsource-catalogue.json'));

describe('le catalogue', () => {
  const liste = F.catalogueNormalise(CATALOGUE);

  test('une police : licence en clair, vrai gras, vrai italique, complète', () => {
    const cn = liste.find(p => p.id === 'comic-neue');
    assert.equal(cn.nom, 'Comic Neue');
    assert.equal(cn.licence, 'SIL Open Font License 1.1');
    assert.equal(cn.url, 'https://openfontlicense.org');
    assert.equal(cn.gras, 'vrai');
    assert.equal(cn.italique, 'vrai');
    assert.equal(cn.complete, true);
    assert.equal(cn.graisseNormale, 400);
    assert.equal(cn.graisseGrasse, 700);
    const bangers = liste.find(p => p.id === 'bangers');
    assert.equal(bangers.complete, false);
    assert.equal(bangers.gras, 'simule');
    const caveat = liste.find(p => p.id === 'caveat');
    assert.equal(caveat.gras, 'vrai', '600 et plus comptent comme un vrai gras');
    assert.equal(caveat.italique, 'simule');
  });

  test('sans sous-ensemble latin, ou mal formée : écartée ; trié par nom', () => {
    assert.equal(F.policeNormalisee({ id: 'x', family: 'X', subsets: ['arabic'], weights: [400] }), null);
    assert.equal(F.policeNormalisee({ id: 'x' }), null);
    assert.equal(F.policeNormalisee({ id: 'x', family: 'X', subsets: ['latin'], weights: [] }), null);
    const noms = liste.map(p => p.nom);
    assert.deepEqual(noms, [...noms].sort((a, b) => a.localeCompare(b, 'en')));
  });

  test('une licence inconnue s\'affiche telle quelle, sans lien', () => {
    const p = F.policeNormalisee({ id: 'x', family: 'X', subsets: ['latin'], weights: [400], license: 'Maison-1.0' });
    assert.equal(p.licence, 'Maison-1.0');
    assert.equal(p.url, null);
  });
});

describe('la recherche', () => {
  const liste = F.catalogueNormalise(CATALOGUE);
  test('texte (sans accents ni majuscules), catégorie, complètes seulement', () => {
    assert.deepEqual(F.pageLocale(liste, { texte: 'COMIC' }).resultats.map(p => p.id), ['comic-neue']);
    assert.ok(F.pageLocale(liste, { categorie: 'handwriting' }).resultats.every(p => p.categorie === 'handwriting'));
    const completes = F.pageLocale(liste, { completes: true }).resultats;
    assert.ok(completes.length >= 2 && completes.every(p => p.complete));
  });
  test('par pages, avec la suite', () => {
    const grand = Array.from({ length: 100 }, (_, i) => ({ ...liste[0], id: `p${i}`, nom: `P${String(i).padStart(3, '0')}` }));
    const p1 = F.pageLocale(grand, {});
    assert.equal(p1.resultats.length, F.PAR_PAGE);
    assert.equal(p1.suivant, F.PAR_PAGE);
    const p3 = F.pageLocale(grand, { curseur: 96 });
    assert.equal(p3.resultats.length, 4);
    assert.equal(p3.suivant, null);
    assert.equal(p1.total, 100);
  });
});

describe('les fichiers', () => {
  const liste = F.catalogueNormalise(CATALOGUE);
  test('complète : normal, gras, italique, gras italique, en latin woff2', () => {
    const f = F.fichiersATelecharger(liste.find(p => p.id === 'comic-neue'));
    assert.deepEqual(f.map(x => [x.graisse, x.italique]), [[400, false], [700, false], [400, true], [700, true]]);
    assert.equal(f[3].url, 'https://cdn.jsdelivr.net/fontsource/fonts/comic-neue@latest/latin-700-italic.woff2');
    assert.equal(f[0].fichier, 'comic-neue-latin-400-normal.woff2');
  });
  test('incomplète : seulement ce qui existe (le reste sera simulé)', () => {
    assert.deepEqual(F.fichiersATelecharger(liste.find(p => p.id === 'bangers')).map(x => [x.graisse, x.italique]), [[400, false]]);
  });
  test('l\'aperçu : la variante demandée si elle existe, sinon la normale', () => {
    const cn = liste.find(p => p.id === 'comic-neue');
    assert.match(F.fichierApercu(cn), /latin-400-normal\.woff2$/);
    assert.match(F.fichierApercu(cn, 700, true), /latin-700-italic\.woff2$/);
    assert.match(F.fichierApercu(liste.find(p => p.id === 'bangers'), 700, true), /latin-400-normal\.woff2$/);
  });
  test('la graisse normale et la grasse', () => {
    assert.equal(F.graisseNormale([300, 500]), 300);
    assert.equal(F.graisseGrasse([400, 600, 800]), 600);
    assert.equal(F.graisseGrasse([300, 400, 500]), null);
  });
});

describe('le câblage', () => {
  const main = lire('electron/main.js');
  const pre = lire('electron/preload.js');
  test('quatre canaux fontstore:*, la simulation comme le store de modèles', () => {
    for (const c of ['infos', 'chercher', 'apercu', 'ajouter']) {
      assert.match(main, new RegExp(`ipcMain\\.handle\\('fontstore:${c}'`));
      assert.match(pre, new RegExp(`ipcRenderer\\.invoke\\('fontstore:${c}'`));
    }
    assert.match(main, /storePolices\.chercher\(params, SIMULATION_STORE \? RACINE : null\)/);
  });
  test('un téléchargement suit le chemin d\'un import de fichiers (jeton, conflits, fonts:commit)', () => {
    assert.match(main, /return preparerImportDePolices\(lus, integrees\);/);
    assert.match(lire('src/polices-ui.js'), /const r = await pont\.fontStoreAjouter\(p\.id, NOMS_INTEGRES\);/);
    assert.match(lire('src/polices-ui.js'), /const n = await trancherEtEcrire\(\{ \.\.\.r, illisibles: \[\] \}\);/);
  });
  test('les aperçus se chargent quand la vignette devient visible, sous un nom propre au store', () => {
    const s = lire('src/polices-store-ui.js');
    assert.match(s, /new globalThis\.IntersectionObserver\(/);
    assert.match(s, /export const familleDApercu = \(id\) => `SB apercu \$\{id\}`;/);
  });
  test('deux onglets, « Complètes seulement » coché par défaut, une coche sur une police déjà là', () => {
    const html = lire('src/index.html');
    assert.match(html, /data-mode="local" id="policesOngletLocal">Mes polices</);
    assert.match(html, /data-mode="enLigne" id="policesOngletEnLigne">En ligne</);
    assert.match(html, /<input type="checkbox" id="policesEnLigneCompletes" checked>/);
    assert.match(lire('src/polices-ui.js'), /if \(p\.enLigne && dejaPossedee\(p\.nom\)\) apercu\.appendChild\(el\('span', \{ texte: '✓', classe: 'police-possedee'/);
  });
});
