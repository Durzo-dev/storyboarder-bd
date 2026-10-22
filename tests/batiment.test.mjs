// #454a : le fichier de bâtiment (src/batiment.js) et son rangement (src/batiment-store.js).
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VERSION_BATIMENT, EXTENSION_BATIMENT, DEFAUTS_BATIMENT, creerBatiment, nomDuNiveauParDefaut,
  normaliserBatiment, lireBatiment, ecrireBatiment, nomDeFichierDuBatiment, nomDeFichierLibre,
  nomAfficheDuFichier,
} from '../src/batiment.js';
import {
  setBatimentBridge, listerBatiments, lireBatimentDuDisque, enregistrerBatiment, renommerBatiment,
  supprimerBatiment,
} from '../src/batiment-store.js';

const fr = (en, f) => f;
const en = (e) => e;
const mur = (id, a, b, extra = {}) => ({ id, niveauId: 'n0', a, b, epaisseur: 0.2, ...extra });

describe('créer', () => {
  test('un rez-de-chaussée, rien dessus, toit à deux pans par défaut', () => {
    const b = creerBatiment('Maison', fr);
    assert.equal(b.version, VERSION_BATIMENT);
    assert.equal(b.nom, 'Maison');
    assert.deepEqual(b.niveaux, [{ id: 'n0', nom: 'Rez-de-chaussée', elevation: 0, hauteur: DEFAUTS_BATIMENT.hauteur, dalle: DEFAUTS_BATIMENT.dalle }]);
    assert.deepEqual([b.murs, b.ouvertures, b.escaliers, b.pieces, b.elements], [[], [], [], [], []]);
    assert.equal(b.toit.type, 'deux-pans');
    assert.equal(creerBatiment('', en).nom, 'Building');
  });
  test('les noms de niveau par défaut', () => {
    assert.equal(nomDuNiveauParDefaut(0, fr), 'Rez-de-chaussée');
    assert.equal(nomDuNiveauParDefaut(2, fr), 'Étage 2');
    assert.equal(nomDuNiveauParDefaut(-1, fr), 'Sous-sol');
    assert.equal(nomDuNiveauParDefaut(-2, en), 'Basement 2');
  });
});

