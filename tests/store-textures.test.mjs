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
      deplacement: 'Grass005_1K-JPG_Displacement.jpg',
    });
    assert.equal(ACG.cartesDuZip(noms.filter(n => !n.includes('NormalGL'))), null);
    assert.equal(ACG.cartesDuZip(['../x_Color.jpg', 'a_NormalGL.jpg', 'a_Roughness.jpg']), null);
  });
});

// ── #446b : le téléchargement, la cuisson, le rangement ────────────────────────────────────────
const zlib = require('zlib');
const Z = require('../electron/bibliotheque/zip-lecture.js');
const B = require('../electron/bibliotheque/bibliotheque-textures.js');

/** Une petite archive zip, écrite ici pour ne dépendre d'aucun outil : une entrée stockée, une compressée. */
function petitZip(fichiers){
  const locaux = [], centraux = [];
  let decalage = 0;
  for (const [nom, contenu, comprimer] of fichiers) {
    const donnees = comprimer ? zlib.deflateRawSync(contenu) : contenu;
    const n = Buffer.from(nom, 'utf8');
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(comprimer ? 8 : 0, 8);
    l.writeUInt32LE(donnees.length, 18); l.writeUInt32LE(contenu.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(comprimer ? 8 : 0, 10);
    c.writeUInt32LE(donnees.length, 20); c.writeUInt32LE(contenu.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(decalage, 42);
    locaux.push(l, n, donnees); centraux.push(c, n);
    decalage += 30 + n.length + donnees.length;
  }
  const central = Buffer.concat(centraux);
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(central.length, 12); fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, central, fin]);
}

describe('#446b : lire un zip ambientCG (sans dépendance)', () => {
  const couleur = Buffer.from('couleur '.repeat(200));
  const archive = petitZip([
    ['G_1K-JPG_Color.jpg', couleur, true],
    ['G_1K-JPG_NormalGL.jpg', Buffer.from('normale'), false],
    ['G_1K-JPG_Roughness.jpg', Buffer.from('rugosite'), true],
    ['dossier/G_1K-JPG_Color.jpg', Buffer.from('piege'), false],
  ]);
  test('les noms à la racine, et les cartes qu\'on en garde', () => {
    assert.deepEqual(Z.nomsDuZip(archive), ['G_1K-JPG_Color.jpg', 'G_1K-JPG_NormalGL.jpg', 'G_1K-JPG_Roughness.jpg']);
    const c = ACG.cartesDuZip(Z.nomsDuZip(archive));
    assert.equal(c.couleur, 'G_1K-JPG_Color.jpg');
    assert.equal(c.deplacement, null);
  });
  test('stockée ou compressée, le contenu revient intact ; un fichier dans un dossier n\'est jamais lu', () => {
    const lus = Z.extraire(archive, ['G_1K-JPG_Color.jpg', 'G_1K-JPG_NormalGL.jpg', 'dossier/G_1K-JPG_Color.jpg']);
    assert.ok(lus.get('G_1K-JPG_Color.jpg').equals(couleur));
    assert.equal(lus.get('G_1K-JPG_NormalGL.jpg').toString(), 'normale');
    assert.ok(!lus.has('dossier/G_1K-JPG_Color.jpg'));
  });
  test('une archive illisible est refusée, pas devinée', () => {
    assert.equal(Z.nomsDuZip(Buffer.from('pas un zip du tout, vraiment pas')), null);
    assert.throws(() => Z.extraire(Buffer.from('rien'), ['x']), /illisible/);
  });
});

