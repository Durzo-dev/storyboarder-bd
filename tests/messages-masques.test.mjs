/**
 * #434 : « Ne plus afficher ce message » sur les confirmations choisies avec Valentin, et
 * « Réafficher les messages masqués » dans la Configuration.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const tout = ['io.js', 'events.js', 'scenes.js', 'persona-editor.js', 'store-ui.js', 'textures-store-ui.js', 'polices-ui.js', 'batiment-editeur-ui.js', 'terrain-editeur-ui.js'].map(lire).join('\n');

test('les dix-huit confirmations masquables, et elles seules', () => {
  const cles = [...tout.matchAll(/masquable: '([a-z-]+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(cles, ['charger-scene', 'faire-une-cour', 'fermer-editeur-batiment', 'fermer-editeur-terrain', 'fusionner-bulles', 'quitter-editeur-modele',
    'remplacer-modele-batiment', 'renommer-image', 'renommer-modele', 'repointer-modeles', 'retirer-relief', 'supprimer-bulle-fusionnee', 'supprimer-chapitre',
    'supprimer-style-bulle', 'supprimer-tag-modele', 'supprimer-tag-texture', 'supprimer-usage-police', 'vider-case']);
});

test('masquée : « oui » sans fenêtre ; retenue seulement si cochée PUIS confirmée ; rétablie depuis la Configuration', () => {
  const io = lire('io.js');
  assert.match(io, /if \(messageMasque\(options\.masquable\)\) return Promise\.resolve\(true\);/);
  assert.match(io, /if \(result && _masquableEnCours && confirmActionMasquer\.checked\) masquerLeMessage\(_masquableEnCours\);/);
  assert.match(io, /window\.storyboarderAPI\.setSetting\('messagesMasques', S\.messagesMasques\)/);
  const ev = lire('events.js');
  assert.match(ev, /definirMessagesMasques\(settings && settings\.messagesMasques\);/);
  assert.match(ev, /'reafficherMessagesBtn'\)\.addEventListener\('click', \(\) => \{ reafficherLesMessages\(\); majBoutonMessagesMasques\(\); \}\);/);
  // Les rappels transmettent les options jusqu'à la fenêtre commune.
  assert.equal((ev.match(/confirmer: \(message, titre, options\) => confirmAction\(message, titre, options\)/g) || []).length, 4);
  const html = lire('index.html');
  assert.match(html, /id="confirmActionMasquerLigne"/);
  assert.match(html, /id="reafficherMessagesBtn"/);
});
