/**
 * tests/chapitres.test.mjs : les Chapitres d'un Tome (facultatifs, numérotation continue).
 * Fonctions pures, exécutées.
 */
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  normaliserChapitres, segmentsDuTome, creerChapitre, renommerChapitre, supprimerChapitre,
  deplacerChapitre, deplacerPlanche, indexDuChapitre, chapitrePourNouvellePlanche, nomParDefautDuChapitre,
} from '../src/chapitres.js';

const tome = (n = 4) => ({ id: 't1', pages: Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + 1), objects: [] })) });
const ordre = (t) => t.pages.map(p => p.id + (p.chapitreId ? '@' + p.chapitreId : ''));

describe('Un Tome sans chapitre', () => {
  test('reste tel quel : aucun champ ajouté, un seul groupe', () => {
    const t = tome();
    normaliserChapitres(t);
    assert.equal('chapitres' in t, false);
    assert.ok(t.pages.every(p => !('chapitreId' in p)));
    const s = segmentsDuTome(t);
    assert.equal(s.length, 1);
    assert.equal(s[0].chapitre, null);
    assert.deepEqual(s[0].pages.map(x => x.index), [0, 1, 2, 3]);
  });
});

describe('Créer, renommer, supprimer', () => {
  test('noms par défaut « Chapitre N », jamais repris tant qu\'il existe', () => {
    const t = tome();
    assert.equal(creerChapitre(t).nom, 'Chapitre 1');
    assert.equal(creerChapitre(t).nom, 'Chapitre 2');
    renommerChapitre(t, 'ch1', 'Prologue');
    assert.equal(nomParDefautDuChapitre(t), 'Chapitre 3');
    assert.equal(renommerChapitre(t, 'ch2', '   '), false, 'un nom vide est refusé');
  });
  test('supprimer un chapitre GARDE ses Planches, qui remontent sous le Tome', () => {
    const t = tome();
    creerChapitre(t);
    deplacerPlanche(t, 'p3', { chapitreId: 'ch1' });
    deplacerPlanche(t, 'p4', { chapitreId: 'ch1' });
    assert.equal(supprimerChapitre(t, 'ch1'), 2);
    assert.equal(t.pages.length, 4);
    assert.ok(t.pages.every(p => !p.chapitreId));
    assert.deepEqual(t.chapitres, []);
  });
});

describe('Déplacer', () => {
  test('une Planche entre dans un chapitre, à la fin, et les Planches restent CONTIGUËS', () => {
    const t = tome(5);
    creerChapitre(t); creerChapitre(t);
    deplacerPlanche(t, 'p1', { chapitreId: 'ch2' });
    deplacerPlanche(t, 'p2', { chapitreId: 'ch1' });
    deplacerPlanche(t, 'p5', { chapitreId: 'ch1' });
    // Sans chapitre en tête, puis ch1, puis ch2.
    assert.deepEqual(ordre(t), ['p3', 'p4', 'p2@ch1', 'p5@ch1', 'p1@ch2']);
    assert.deepEqual(indexDuChapitre(t, 'ch1'), [2, 3]);
  });
  test('avant une Planche donnée du même groupe', () => {
    const t = tome(3);
    creerChapitre(t);
    ['p1', 'p2', 'p3'].forEach(id => deplacerPlanche(t, id, { chapitreId: 'ch1' }));
    deplacerPlanche(t, 'p3', { chapitreId: 'ch1', avantPageId: 'p1' });
    assert.deepEqual(ordre(t), ['p3@ch1', 'p1@ch1', 'p2@ch1']);
  });
  test('réordonner les chapitres emporte leurs Planches, numérotation continue', () => {
    const t = tome(4);
    creerChapitre(t); creerChapitre(t);
    deplacerPlanche(t, 'p1', { chapitreId: 'ch1' }); deplacerPlanche(t, 'p2', { chapitreId: 'ch1' });
    deplacerPlanche(t, 'p3', { chapitreId: 'ch2' }); deplacerPlanche(t, 'p4', { chapitreId: 'ch2' });
    deplacerChapitre(t, 'ch2', 0);
    assert.deepEqual(t.chapitres.map(c => c.id), ['ch2', 'ch1']);
    assert.deepEqual(ordre(t), ['p3@ch2', 'p4@ch2', 'p1@ch1', 'p2@ch1']);
  });
  test('vers un chapitre inconnu : refusé, rien ne bouge', () => {
    const t = tome(2);
    assert.equal(deplacerPlanche(t, 'p1', { chapitreId: 'nope' }), false);
    assert.deepEqual(ordre(t), ['p1', 'p2']);
  });
});

describe('Un fichier incohérent est réparé à la lecture', () => {
  test('chapitre inconnu oublié, Planches regroupées', () => {
    const t = tome(4);
    t.chapitres = [{ id: 'a', nom: 'A' }];
    t.pages[0].chapitreId = 'a'; t.pages[2].chapitreId = 'a'; t.pages[3].chapitreId = 'fantome';
    normaliserChapitres(t);
    assert.deepEqual(ordre(t), ['p2', 'p4', 'p1@a', 'p3@a']);
  });
  test('les segments montrent les chapitres VIDES, et le groupe sans chapitre seulement s\'il a des Planches', () => {
    const t = tome(1);
    creerChapitre(t);
    deplacerPlanche(t, 'p1', { chapitreId: 'ch1' });
    creerChapitre(t);
    const s = segmentsDuTome(t);
    assert.deepEqual(s.map(x => x.chapitre && x.chapitre.id), ['ch1', 'ch2']);
    assert.equal(s[1].pages.length, 0);
  });
  test('une nouvelle Planche va dans le DERNIER chapitre', () => {
    const t = tome(1);
    assert.equal(chapitrePourNouvellePlanche(t), null);
    creerChapitre(t); creerChapitre(t);
    assert.equal(chapitrePourNouvellePlanche(t), 'ch2');
  });
});

describe('Le branchement', () => {
  const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  test('l\'arbre range les Planches par chapitre, repliable, et le dépôt passe par chapitres.js', () => {
    const PT = lire('src/project-tree.js');
    assert.match(PT, /segmentsDuTome\(t\)\.forEach\(seg => \{/);
    assert.match(PT, /const cle = 'chapitre:' \+ t\.id \+ ':' \+ ch\.id;/);
    assert.match(PT, /apres\(\(\) => deplacerPlanche\(t, id, \{ chapitreId: p\.chapitreId \|\| null, avantPageId \}\)\);/);
    assert.match(PT, /apres\(\(\) => deplacerChapitre\(t, id, vers\)\);/);
    assert.match(PT, /const _chNouvelle = chapitrePourNouvellePlanche\(t\);/);
  });
  test('menu du chapitre (renommer, exporter, supprimer) et « Retirer du chapitre »', () => {
    const EV = lire('src/events.js');
    assert.match(EV, /exportPages\(ti, indexDuChapitre\(S\.tomes\[ti\], id\)\)/);
    assert.match(EV, /supprimerChapitre\(t, id\);/);
    assert.match(EV, /deplacerPlanche\(t, pg\.id, \{ chapitreId: null \}\);/);
    assert.match(lire('index.html'), /id="chapterContextMenu"/);
  });
  test('un fichier est remis en ordre à la lecture, Planche courante suivie par son id', () => {
    const IO = lire('src/io.js');
    assert.match(IO, /if \(!t \|\| !Array\.isArray\(t\.chapitres\) \|\| !t\.chapitres\.length\) return;\n    const courante/);
  });
});
