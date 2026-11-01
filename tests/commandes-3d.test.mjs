/**
 * #463f : les Commandes d'une Case, de son mode Caméra et d'une Scène, et les infobulles des aperçus.
 */
import './helpers/dom-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commandesDuMenu3D } from '../src/commandes-3d.js';

const fr = (en, f) => f;
const texte = (c) => commandesDuMenu3D(c, fr).join('\n');

test('une Case : choisir, son menu, C ; un Élément choisi : déplacer, molette, tourner, R', () => {
  const t = texte({ ecran: 'case' });
  assert.match(t, /Clic sur un Élément de la liste/);
  assert.match(t, /C : mode Caméra\./);
  assert.doesNotMatch(t, /tourner la vue/);
  const e = texte({ ecran: 'case', element: 'perso', plateau: true });
  assert.match(e, /Clic droit maintenu dessus, gauche \/ droite : le tourner \(vu de face\)\./);
  assert.match(e, /R : un quart de tour\./);
  assert.match(texte({ ecran: 'case', element: 'objet', plateau: false }), /en tournant autour : le tourner \(vu de dessus\)\./);
});

test('le mode Caméra et une Scène : les gestes de la vue, l\'axe bloqué dit ; sortir, ou T', () => {
  const c = texte({ ecran: 'camera' });
  assert.match(c, /Glisser droit \(ou Ctrl \+ glisser, ou bouton du milieu\) : déplacer la vue\./);
  assert.match(c, /C ou la croix : sortir du mode Caméra\./);
  assert.match(texte({ ecran: 'camera', axe: 'y' }), /à l'horizontale seulement, Y est bloqué/);
  const s = texte({ ecran: 'scene', element: 'perso' });
  assert.match(s, /Glisser gauche : tourner la vue\./);
  assert.match(s, /T : vue de dessus\./);
  assert.match(s, /Tirer l'Élément choisi : le déplacer\./);
});

test('câblage : la section en tête (sous « Caméra » en mode Caméra) ; infobulles des aperçus', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="sideCommandesSection"') < html.indexOf('id="sideCameraSection"'));
  const sb = readFileSync(new URL('../src/sidebar.js', import.meta.url), 'utf8');
  assert.match(sb, /remplirCommandes3D\('camera', sel, selRaw\);/);
  assert.match(sb, /remplirCommandes3D\(isSceneCanvas \? 'scene' : 'case', sel, selRaw\);/);
  assert.match(sb, /if \(ecran === 'camera'\) \{ if \(entete\.nextElementSibling !== sideCommandesSection\) entete\.after\(sideCommandesSection\); \}/);
  for (const f of ['store-apercu-3d.js', 'batiment-editeur-ui.js']) {
    assert.match(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), /el\.title = tr\('Left drag: turn · right drag: move · wheel: zoom'/, f);
  }
  assert.match(html, /id="objectPreview3D" width="240" height="161" title="Molette : zoomer"/);
});
