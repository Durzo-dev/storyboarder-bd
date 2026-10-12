/**
 * tests/import-dafont.test.mjs : les polices venues de DaFont (#423), et leurs licences.
 *
 * L'outil lit des zips qui ne sont PAS dans le dépôt (apercus/dafont/, chez Valentin) : on ne peut
 * pas le relancer ici. On tient donc ses décisions pures, et surtout ce qu'il a ÉCRIT dans le dépôt :
 * chaque police proposée a ses fichiers, sa feuille, et sa licence à côté d'elle.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  SELECTION, VARIANTES, CODES_LICENCE, nomDeFichierDafont, formatCss, variantesDeLaSelection,
  feuilleDafont, moduleApplication, texteLicence, texteLisible,
} from '../tools/import-dafont.mjs';
import { POLICES_DAFONT } from '../src/polices-dafont.js';
import { POLICES_GOOGLE, POLICES_BULLES, USAGES_POLICES, LICENCES_POLICES } from '../src/constants.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'assets', 'fonts', 'dafont');

describe('Les décisions de l\'outil', () => {
  test('un nom de fichier stable : clé, graisse, italique, extension en minuscules', () => {
    assert.equal(nomDeFichierDafont('gargle', VARIANTES[3], 'Gargle Bd It.otf'), 'gargle-700-italic.otf');
    assert.equal(nomDeFichierDafont('odeanerik', VARIANTES[0], 'Ode-Erik.TTF'), 'odeanerik-400.ttf');
    assert.equal(formatCss('x.otf'), 'opentype');
    assert.equal(formatCss('x.ttf'), 'truetype');
  });

  test('vrai gras et vrai italique seulement quand l\'auteur les a dessinés', () => {
    assert.deepEqual(variantesDeLaSelection({ fichiers: { normal: 'a', italique: 'b' } }), { gras: 'simule', italique: 'vrai' });
    assert.deepEqual(variantesDeLaSelection({ fichiers: { normal: 'a' } }), { gras: 'simule', italique: 'simule' });
  });

  test('la feuille : un @font-face par fichier, en block, rien depuis le réseau', () => {
    const css = feuilleDafont([{ cle: 'k', nom: 'Kaph', fichiers: { normal: 'K.ttf', italique: 'Ki.ttf' } }]);
    assert.equal((css.match(/@font-face/g) || []).length, 2);
    assert.match(css, /font-family: 'Kaph';\n {2}font-style: italic;\n {2}font-weight: 400;/);
    assert.match(css, /url\(\.\/k\/k-400-italic\.ttf\) format\('truetype'\)/);
    assert.match(css, /font-display: block/);
    assert.doesNotMatch(css, /https?:/);
  });

  test('RÉGRESSION : un readme qui ne fait que NOMMER l\'OFL reçoit le texte entier', () => {
    // Morning Breeze : son readme dit « License: SIL Open Font License (OFL) », et rien de plus.
    // L'OFL exige que son texte voyage avec la police.
    const p = { nom: 'M', dossier: 'm', cle: 'm', licence: 'ofl', fichiers: { normal: 'm.otf' } };
    const t = texteLicence(p, { auteur: 'A' }, 'License: SIL Open Font License (OFL)', 'OFL\nPERMISSION & CONDITIONS\n…');
    assert.match(t, /License: SIL Open Font License \(OFL\)/);
    assert.match(t, /PERMISSION & CONDITIONS/);
    assert.match(t, /Designer: A/);
  });

  test('CC0 sans texte dans le zip : la déclaration de la police, et la licence nommée', () => {
    const p = { nom: 'F', dossier: 'foo', cle: 'foo', licence: 'cc0', fichiers: { normal: 'Foo.otf' } };
    const t = texteLicence(p, { licence: 'Please do not ask permission', copyright: 'Released in 2024 under CC0' }, null, '');
    assert.match(t, /creativecommons\.org\/publicdomain\/zero/);
    assert.match(t, /Please do not ask permission/);
    assert.match(t, /dl\.dafont\.com\/dl\/\?f=foo/);
  });

  test('un texte Latin-1 se lit sans « � »', () => {
    assert.equal(texteLisible(Buffer.from([0xA9, 0x20, 0x41])), '© A');
    assert.equal(texteLisible(Buffer.from('© A', 'utf8')), '© A');
  });

  test('le module généré se relit à l\'identique', () => {
    assert.equal(readFileSync(join(RACINE, 'src', 'polices-dafont.js'), 'utf8'), moduleApplication(SELECTION));
  });
});

describe('Ce que l\'outil a écrit dans le dépôt', () => {
  test('la sélection : clés et noms uniques, licences et usages connus, aucun doublon avec Google', () => {
    assert.equal(SELECTION.length, 55);
    assert.equal(new Set(SELECTION.map(p => p.cle)).size, SELECTION.length);
    const noms = POLICES_BULLES.map(p => p.nom.toLowerCase());
    assert.equal(new Set(noms).size, noms.length, 'deux polices intégrées portent le même nom');
    const usages = new Set(USAGES_POLICES.map(u => u.cle));
    for (const p of SELECTION) {
      assert.ok(CODES_LICENCE.includes(p.licence) && LICENCES_POLICES[p.licence], `${p.nom} : licence ${p.licence}`);
      assert.ok(p.usages.length && p.usages.every(u => usages.has(u)), `${p.nom} : usages ${p.usages}`);
      assert.match(p.cle, /^[a-z0-9]+$/);
    }
    assert.deepEqual(POLICES_BULLES.map(p => p.nom), [...POLICES_GOOGLE, ...POLICES_DAFONT].map(p => p.nom));
  });

  test('RÉGRESSION : chaque police a ses fichiers et sa licence, et rien d\'autre ne traîne', () => {
    for (const p of SELECTION) {
      const attendus = VARIANTES.filter(v => p.fichiers[v.champ]).map(v => nomDeFichierDafont(p.cle, v, p.fichiers[v.champ]));
      const d = join(DOSSIER, p.cle);
      assert.deepEqual(readdirSync(d).sort(), [...attendus, 'LICENSE.txt'].sort(), `${p.cle} : contenu du dossier`);
      const licence = readFileSync(join(d, 'LICENSE.txt'), 'utf8');
      if (p.licence === 'ofl') assert.match(licence, /PERMISSION & CONDITIONS/, `${p.nom} : texte de l'OFL absent`);
      if (p.licence === 'gpl2') assert.match(licence, /GNU GENERAL PUBLIC LICENSE/, `${p.nom} : texte de la GPL absent`);
      if (p.licence === 'ccbysa4') assert.match(licence, /Attribution-ShareAlike 4\.0/, `${p.nom} : CC BY-SA non nommée`);
      assert.doesNotMatch(licence, /�/, `${p.nom} : caractère illisible dans la licence`);
    }
    const dossiers = readdirSync(DOSSIER, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
    assert.deepEqual(dossiers, SELECTION.map(p => p.cle).sort(), 'un dossier orphelin, ou manquant');
  });

  test('la feuille du dépôt est celle que l\'outil écrirait, et style.css l\'importe', () => {
    assert.equal(readFileSync(join(DOSSIER, 'dafont.css'), 'utf8'), feuilleDafont(SELECTION));
    assert.match(readFileSync(join(RACINE, 'src', 'style.css'), 'utf8'), /@import url\('\.\.\/assets\/fonts\/dafont\/dafont\.css'\);/);
  });

  test('le récapitulatif nomme chaque police', () => {
    const md = readFileSync(join(DOSSIER, 'LICENSES.md'), 'utf8');
    assert.match(md, /DO NOT EDIT BY HAND/);
    for (const p of SELECTION) assert.ok(md.includes(`| ${p.nom} |`), `${p.nom} absente de LICENSES.md`);
    assert.ok(existsSync(join(RACINE, 'tools', 'licences', 'OFL-1.1.txt')));
  });
});
