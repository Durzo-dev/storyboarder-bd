/**
 * #463a : l'orientation des fenêtres d'Élément, alignée sur l'éditeur de bâtiment : Rotation (Y),
 * Inclinaison (X), Bascule (Z), dans cet ordre, un champ en degrés à côté de chaque curseur, et
 * « Remettre droit ». La fenêtre d'un Objet reliait « Rotation horizontale » à rotX (signalé dans
 * docs/en/gestes-3d.md) : le premier curseur est maintenant celui de rotY, comme partout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
const mod = readFileSync(new URL('../src/orientation-champs.js', import.meta.url), 'utf8');

test('quatre fenêtres : Rotation (Y), Inclinaison (X), Bascule (Z), dans cet ordre, chacune avec son champ en degrés', () => {
  for (const [y, x, z] of [['personaRotYInput', 'personaRotXInput', 'personaRotZInput'], ['objectRotYInput', 'objectRotXInput', 'objectRotZInput'],
    ['roomRotYInput', 'roomRotXInput', 'roomRotZInput'], ['buildingRotYInput', 'buildingRotXFixe', 'buildingRotZFixe']]) {
    const pos = [y, x, z].map(id => html.indexOf(`id="${id}"`));
    assert.ok(pos.every(p => p > 0) && pos[0] < pos[1] && pos[1] < pos[2], y);
    for (const id of [y, x, z]) {
      assert.match(html, new RegExp(`<label class="modal-field-label" for="${id}">`), id);
      assert.match(html, new RegExp(`id="${id}Deg" class="orientation-degres"`), id);
    }
    assert.match(i18n, new RegExp(`\\['${y}', 'Turn', 'Rotation'\\]`));
    assert.match(i18n, new RegExp(`\\['${x}', 'Tilt', 'Inclinaison'\\]`));
    assert.match(i18n, new RegExp(`\\['${z}', 'Lean', 'Bascule'\\]`));
  }
  assert.doesNotMatch(html, /Rotation horizontale<\/label>\s*<input type="range" id="(object|persona|room|building)/);
  assert.doesNotMatch(html, />Roulis</);
});

test('le champ suit le curseur (même écrit par le code) et le commande ; « Remettre droit » : X et Z à zéro', () => {
  assert.match(mod, /set\(v\)\{ DESCRIPTEUR\.set\.call\(this, v\); champ\.value = DESCRIPTEUR\.get\.call\(this\); \}/);
  assert.match(mod, /curseur\.value = String\(Math\.max\(-180, Math\.min\(180, v\)\)\);\s*curseur\.dispatchEvent\(saisie\(\)\);/);
  assert.match(mod, /redresser\('objectRedresserBtn', 'objectRotXInput', 'objectRotZInput'\);/);
  for (const b of ['personaRedresserBtn', 'objectRedresserBtn', 'roomRedresserBtn']) assert.match(html, new RegExp(`id="${b}">Remettre droit<`));
});