describe('relire', () => {
  test('un bâtiment créé se relit à l’identique (aller-retour par le texte)', () => {
    const b = creerBatiment('Maison', fr);
    b.murs.push({ ...mur('m0', { x: 0, z: 0 }, { x: 5, z: 0 }), revetement: { interieur: 'papier-peint', exterieur: null } });
    b.ouvertures.push({ id: 'o0', murId: 'm0', type: 'fenetre', le: 0.5, y: 1, largeur: 1.2, hauteur: 1.1 });
    const lu = lireBatiment(ecrireBatiment(b), fr);
    assert.deepEqual(lu, { batiment: b });
  });
  test('ce qui n’est pas un bâtiment est refusé', () => {
    assert.deepEqual(lireBatiment('pas du json', fr), { erreur: 'illisible' });
    assert.deepEqual(lireBatiment('[1,2]', fr), { erreur: 'illisible' });
    assert.deepEqual(normaliserBatiment(null, fr), { erreur: 'illisible' });
  });
  test('un objet presque vide devient un bâtiment d’un niveau', () => {
    const { batiment } = normaliserBatiment({}, fr);
    assert.equal(batiment.niveaux.length, 1);
    assert.equal(batiment.nom, 'Bâtiment');
  });
  test('les murs illisibles sont écartés, pas tout le bâtiment ; bornes et niveau par défaut', () => {
    const { batiment } = normaliserBatiment({
      niveaux: [{ id: 'n0', elevation: 0, hauteur: 3 }],
      murs: [
        mur('ok', { x: 0, z: 0 }, { x: 4, z: 0 }, { epaisseur: 5, niveauId: 'inconnu' }),
        mur('nul', { x: 1, z: 1 }, { x: 1, z: 1 }),
        mur('nan', { x: 'a', z: 0 }, { x: 1, z: 0 }),
        mur('ok', { x: 0, z: 0 }, { x: 0, z: 4 }),          // doublon d'id
        { a: { x: 0, z: 0 }, b: { x: 1, z: 0 } },            // sans id
      ],
    }, fr);
    assert.deepEqual(batiment.murs.map(m => m.id), ['ok']);
    assert.equal(batiment.murs[0].epaisseur, 1, 'bornée');
    assert.equal(batiment.murs[0].niveauId, 'n0');
    assert.deepEqual(batiment.murs[0].revetement, { interieur: null, exterieur: null });
  });
  test('une ouverture sur un mur disparu s’en va ; les valeurs sont bornées', () => {
    const { batiment } = normaliserBatiment({
      murs: [mur('m0', { x: 0, z: 0 }, { x: 4, z: 0 })],
      ouvertures: [{ id: 'o0', murId: 'm0', type: 'hublot', le: 3 }, { id: 'o1', murId: 'parti' }],
    }, fr);
    assert.deepEqual(batiment.ouvertures, [{ id: 'o0', murId: 'm0', type: 'porte', le: 1, y: 0, largeur: 0.9, hauteur: 2.1 }]);
  });
  test('les niveaux sont triés par élévation et nommés selon leur rang ; une élévation manquante se pose sur le précédent', () => {
    const { batiment } = normaliserBatiment({
      niveaux: [
        { id: 'a', elevation: 0, hauteur: 3 },
        { id: 'b' },
        { id: 'c', elevation: -3, hauteur: 3 },
      ],
    }, fr);
    assert.deepEqual(batiment.niveaux.map(n => [n.id, n.elevation, n.nom]), [['c', -3, 'Sous-sol'], ['a', 0, 'Rez-de-chaussée'], ['b', 3, 'Étage 1']]);
  });
  test('pièces et escaliers d’un niveau disparu s’en vont', () => {
    const { batiment } = normaliserBatiment({
      pieces: [{ id: 'p0', niveauId: 'n0', nom: 'Cuisine' }, { id: 'p1', niveauId: 'zz' }],
      escaliers: [{ id: 'e0', niveauId: 'zz' }],
    }, fr);
    assert.deepEqual(batiment.pieces.map(p => p.id), ['p0']);
    assert.deepEqual(batiment.escaliers, []);
  });
  test('un fichier plus récent se lit quand même, et garde ses champs inconnus', () => {
    const r = normaliserBatiment({ version: VERSION_BATIMENT + 1, nom: 'Futur', balcons: [1], toit: { type: 'deux-pans', lucarnes: 2 } }, fr);
    assert.equal(r.recent, true);
    assert.deepEqual(r.batiment.balcons, [1]);
    assert.equal(r.batiment.toit.lucarnes, 2);
    assert.equal(r.batiment.version, VERSION_BATIMENT + 1, 'la version n’est pas rabaissée');
  });
  test('le toit : type inconnu → deux pans, pente bornée, terrasse booléenne', () => {
    const { batiment } = normaliserBatiment({ toit: { type: 'coupole', pente: 200, terrasse: 'oui' } }, fr);
    assert.deepEqual([batiment.toit.type, batiment.toit.pente, batiment.toit.terrasse], ['deux-pans', 75, false]);
  });
});

describe('nommer', () => {
  test('un nom de fichier propre', () => {
    assert.equal(nomDeFichierDuBatiment('Maison'), 'Maison' + EXTENSION_BATIMENT);
    assert.equal(nomDeFichierDuBatiment('../../a:b'), 'a_b.batiment.json');
    assert.equal(nomDeFichierDuBatiment('x.batiment.json'), 'x.batiment.json');
    assert.equal(nomDeFichierDuBatiment('..'), 'batiment.batiment.json');
    assert.equal(nomAfficheDuFichier('Maison (2).batiment.json'), 'Maison (2)');
  });
  test('un nom libre, la casse ignorée', () => {
    assert.equal(nomDeFichierLibre('Maison', ['maison.batiment.json']), 'Maison (2).batiment.json');
    assert.equal(nomDeFichierLibre('Maison', ['Maison.batiment.json', 'Maison (2).batiment.json']), 'Maison (3).batiment.json');
    assert.equal(nomDeFichierLibre('Grange', ['Maison.batiment.json']), 'Grange.batiment.json');
  });
});

