/**
 * tests/store-textures.test.mjs, le store de textures (#446a) : les matières, leurs usages, et les
 * deux sources (Poly Haven, ambientCG) lues sur de VRAIES réponses relevées le 25 octobre 2026
 * (tests/fixtures/*-textures*.json). Si une source change de format, ce sont elles à relever.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../electron/bibliotheque/texture-matieres.js');
const PH = require('../electron/bibliotheque/store-textures-polyhaven.js');
const ACG = require('../electron/bibliotheque/store-textures-ambientcg.js');
const fixture = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const MAINTENANT = Date.UTC(2026, 9, 25);

describe('la table des matières et des usages (validée le 25 octobre 2026)', () => {
  test('vingt matières, onze usages, chaque usage d\'une matière existe', () => {
    assert.equal(M.MATIERES.length, 20);
    assert.equal(M.USAGES.length, 11);
    const usages = new Set(M.USAGES.map(u => u.slug));
    M.MATIERES.forEach(m => m.usages.forEach(u => assert.ok(usages.has(u), `${m.slug} → ${u} inconnu`)));
  });
  test('quelques lignes de la table, telles que validées', () => {
    assert.deepEqual(M.matiere('beton').usages, ['sol', 'route', 'muret', 'mur-ext', 'mur-int', 'sol-int', 'plafond']);
    assert.deepEqual(M.matiere('tuiles').usages, ['toit']);
    assert.deepEqual(M.matiere('herbe').usages, ['sol', 'haie']);
    assert.deepEqual(M.matiere('papier-peint').usages, ['mur-int']);
  });
  test('chaque usage est servi par au moins une matière', () => {
    M.USAGES.forEach(u => assert.ok(M.matieresDeLUsage(u.slug).length, `usage sans matière : ${u.slug}`));
  });
  test('les usages d\'une texture sont l\'union de ceux de ses matières, dans l\'ordre de l\'interface', () => {
    assert.deepEqual(M.usagesDe(['herbe', 'feuillage']), ['sol', 'haie']);
    assert.deepEqual(M.usagesDe(['brique', 'tuiles']), ['muret', 'mur-ext', 'mur-int', 'toit']);
    assert.deepEqual(M.usagesDe([]), []);
  });
  test('les mots sont ENTIERS : « textile » n\'est pas du carrelage, « tiles » l\'est', () => {
    assert.deepEqual(M.matieresParMots(['textile']), []);
    assert.deepEqual(M.matieresParMots(['floor tiles']), ['carrelage']);
  });
});

describe('Poly Haven : le catalogue des textures', () => {
  const cat = PH.catalogueNormalise(fixture('polyhaven-textures.json'), MAINTENANT);
  const par = (id) => cat.find(e => e.r.id === id).r;
  test('le tissu est écarté (aucune matière chez nous) ; le reste est gardé', () => {
    assert.deepEqual(cat.map(e => e.r.id).sort(), ['asphalt_snow', 'brick_wall_001', 'dirty_carpet', 'snow_02']);
  });
  test('plusieurs matières par texture quand c\'est vrai', () => {
    assert.deepEqual(par('asphalt_snow').matieres, ['neige', 'asphalte']);
    assert.deepEqual(par('dirty_carpet').matieres, ['moquette']);
    assert.deepEqual(par('brick_wall_001').matieres, ['brique']);
  });
  test('l\'usage découle des matières', () => {
    assert.deepEqual(par('brick_wall_001').usages, ['muret', 'mur-ext', 'mur-int']);
    assert.deepEqual(par('dirty_carpet').usages, ['sol-int']);
  });
  test('la taille réelle en mètres, CC0, type texture', () => {
    const b = par('brick_wall_001');
    assert.deepEqual(b.details.dimensions, [3, 3]);
    assert.equal(b.licence.code, 'cc0');
    assert.equal(b.type, 'texture');
    assert.match(b.vignettes.grande, /width=1024/);
  });
  test('pageLocale : texte, matière, usage, et les plus téléchargées d\'abord', () => {
    assert.deepEqual(PH.pageLocale(cat, {}).resultats.map(r => r.id), ['snow_02', 'brick_wall_001', 'dirty_carpet', 'asphalt_snow']);
    assert.deepEqual(PH.pageLocale(cat, { matiere: 'neige' }).resultats.map(r => r.id), ['snow_02', 'asphalt_snow']);
    assert.deepEqual(PH.pageLocale(cat, { usage: 'route' }).resultats.map(r => r.id), ['snow_02', 'asphalt_snow']);
    assert.deepEqual(PH.pageLocale(cat, { texte: 'rug' }).resultats.map(r => r.id), ['dirty_carpet']);
  });
  test('une texture en accès anticipé est écartée', () => {
    const futur = { x: { ...fixture('polyhaven-textures.json').snow_02, date_published: MAINTENANT / 1000 + 86400 } };
    assert.deepEqual(PH.catalogueNormalise(futur, MAINTENANT), []);
  });
});

describe('Poly Haven : le téléchargement', () => {
  const fichiers = fixture('polyhaven-textures-fichiers.json');
  test('couleur, relief OpenGL, rugosité et AO, en JPG, à la résolution demandée', () => {
    const p = PH.planTelechargement(fichiers);
    assert.equal(p.resolution, '1k');
    assert.deepEqual(p.cartes.map(c => c.carte), ['couleur', 'normal', 'rugosite', 'ao']);
    assert.match(p.cartes[1].url, /_nor_gl_1k\.jpg$/);
    assert.equal(p.total, 574381 + 295279 + 211093 + 269071);
  });
  test('les options : 1k et 2k, avec leur poids', () => {
    assert.deepEqual(PH.optionsTelechargement(fichiers).map(o => o.resolution), ['1k', '2k']);
  });
  test('une carte obligatoire manquante, ou une adresse étrangère, et rien n\'est téléchargé', () => {
    const { Rough, ...sansRugosite } = fichiers;
    assert.ok(Rough);
    assert.equal(PH.planTelechargement(sansRugosite), null);
    const pirate = JSON.parse(JSON.stringify(fichiers));
    pirate.Diffuse['1k'].jpg.url = 'https://exemple.com/x.jpg';
    assert.equal(PH.planTelechargement(pirate), null);
  });
  test('l\'AO est facultative', () => {
    const { AO, ...sansAO } = fichiers;
    assert.ok(AO);
    assert.deepEqual(PH.planTelechargement(sansAO).cartes.map(c => c.carte), ['couleur', 'normal', 'rugosite']);
  });
});

describe('ambientCG : les pages et les matières', () => {
  const json = fixture('ambientcg-textures.json');
  test('une page normalisée : le tissu est écarté, l\'offset suivant donné', () => {
    const p = ACG.pageDepuis(json, { curseur: '0' });
    assert.deepEqual(p.resultats.map(r => r.id), ['Grass005', 'Grass001', 'Bricks113A']);
    assert.equal(p.suivant, '4');
  });
  test('matières, usages, taille réelle (centimètres → mètres, 0 = inconnue)', () => {
    const [g5, g1, b] = ACG.pageDepuis(json).resultats;
    assert.deepEqual(g5.matieres, ['herbe']);
    assert.deepEqual(g5.usages, ['sol', 'haie']);
    assert.equal(g5.details.dimensions, null);
    assert.deepEqual(g1.details.dimensions, [1.4, 1.4]);
    assert.deepEqual(b.matieres, ['brique']);
  });
  test('les zip JPG seulement, sur le domaine d\'ambientCG', () => {
    const g = ACG.pageDepuis(json).resultats[0];
    assert.deepEqual(Object.keys(g.zips), ['1K', '2K']);
    assert.equal(ACG.planTelechargement(g).zip.url, 'https://ambientcg.com/get?file=Grass005_1K-JPG.zip');
    assert.equal(ACG.planTelechargement(g, '2K').total, 39523019);
  });
  test('l\'adresse : matière et usage deviennent des catégories ambientCG', () => {
    const u = new URL(ACG.urlRecherche({ matiere: 'parquet', texte: 'oak', curseur: '24' }));
    assert.equal(u.searchParams.get('category'), 'WoodFloor,Planks');
    assert.equal(u.searchParams.get('q'), 'oak');
    assert.equal(u.searchParams.get('offset'), '24');
    assert.equal(u.searchParams.get('type'), 'Material');
    assert.equal(ACG.urlRecherche({ matiere: 'tuiles', usage: 'sol' }), null, 'les tuiles ne servent pas le sol : rien à demander');
    assert.match(new URL(ACG.urlRecherche({ usage: 'toit' })).searchParams.get('category'), /RoofingTiles/);
  });
  test('les cartes du zip : couleur, normal GL, rugosité obligatoires ; ni DX ni chemin piégé', () => {
    const noms = ['Grass005_1K-JPG_Color.jpg', 'Grass005_1K-JPG_NormalDX.jpg', 'Grass005_1K-JPG_NormalGL.jpg',
      'Grass005_1K-JPG_Roughness.jpg', 'Grass005_1K-JPG_AmbientOcclusion.jpg', 'Grass005_1K-JPG_Displacement.jpg'];
    assert.deepEqual(ACG.cartesDuZip(noms), {
      couleur: 'Grass005_1K-JPG_Color.jpg', normal: 'Grass005_1K-JPG_NormalGL.jpg',
      rugosite: 'Grass005_1K-JPG_Roughness.jpg', ao: 'Grass005_1K-JPG_AmbientOcclusion.jpg',
    });
    assert.equal(ACG.cartesDuZip(noms.filter(n => !n.includes('NormalGL'))), null);
    assert.equal(ACG.cartesDuZip(['../x_Color.jpg', 'a_NormalGL.jpg', 'a_Roughness.jpg']), null);
  });
});
