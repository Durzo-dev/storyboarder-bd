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

// #459a : l'affichage d'un bâtiment placé, par Case.
describe('montrer jusqu\'à un niveau (#459a)', () => {
  test('niveauDeCoupe : seulement un niveau qui existe encore ; fixerCoupe pose et retire le champ', async () => {
    const { niveauDeCoupe, fixerCoupe } = await import('../src/batiment-element.js');
    const o = creerElementBatiment({ panel, page, batiment: maison() });
    assert.equal(niveauDeCoupe(o), null);
    fixerCoupe(o, 'n0');
    assert.deepEqual(o.affichage, { jusquA: 'n0' });
    assert.equal(niveauDeCoupe(o), 'n0');
    o.affichage.jusquA = 'disparu';
    assert.equal(niveauDeCoupe(o), null, 'un niveau supprimé ne coupe plus rien');
    fixerCoupe(o, null);
    assert.equal('affichage' in o, false, 'tout montré : plus de champ');
  });
  test('coupé, le rig garde la boîte du bâtiment entier (gabarit invisible, hors des rayons)', async () => {
    await import('./helpers/dom-stub.mjs');
    const { buildPropRig3D } = await import('../src/rig3d.js');
    const { ajouterEtage } = await import('../src/batiment-niveaux.js');
    const { fixerCoupe } = await import('../src/batiment-element.js');
    const T = globalThis.THREE;
    const b = maison();
    const n1 = ajouterEtage(b, fr);
    ajouterRectangle(b, n1.id, { x: 0, z: 0 }, { x: 6, z: 4 }, 0.2);
    const o = creerElementBatiment({ panel, page, batiment: b });
    const entier = buildPropRig3D('batiment', '#888', o).figureGroup;
    fixerCoupe(o, 'n0');
    const r = buildPropRig3D('batiment', '#888', o);
    const coupe = r.figureGroup;
    const h = (g) => new T.Box3().setFromObject(g).getSize(new T.Vector3()).y;
    proche(h(coupe), h(entier));
    const gabarit = coupe.children.find(c => c.userData.gabarit);
    assert.ok(gabarit && gabarit.visible === false);
    assert.equal(gabarit.layers.test(new T.Layers()), false, 'les rayons de la sélection ne le voient pas');
    assert.match(r.batimentSig, /\|n0\|null$/, 'la coupe fait partie de la signature du rig');
  });
});

test('#459a : la section « Affichage du bâtiment » suit l\'Élément choisi, et pose la coupe avec un point d\'annulation', async () => {
  const { readFileSync } = await import('node:fs');
  const sb = readFileSync(new URL('../src/sidebar.js', import.meta.url), 'utf8');
  assert.match(sb, /sidePersonasSection\.style\.display = 'block';\n\s*majSectionAffichageBatiment\(selRaw\);/);
  assert.match(sb, /_snapshot\(\);\n\s*fixerCoupe\(el, choix\.value \|\| null\);/);
  assert.match(readFileSync(new URL('../src/index.html', import.meta.url), 'utf8'), /id="sideBatimentSection"/);
});

test('#459a, retours : la liste ne se refait pas sous la souris, et le menu remonte vers la section', async () => {
  const { readFileSync } = await import('node:fs');
  const sb = readFileSync(new URL('../src/sidebar.js', import.meta.url), 'utf8');
  assert.match(sb, /if \(document\.activeElement !== choix\) \{\n\s*if \(choix\.dataset\.cle !== cle\)/, 'refaite seulement si elle a changé, et jamais ouverte');
  assert.match(sb, /document\.activeElement !== document\.getElementById\('sideBatimentCoupe'\)\) sideBatimentSection\.style\.display = 'none'/);
  assert.match(sb, /const nouveau = _batimentPrecedent !== el\.id;/);
  assert.match(sb, /sideBatimentSection\.scrollIntoView\(\{ block: 'nearest', behavior: 'smooth' \}\)/);
});

