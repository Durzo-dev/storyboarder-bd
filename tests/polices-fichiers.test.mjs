/**
 * tests/polices-fichiers.test.mjs : lire un fichier de police (#423). Le nom de FAMILLE (pas celui
 * du fichier, demandé), la graisse, l'italique, les graisses d'une police variable, la licence et
 * les droits déclarés ; puis le regroupement des fichiers en familles.
 *
 * Les WOFF2 sont les vrais fichiers embarqués (assets/fonts) ; TTF et WOFF sont fabriqués ici, au
 * plus court, avec exactement les tables que le lecteur consulte.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { lirePolice, regrouperEnFamilles, base128 } = require('../electron/bibliotheque/polices-fichiers.js');
const asset = (f) => readFileSync(new URL('../assets/fonts/' + f, import.meta.url));

/** Une table `name` : des chaînes Windows (UTF-16 BE, anglais). */
function tableName(chaines){
  const entrees = Object.entries(chaines).map(([id, s]) => {
    const le = Buffer.from(s, 'utf16le'); const be = Buffer.from(le); be.swap16();
    return { id: Number(id), octets: be };
  });
  const tete = Buffer.alloc(6 + entrees.length * 12);
  tete.writeUInt16BE(0, 0); tete.writeUInt16BE(entrees.length, 2); tete.writeUInt16BE(tete.length, 4);
  let decalage = 0;
  entrees.forEach((e, i) => {
    const r = 6 + i * 12;
    tete.writeUInt16BE(3, r); tete.writeUInt16BE(1, r + 2); tete.writeUInt16BE(0x409, r + 4);
    tete.writeUInt16BE(e.id, r + 6); tete.writeUInt16BE(e.octets.length, r + 8); tete.writeUInt16BE(decalage, r + 10);
    decalage += e.octets.length;
  });
  return Buffer.concat([tete, ...entrees.map(e => e.octets)]);
}
/** Une table `OS/2` réduite à ce qu'on lit : graisse, fsType, fsSelection. */
function tableOS2({ graisse = 400, italique = false, fsType = 0 } = {}){
  const t = Buffer.alloc(78);
  t.writeUInt16BE(graisse, 4); t.writeUInt16BE(fsType, 8); t.writeUInt16BE(italique ? 1 : 0, 62);
  return t;
}
/** Un TTF : en-tête, table des tables, tables. */
function ttf(tables){
  const tags = Object.keys(tables);
  const tete = Buffer.alloc(12 + tags.length * 16);
  tete.writeUInt32BE(0x00010000, 0); tete.writeUInt16BE(tags.length, 4);
  let decalage = tete.length;
  tags.forEach((tag, i) => {
    const r = 12 + i * 16;
    tete.write(tag, r, 'latin1'); tete.writeUInt32BE(decalage, r + 8); tete.writeUInt32BE(tables[tag].length, r + 12);
    decalage += tables[tag].length;
  });
  return Buffer.concat([tete, ...tags.map(t => tables[t])]);
}
/** Un WOFF 1 : chaque table compressée par zlib quand elle y gagne, brute sinon (comme la norme). */
function woff(tables){
  const tags = Object.keys(tables);
  const comp = tags.map(t => { const z = deflateSync(tables[t]); return z.length < tables[t].length ? z : tables[t]; });
  const tete = Buffer.alloc(44 + tags.length * 20);
  tete.write('wOFF', 0, 'latin1'); tete.writeUInt16BE(tags.length, 12);
  let decalage = tete.length;
  tags.forEach((tag, i) => {
    const r = 44 + i * 20;
    tete.write(tag, r, 'latin1'); tete.writeUInt32BE(decalage, r + 4);
    tete.writeUInt32BE(comp[i].length, r + 8); tete.writeUInt32BE(tables[tag].length, r + 12);
    decalage += comp[i].length;
  });
  return Buffer.concat([tete, ...comp]);
}

