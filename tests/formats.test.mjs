// #453 : les formats d'un Projet (src/formats.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatsParDefaut, trouverFormat, nomDuFormat, libelleDuFormat, pxParMm, dimensionsDuFormat,
  creerFormat, renommerFormat, tomesDuFormat, suppressionPossible, supprimerFormat, appliquerFormat,
  formatAuxDimensions, normaliserFormats,
} from '../src/formats.js';
import { FORMATS } from '../src/constants.js';

const fr = (en, frs) => frs;
const en = (en) => en;

describe('formats de départ', () => {
  test('une copie des quatre formats intégrés, sans nom (il suit la langue)', () => {
    const l = formatsParDefaut();
    assert.deepEqual(l.map(f => f.key), FORMATS.map(f => f.key));
    assert.ok(l.every(f => f.nom === undefined));
    l[0].w = 1;
    assert.equal(FORMATS[0].w, 550, 'une copie, pas les constantes');
  });
  test('nom et libellé dans la langue courante, ou le nom donné', () => {
    const fb = trouverFormat(formatsParDefaut(), 'fb');
    assert.equal(nomDuFormat(fb, fr), 'Franco-Belge');
    assert.equal(nomDuFormat(fb, en), 'Franco-Belgian');
    assert.equal(libelleDuFormat(fb, fr), 'Franco-Belge (220×290mm)');
    assert.equal(libelleDuFormat({ ...fb, nom: 'Album' }, en), 'Album (220×290mm)');
    assert.equal(libelleDuFormat(trouverFormat(formatsParDefaut(), 'custom'), fr), 'Format personnalisé (1440×1980px)');
  });
  test('les dimensions annoncées des intégrés correspondent à leurs dimensions réelles', () => {
    for (const f of FORMATS) {
      const d = dimensionsDuFormat(f.largeur, f.hauteur, f.unite);
      if (f.unite === 'px') assert.equal(d.w * d.scale >= f.largeur - d.scale, true, f.key);
      else assert.equal(d.mmW, f.mmW, f.key);
    }
    const webtoon = dimensionsDuFormat(800, 1280, 'px');
    assert.deepEqual([webtoon.w, webtoon.h, webtoon.scale], [400, 640, 2]);
  });
});

describe('pxParMm', () => {
  test('w / mmW, et 96 dpi sans format', () => {
    assert.equal(pxParMm(trouverFormat(formatsParDefaut(), 'fb')), 2.5);
    assert.equal(pxParMm(undefined), 96 / 25.4);
  });
  test('un format créé en mm donne des mm justes', () => {
    const l = formatsParDefaut();
    const { format } = creerFormat(l, { nom: 'A4', largeur: 210, hauteur: 297, unite: 'mm' }, fr);
    assert.equal(format.h, 725);
    assert.ok(Math.abs(format.w / pxParMm(format) - 210) < 0.01);
    assert.ok(Math.abs(format.h / pxParMm(format) - 297) < 1);
  });
});

describe('créer', () => {
  test('en mm : le plus grand côté à 725, export ×4 ; à l’italienne aussi', () => {
    const l = formatsParDefaut();
    const { format } = creerFormat(l, { nom: 'Italienne', largeur: 300, hauteur: 200, unite: 'mm' }, fr);
    assert.deepEqual([format.w, format.h, format.scale, format.unite], [725, 483, 4, 'mm']);
    assert.equal(l.length, 5);
    assert.equal(format.key, 'f1');
  });
  test('en px : réduit à l’écran, rendu à sa taille par l’export', () => {
    const { format } = creerFormat(formatsParDefaut(), { nom: 'Strip', largeur: 3000, hauteur: 1000, unite: 'px' }, fr);
    assert.deepEqual([format.w, format.h, format.scale], [1000, 333, 3]);
  });
  test('refus : nom vide, nom déjà pris (y compris celui d’un intégré), dimensions, allongement', () => {
    const l = formatsParDefaut();
    assert.equal(creerFormat(l, { nom: '  ', largeur: 100, hauteur: 100, unite: 'mm' }, fr).erreur, 'nom');
    assert.equal(creerFormat(l, { nom: 'franco-belge', largeur: 100, hauteur: 100, unite: 'mm' }, fr).erreur, 'doublon');
    assert.equal(creerFormat(l, { nom: 'X', largeur: 0, hauteur: 100, unite: 'mm' }, fr).erreur, 'dimensions');
    assert.equal(creerFormat(l, { nom: 'X', largeur: 'abc', hauteur: 100, unite: 'px' }, fr).erreur, 'dimensions');
    assert.equal(creerFormat(l, { nom: 'X', largeur: 50, hauteur: 2000, unite: 'mm' }, fr).erreur, 'allongement');
    assert.equal(l.length, 4);
  });
});

