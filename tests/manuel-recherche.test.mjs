/**
 * tests/manuel-recherche.test.mjs : le Manuel rangé en groupes repliables, et sa recherche par mots
 * clés (demandé). Les décisions sont pures (src/manuel-recherche.js) ; le HTML et les tables de
 * traduction doivent s'y accorder.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GROUPES_MANUEL, normaliser, motsDeRecherche, chercherDansLeManuel, morceauxSurlignes, vueDeRecherche } from '../src/manuel-recherche.js';
import { HELP_MANUAL_EN, HELP_MANUAL_FR } from '../src/help-content.js';
import { groupeManuelOuvert, memoriserGroupeManuel } from '../src/section-memory.js';

const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const HTML = lire('src/index.html');

describe('les groupes', () => {
  test('chaque section est rangée dans exactement un groupe', () => {
    const rangees = GROUPES_MANUEL.flatMap(g => g.sections);
    assert.equal(new Set(rangees).size, rangees.length, 'une section est rangée deux fois');
    assert.deepEqual([...rangees].sort(), HELP_MANUAL_FR.map(s => s.id).sort());
  });

  test('un nom de groupe n\'est jamais celui d\'une section (demandé), dans les deux langues', () => {
    for (const [lang, table] of [['fr', HELP_MANUAL_FR], ['en', HELP_MANUAL_EN]]) {
      const titres = new Set(table.map(s => normaliser(s.title)));
      for (const g of GROUPES_MANUEL) assert.ok(!titres.has(normaliser(g[lang])), `« ${g[lang]} » est aussi une section (${lang})`);
    }
  });

  test('les raccourcis clavier sont dans le groupe Application (demandé)', () => {
    assert.ok(GROUPES_MANUEL.find(g => g.id === 'application').sections.includes('raccourcis'));
  });

  test('le HTML range les sections exactement comme la table, dans le même ordre', () => {
    for (const g of GROUPES_MANUEL) {
      const i = HTML.indexOf(`<div class="help-categorie" data-categorie="${g.id}">`);
      assert.ok(i >= 0, `groupe ${g.id} absent du HTML`);
      const j = HTML.indexOf('<div class="help-categorie"', i + 1);
      const bloc = HTML.slice(i, j < 0 ? HTML.indexOf('</div>\n    </div>', i) : j);
      assert.deepEqual([...bloc.matchAll(/data-help="([^"]+)"/g)].map(m => m[1]), g.sections, g.id);
      assert.match(bloc, new RegExp(`id="helpCat_${g.id.replace(/-/g, '_')}" aria-expanded="false">${g.fr}<`));
    }
  });

  test('les titres des groupes sont traduits avec les mots de la table', () => {
    const i18n = lire('src/i18n.js');
    for (const g of GROUPES_MANUEL) {
      assert.ok(i18n.includes(`['#helpCat_${g.id.replace(/-/g, '_')}', '${g.en}', '${g.fr}']`), g.id);
    }
  });

  test('l\'état replié est mémorisé, replié par défaut', () => {
    const stock = new Map();
    const stockage = { getItem: (k) => (stock.has(k) ? stock.get(k) : null), setItem: (k, v) => stock.set(k, v) };
    assert.equal(groupeManuelOuvert(stockage, 'bulles'), false);
    memoriserGroupeManuel(stockage, 'bulles', true);
    assert.equal(groupeManuelOuvert(stockage, 'bulles'), true);
  });
});

describe('la recherche', () => {
  const sections = [
    { id: 'a', title: 'Caméra', paragraphs: ['La caméra tourne. Caméra encore.'] },
    { id: 'b', title: 'Lumière', paragraphs: ['Une ombre portée par la lumière.'] },
    { id: 'c', title: 'Ombres', paragraphs: ['Rien sur la lumiere ici ? Si : ombre.'] },
  ];

  test('sans accents ni majuscules', () => {
    assert.equal(normaliser('Éditeur CAMÉRA'), 'editeur camera');
    assert.deepEqual([...chercherDansLeManuel(sections, 'camera').keys()], ['a']);
    assert.deepEqual([...chercherDansLeManuel(sections, 'CAMÉRA').keys()], ['a']);
  });

  test('plusieurs mots : les sections qui les contiennent TOUS, avec leur nombre de correspondances', () => {
    const r = chercherDansLeManuel(sections, 'ombre lumière');
    assert.deepEqual([...r.keys()], ['b', 'c']);
    assert.equal(r.get('b'), 3, 'une « ombre », deux « lumière » (titre compris)');
    assert.equal(chercherDansLeManuel(sections, 'camera').get('a'), 3, 'titre compris');
  });

  test('une recherche vide ne trouve rien et ne filtre rien', () => {
    assert.equal(chercherDansLeManuel(sections, '   ').size, 0);
    assert.equal(vueDeRecherche(HELP_MANUAL_FR, ''), null);
    assert.deepEqual(motsDeRecherche(' a, b  a '), ['a', 'b']);
  });

  test('la vue : seuls les groupes qui contiennent un résultat', () => {
    const v = vueDeRecherche(HELP_MANUAL_FR, 'raccourcis');
    assert.ok(v.groupes.includes('application'));
    const aucune = vueDeRecherche(HELP_MANUAL_FR, 'xyzzyqwv');
    assert.deepEqual(aucune.groupes, []);
    assert.equal(aucune.sections.size, 0);
  });

  test('le surlignage garde le texte d\'origine, accents compris', () => {
    const m = morceauxSurlignes('La Caméra et la camera.', 'camera');
    assert.equal(m.map(x => x.texte).join(''), 'La Caméra et la camera.');
    assert.deepEqual(m.filter(x => x.surligne).map(x => x.texte), ['Caméra', 'camera']);
    assert.deepEqual(morceauxSurlignes('Texte', ''), [{ texte: 'Texte', surligne: false }]);
  });
});

describe('le câblage', () => {
  const ev = lire('src/events.js');
  test('la saisie filtre, Échap et la croix vident, un clic ouvre la section avec la recherche', () => {
    assert.match(ev, /helpSearchInput\.addEventListener\('input', rafraichirMenuManuel\)/);
    assert.match(ev, /if \(e\.key !== 'Escape' \|\| !helpSearchInput\.value\) return;/);
    assert.match(ev, /openHelpModal\(bouton\.dataset\.help, S\.appLang, helpSearchInput \? helpSearchInput\.value : ''\)/);
    assert.match(ev, /const vue = vueDeRecherche\(S\.appLang === 'en' \? HELP_MANUAL_EN : HELP_MANUAL_FR, requete\);/);
  });
  test('pendant une recherche, l\'état mémorisé des groupes n\'est pas touché', () => {
    assert.match(ev, /if \(!\(helpSearchInput && helpSearchInput\.value\.trim\(\)\)\) memoriserGroupeManuel\(/);
  });
  test('la modale surligne les mots cherchés, et les garde au changement de langue', () => {
    const m = lire('src/modals.js');
    assert.match(m, /morceauxSurlignes\(texte, rechercheManuelOuverte\)/);
    assert.match(m, /return openHelpModal\(sectionManuelOuverte, lang, rechercheManuelOuverte\);/);
  });
});

describe('l\'apparence (retours à l\'écran)', () => {
  const css = lire('src/style.css');
  test('un délimiteur entre deux groupes', () => {
    assert.match(css, /\.help-categorie \+ \.help-categorie\{ border-top:1px solid var\(--line\);/);
  });
  test('le champ de recherche est celui du store (.modal-input)', () => {
    assert.match(HTML, /<input id="helpSearchInput" class="modal-input" type="search"/);
    assert.match(css, /\.help-recherche input\.modal-input\{ margin:0;/);
  });
  test('le surlignage est un aplat d\'accent plein, libellé en jeton', () => {
    assert.match(css, /\.help-modal-body mark\{ background:var\(--accent\); color:var\(--sur-accent\);/);
  });
});