// #464 : masquer un mur, un plafond, un sol d'un bâtiment placé, par Case.
describe('masquer des parties d\'un bâtiment placé (#464)', () => {
  const avecPieces = async () => { const { actualiserPieces } = await import('../src/batiment-pieces.js'); const b = maison(); actualiserPieces(b, 'n0', fr); return b; };
  test('masquesDe ne garde que ce qui existe ; fixerMasques pose, dédoublonne et retire ; le résumé', async () => {
    const { masquesDe, fixerMasques, resumeDesMasques } = await import('../src/batiment-element.js');
    const o = creerElementBatiment({ panel, page, batiment: await avecPieces() });
    const [m1, m2] = o.batiment.murs;
    const piece = o.batiment.pieces[0];
    assert.equal(masquesDe(o), null);
    fixerMasques(o, { murs: [m1.id, m1.id, m2.id, 'disparu'], plafonds: [piece.id] });
    assert.deepEqual(o.affichage.masques.murs, [m1.id, m2.id, 'disparu']);
    assert.deepEqual(masquesDe(o), { murs: [m1.id, m2.id], plafonds: [piece.id], sols: [] }, 'un id disparu ne masque rien');
    assert.equal(resumeDesMasques(masquesDe(o), fr), '2 murs, 1 plafond');
    fixerMasques(o, { murs: [], plafonds: [], sols: [] });
    assert.equal('affichage' in o, false, 'rien de masqué : plus de champ');
  });
  test('le rendu omet le mur, le plafond et sa dalle ; le rig garde la boîte entière', async () => {
    await import('./helpers/dom-stub.mjs');
    const T = globalThis.THREE;
    const { construireBatiment3D, materiauxBatiment3D } = await import('../src/batiment-3d.js');
    const { buildPropRig3D } = await import('../src/rig3d.js');
    const { fixerMasques } = await import('../src/batiment-element.js');
    const b = await avecPieces();
    const mats = materiauxBatiment3D(T);
    const taille = (g) => new T.Box3().setFromObject(g).getSize(new T.Vector3());
    const entier = taille(construireBatiment3D(T, b, mats));
    const sansMur = taille(construireBatiment3D(T, b, mats, { masques: { murs: [b.murs.find(m => Math.abs(m.a.z - m.b.z) < 1e-9 && m.a.z < 1).id] } }));
    assert.ok(sansMur.z < entier.z - 0.05, 'le mur du bord z = 0 n\'est plus là');
    const sansPlafond = taille(construireBatiment3D(T, b, mats, { masques: { plafonds: [b.pieces[0].id] } }));
    assert.ok(sansPlafond.y < entier.y, 'la dalle du dessus est partie avec le plafond');
    const o = creerElementBatiment({ panel, page, batiment: b });
    fixerMasques(o, { plafonds: [b.pieces[0].id] });
    const r = buildPropRig3D('batiment', '#888', o);
    proche(taille(r.figureGroup).y, entier.y);
    assert.match(r.batimentSig, /plafonds/, 'les masques font partie de la signature du rig');
  });
  test('câblage : l\'éditeur en masquage (Sélection seule, clic = masquer, Valider / Annuler), la section de la Case', async () => {
    const { readFileSync } = await import('node:fs');
    const ui = readFileSync(new URL('../src/batiment-editeur-ui.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    const sb = readFileSync(new URL('../src/sidebar.js', import.meta.url), 'utf8');
    assert.match(ui, /if \(m\) \{ basculerMasque\('murs', m\.mur\.id\); return; \}/);
    assert.match(ui, /if \(\(E\.pose \|\| E\.masquage\) && outil && outil !== 'selection'\) return;/);
    assert.match(ui, /if \(E && E\.masquage\) \{ annulerLeMasquage\(\); return; \}/);
    assert.match(ui, /masques: E && E\.masquage \? E\.masquage\.masques : null/);
    assert.match(css, /\.batiment-editeur\.masquage \.batiment-outil\[data-outil\]:not\(\[data-outil="selection"\]\)\{ display:none; \}/);
    assert.match(sb, /ouvrirEditeurDeBatiment\(\{ batiment: el\.batiment, masquage: \{/);
    assert.match(sb, /_snapshot\(\);\n\s*fixerMasques\(cible, m\);/);
  });
});
