// tools/design-system.mjs : le système de design est LU dans style.css, et sa page est à jour.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jetonsDuBloc, themes, page, fragment } from '../tools/design-system.mjs';

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
  test('la page couvre toute l\'interface : chaque écran y figure, et ses balises sont équilibrées', () => {
    const p = page();
    // Signalé : une première version ne montrait que l'éditeur de bâtiment.
    for (const t of ['L\'application', 'Menus de droite', 'Menus contextuels', 'Modales', 'Bibliothèques', 'Éditeurs', 'Contrôles']) {
      assert.ok(p.includes(`<h2 class="ds-titre">${t}</h2>`), `la section « ${t} » a disparu`);
    }
    const corps = p.slice(p.indexOf('<body>')).replace(/<!--[\s\S]*?-->/g, '');
    assert.equal((corps.match(/<div\b/g) || []).length, (corps.match(/<\/div>/g) || []).length,
      'un fragment déséquilibré ferait sortir la suite de la page de sa mise en page');
    assert.ok(p.includes('LA COULEUR D\'UN BOUTON DIT CE QU\'IL FAIT'), 'la page doit embarquer src/style.css tel quel');
  });
  test('un fragment se lit par son identifiant, balises équilibrées', () => {
    const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
    const f = fragment(html, 'confirmActionModal');
    assert.ok(f.startsWith('<div class="modal-overlay hidden" id="confirmActionModal">'));
    assert.ok(f.endsWith('</div>'));
    assert.ok(f.includes('confirmActionOk'));
  });
  test('RÉGRESSION : docs/design-system.html est à jour (sinon : node tools/design-system.mjs)', () => {
    const ecrite = readFileSync(new URL('../docs/design-system.html', import.meta.url), 'utf8');
    assert.ok(ecrite === page(), 'la page du système de design ne correspond plus aux jetons ou aux icônes : régénérez-la');
  });
});