describe('le rangement (pont simulé)', () => {
  afterEach(() => setBatimentBridge(null));
  function pontEnMemoire(){
    const fichiers = new Map();
    return {
      fichiers,
      listBatimentFiles: async () => [...fichiers.keys()],
      readBatimentFile: async (n) => (fichiers.has(n) ? { ok: true, texte: fichiers.get(n) } : { ok: false, error: 'ENOENT' }),
      writeBatimentFile: async (n, t) => { fichiers.set(n, t); return { ok: true, name: n }; },
      deleteBatimentFile: async (n) => { fichiers.delete(n); return { ok: true }; },
      renameBatimentFile: async (a, b) => { fichiers.set(b, fichiers.get(a)); fichiers.delete(a); return { ok: true, name: b }; },
    };
  }
  test('sans pont : rien, et on le dit', async () => {
    assert.deepEqual(await listerBatiments(), []);
    assert.equal((await enregistrerBatiment(creerBatiment('A', fr))).ok, false);
  });
  test('enregistrer un nouveau, puis un second du même nom, relire, renommer, supprimer', async () => {
    const p = pontEnMemoire(); setBatimentBridge(p);
    const a = await enregistrerBatiment(creerBatiment('Maison', fr));
    const b = await enregistrerBatiment(creerBatiment('Maison', fr));
    assert.deepEqual([a.fichier, b.fichier], ['Maison.batiment.json', 'Maison (2).batiment.json']);
    const lu = await lireBatimentDuDisque('Maison.batiment.json', fr);
    assert.equal(lu.ok, true);
    assert.equal(lu.batiment.nom, 'Maison');
    assert.equal((await renommerBatiment('Maison (2).batiment.json', 'Maison')).ok, false, 'nom pris');
    assert.deepEqual(await renommerBatiment('Maison (2).batiment.json', 'Grange'), { ok: true, fichier: 'Grange.batiment.json' });
    assert.deepEqual(await supprimerBatiment('Grange.batiment.json'), { ok: true });
    assert.deepEqual(await listerBatiments(), ['Maison.batiment.json']);
  });
  test('réécrire un fichier existant garde son nom', async () => {
    const p = pontEnMemoire(); setBatimentBridge(p);
    const { fichier } = await enregistrerBatiment(creerBatiment('Maison', fr));
    const b = creerBatiment('Autre nom', fr);
    assert.deepEqual(await enregistrerBatiment(b, fichier), { ok: true, fichier });
    assert.equal(JSON.parse(p.fichiers.get(fichier)).nom, 'Autre nom');
  });
  test('un fichier abîmé ou absent se signale, sans lever', async () => {
    const p = pontEnMemoire(); setBatimentBridge(p);
    p.fichiers.set('x.batiment.json', '{oups');
    assert.equal((await lireBatimentDuDisque('x.batiment.json', fr)).ok, false);
    assert.equal((await lireBatimentDuDisque('absent.batiment.json', fr)).ok, false);
  });
});

describe('le pont Electron se défend', () => {
  const MAIN = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
  test('les cinq canaux vérifient le nom, l’écriture passe par un fichier temporaire', () => {
    for (const canal of ['read', 'write', 'delete']) {
      const i = MAIN.indexOf(`ipcMain.handle('batiments:${canal}'`);
      assert.ok(i > 0, canal);
      assert.match(MAIN.slice(i, i + 300), /nomDeBatimentAcceptable\(name\)/, canal);
    }
    const r = MAIN.indexOf("ipcMain.handle('batiments:rename'");
    assert.match(MAIN.slice(r, r + 300), /nomDeBatimentAcceptable\(ancien\) \|\| !nomDeBatimentAcceptable\(nouveau\)/);
    const w = MAIN.indexOf("ipcMain.handle('batiments:write'");
    assert.match(MAIN.slice(w, w + 700), /\.tmp'[\s\S]*rename/);
  });
});
