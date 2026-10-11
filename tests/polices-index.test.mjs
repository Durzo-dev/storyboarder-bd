/**
 * tests/polices-index.test.mjs : les décisions sur les polices de l'utilisateur (#423) — l'index du
 * dossier Polices, les conflits de nom à l'import, les renommages qui ne réécrivent aucun Projet —
 * et le câblage des canaux fonts:* (inspecté, Electron étant hors de portée).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../electron/bibliotheque/polices.js');
const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const vide = () => P.indexLu(null);

describe('l\'index', () => {
  test('absent, illisible ou édité à la main : jamais d\'exception, seulement ce qui a la bonne forme', () => {
    const neuf = { familles: [], renommages: {}, usages: null, usagesDesPolices: {} };
    assert.deepEqual(vide(), neuf, 'usages null : jamais amorcés');
    assert.deepEqual(P.indexLu('{pas du json'), neuf);
    const i = P.indexLu({
      familles: [{ nom: 'A', fichiers: ['a.ttf', '../b.ttf', 'c.exe'] }, { nom: 'a', fichiers: ['d.otf'] }, { nom: '', fichiers: ['e.ttf'] }, { nom: 'Vide', fichiers: [] }],
      renommages: { X: 'Y', Z: 3, W: 'W' },
    });
    assert.deepEqual(i.familles, [{ nom: 'A', fichiers: ['a.ttf'] }]);
    assert.deepEqual(i.renommages, { X: 'Y' });
  });

  test('un nom de fichier sûr, et unique dans le dossier', () => {
    assert.equal(P.fichierPoliceAcceptable('Ma Police.woff2'), true);
    assert.equal(P.fichierPoliceAcceptable('../x.ttf'), false);
    assert.equal(P.fichierPoliceAcceptable('.cache.ttf'), false);
    assert.equal(P.fichierPoliceAcceptable('x.exe'), false);
    assert.equal(P.nomDeFichierPolice('Komika Axis.TTF', new Set(['komika axis.ttf'])), 'Komika Axis-2.ttf');
    assert.equal(P.nomDeFichierPolice('Ko<mi>ka?.ttf', new Set()), 'Ko_mi_ka_.ttf');
  });
});

describe('l\'import', () => {
  const familles = [{ famille: 'Komika', fichiers: [{ fichier: 'k.ttf' }, { fichier: 'kb.ttf' }] }];

  test('un nom déjà pris est signalé : par une police importée ou intégrée', () => {
    const index = { familles: [{ nom: 'Komika', fichiers: ['old.ttf'] }], renommages: {} };
    assert.equal(P.propositionsDImport(index, familles)[0].conflit, 'importee');
    assert.equal(P.propositionsDImport(vide(), [{ famille: 'Bangers', fichiers: [] }], ['Bangers'])[0].conflit, 'integree');
    assert.equal(P.propositionsDImport(vide(), familles)[0].conflit, null);
  });

  test('ajouter, remplacer, garder les deux, passer', () => {
    assert.deepEqual(P.appliquerImport(vide(), familles).index.familles, [{ nom: 'Komika', fichiers: ['k.ttf', 'kb.ttf'] }]);
    const index = { familles: [{ nom: 'Komika', fichiers: ['old.ttf'] }], renommages: {} };
    const r = P.appliquerImport(index, familles, { Komika: 'remplacer' });
    assert.deepEqual(r.index.familles, [{ nom: 'Komika', fichiers: ['k.ttf', 'kb.ttf'] }]);
    assert.deepEqual(r.retires, ['old.ttf'], 'les fichiers remplacés sont à effacer');
    assert.deepEqual(P.appliquerImport(index, familles, { Komika: 'garder' }).index.familles.map(f => f.nom), ['Komika', 'Komika (2)']);
    assert.deepEqual(P.appliquerImport(index, familles, { Komika: 'passer' }).index.familles.map(f => f.nom), ['Komika']);
    assert.equal(index.familles[0].fichiers[0], 'old.ttf', 'l\'index reçu n\'est pas modifié');
    // Une intégrée n'est jamais remplacée : « garder les deux » prend un autre nom.
    assert.deepEqual(P.appliquerImport(vide(), [{ famille: 'Bangers', fichiers: [{ fichier: 'b.ttf' }] }], {}, ['Bangers']).index.familles.map(f => f.nom), ['Bangers (2)']);
  });
});

describe('renommer et supprimer', () => {
  const index = { familles: [{ nom: 'A', fichiers: ['a.ttf'] }, { nom: 'B', fichiers: ['b.ttf'] }], renommages: {} };

  test('renommer garde le chemin de l\'ancien nom, en chaîne, sans boucle', () => {
    const r1 = P.renommer(index, 'A', 'A2').index;
    assert.deepEqual(r1.familles.map(f => f.nom), ['A2', 'B']);
    assert.equal(P.nomCourant(r1, 'A'), 'A2');
    const r2 = P.renommer(r1, 'A2', 'A3').index;
    assert.equal(P.nomCourant(r2, 'A'), 'A3', 'A → A2 → A3 se résout jusqu\'au bout');
    const retour = P.renommer(r2, 'A3', 'A').index;
    assert.equal(P.nomCourant(retour, 'A'), 'A', 'revenir au premier nom ne laisse pas de boucle');
    assert.equal(P.nomCourant(retour, 'A2'), 'A');
  });

  test('refusé : vide, inconnu, déjà pris (intégrées comprises, sans la casse)', () => {
    assert.equal(P.renommer(index, 'A', '  ').erreur, 'vide');
    assert.equal(P.renommer(index, 'Z', 'Y').erreur, 'inconnue');
    assert.equal(P.renommer(index, 'A', 'b').erreur, 'pris');
    assert.equal(P.renommer(index, 'A', 'bangers', ['Bangers']).erreur, 'pris');
  });

  test('supprimer rend les fichiers à effacer', () => {
    const r = P.supprimer(index, 'B');
    assert.deepEqual(r.index.familles.map(f => f.nom), ['A']);
    assert.deepEqual(r.retires, ['b.ttf']);
    assert.deepEqual(P.supprimer(index, 'Z').retires, []);
  });
});

describe('le câblage (electron/main.js, preload.js)', () => {
  const main = lire('electron/main.js');
  const pre = lire('electron/preload.js');
  test('six canaux, tous exposés par le pont', () => {
    for (const c of ['list', 'read', 'pick', 'commit', 'rename', 'delete']) {
      assert.match(main, new RegExp(`ipcMain\\.handle\\('fonts:${c}'`), c);
      assert.match(pre, new RegExp(`ipcRenderer\\.invoke\\('fonts:${c}'`), c);
    }
  });
  test('le processus principal se défend : nom de fichier vérifié, index écrit à côté puis renommé', () => {
    assert.match(main, /ipcMain\.handle\('fonts:read', async \(event, fichier\) => \{\n {2}if \(!polices\.fichierPoliceAcceptable\(fichier\)\)/);
    assert.match(main, /await fs\.promises\.rename\(cible \+ '\.tmp', cible\);/);
    assert.match(main, /return path\.join\(getProjectsDir\(\), 'Polices'\);/);
  });
});

describe('les usages (comme les tags du store)', () => {
  const depart = { usages: [{ id: 'u1', nom: 'Dialogue BD' }, { id: 'u2', nom: 'Cris' }], usagesDesPolices: { 'Comic Neue': ['u1'], Kanit: ['u2'] } };

  test('la première opération amorce les usages d\'origine', () => {
    const r = P.operationUsage(vide(), 'creer', { nom: 'Murmures' }, depart);
    assert.deepEqual(r.index.usages.map(u => u.nom), ['Dialogue BD', 'Cris', 'Murmures']);
    assert.equal(r.id, 'u3');
    assert.deepEqual(r.index.usagesDesPolices, depart.usagesDesPolices);
  });

  test('créer un nom existant rend l\'existant ; un nom vide est refusé', () => {
    assert.equal(P.operationUsage(vide(), 'creer', { nom: ' cris ' }, depart).id, 'u2');
    assert.equal(P.operationUsage(vide(), 'creer', { nom: '  ' }, depart).erreur, 'vide');
  });

  test('renommer : refusé si vide, inconnu ou pris', () => {
    const base = P.operationUsage(vide(), 'creer', { nom: 'X' }, depart).index;
    assert.equal(P.operationUsage(base, 'renommer', { id: 'u1', nom: 'Dialogue' }).index.usages[0].nom, 'Dialogue');
    assert.equal(P.operationUsage(base, 'renommer', { id: 'u1', nom: 'cris' }).erreur, 'pris');
    assert.equal(P.operationUsage(base, 'renommer', { id: 'u9', nom: 'Y' }).erreur, 'inconnu');
  });

  test('poser, retirer, supprimer : les attributions suivent', () => {
    let i = P.operationUsage(vide(), 'poser', { police: 'Kanit', id: 'u1', actif: true }, depart).index;
    assert.deepEqual(i.usagesDesPolices.Kanit, ['u2', 'u1']);
    i = P.operationUsage(i, 'poser', { police: 'Kanit', id: 'u2', actif: false }).index;
    assert.deepEqual(i.usagesDesPolices.Kanit, ['u1']);
    i = P.operationUsage(i, 'supprimer', { id: 'u1' }).index;
    assert.equal(i.usagesDesPolices.Kanit, undefined, 'plus d\'usage : plus d\'entrée');
    assert.equal(i.usagesDesPolices['Comic Neue'], undefined);
    assert.deepEqual(i.usages.map(u => u.id), ['u2']);
  });

  test('renommer ou supprimer une police déplace ou retire ses usages', () => {
    const base = { familles: [{ nom: 'A', fichiers: ['a.ttf'] }], renommages: {}, usages: [{ id: 'u1', nom: 'Z' }], usagesDesPolices: { A: ['u1'] } };
    assert.deepEqual(P.renommer(base, 'A', 'B').index.usagesDesPolices, { B: ['u1'] });
    assert.deepEqual(P.supprimer(base, 'A').index.usagesDesPolices, {});
  });

  test('relu du disque : forme vérifiée, ids inconnus écartés', () => {
    const i = P.indexLu({ usages: [{ id: 'u1', nom: 'A' }, { id: 'u1', nom: 'B' }, { nom: 'C' }], usagesDesPolices: { X: ['u1', 'u9'], Y: [] } });
    assert.deepEqual(i.usages, [{ id: 'u1', nom: 'A' }]);
    assert.deepEqual(i.usagesDesPolices, { X: ['u1'] });
  });

  test('le canal fonts:usage', () => {
    assert.match(lire('electron/main.js'), /ipcMain\.handle\('fonts:usage', async \(event, op, args, depart\) => \{/);
    assert.match(lire('electron/preload.js'), /fontUsageOperation: \(op, args, depart\) => ipcRenderer\.invoke\('fonts:usage', op, args, depart\)/);
  });
});