describe('renommer', () => {
  test('seul le nom change, intégré compris', () => {
    const l = formatsParDefaut();
    const avant = { ...trouverFormat(l, 'fb') };
    assert.deepEqual(renommerFormat(l, 'fb', ' Album ', fr), { ok: true });
    const apres = trouverFormat(l, 'fb');
    assert.equal(apres.nom, 'Album');
    assert.deepEqual({ ...apres, nom: undefined }, { ...avant, nom: undefined });
  });
  test('refus : inconnu, vide, doublon ; garder son propre nom est permis', () => {
    const l = formatsParDefaut();
    assert.equal(renommerFormat(l, 'zz', 'A', fr).erreur, 'inconnu');
    assert.equal(renommerFormat(l, 'fb', '', fr).erreur, 'nom');
    assert.equal(renommerFormat(l, 'fb', 'Comics US', fr).erreur, 'doublon');
    assert.deepEqual(renommerFormat(l, 'fb', 'Franco-Belge', fr), { ok: true });
  });
});

describe('supprimer', () => {
  test('interdit tant qu’un Tome l’utilise, permis ensuite (intégré compris)', () => {
    const l = formatsParDefaut();
    const tomes = [{ name: 'Tome 1', format: 'fb' }, { name: 'Tome 2', format: 'us' }];
    const r = supprimerFormat(l, 'fb', tomes);
    assert.equal(r.erreur, 'utilise');
    assert.deepEqual(r.tomes.map(t => t.name), ['Tome 1']);
    assert.equal(l.length, 4);
    assert.deepEqual(supprimerFormat(l, 'webtoon', tomes), { ok: true });
    assert.equal(trouverFormat(l, 'webtoon'), undefined);
    assert.deepEqual(tomesDuFormat(tomes, 'us').map(t => t.name), ['Tome 2']);
  });
  test('jamais le dernier', () => {
    const l = [formatsParDefaut()[0]];
    assert.equal(suppressionPossible(l, 'fb', []).erreur, 'dernier');
    assert.equal(suppressionPossible(l, 'zz', []).erreur, 'inconnu');
  });
});

describe('appliquer et retrouver', () => {
  test('le Tome copie clé et dimensions', () => {
    const t = { format: 'fb', w: 550, h: 725, scale: 4 };
    appliquerFormat(t, trouverFormat(formatsParDefaut(), 'webtoon'));
    assert.deepEqual(t, { format: 'webtoon', w: 400, h: 640, scale: 2 });
  });
  test('formatAuxDimensions réutilise un format existant, sinon en crée un au nom libre', () => {
    const l = formatsParDefaut();
    assert.equal(formatAuxDimensions(l, 550, 725, 4, 'Format personnalisé', fr).key, 'fb');
    const a = formatAuxDimensions(l, 500, 725, 4, 'Format personnalisé', fr);
    assert.equal(a.nom, 'Format personnalisé 2', '« Format personnalisé » est pris par l’intégré');
    assert.deepEqual([a.w, a.h, a.scale, a.largeur, a.hauteur, a.unite], [500, 725, 4, 2000, 2900, 'px']);
    assert.equal(formatAuxDimensions(l, 500, 725, 4, 'Format personnalisé', fr), a);
  });
});

describe('normaliserFormats (lecture d’un Projet)', () => {
  test('un Projet d’avant #453 reçoit les formats de départ', () => {
    const tomes = [{ format: 'fb', w: 550, h: 725, scale: 4 }];
    const l = normaliserFormats(undefined, tomes, fr);
    assert.deepEqual(l.map(f => f.key), ['fb', 'us', 'webtoon', 'custom']);
    assert.equal(tomes[0].format, 'fb');
  });
  test('un Tome « personnalisé » à d’autres dimensions (planche importée) reçoit son format ; ses dimensions ne bougent pas', () => {
    const tomes = [
      { format: 'custom', w: 512, h: 725, scale: 4 },
      { format: 'custom', w: 512, h: 725, scale: 4 },
      { format: 'custom', w: 480, h: 660, scale: 3 },
    ];
    const l = normaliserFormats(undefined, tomes, fr);
    assert.equal(l.length, 5);
    assert.equal(tomes[0].format, tomes[1].format, 'mêmes dimensions, même format');
    assert.equal(trouverFormat(l, tomes[0].format).nom, 'Format personnalisé 2');
    assert.deepEqual([tomes[0].w, tomes[0].h, tomes[0].scale], [512, 725, 4]);
    assert.equal(tomes[2].format, 'custom');
  });
  test('la liste du fichier est gardée telle quelle (un intégré supprimé ne revient pas), les entrées illisibles écartées', () => {
    const lus = [{ key: 'f1', nom: 'A4', unite: 'mm', largeur: 210, hauteur: 297, w: 513, h: 725, scale: 4, mmW: 210 }, { key: 'x' }, null];
    const tomes = [{ format: 'f1', w: 513, h: 725, scale: 4 }];
    const l = normaliserFormats(lus, tomes, fr);
    assert.deepEqual(l.map(f => f.key), ['f1']);
  });
  test('une clé inconnue sans dimensions lisibles prend le premier format', () => {
    const tomes = [{ format: 'zz' }];
    const l = normaliserFormats([], tomes, fr);
    assert.equal(l.length, 4, 'liste vide : celle de départ');
    assert.deepEqual(tomes[0], { format: 'fb', w: 550, h: 725, scale: 4 });
  });
});
