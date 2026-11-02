/**
 * La boîte de sélection en 3D (demandé, 2 novembre 2026) : un Personnage ou un Objet 3D (bâtiment
 * compris) est entouré des douze arêtes de SA boîte, orientée comme lui, projetées par la caméra de
 * sa Case ; le rectangle qui la contient sert aux clics (glisser, tourner).
 */
import './helpers/dom-stub.mjs';
import './helpers/render-stub.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getElementProjectedBox3D, ARETES_BOITE_3D, projectElementCenterToCanvas3D } from '../src/scene3d.js';
import { objectRigCache3D } from '../src/rig3d.js';

const T = globalThis.THREE;
const page = { w: 1000, h: 1400 };
const panel = { id: 'c1', type: 'panel', x: 100, y: 100, w: 800, h: 600, pts: [] };

function poser(o, rotY){
  const fg = new T.Group();
  fg.add(new T.Mesh(new T.BoxGeometry(4, 1, 2), new T.MeshBasicMaterial()));
  fg.rotation.set(0, rotY, 0);
  fg.position.set(0, 0.5, 0);
  fg.updateMatrixWorld(true);
  objectRigCache3D.set(o.id, { figureGroup: fg, placeDansLaCase3D: { panelId: panel.id, p: fg.position.clone(), r: fg.rotation.clone(), s: fg.scale.clone() } });
}

test('huit coins projetés, douze arêtes ; rien sans place dans CETTE Case ; les murs gardent leur cadre', () => {
  const o = { id: 'o1', type: 'objet3d', objType: 'caisse' };
  poser(o, 0);
  const b = getElementProjectedBox3D(o, panel, page);
  assert.ok(b, 'une boîte');
  assert.equal(b.coins.length, 8);
  assert.equal(ARETES_BOITE_3D.length, 12);
  assert.ok(b.coins.every(c => Number.isFinite(c.x) && Number.isFinite(c.y)));
  assert.ok(b.x1 - b.x0 > 1 && b.y1 - b.y0 > 1);
  // Le dessus (4-7) est plus haut à l'écran que le dessous (0-3).
  const moy = (ix) => ix.reduce((s, i) => s + b.coins[i].y, 0) / ix.length;
  assert.ok(moy([4, 5, 6, 7]) < moy([0, 1, 2, 3]));
  assert.equal(getElementProjectedBox3D(o, { ...panel, id: 'autre' }, page), null, 'placé dans une autre Case');
  assert.equal(getElementProjectedBox3D({ id: 'mur', type: 'objet3d', objType: 'mur' }, panel, page), null);
  assert.equal(getElementProjectedBox3D({ id: 'b', type: 'bulle' }, panel, page), null);
});

test('orientée comme l\'Élément : tourné d\'un quart de tour, sa boîte tourne avec lui', () => {
  const o = { id: 'o2', type: 'objet3d', objType: 'caisse' };
  poser(o, 0);
  const a = getElementProjectedBox3D(o, panel, page);
  poser(o, Math.PI / 2);
  const q = getElementProjectedBox3D(o, panel, page);
  // Le coin 1 (x max) passe d'un côté à l'autre de l'écran : la boîte n'est pas celle du monde.
  assert.ok(Math.abs((a.coins[1].x - a.coins[0].x) - (q.coins[1].x - q.coins[0].x)) > 1);
});

test('câblage : dessinée par drawSelection, et les clics (glisser, tourner) la prennent', () => {
  const draw = readFileSync(new URL('../src/draw.js', import.meta.url), 'utf8');
  assert.match(draw, /if \(owner\) boite3D = getElementProjectedBox3D\(o, owner, page\);/);
  assert.match(draw, /for \(const \[i, j\] of ARETES_BOITE_3D\)/);
  const ev = readFileSync(new URL('../src/events.js', import.meta.url), 'utf8');
  assert.match(ev, /const _boite3D = getElementProjectedBox3D\(sel, ownerPanel, page\);/);
  assert.match(ev, /const _b3R = _caseR \? getElementProjectedBox3D\(_elR, _caseR, _pgR\) : null;/);
  const sc = readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
  assert.match(sc, /entry\.placeDansLaCase3D = \{ panelId: panel\.id,/);
  assert.equal(typeof projectElementCenterToCanvas3D, 'function');
});
