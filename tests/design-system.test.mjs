// tools/design-system.mjs : le système de design est LU dans style.css, et sa page est à jour.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jetonsDuBloc, themes, page } from '../tools/design-system.mjs';

const CSS = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

describe('le système de design suit style.css', () => {
  test('les quatre rendus, résolus comme la cascade', () => {
    const t = Object.fromEntries(themes(CSS).map(([nom, , j]) => [nom, j]));
    assert.deepEqual(Object.keys(t), ['Sombre', 'Clair', 'Sombre contrasté', 'Clair contrasté']);
    assert.equal(t.Sombre.accent, jetonsDuBloc(CSS, ':root').accent);
    // Le Clair n'a pas d'accent à lui : il hérite de celui du Sombre.
    assert.equal(t.Clair.accent, t.Sombre.accent);
    assert.equal(t.Clair.paper, jetonsDuBloc(CSS, 'body.theme-light').paper);
    assert.equal(t['Clair contrasté'].accent, jetonsDuBloc(CSS, 'body.theme-light.theme-contraste').accent);
  });
  test('RÉGRESSION : docs/design-system.html est à jour (sinon : node tools/design-system.mjs)', () => {
    const ecrite = readFileSync(new URL('../docs/design-system.html', import.meta.url), 'utf8');
    assert.ok(ecrite === page(), 'la page du système de design ne correspond plus aux jetons ou aux icônes : régénérez-la');
  });
});
