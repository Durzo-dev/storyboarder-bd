// #454a-4 : le bâtiment placé (src/batiment-element.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  OBJ_TYPE_BATIMENT, estUnBatimentPlace, encombrementDuBatiment, creerElementBatiment, appliquerBatiment,
  signatureDuBatiment, signatureDeStructure, recalerHauteurDuBatimentPlace,
} from '../src/batiment-element.js';
import { creerBatiment } from '../src/batiment.js';
import { ajouterRectangle } from '../src/batiment-trace.js';
import { WALL_PX_PER_UNIT_3D } from '../src/constants.js';

const fr = (en, f) => f;
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
function maison(l = 6, p = 4){
  const b = creerBatiment('Maison', fr);
  ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: l, z: p }, 0.2);
  return b;
}
const page = { w: 2000, h: 1500 };
const panel = { id: 'c1', x: 100, y: 100, w: 800, h: 600 };

describe('encombrement', () => {
  test('hauteur du niveau, largeur et profondeur épaisseur comprise', () => {
    const e = encombrementDuBatiment(maison());
    assert.equal(e.hauteur, 3, '2,80 m sous plafond + 20 cm de toit plat');
    proche(e.largeur, 6.2); proche(e.profondeur, 4.2);
  });
  test('un bâtiment vide mesure 1 m', () => {
    assert.deepEqual(encombrementDuBatiment(creerBatiment('V', fr)), { hauteur: 1, largeur: 1, profondeur: 1 });
  });
});

describe('placer, puis appliquer une retouche', () => {
  test('un objet 3D qui embarque une COPIE du bâtiment, à sa hauteur réelle', () => {
    const b = maison();
    const o = creerElementBatiment({ panel, page, batiment: b });
    assert.equal(o.type, 'objet3d'); assert.equal(o.objType, OBJ_TYPE_BATIMENT);
    assert.ok(estUnBatimentPlace(o));
    assert.notEqual(o.batiment, b, 'une copie');
    b.nom = 'Autre';
    assert.equal(o.batiment.nom, 'Maison', 'indépendante');
    assert.equal(o.realHeightFloor, 3);
    proche(o.h, 3 * WALL_PX_PER_UNIT_3D); proche(o.w, 6.2 * WALL_PX_PER_UNIT_3D);
    assert.equal(o.homePanelId, 'c1');
    assert.equal(o.magnetGround, true);
  });
  test('appliquer : nouvelle copie, nouveau cadre recentré, la position monde ne bouge pas', () => {
    const o = creerElementBatiment({ panel, page, batiment: maison() });
    o.wxFloor = 3; o.rotY = 1;
    const cx = o.x + o.w / 2;
    const plus = maison(10, 4);
    plus.nom = 'Grange';
    appliquerBatiment(o, plus, page);
    assert.equal(o.name, 'Grange');
    proche(o.w, 10.2 * WALL_PX_PER_UNIT_3D);
    proche(o.x + o.w / 2, cx);
    assert.deepEqual([o.wxFloor, o.rotY], [3, 1]);
    assert.notEqual(o.batiment, plus);
  });
  test('placé depuis la bibliothèque : il garde le nom du fichier', () => {
    const o = creerElementBatiment({ panel, page, batiment: maison(), source: 'Maison.batiment.json' });
    assert.equal(o.batimentSource, 'Maison.batiment.json');
    assert.equal(creerElementBatiment({ panel, page, batiment: maison() }).batimentSource, undefined);
  });
  test('la signature change avec le bâtiment, pas avec une copie identique', () => {
    const b = maison();
    assert.equal(signatureDuBatiment(b), signatureDuBatiment(JSON.parse(JSON.stringify(b))));
    const c = maison(); c.murs[0].epaisseur = 0.3;
    assert.notEqual(signatureDuBatiment(b), signatureDuBatiment(c));
  });
  test('la structure ignore le nom, pas le reste', () => {
    const a = maison(), b = maison();
    b.nom = 'Autre nom';
    assert.equal(signatureDeStructure(a), signatureDeStructure(b));
    b.murs[0].epaisseur = 0.3;
    assert.notEqual(signatureDeStructure(a), signatureDeStructure(b));
  });
  test('un bâtiment placé avant le toit plat retrouve sa hauteur', () => {
    const o = creerElementBatiment({ panel, page, batiment: maison() });
    o.realHeightFloor = 2.8; o.h = 2.8 * WALL_PX_PER_UNIT_3D;
    assert.equal(recalerHauteurDuBatimentPlace(o), true);
    assert.equal(o.realHeightFloor, 3); proche(o.h, 3 * WALL_PX_PER_UNIT_3D);
    assert.equal(recalerHauteurDuBatimentPlace(o), false);
  });
  test('ce qui n’est pas un bâtiment placé', () => {
    assert.equal(estUnBatimentPlace({ type: 'objet3d', objType: 'modele' }), false);
    assert.equal(estUnBatimentPlace({ type: 'objet3d', objType: 'batiment' }), false, 'sans bâtiment embarqué');
  });
});