describe('#446b : « Mes textures »', () => {
  const r = PH.catalogueNormalise(fixture('polyhaven-textures.json'), MAINTENANT).find(e => e.r.id === 'brick_wall_001').r;
  test('un dossier par texture, sans rien qui en sorte', () => {
    assert.equal(B.dossierDe('polyhaven', 'brick_wall_001'), 'polyhaven-brick_wall_001');
    assert.equal(B.dossierDe('polyhaven', '../../x'), 'polyhaven-x');
    assert.equal(B.dossierDe('', 'x'), null);
  });
  test('la cuisson en grand format dès qu\'un Sol ou un Tracé s\'en sert', () => {
    assert.equal(B.tailleDeCuisson(['muret', 'mur-ext']), 1024);
    assert.equal(B.tailleDeCuisson(['mur-int', 'sol-int']), 512);
  });
  test('l\'entrée garde le crédit, les usages, la taille réelle et ce que la cuisson a mesuré', () => {
    const e = B.entreeTexture(r, { resolution: '1k', cartes: ['couleur', 'normal', 'rugosite'],
      cuisson: { fichier: 'grain.png', teinte: '#8A4B3C', nature: 'gris', raccordVisible: true }, date: new Date(Date.UTC(2026, 9, 25)) });
    assert.equal(e.cle, 'polyhaven:brick_wall_001');
    assert.equal(e.auteur.nom, 'Rob Tuytel, Dimitrios Savva');
    assert.deepEqual(e.usages, ['muret', 'mur-ext', 'mur-int']);
    assert.deepEqual(e.dimensions, [3, 3]);
    assert.equal(e.grain, 'grain.png');
    assert.equal(e.raccordVisible, true);
  });
  test('sans cuisson, la texture reste (revêtements) : pas de grain, pas de raccord annoncé', () => {
    const e = B.entreeTexture(r, { resolution: '1k', cartes: ['couleur'], cuisson: null });
    assert.equal(e.grain, null);
    assert.equal(e.raccordVisible, false);
  });
  test('ajouter remplace la même texture ; présentes écarte un dossier effacé à la main', () => {
    const e1 = B.entreeTexture(r, { resolution: '1k', cartes: [] });
    const e2 = B.entreeTexture(r, { resolution: '2k', cartes: [] });
    const b = B.ajouter(B.ajouter(B.vide(), e1), e2);
    assert.equal(b.textures.length, 1);
    assert.equal(b.textures[0].resolution, '2k');
    assert.deepEqual(B.presentes(b, []), []);
    assert.equal(B.presentes(b, ['polyhaven-brick_wall_001']).length, 1);
    assert.equal(B.retirer(b, e1.cle).textures.length, 0);
  });
});

