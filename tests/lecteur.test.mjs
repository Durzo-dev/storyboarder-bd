/**
 * tests/lecteur.test.mjs : le Lecteur d'un Tome ou d'un Chapitre. Décisions pures, exécutées.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  optionsValides, OPTIONS_LECTEUR, etalements, etalementDeLaPage, pasDuCote, etapesGuidees,
  etapeDeLaPage, cadrageDansLaVue, avancer, VITESSE_MAX, coteQuiTourne,
} from '../src/lecteur.js';

const paires = (l) => l.map(e => [e.gauche, e.droite]);

describe('Les options', () => {
  test('valeurs inconnues ramenées aux défauts, vitesse bornée', () => {
    assert.deepEqual(optionsValides(null), OPTIONS_LECTEUR);
    const o = optionsValides({ double: true, sens: 'rtl', debut: 'nimporte', vitesse: 999, fond: 'vert' });
    assert.equal(o.double, true); assert.equal(o.sens, 'rtl');
    assert.equal(o.debut, OPTIONS_LECTEUR.debut); assert.equal(o.vitesse, VITESSE_MAX);
    assert.equal(o.fond, OPTIONS_LECTEUR.fond);
  });
});

describe('Les étalements', () => {
  const pages = [0, 1, 2, 3, 4];
  test('une page à la fois : chaque Planche seule', () => {
    assert.deepEqual(paires(etalements(pages)), [[0, null], [1, null], [2, null], [3, null], [4, null]]);
  });
  test('double page, lecture vers la droite, première page à DROITE : une page blanche devant', () => {
    assert.deepEqual(paires(etalements(pages, { double: true, sens: 'ltr', debut: 'droite' })),
      [[null, 0], [1, 2], [3, 4]]);
  });
  test('double page, lecture vers la droite, première page à GAUCHE : blanche à la fin si besoin', () => {
    assert.deepEqual(paires(etalements(pages, { double: true, sens: 'ltr', debut: 'gauche' })),
      [[0, 1], [2, 3], [4, null]]);
  });
  test('lecture vers la gauche (manga) : la page lue en premier est à DROITE', () => {
    assert.deepEqual(paires(etalements([0, 1, 2, 3], { double: true, sens: 'rtl', debut: 'droite' })),
      [[1, 0], [3, 2]]);
    assert.deepEqual(paires(etalements([0, 1, 2], { double: true, sens: 'rtl', debut: 'gauche' })),
      [[0, null], [2, 1]]);
  });
  test('retrouver l\'étalement d\'une Planche', () => {
    const l = etalements(pages, { double: true, debut: 'droite' });
    assert.equal(etalementDeLaPage(l, 3), 2);
    assert.equal(etalementDeLaPage(l, 99), 0);
  });
});

describe('Les flèches et les bords', () => {
  test('vers la droite : droite avance ; vers la gauche (manga) : gauche avance', () => {
    assert.equal(pasDuCote('droite', 'ltr'), 1);
    assert.equal(pasDuCote('gauche', 'ltr'), -1);
    assert.equal(pasDuCote('gauche', 'rtl'), 1);
    assert.equal(pasDuCote('droite', 'rtl'), -1);
  });
  test('avancer est borné, et dit quand on est au bout', () => {
    assert.deepEqual(avancer(2, 1, 3), { index: 2, fin: true });
    assert.deepEqual(avancer(0, 1, 3), { index: 1, fin: false });
    assert.deepEqual(avancer(0, -1, 3), { index: 0, fin: true });
  });
});

describe('La vue guidée', () => {
  const cases = { 0: [{ x: 0, y: 50, w: 10, h: 10, caseNumber: 2 }, { x: 0, y: 0, w: 10, h: 10, caseNumber: 1 }], 1: [] };
  test('les Cases dans l\'ordre de leur numéro ; une Planche sans Case est une étape entière', () => {
    const e = etapesGuidees([0, 1], (p) => cases[p]);
    assert.deepEqual(e.map(x => [x.page, x.cadre && x.cadre.y]), [[0, 0], [0, 50], [1, null]]);
    assert.equal(etapeDeLaPage(e, 1), 2);
  });
  test('le cadrage centre la Case et la fait tenir avec une marge', () => {
    const c = cadrageDansLaVue({ x: 100, y: 100, w: 200, h: 100 }, { w: 1000, h: 1400 }, { w: 800, h: 600 }, 0);
    assert.equal(c.echelle, 4);
    assert.equal(c.x + 200 * c.echelle, 400, 'le centre de la Case au centre de la vue (x)');
    assert.equal(c.y + 150 * c.echelle, 300, 'et en y');
    const page = cadrageDansLaVue(null, { w: 1000, h: 1400 }, { w: 800, h: 700 }, 0);
    assert.equal(page.echelle, 0.5, 'sans cadre, la page entière tient');
  });
});

describe('Le branchement', () => {
  const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  test('ouvert par le clic droit sur un Tome ou un Chapitre', () => {
    const EV = lire('src/events.js');
    assert.match(EV, /ouvrirLecteur\(ti, t\.pages\.map\(\(p, i\) => i\), t\.name, depart\);/);
    assert.match(EV, /ouvrirLecteur\(ti, pages, `\$\{t\.name\} · \$\{ch\.nom\}`, depart\);/);
    const HTML = lire('src/index.html');
    assert.match(HTML, /id="ctxReadVolume"/);
    assert.match(HTML, /id="ctxReadChapter"/);
    assert.match(HTML, /id="lecteurOverlay"/);
  });
  test('les Planches sont dessinées par le même chemin que l\'export, après chargement', () => {
    const D = lire('src/draw.js');
    const f = D.slice(D.indexOf('export async function rendrePlancheEnImage'));
    assert.match(f, /await Promise\.all\(\[preloadModelsFor\(pd\.objects \|\| \[\]\), preloadImagesFor\(pd\.objects \|\| \[\]\)\]\);/);
    assert.match(f.slice(0, 1200), /drawContent\(c\.getContext\('2d'\), page, echelle, false, false\);/);
  });
  test('le Lecteur garde ses touches pour lui, et le sens des flèches suit la lecture', () => {
    const UI = lire('src/lecteur-ui.js');
    assert.match(UI, /if \(e\.key === 'ArrowRight'\) aller\(pasDuCote\('droite', options\.sens\)\);/);
    assert.match(UI, /if \(fait\) \{ e\.preventDefault\(\); e\.stopImmediatePropagation\(\); \}/);
    assert.match(UI, /window\.addEventListener\('keydown', clavier, true\);/);
  });
  test('retours : titre dans le menu, position « 1&2/9 », bords collés et absents au bout', () => {
    const UI = lire('src/lecteur-ui.js');
    assert.match(UI, /\$\{rangs\.join\('&'\)\}\/\$\{n\}/);
    assert.match(UI, /g\.hidden = avancer\(L\.index, pasDuCote\('gauche', options\.sens\), n\)\.fin;/);
    // Tout l'espace de chaque côté de la page est cliquable.
    assert.match(UI, /const gauche = Math\.max\(large, r\.left - scene\.left\);/);
    assert.match(UI, /const droite = Math\.max\(large, scene\.right - r\.right\);/);
    // Plein écran et fenêtre : recalage immédiat sans redessin, dessin une fois la taille stable.
    assert.match(UI, /function surRedimension\(\)\{\n  if \(!L\) return;\n  retailler\(\);\n  clearTimeout\(_redimension\);\n  _redimension = setTimeout\(afficher, 250\);/);
    assert.match(UI, /window\.addEventListener\('resize', surRedimension\);/);
    // « Vers la gauche » à gauche (des pictogrammes depuis, nom en infobulle).
    assert.match(UI, /choix\('sens', \[\['rtl', tr\('To the left', 'Vers la gauche'\), ICONES_SENS\.rtl\], \['ltr', tr\('To the right', 'Vers la droite'\), ICONES_SENS\.ltr\]\]\)/);
    assert.match(UI, /\[vitesse, lecture\]/);
    const HTML = lire('src/index.html');
    assert.doesNotMatch(HTML, /lecteur-bar/);
    assert.match(HTML, /<div class="menu-header lecteur-entete">/);
  });
  test('vue livre : cochée par défaut, la bonne page tourne, à plat sans effet', () => {
    assert.equal(OPTIONS_LECTEUR.livre, true);
    assert.equal(coteQuiTourne(1, 'ltr'), 'droite', 'avancer vers la droite tourne la page de droite');
    assert.equal(coteQuiTourne(-1, 'ltr'), 'gauche');
    assert.equal(coteQuiTourne(1, 'rtl'), 'gauche', 'en manga, l\'inverse');
    assert.equal(coteQuiTourne(0, 'ltr'), null, 'un saut ne tourne rien');
    const UI = lire('src/lecteur-ui.js');
    assert.match(UI, /const cote = options\.livre && L\.pas \? coteQuiTourne\(L\.pas, options\.sens\) : null;/);
    assert.match(UI, /bascule\('livre', tr\('Book view: the page turns', 'Vue livre : la page se tourne'\), ICONE_LIVRE, options\.guide\)/);
    const CSS = lire('src/style.css');
    assert.match(CSS, /\.lecteur-bord-gauche \{ left: 0; justify-content: flex-end; padding-right: 32px; \}/);
    assert.match(CSS, /\.lecteur-bord-droite \{ right: 0; justify-content: flex-start; padding-left: 32px; \}/);
    assert.doesNotMatch(CSS, /\.lecteur-page \{[^}]*box-shadow/, 'à plat, aucune ombre');
  });
});

describe('le menu du Lecteur en pictogrammes (demandé : « comme l\'éditeur de bâtiment »)', () => {
  const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const UI = lire('src/lecteur-ui.js');
  test('un choix à pictogramme n\'a pas de texte : son nom passe en infobulle et en aria-label', () => {
    assert.match(UI, /if \(icone\) \{ b\.innerHTML = icone; b\.title = libelle; b\.setAttribute\('aria-label', libelle\); \}/);
  });
  test('les deux vues sont des bascules, et aria-pressed dit leur état', () => {
    assert.match(UI, /setAttribute\('aria-pressed', String\(!!options\[cle\]\)\)/);
    assert.match(UI, /bascule\('guide', /);
  });
  test('les icônes sont au trait, en currentColor, sans couleur écrite en dur', () => {
    const I = lire('src/lecteur-icones.js');
    assert.match(I, /stroke="currentColor" stroke-width="1\.6"/);
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(I));
  });
  test('options sous un trait : l\'ajustement toujours, la première page en deux pages seulement', () => {
    assert.match(UI, /!options\.guide && groupeOptions\(\n\s+options\.double && choix\('debut'/);
    assert.match(UI, /choix\('ajustement', [^\n]+, false, 'options'\)/);
  });
});
