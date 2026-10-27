// #454e partie 2 : poser un Élément dans une pièce d'un bâtiment placé, depuis sa fiche, par l'éditeur.
import './helpers/dom-stub.mjs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { etagesEtPieces, creerElementBatiment } from '../src/batiment-element.js';
import { creerBatiment } from '../src/batiment.js';
import { ajouterRectangle } from '../src/batiment-trace.js';
import { ajouterEtage } from '../src/batiment-niveaux.js';
import { actualiserPieces } from '../src/batiment-pieces.js';
import { construireBatiment3D, materiauxBatiment3D } from '../src/batiment-3d.js';
import { pointDuRigPlace3D, pointDansLeRigPlace3D } from '../src/scene3d.js';
import { batimentsOuPoser, rotationDansLeBatiment, rotationDansLaScene, pieceDeDepart } from '../src/batiment-pose-ui.js';
import { centreDuMeuble, hauteurPourLeCentre, fixerAngle } from '../src/batiment-mobilier.js';

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
});

describe('du repère du bâtiment au monde de la Case', () => {
  const placer = (rotY = 0) => {
    const o = creerElementBatiment({ panel, page, batiment: maison() });
    o.wxFloor = 2; o.wzFloor = -1; o.wyFloor = -3 + o.realHeightFloor / 2; o.rotY = rotY;
    const fg = construireBatiment3D(T, o.batiment, materiauxBatiment3D(T));
    fg.rotation.set(0, rotY, 0);
    return { o, point: (p) => pointDuRigPlace3D(fg, o, panel, p), inverse: (w) => pointDansLeRigPlace3D(fg, o, panel, w), fg };
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

describe('l’aller-retour entre la Case et le bâtiment', () => {
  test('pointDansLeRigPlace3D défait pointDuRigPlace3D, bâtiment tourné', () => {
    const o = creerElementBatiment({ panel, page, batiment: maison() });
    o.wxFloor = 2; o.wzFloor = -1; o.wyFloor = -1; o.rotY = 0.7;
    const fg = construireBatiment3D(T, o.batiment, materiauxBatiment3D(T));
    fg.rotation.set(0, 0.7, 0);
    const p = { x: 1.3, y: 2.1, z: 3.4 };
    const r = pointDansLeRigPlace3D(fg, o, panel, pointDuRigPlace3D(fg, o, panel, p));
    proche(r.x, p.x); proche(r.y, p.y); proche(r.z, p.z);
  });
  test('l’orientation : de la Case au meuble et retour', () => {
    const bEl = { rotX: 0, rotY: 0.6, rotZ: 0 };
    const el = { rotX: 0.2, rotY: -1.1, rotZ: 0.1 };
    const r = rotationDansLeBatiment(el, bEl);
    const m = {};
    fixerAngle(m, 'y', r.rotY); fixerAngle(m, 'x', r.rotX); fixerAngle(m, 'z', r.rotZ);
    const w = rotationDansLaScene(m, bEl);
    proche(w.x, el.rotX); proche(w.y, el.rotY); proche(w.z, el.rotZ);
  });
  test('un Élément droit dans un bâtiment tourné : seul son lacet change', () => {
    const r = rotationDansLeBatiment({ rotY: 1 }, { rotY: 0.25 });
    proche(r.rotY, 0.75); proche(r.rotX, 0); proche(r.rotZ, 0);
  });
});

describe('le centre d’un meuble (là où la Case met le centre d’un Élément)', () => {
  const b = { niveaux: [{ id: 'n0', elevation: 0 }, { id: 'n1', elevation: 3 }] };
  test('droit, au sol de l’étage : à mi-hauteur au-dessus', () => {
    const c = centreDuMeuble(b, { niveauId: 'n1', x: 1, z: 2, rotY: 0, echelle: 2, dims: [0.5, 0.4, 0.9] });
    proche(c.x, 1); proche(c.y, 3 + 0.9); proche(c.z, 2);
  });
  test('hauteurPourLeCentre est l’inverse, incliné compris', () => {
    const m = { niveauId: 'n1', x: 0, z: 0, rotY: 0.3, rotX: 0.4, rotZ: -0.2, echelle: 1, dims: [0.6, 0.5, 1.7], colle: false, y: 0 };
    m.y = hauteurPourLeCentre(m, 3, 4.2);
    proche(centreDuMeuble(b, m).y, 4.2);
  });
});

describe('où l’éditeur s’ouvre', () => {
  test('pas encore dans le bâtiment : la première pièce du rez-de-chaussée', () => {
    const b = maison();
    const n1 = ajouterEtage(b, fr);
    ajouterRectangle(b, n1.id, { x: 0, z: 0 }, { x: 3, z: 3 }, 0.2);
    actualiserPieces(b, n1.id, fr);
    const p = pieceDeDepart(b);
    assert.equal(p.niveauId, 'n0');
  });
  test('le bloc ne propose plus que le bâtiment ; l’Élément déjà dedans est retrouvé à sa place', () => {
    const pose = readFileSync(new URL('../src/batiment-pose-ui.js', import.meta.url), 'utf8');
    assert.ok(!/data-role="etage"|data-role="piece"/.test(pose));
    assert.match(pose, /'Poser dans ce bâtiment'/);
    assert.match(pose, /let m = meubleASaPlace\(obj, rep, \{ id: ID, bat, bEl, panel \}\);\s*if \(!m\) \{/);
  });
  test('raccord : les valeurs exactes vont dans la fiche (pas d’arrondi, curseurs libérés de leur pas)', () => {
    const pose = readFileSync(new URL('../src/batiment-pose-ui.js', import.meta.url), 'utf8');
    assert.match(pose, /champX\.value = String\(x\);/);
    assert.match(pose, /\$\(k\)\.step = 'any'/);
    assert.match(pose, /delete obj\.wyFloor;/);
    const modals = readFileSync(new URL('../src/modals.js', import.meta.url), 'utf8');
    assert.match(modals, /versCurseurRotY: \(r\) => rotYToSliderDeg\(r, true\)/);
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

describe('l’éditeur en pose (demandé)', () => {
  const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const pose = readFileSync(new URL('../src/batiment-pose-ui.js', import.meta.url), 'utf8');
  test('« Valider la position » et « Annuler » remplacent « Supprimer l’élément » et « Quitter »', () => {
    assert.match(ui, /'Valider la position'/);
    assert.match(ui, /valider\.onclick = validerLaPose/);
    assert.match(ui, /annulerPose\.onclick = annulerLaPose/);
    assert.match(css, /\.batiment-editeur\.pose #batimentQuitterBtn/);
  });
  test('la croix et Échap valent « Annuler »', () => {
    assert.match(ui, /if \(E && E\.pose\) \{ annulerLaPose\(\); return; \}/);
    assert.match(ui, /if \(e\.key === 'Escape'\) \{ avale\(\); annulerLaPose\(\); return; \}/);
  });
  test('seul l’outil Sélection, et seul l’élément se prend', () => {
    assert.match(css, /\.batiment-editeur\.pose \.batiment-outil\[data-outil\]:not\(\[data-outil="selection"\]\)\{ display:none; \}/);
    assert.match(ui, /if \(\(E\.pose \|\| E\.masquage\) && outil && outil !== 'selection'\) return;/);
    assert.match(ui, /const sommet = E\.pose \? null : sommetSous/);
    assert.match(ui, /const ouvertureId = E\.pose \? null : ouvertureSous/);
    assert.ok(!/meubleSous\(E\.batiment, E\.niveauId, souris\(e\)\.p\)/.test(ui), 'les gestes passent par meubleVise');
  });
  test('changer d’étage emmène l’élément', () => {
    assert.match(ui, /if \(posee\) posee\.niveauId = id;/);
  });
  test('Annuler rouvre la fiche ; Valider l’enregistre puis centre la caméra', () => {
    assert.match(pose, /annuler: \(\) => modale\.classList\.remove\('hidden'\)/);
    assert.match(pose, /fiche\.enregistrer\(\);\s*centerSceneCameraOnElement\(panel, obj\);/);
  });
});
