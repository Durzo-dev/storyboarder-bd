/**
 * tests/bulle-gras-italique.test.mjs : le gras et l'italique du texte d'une Bulle (#423, demandé).
 * Deux interrupteurs cumulables, toujours actifs ; marqués « simulé » quand la police n'a pas la
 * variante (Bangers, Creepster, polices importées incomplètes), jamais grisés (décidé par Valentin).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers/dom-stub.mjs';

const { variantesDePolice, styleDuTexteDeBulle, POLICES_BULLES } = await import('../src/constants.js');
const { synchroniserStyleDuTexteDeBulle } = await import('../src/sidebar.js');

const lire = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

describe('la décision', () => {
  test('ce que chaque police sait faire', () => {
    assert.deepEqual(variantesDePolice('Comic Neue'), { gras: 'vrai', italique: 'vrai' });
    assert.deepEqual(variantesDePolice('Bangers'), { gras: 'simule', italique: 'simule' });
    assert.deepEqual(variantesDePolice('Une police inconnue'), { gras: 'simule', italique: 'simule' });
    // Une police retirée répond pour sa remplaçante, qui est celle qu'on dessine.
    assert.deepEqual(variantesDePolice('Kalam'), variantesDePolice('Shantell Sans'));
    // Huit de Google, puis trois de DaFont (#423) : Gargle, Just Breathe, Morning Breeze.
    assert.equal(POLICES_BULLES.filter(p => p.gras === 'vrai' && p.italique === 'vrai').length, 11);
    assert.deepEqual(variantesDePolice('Gargle'), { gras: 'vrai', italique: 'vrai' });
    assert.deepEqual(variantesDePolice('Ruthless Sketch'), { gras: 'simule', italique: 'vrai' });
  });

  test('les deux cumulables, absents = normal', () => {
    assert.equal(styleDuTexteDeBulle({ bulleFont: 'Kanit' }).prefixe, '');
    assert.equal(styleDuTexteDeBulle({ bulleFont: 'Kanit', bulleGras: true }).prefixe, 'bold ');
    assert.equal(styleDuTexteDeBulle({ bulleFont: 'Kanit', bulleItalique: true }).prefixe, 'italic ');
    assert.equal(styleDuTexteDeBulle({ bulleFont: 'Kanit', bulleGras: true, bulleItalique: true }).prefixe, 'italic bold ');
  });

  test('une police sans la variante la simule : jamais refusée', () => {
    assert.equal(styleDuTexteDeBulle({ bulleFont: 'Une police inconnue', bulleGras: true, bulleItalique: true }).prefixe, 'italic bold ');
  });

  test('simulé : dessiné quand même (Bangers)', () => {
    assert.equal(styleDuTexteDeBulle({ bulleFont: 'Bangers', bulleGras: true }).prefixe, 'bold ');
  });
});

describe('les interrupteurs', () => {
  // Le stub DOM ne retient pas les attributs : deux boutons qui les retiennent, servis à leur id.
  const bouton = () => {
    const attrs = {}; const classes = new Set();
    return {
      disabled: false, title: '',
      setAttribute(k, v){ attrs[k] = String(v); }, getAttribute(k){ return k in attrs ? attrs[k] : null; },
      classList: { toggle(c, on){ if (on) classes.add(c); else classes.delete(c); }, contains: (c) => classes.has(c) },
    };
  };
  const boutons = { sideBubbleBoldBtn: bouton(), sideBubbleItalicBtn: bouton() };
  const avant = document.getElementById;
  document.getElementById = (id) => boutons[id] || avant.call(document, id);
  const g = () => boutons.sideBubbleBoldBtn;
  const i = () => boutons.sideBubbleItalicBtn;

  test('enfoncés selon la Bulle, actifs pour une police complète', () => {
    synchroniserStyleDuTexteDeBulle({ bulleFont: 'Comic Neue', bulleGras: true });
    assert.equal(g().getAttribute('aria-pressed'), 'true');
    assert.equal(i().getAttribute('aria-pressed'), 'false');
    assert.equal(g().disabled, false);
    assert.equal(g().classList.contains('simule'), false);
  });

  test('marqués « simulé » pour Bangers et une police inconnue, jamais grisés', () => {
    synchroniserStyleDuTexteDeBulle({ bulleFont: 'Bangers' });
    assert.equal(g().classList.contains('simule'), true);
    assert.equal(g().disabled, false);
    synchroniserStyleDuTexteDeBulle({ bulleFont: 'Une police inconnue', bulleItalique: true });
    assert.equal(i().classList.contains('simule'), true);
    assert.equal(i().disabled, false, 'une variante manquante se simule, elle ne se refuse pas');
    assert.equal(i().getAttribute('aria-pressed'), 'true');
    assert.doesNotMatch(lire('src/sidebar.js'), /b\.disabled =/);
  });

  test('le câblage : dessin, clic, changement de police, préchargement des quatre styles', () => {
    assert.match(lire('src/draw.js'), /c\.font = `\$\{styleDuTexteDeBulle\(o\)\.prefixe\}\$\{fontSize\}px/);
    const ev = lire('src/events.js');
    assert.match(ev, /getElementById\('sideBubbleBoldBtn'\)\.addEventListener\('click', \(\) => basculerStyleDuTexteDeBulle\('bulleGras'\)\)/);
    assert.match(ev, /getElementById\('sideBubbleItalicBtn'\)\.addEventListener\('click', \(\) => basculerStyleDuTexteDeBulle\('bulleItalique'\)\)/);
    assert.match(ev, /S\.sideDescTarget\[champ\] = !S\.sideDescTarget\[champ\];/);
    assert.match(ev, /const STYLES = \['', 'bold ', 'italic ', 'italic bold '\];/);
    const html = lire('src/index.html');
    assert.ok(html.indexOf('id="sideBubbleBoldBtn"') > html.indexOf('id="sideBubbleFontSelect"'));
  });
});
