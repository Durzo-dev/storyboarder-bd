// #454e partie 2 : poser un Élément dans une pièce d'un bâtiment placé, depuis sa fiche.
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { etagesEtPieces, pointDeLaPiece, creerElementBatiment } from '../src/batiment-element.js';
import { creerBatiment } from '../src/batiment.js';
import { ajouterRectangle } from '../src/batiment-trace.js';
import { ajouterEtage } from '../src/batiment-niveaux.js';
import { actualiserPieces } from '../src/batiment-pieces.js';
import { construireBatiment3D, materiauxBatiment3D } from '../src/batiment-3d.js';
import { pointDuRigPlace3D, positionPoseeSur3D } from '../src/scene3d.js';
import { batimentsOuPoser } from '../src/batiment-pose-ui.js';
import { GROUND_CONTACT_EPS_3D, PANEL_DEPTH_MAX_3D } from '../src/constants.js';

const fr = (en, f) => f;
const T = globalThis.THREE;
const proche = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
function maison(){
  const b = creerBatiment('Maison', fr);
  ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 6, z: 4 }, 0.2);
  actualiserPieces(b, 'n0', fr);
  return b;
}
const page = { w: 2000, h: 1500, objects: [] };
const panel = { id: 'c1', type: 'panel', x: 100, y: 100, w: 800, h: 600 };

describe('étages et pièces', () => {
  test('les étages avec leurs pièces, du plus bas au plus haut', () => {
    const b = maison();
    const e = etagesEtPieces(b);
    assert.equal(e.length, 1);
    assert.equal(e[0].pieces.length, 1);
    assert.ok(e[0].pieces[0].nom);
  });
  test('un étage sans pièce n’est pas proposé', () => {
    const b = maison();
    ajouterEtage(b, fr);
    assert.equal(etagesEtPieces(b).length, 1);
  });
  test('le point d’une pièce : son repère, au niveau de son sol', () => {
    const b = maison();
    const p = b.pieces[0];
    const pt = pointDeLaPiece(b, p.id);
    assert.equal(pt.x, p.repere.x); assert.equal(pt.z, p.repere.z);
    proche(pt.y, 0.005);
    assert.equal(pointDeLaPiece(b, 'inconnue'), null);
  });
});

describe('du repère du bâtiment au monde de la Case', () => {
  const placer = (rotY = 0) => {
    const o = creerElementBatiment({ panel, page, batiment: maison() });
    o.wxFloor = 2; o.wzFloor = -1; o.wyFloor = -3 + o.realHeightFloor / 2; o.rotY = rotY;
    const fg = construireBatiment3D(T, o.batiment, materiauxBatiment3D(T));
    fg.rotation.set(0, rotY, 0);
    return { o, point: (p) => pointDuRigPlace3D(fg, o, panel, p), fg };
  };
  test('sans rotation : le centre du bâtiment tombe sur la position de l’Élément', () => {
    const { point } = placer();
    // La boîte du rig va de -0,1 à 6,1 en x et de -0,1 à 4,1 en z : son centre est (3, 2).
    const w = point( { x: 3, y: 0, z: 2 });
    proche(w.x, 2); proche(w.z, -1);
    proche(w.y, -3, 0.02);   // le bas du bâtiment touche le Sol
  });
  test('un quart de tour : les axes du bâtiment tournent avec lui', () => {
    const { point } = placer(Math.PI / 2);
    const a = point({ x: 3, y: 0, z: 2 });
    const b = point({ x: 4, y: 0, z: 2 });
    proche(a.x, 2); proche(a.z, -1);
    // rotY = +90° : +x du bâtiment devient -z du monde.
    proche(b.x - a.x, 0); proche(b.z - a.z, -1);
  });
  test('le rig n’est pas déplacé par la mesure', () => {
    const { point, fg } = placer();
    fg.position.set(5, 6, 7); fg.scale.set(2, 2, 2);
    const avant = point({ x: 1, y: 1, z: 1 });
    assert.deepEqual(point({ x: 1, y: 1, z: 1 }), avant);
    assert.deepEqual(fg.position.toArray(), [5, 6, 7]);
    assert.deepEqual(fg.scale.toArray(), [2, 2, 2]);
  });
});

describe('poser sur un sol', () => {
  test('le centre est à mi-hauteur au-dessus du sol, la profondeur bornée', () => {
    const v = positionPoseeSur3D({ x: 1, y: 2, z: 3 }, 1.8);
    assert.equal(v.x, 1); proche(v.y, 2 + 0.9 + GROUND_CONTACT_EPS_3D); assert.equal(v.z, 3);
    assert.equal(positionPoseeSur3D({ x: 0, y: 0, z: 999 }, 1).z, PANEL_DEPTH_MAX_3D);
  });
});

describe('les bâtiments proposés', () => {
  test('ceux de la Case de l’Élément, qui ont une pièce', () => {
    const b1 = creerElementBatiment({ panel, page, batiment: maison() });
    const vide = creerElementBatiment({ panel, page, batiment: creerBatiment('Vide', fr) });
    const ailleurs = { ...creerElementBatiment({ panel, page, batiment: maison() }), homePanelId: 'c2' };
    const perso = { id: 'p', type: 'perso', homePanelId: 'c1', x: 0, y: 0, w: 10, h: 10 };
    const pg = { objects: [panel, { id: 'c2', type: 'panel', x: 1000, y: 0, w: 10, h: 10 }, b1, vide, ailleurs, perso] };
    assert.deepEqual(batimentsOuPoser(perso, pg).map(o => o.id), [b1.id]);
  });
});

test('les deux fiches préparent le bloc avant de prendre leur empreinte', () => {
  const src = readFileSync(new URL('../src/modals.js', import.meta.url), 'utf8');
  for (const prefixe of ['persona', 'object']) {
    const i = src.indexOf(`prefixe: '${prefixe}'`);
    assert.ok(i > 0, prefixe);
    const empreinte = src.indexOf('S.modalSnapshot = captureModalSnapshot', i);
    const ouverture = src.lastIndexOf('export function', i);
    assert.ok(empreinte > i && src.lastIndexOf('export function', empreinte) === ouverture, prefixe);
  }
});
