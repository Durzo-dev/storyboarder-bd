/**
 * tests/i18n-libelles.test.mjs — #461 : les traductions par champ TROUVENT leur libellé.
 *
 * Trouvé en basculant le système de design en anglais : « Taille réelle », « Longueur du mur »,
 * « Intensité »… avaient une entrée dans I18N_PREV_LABEL, mais le code cherchait le libellé JUSTE
 * AVANT le champ, et ces champs sont enveloppés (un curseur et sa valeur dans un `<div>`) : la
 * traduction n'était jamais posée, sans un signal. Ce test rejoue, sur le HTML, la recherche
 * d'etiquetteDuChamp et vérifie que chaque entrée tombe sur le libellé dont elle porte le français.
 */
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { I18N_PREV_LABEL, I18N_CASES, I18N_AVANT_NOMBRE } from '../src/i18n.js';

const HTML = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const debutDe = (id) => { const i = HTML.indexOf(`id="${id}"`); assert.ok(i >= 0, `#${id} absent d'index.html`); return HTML.lastIndexOf('<', i); };
const texteDe = (t) => t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Le libellé que trouverait etiquetteDuChamp : <label for>, sinon ce qui précède, en remontant les enveloppes. */
function libelleDuChamp(id){
  const pour = new RegExp(`<label[^>]*for="${id}"[^>]*>([\\s\\S]*?)</label>`).exec(HTML);
  if (pour) return texteDe(pour[1]);
  let avant = HTML.slice(0, debutDe(id)).replace(/\s+$/, '');
  for (let k = 0; k < 4; k++) {
    const ouvrante = /<(div|span)\b[^>]*>$/.exec(avant);
    if (!ouvrante) break;
    avant = avant.slice(0, ouvrante.index).replace(/\s+$/, '');
  }
  const m = /<label\b[^>]*>([^<]*)<\/label>$/.exec(avant);
  return m ? texteDe(m[1]) : null;
}

describe('#461 : chaque traduction par champ trouve son libellé', () => {
  test('I18N_PREV_LABEL : le libellé trouvé porte bien le français de l\'entrée', () => {
    const faux = I18N_PREV_LABEL.filter(([id, , fr]) => libelleDuChamp(id) !== fr)
      .map(([id, , fr]) => `#${id} : attendu « ${fr} », trouvé « ${libelleDuChamp(id)} »`);
    assert.deepEqual(faux, [], 'ces traductions ne seraient jamais posées');
  });
  test('RÉGRESSION : les champs enveloppés qui ne se traduisaient pas', () => {
    for (const id of ['personaSizeInput', 'objectSizeInput', 'objectWallLengthInput', 'objectWallHeightInput', 'objectLightIntensityRange']) {
      assert.ok(I18N_PREV_LABEL.some(e => e[0] === id), `#${id} doit rester traduit`);
      assert.ok(libelleDuChamp(id), `#${id} : libellé introuvable`);
    }
  });
  test('I18N_CASES : chaque case est suivie, dans son libellé, du français de l\'entrée', () => {
    const faux = I18N_CASES.filter(([id, , fr]) => {
      const apres = HTML.slice(HTML.indexOf('>', HTML.indexOf(`id="${id}"`)) + 1);
      return texteDe(apres.slice(0, apres.indexOf('</label>'))) !== fr;
    }).map(e => e[0]);
    assert.deepEqual(faux, []);
  });
  test('I18N_AVANT_NOMBRE : chaque libellé commence par le français de l\'entrée', () => {
    const faux = I18N_AVANT_NOMBRE.filter(([sel, , fr]) => {
      const id = /for="([^"]+)"/.exec(sel)[1];
      const m = new RegExp(`<label[^>]*for="${id}"[^>]*>([^<]*)`).exec(HTML);
      return !m || m[1] !== fr;
    }).map(e => e[0]);
    assert.deepEqual(faux, []);
  });
});