describe('lire une police', () => {
  test('WOFF2 : le nom de famille, la graisse, l\'italique (fichiers embarqués)', () => {
    const i = lirePolice(asset('ComicNeue-700-italic-latin.woff2'));
    assert.equal(i.famille, 'Comic Neue');
    assert.equal(i.graisse, 700);
    assert.equal(i.italique, true);
    assert.equal(i.format, 'woff2');
    assert.match(i.copyright, /Comic Neue Project Authors/);
    assert.match(i.url, /OFL|openfontlicense/i);
    assert.equal(i.droits, 'installable');
  });

  test('une police VARIABLE : ses graisses, et un nom de famille sans le mot de graisse', () => {
    const i = lirePolice(asset('Nunito-latin.woff2'));
    assert.deepEqual(i.graisses, [200, 1000]);
    assert.equal(i.famille, 'Nunito', 'le nom 1 de la Nunito variable est « Nunito ExtraLight »');
  });

  test('TTF : nom 16 préféré au nom 1, licence et adresse', () => {
    const i = lirePolice(ttf({
      name: tableName({ 1: 'Ma Police Light', 2: 'Regular', 13: 'Licence libre', 14: 'https://exemple.org/licence', 16: 'Ma Police' }),
      'OS/2': tableOS2({ graisse: 300 }),
    }));
    assert.equal(i.famille, 'Ma Police');
    assert.equal(i.graisse, 300);
    assert.equal(i.licence, 'Licence libre');
    assert.equal(i.url, 'https://exemple.org/licence');
    assert.equal(i.format, 'sfnt');
  });

  test('WOFF : tables compressées, droits restreints', () => {
    const i = lirePolice(woff({ name: tableName({ 1: 'Restreinte', 2: 'Bold Italic' }), 'OS/2': tableOS2({ graisse: 700, italique: true, fsType: 2 }) }));
    assert.equal(i.famille, 'Restreinte');
    assert.equal(i.italique, true);
    assert.equal(i.droits, 'restreinte');
    assert.equal(lirePolice(woff({ name: tableName({ 1: 'X' }), 'OS/2': tableOS2({ fsType: 4 }) })).droits, 'apercu');
  });

  test('un fichier illisible rend null, sans lever', () => {
    assert.equal(lirePolice(Buffer.from('ceci n\'est pas une police')), null);
    assert.equal(lirePolice(Buffer.alloc(0)), null);
    assert.equal(lirePolice(ttf({ 'OS/2': tableOS2() })), null, 'sans nom, pas de police');
    const tronque = asset('Kanit-400-latin.woff2').subarray(0, 200);
    assert.equal(lirePolice(tronque), null);
  });

  test('UIntBase128 (WOFF2)', () => {
    assert.deepEqual(base128(Buffer.from([0x3f]), 0), { v: 63, taille: 1 });
    assert.deepEqual(base128(Buffer.from([0x81, 0x00]), 0), { v: 128, taille: 2 });
  });
});

describe('regrouper en familles', () => {
  test('les fichiers d\'une même police n\'en font qu\'une, avec ses vraies variantes', () => {
    const lus = ['Kanit-400-latin.woff2', 'Kanit-700-italic-latin.woff2', 'Bangers-400-latin.woff2']
      .map(f => ({ fichier: f, info: lirePolice(asset(f)) }));
    const f = regrouperEnFamilles(lus);
    assert.deepEqual(f.map(x => x.famille), ['Kanit', 'Bangers']);
    const kanit = f[0];
    assert.equal(kanit.fichiers.length, 2);
    assert.equal(kanit.gras, 'vrai');
    assert.equal(kanit.italique, 'vrai');
    assert.equal(f[1].gras, 'simule', 'Bangers n\'a pas de gras : il sera simulé');
  });

  test('une police variable qui monte à 600 a un vrai gras', () => {
    const f = regrouperEnFamilles([{ fichier: 'n.woff2', info: lirePolice(asset('Nunito-latin.woff2')) }]);
    assert.equal(f[0].gras, 'vrai');
    assert.equal(f[0].italique, 'simule');
  });

  test('les droits les plus restrictifs l\'emportent', () => {
    const a = { fichier: 'a', info: { famille: 'F', graisse: 400, italique: false, droits: 'installable' } };
    const b = { fichier: 'b', info: { famille: 'F', graisse: 700, italique: false, droits: 'restreinte' } };
    assert.equal(regrouperEnFamilles([a, b])[0].droits, 'restreinte');
  });
});