describe('#446b : résolutions (4K pour les bâtiments seulement, jamais 8K)', () => {
  test('Poly Haven : 1k et 2k pour un Sol ; 4k ajoutée dès qu\'un bâtiment s\'en sert', () => {
    assert.deepEqual(PH.resolutionsPermises(['sol', 'route'], PH.RESOLUTIONS), ['1k', '2k']);
    assert.deepEqual(PH.resolutionsPermises(['muret', 'mur-ext'], PH.RESOLUTIONS), ['1k', '2k', '4k']);
    assert.ok(!PH.RESOLUTIONS.includes('8k') && !ACG.RESOLUTIONS.includes('8K'));
  });
  test('le déplacement est téléchargé (le cuiseur en tire le relief)', () => {
    const fichiers = fixture('polyhaven-textures-fichiers.json');
    fichiers.Displacement = { '1k': { jpg: { url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/b/b_disp_1k.jpg', size: 10 } } };
    assert.deepEqual(PH.planTelechargement(fichiers).cartes.map(c => c.carte), ['couleur', 'normal', 'rugosite', 'ao', 'deplacement']);
  });
  test('ambientCG : les options suivent les zip réellement proposés', () => {
    const g = ACG.pageDepuis(fixture('ambientcg-textures.json')).resultats[0];
    assert.deepEqual(ACG.optionsTelechargement(g).map(o => o.resolution), ['1K', '2K']);
  });
});

describe('#446b : le câblage', () => {
  const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  test('le cuiseur s\'appelle comme une fonction, et voyage avec l\'application installée', () => {
    assert.match(lire('tools/bake-textures.mjs'), /export async function cuireMatiere3D\(/);
    assert.ok(JSON.parse(lire('package.json')).build.files.includes('tools/bake-textures.mjs'));
  });
  test('ses canaux à part : le store de textures est une fenêtre à part (demandé)', () => {
    const main = lire('electron/main.js');
    for (const c of ['infos', 'chercher', 'options', 'telecharger', 'mes', 'supprimer']) assert.match(main, new RegExp(`'textures:${c}'`));
    assert.match(lire('electron/preload.js'), /texturesTelecharger: /);
  });
  test('le renderer ne donne jamais d\'adresse : seulement une source et un identifiant', () => {
    const s = lire('electron/bibliotheque/store-textures.js');
    assert.match(s, /async function telecharger\(dossierProjets, sourceId, id, resolution, progression, simulation\)/);
    assert.match(s, /ACG\.HOTE_ZIP\.test\(plan\.zip\.url\)/);
  });
});

describe('#446c : la fenêtre du store de textures', () => {
  const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const html = lire('src/index.html');
  const ui = lire('src/textures-store-ui.js');
  test('une fenêtre À PART, avec son bouton dans le bandeau, juste à droite de la bibliothèque de modèles (demandé)', () => {
    const i = html.indexOf('id="storeOuvrirBtn"'), j = html.indexOf('id="texturesOuvrirBtn"'), k = html.indexOf('id="policesOuvrirBtn"');
    assert.ok(i > 0 && j > i && k > j, 'store de modèles, puis textures, puis polices');
    assert.match(html, /class="modal-overlay hidden" id="texturesModal"/);
    assert.match(lire('src/store-ui.js'), /export const SOURCES_STORE = \['local', 'sketchfab', 'polyhaven'\];/, 'pas un onglet du store de modèles');
  });
  test('trois onglets : Mes textures, puis une source par onglet ; filtres matière et usage', () => {
    assert.match(ui, /\[\[LOCAL, tr\('My textures', 'Mes textures'\)\], \.\.\.\(infos \? infos\.sources : \[\]\)/);
    assert.match(html, /id="texturesMatiere"/);
    assert.match(html, /id="texturesUsage"/);
  });
  test('rien d\'office : le téléchargement part du bouton de la fiche, à la résolution choisie (1k d\'abord)', () => {
    assert.match(ui, /choisie = options\[0\]\.resolution;/);
    assert.match(ui, /api\(\)\.texturesTelecharger\(r\.source, r\.id, choisie\)/);
  });
  test('câblée au démarrage, le bandeau l\'allume quand elle est ouverte', () => {
    const ev = lire('src/events.js');
    assert.match(ev, /cablerTextures\(\{ confirmer: /);
    assert.match(ev, /\['texturesModal', 'texturesOuvrirBtn'\]/);
  });
});

describe('import d\'un dossier de cartes (demandé : l\'application prend ce qu\'il lui faut)', () => {
  test('les conventions des banques : ambientCG, Poly Haven, et les noms courts (basecolor, normal, height)', () => {
    assert.deepEqual(B.cartesDuDossier(['Oak_Color.jpg', 'Oak_NormalGL.jpg', 'Oak_NormalDX.jpg', 'Oak_Roughness.jpg', 'Oak_Displacement.png', 'preview.jpg']).cartes,
      { couleur: 'Oak_Color.jpg', normal: 'Oak_NormalGL.jpg', rugosite: 'Oak_Roughness.jpg', deplacement: 'Oak_Displacement.png' });
    assert.deepEqual(B.cartesDuDossier(['w_diff_1k.jpg', 'w_nor_gl_1k.jpg', 'w_rough_1k.jpg', 'w_ao_1k.jpg', 'w_disp_1k.png']).cartes,
      { couleur: 'w_diff_1k.jpg', normal: 'w_nor_gl_1k.jpg', rugosite: 'w_rough_1k.jpg', ao: 'w_ao_1k.jpg', deplacement: 'w_disp_1k.png' });
    assert.equal(B.cartesDuDossier(['a_basecolor.png', 'a_normal.png', 'a_height.png']).cartes.normal, 'a_normal.png', 'normale ambiguë : lue comme OpenGL');
  });
  test('RÉGRESSION : une normale DirectX n\'est jamais prise (elle inverserait le relief)', () => {
    assert.equal(B.cartesDuDossier(['a_Color.jpg', 'a_NormalDX.jpg']).cartes.normal, undefined);
  });
  test('refus lisibles : pas de couleur, ou deux résolutions dans le même dossier', () => {
    assert.equal(B.cartesDuDossier(['photo.jpg']).refus, 'couleur');
    const d = B.cartesDuDossier(['x_Color_1k.jpg', 'x_Color_2k.jpg']);
    assert.equal(d.refus, 'doublons');
    assert.deepEqual(d.doublons, ['couleur']);
  });
  test('un identifiant propre et unique, d\'après le nom du dossier', () => {
    assert.equal(B.idImport('Chêne clair (2k)'), 'Chene_clair_2k');
    assert.equal(B.idImport('oak', ['oak', 'oak_2']), 'oak_3');
  });
  test('cocher des matières recalcule les usages', () => {
    const b = { version: 1, textures: [{ cle: 'import:oak', dossier: 'import-oak', matieres: [], usages: [] }] };
    const apres = B.avecMatieres(b, 'import:oak', ['parquet'], M.usagesDe);
    assert.deepEqual(apres.textures[0].usages, ['chemin', 'cloture', 'mur-int', 'sol-int', 'plafond']);
  });
  test('câblage : la tuile « Importer un dossier » en tête de Mes textures, la boîte de choix d\'un dossier', () => {
    const ui = readFileSync(new URL('../src/textures-store-ui.js', import.meta.url), 'utf8');
    // En tête, sauf en mode « choisir » (on y applique une texture, on n'en importe pas).
    assert.match(ui, /g\.replaceChildren\(\.\.\.\(choix \? \[\] : \[carteImport\(\)\]\), \.\.\.liste\.map\(t => carte\(t, true\)\)\)/);
    assert.match(readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8'), /'textures:importer'[\s\S]{0,300}properties: \['openDirectory'\]/);
  });
});

describe('retours du 25 octobre sur la fenêtre', () => {
  const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  test('pas de badges de matières sur les vignettes (illisibles) : ils restent sur la fiche', () => {
    const ui = lire('src/textures-store-ui.js');
    const carte = ui.slice(ui.indexOf('function carte(r, local)'), ui.indexOf('function rendreGrille'));
    assert.doesNotMatch(carte, /store-badge/);
  });
  test('RÉGRESSION : l\'icône du store de textures n\'est pas celle des Murs (une icône = un usage)', () => {
    const html = lire('src/index.html');
    const bouton = html.slice(html.indexOf('id="texturesOuvrirBtn"'), html.indexOf('</button>', html.indexOf('id="texturesOuvrirBtn"')));
    assert.doesNotMatch(bouton, /M3 9\.5h18M3 15h18/, 'les briques des Murs sont revenues');
  });
});

describe('retours du 25 octobre sur la fiche des textures', () => {
  const ui = readFileSync(new URL('../src/textures-store-ui.js', import.meta.url), 'utf8');
  test('ni recherche ni filtres sur une fiche (comme le store de modèles)', () => {
    assert.match(ui, /\$\('texturesFormulaire'\)\.hidden = true;/);
    assert.match(ui, /\$\('texturesFormulaire'\)\.hidden = false;/);
  });
  test('la qualité se choisit par la flèche du bouton Télécharger (bouton scindé du store de modèles)', () => {
    assert.match(ui, /el\('div', \{ classe: 'store-bouton-scinde' \}, \[telecharger, fleche, menu\]\)/);
  });
  test('RÉGRESSION : une texture déjà là propose Supprimer, jamais « Télécharger à nouveau »', () => {
    assert.match(ui, /const action = t \? boutonSupprimer\(t, /);
    assert.doesNotMatch(ui, /Télécharger à nouveau/);
  });
  test('un aperçu 3D sous l\'image : une sphère habillée de la matière', () => {
    assert.match(ui, /new T\.SphereGeometry\(/);
    assert.match(ui, /ouvrirApercu3D\(visuel, null, \{ objet \}\)/);
  });
  test('les matières se choisissent dans un menu à choix MULTIPLE, comme la catégorie d\'un modèle', () => {
    assert.match(ui, /role: 'menuitemcheckbox'/);
    assert.match(ui, /menuMatieres = true;   \/\/ un choix MULTIPLE : le menu reste ouvert/);
  });
  test('revenir de la fiche refait la grille : la coche d\'une texture téléchargée y apparaît', () => {
    assert.match(ui, /if \(ouverte\) \{ rendreGrille\(\);/);
  });
  test('comme la fiche d\'un modèle : utilisée dans ce projet, licence, caractéristiques ; plus de note sous les boutons', () => {
    assert.match(ui, /section\(tr\('Used in this project', 'Utilisée dans ce projet'\)/);
    assert.match(ui, /section\(tr\('Licence', 'Licence'\)/);
    assert.match(ui, /section\(tr\('Characteristics', 'Caractéristiques'\)/);
    assert.doesNotMatch(ui, /La 1k suffit presque toujours/);
  });
  test('les usages en étiquettes sous les matières (plus de section Usages) ; « + Tags » et filtre par tags', () => {
    assert.doesNotMatch(ui, /section\(tr\('Uses', 'Usages'\)/);
    assert.match(ui, /classe: 'store-chip texture-chip-usage'/);
    assert.match(ui, /texte: '\+ Tags'/);
    assert.match(readFileSync(new URL('../src/index.html', import.meta.url), 'utf8'), /id="texturesTagsZone"/);
  });
  test('« Voir sur … » à côté de « Voir en 3D » quand la texture a une page', () => {
    assert.match(ui, /r\.url \? lien\(tr\(`View on \$\{nomSource\(r\.source\)\}`/);
  });
});

describe('les tags de « Mes textures » (purs)', () => {
  test('créer (sans doublon), renommer (refus si pris), poser, supprimer (retiré partout)', () => {
    let b = B.ajouter(B.vide(), { cle: 'polyhaven:a', dossier: 'polyhaven-a', nom: 'A', matieres: [], usages: [] });
    const c1 = B.creerTag(b, 'Médiéval'); b = c1.biblio;
    assert.equal(B.creerTag(b, 'medieval').id, c1.id, 'même nom aux accents près : le tag existant');
    const c2 = B.creerTag(b, 'Ruines'); b = c2.biblio;
    assert.equal(B.renommerTag(b, c2.id, 'médiéval').erreur, 'pris');
    b = B.tagTexture(b, 'polyhaven:a', c1.id, true);
    assert.deepEqual(b.textures[0].tags, [c1.id]);
    b = B.supprimerTag(b, c1.id);
    assert.deepEqual(b.textures[0].tags, []);
    assert.deepEqual(B.tagsDe(b).map(t => t.nom), ['Ruines']);
  });
  test('RÉGRESSION : retélécharger une texture garde ses tags, et ajouter / retirer gardent la liste des tags', () => {
    let b = B.creerTag(B.vide(), 'X').biblio;
    b = B.ajouter(b, { cle: 'p:a', dossier: 'p-a', matieres: [], usages: [] });
    b = B.tagTexture(b, 'p:a', 't1', true);
    b = B.ajouter(b, { cle: 'p:a', dossier: 'p-a', matieres: [], usages: [], resolution: '2k' });
    assert.deepEqual(b.textures[0].tags, ['t1']);
    assert.equal(B.retirer(b, 'p:a').tags.length, 1);
  });
});

describe('Caractéristiques d\'une texture : poids, images, dossier', () => {
  const ui = readFileSync(new URL('../src/textures-store-ui.js', import.meta.url), 'utf8');
  test('le poids (sur le disque, ou de la résolution choisie en ligne), le dossier, et « Images » au lieu de « Cartes »', () => {
    assert.match(ui, /\$\{tr\('Weight', 'Poids'\)\} : \$\{poids\(t\.poids\)\}/);
    assert.match(ui, /\$\{tr\('Folder', 'Dossier'\)\} : Textures\/\$\{t\.dossier\}/);
    assert.match(ui, /renduLisible\(t\.cartes\)/);
    assert.doesNotMatch(ui, /tr\('Maps', 'Cartes'\)/);
    assert.match(readFileSync(new URL('../electron/bibliotheque/store-textures.js', import.meta.url), 'utf8'), /return \{ \.\.\.t, poids \};/);
  });
});

describe('retours : ordre des Caractéristiques et rien sous les boutons', () => {
  const ui = readFileSync(new URL('../src/textures-store-ui.js', import.meta.url), 'utf8');
  test('dossier, taille, poids, images, grain, résolution, provenance : l\'ordre de la fiche d\'un modèle', () => {
    const bloc = ui.slice(ui.indexOf('const caracteristiques = ['), ui.indexOf('];', ui.indexOf('const caracteristiques = [')));
    const ordre = ["'Folder'", "'Real size of one tile'", "'Weight'", 'renduLisible', "'Resolution'", 'Downloaded from'].map(m => bloc.indexOf(m));
    assert.ok(ordre.every(i => i >= 0) && ordre.every((v, k) => !k || v > ordre[k - 1]), 'ordre attendu');
  });
  test('la mention de la source est cachée sur une fiche', () => {
    assert.match(ui, /\$\('texturesCredit'\)\.hidden = true;/);
  });
});

describe('le grain et le raccord ne se disent que s\'ils posent problème (signalé)', () => {
  const ui = readFileSync(new URL('../src/textures-store-ui.js', import.meta.url), 'utf8');
  test('plus de « grain prêt » ; un manque de relief et une couture se disent en mots d\'usage', () => {
    assert.doesNotMatch(ui, /Grain du Sol et des Tracés : prêt/);
    assert.match(ui, /t && !t\.grain \? tr\(/);
    assert.match(ui, /ses bords se voient en lignes/);
  });
});

describe('aperçu 3D : rond ou à plat ; icône du store de modèles', () => {
  const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  test('un bouton en haut à droite de l\'aperçu bascule rond / à plat, avec l\'icône de la forme à venir', () => {
    const ui = lire('src/textures-store-ui.js');
    assert.match(ui, /new T\.PlaneGeometry\(2, 2, 1, 1\)/);
    assert.match(ui, /bascule\.innerHTML = ICONE_FORME\[autre\];/);
    assert.match(lire('src/style.css'), /\.preview-corner-btn\.texture-forme-btn\{ top:8px; right:8px; bottom:auto; \}/);
  });
  test('RÉGRESSION : le store de modèles n\'a plus la grille de vignettes (deux stores : elle ne disait plus rien)', () => {
    const html = lire('src/index.html');
    const b = html.slice(html.indexOf('id="storeOuvrirBtn"'), html.indexOf('</button>', html.indexOf('id="storeOuvrirBtn"')));
    assert.doesNotMatch(b, /<rect x="3" y="3" width="7" height="7"/);
    assert.match(b, /M12 3 4 7v10l8 4 8-4V7z/);
  });
});

describe('carte de « Mes textures »', () => {
  const ui = readFileSync(new URL('../src/textures-store-ui.js', import.meta.url), 'utf8');
  test('le poids sous la provenance ; « Dossier importé » plutôt que « import »', () => {
    assert.match(ui, /local && r\.poids \? el\('span', \{ classe: 'store-carte-infos' \}, \[el\('span', \{ texte: poids\(r\.poids\) \}\)\]\)/);
    assert.match(ui, /import: tr\('Imported folder', 'Dossier importé'\)/);
  });
});

describe('retours : rangée du haut, mention de la source', () => {
  const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  test('RÉGRESSION : la tuile d\'import ne hausse plus la première rangée (min-height 120, pas 180)', () => {
    assert.match(lire('src/style.css'), /color:var\(--ink-soft\); min-height:120px; \}/);
  });
  test('la mention de la source est un lien, sans la licence', () => {
    const ui = lire('src/textures-store-ui.js');
    assert.match(ui, /lien\(tr\(`Textures provided by \$\{nomSource\(onglet\)\}`, `Textures fournies par \$\{nomSource\(onglet\)\}`\), SITES\[onglet\]\)/);
    assert.doesNotMatch(ui, /libres de tout usage/);
  });
});

describe('RÉGRESSION : vignettes entières et nettes (signalé : coupées ou floues)', () => {
  const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  test('cartes en 16:9 (le carré a été écarté), contain avec une marge, sauf une texture à plat ; vignettes de 512 px', () => {
    assert.match(lire('src/style.css'), /\.store-carte img, \.store-sans-vignette\{ width:100%; aspect-ratio:3\/2; object-fit:contain;/);
    assert.match(lire('src/style.css'), /\.store-carte img\{ box-sizing:border-box; padding:8px; \}/);
    assert.match(lire('src/model-thumbnails.js'), /export const HAUTEUR_VIGNETTE = 341;/);
    assert.match(lire('src/style.css'), /\.store-carte img\.texture-a-plat\{ object-fit:cover; padding:0; \}/);
    for (const f of ['store-polyhaven.js', 'store-textures-polyhaven.js', 'store-textures-ambientcg.js', 'store-sketchfab.js']) {
      assert.match(lire(`electron/bibliotheque/${f}`), /petite: vignette\w*\([^)]*, 512\)/, f);
    }
  });
});

describe('la marge des vignettes : portée par le recadrage (signalé : fonds clairs, dégradés, sujets au bord)', () => {
  const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  test('une vignette recadrée remplit la carte, sa marge est en elle ; avant, une marge CSS', () => {
    const css = lire('src/style.css');
    assert.match(css, /\.store-carte img\.recadree:not\(\.recadree-origine\)\{ padding:0; object-fit:cover; \}/);
  });
  test('ni clignotement ni étirement (signalé : la commode étirée, le remplacement au défilement)', () => {
    const css = lire('src/style.css'), ui = lire('src/store-ui.js'), r = lire('src/vignette-recadrage.js');
    assert.match(css, /\.store-carte img:not\(\.texture-a-plat\)\{ opacity:0;/);   // l'originale n'est jamais vue
    assert.match(css, /\.store-carte img\.recadree\{ opacity:1; \}/);
    assert.match(ui, /recadrees\.has\(origine\)/);                                  // reprise immédiate, sans recalcul
    assert.match(ui, /recadree-origine/);
    assert.match(ui, /new MutationObserver/);
    assert.match(css, /\.store-carte-possedee img\.recadree\{ opacity:\.7; \}/);   // possédée : reste atténuée                                        // grille refaite : reprise avant affichage
    assert.match(css, /\.store-carte img\.recadree-immediate\{ transition:none; \}/);                                             // échec : l'originale, montrée
    assert.match(r, /source\.naturalWidth \|\| source\.width/);                     // taille naturelle d'une <img>
    assert.doesNotMatch(lire('src/style.css'), /border-image:var\(--fond-vignette\)/);
  });
});
