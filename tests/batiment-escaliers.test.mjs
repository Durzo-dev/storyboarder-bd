// #454c : les escaliers (src/batiment-escaliers.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  decoupage, hauteurAFranchir, formeDeLEscalier, tremieDeLEscalier, validiteDeLEscalier, ajouterEscalier,
  modifierEscalier, supprimerEscalier, escalierSous, normaliserEscalier, essayerEscalier, contactsDeLEscalier,
  aimanterEscalier,
} from '../src/batiment-escaliers.js';
import { creerBatiment, normaliserBatiment } from '../src/batiment.js';
import { ajouterRectangle } from '../src/batiment-trace.js';
import { ajouterEtage } from '../src/batiment-niveaux.js';
import { actualiserPieces, formesDesPieces } from '../src/batiment-pieces.js';

const fr = (en, f) => f;
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
function maison(){
  const b = creerBatiment('M', fr);
  ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 8, z: 6 }, 0.2);
  ajouterEtage(b, fr);
  return b;
}
const haut = { x: 0, z: -1 };   // monter « vers le haut » de la vue de dessus
const angleHaut = Math.atan2(haut.z, haut.x);

describe('le découpage', () => {
  test('3 m : 18 marches de 16,7 cm, giron de Blondel', () => {
    const d = decoupage(3);
    assert.equal(d.nombre, 18);
    proche(d.hauteur, 3 / 18);
    proche(d.giron, 0.63 - 2 * 3 / 18);
  });
  test('la hauteur à franchir : jusqu’au sol du dessus ; rien sans étage', () => {
    const b = maison();
    assert.equal(hauteurAFranchir(b, 'n0'), 3);
    assert.equal(hauteurAFranchir(creerBatiment('V', fr), 'n0'), null);
  });
});

describe('la forme', () => {
  const b = maison();
  test('droit : une marche par hauteur, la dernière arrive au sol du dessus', () => {
    const f = formeDeLEscalier(b, { niveauId: 'n0', type: 'droit', depart: { x: 4, z: 5 }, angle: angleHaut, largeur: 0.9 });
    assert.equal(f.morceaux.length, 18);
    proche(f.morceaux[17].dessus, 3);
    const zs = f.emprise.map(p => p.z);
    proche(Math.max(...zs) - Math.min(...zs), 18 * f.giron, 1e-9);
  });
  test('L : deux volées et un palier, toujours 18 hauteurs', () => {
    const f = formeDeLEscalier(b, { niveauId: 'n0', type: 'L', depart: { x: 2, z: 5 }, angle: angleHaut });
    assert.equal(f.morceaux.filter(m => m.palier).length, 1);
    assert.equal(f.morceaux.length, 18);
    proche(Math.max(...f.morceaux.map(m => m.dessus)), 3);
    assert.equal(f.emprise.length, 6, 'une emprise en L');
  });
  test('U : la seconde volée redescend à côté de la première', () => {
    const f = formeDeLEscalier(b, { niveauId: 'n0', type: 'U', depart: { x: 2, z: 5 }, angle: angleHaut, largeur: 1 });
    const xs = f.emprise.map(p => p.x);
    proche(Math.max(...xs) - Math.min(...xs), 2, 1e-9);
    assert.equal(f.morceaux.length, 18);
  });
  test('la trémie englobe l’emprise', () => {
    const t = tremieDeLEscalier(b, { niveauId: 'n0', depart: { x: 4, z: 5 }, angle: angleHaut });
    const f = formeDeLEscalier(b, { niveauId: 'n0', depart: { x: 4, z: 5 }, angle: angleHaut });
    assert.ok(Math.min(...t.map(p => p.z)) < Math.min(...f.emprise.map(p => p.z)));
  });
});

describe('poser, retoucher, retrouver', () => {
  test('refusé sans étage, ou à travers un mur ; un escalier le long d’un mur passe', () => {
    assert.deepEqual(ajouterEscalier(creerBatiment('V', fr), 'n0', { depart: { x: 1, z: 1 }, angle: 0 }), { erreur: 'sansEtage' });
    const b = maison();
    assert.deepEqual(ajouterEscalier(b, 'n0', { depart: { x: 4, z: 1 }, angle: angleHaut }), { erreur: 'mur' }, 'traverse le mur du haut');
    const r = ajouterEscalier(b, 'n0', { depart: { x: 0.6, z: 5.8 }, angle: angleHaut });
    assert.ok(r.escalier, JSON.stringify(r));
    assert.equal(validiteDeLEscalier(b, r.escalier).ok, true);
  });
  test('le retrouver sous la souris, le tourner, le supprimer', () => {
    const b = maison();
    const { escalier } = ajouterEscalier(b, 'n0', { depart: { x: 4, z: 5.8 }, angle: angleHaut });
    assert.equal(escalierSous(b, 'n0', { x: 4, z: 4 }), escalier.id);
    assert.equal(escalierSous(b, 'n0', { x: 7, z: 1 }), null);
    assert.deepEqual(modifierEscalier(b, escalier.id, { angle: 0 }), { erreur: 'mur' }, 'tourné, il traverserait le mur de droite');
    assert.deepEqual(modifierEscalier(b, escalier.id, { largeur: 1.2, rampe: 'deux' }), { ok: true });
    assert.equal(escalier.largeur, 1.2);
    supprimerEscalier(b, escalier.id);
    assert.deepEqual(b.escaliers, []);
  });
  test('relu : valeurs par défaut, gardé avec son niveau', () => {
    assert.deepEqual(normaliserEscalier({ id: 'e', type: 'spirale', largeur: 9 }).type, 'droit');
    const { batiment } = normaliserBatiment({ escaliers: [{ id: 'e0', niveauId: 'n0', type: 'U', largeur: 0.1, rampe: 'x' }] }, fr);
    assert.deepEqual([batiment.escaliers[0].type, batiment.escaliers[0].largeur, batiment.escaliers[0].rampe], ['U', 0.5, 'droite']);
  });
});

describe('une retouche qui ne tient pas déplace l’escalier à la place la plus proche', () => {
  test('tourné contre un mur : il se décale juste assez', () => {
    const b = maison();
    const { escalier } = ajouterEscalier(b, 'n0', { depart: { x: 4, z: 5.8 }, angle: angleHaut });
    const r = essayerEscalier(b, escalier.id, { angle: 0 });
    assert.ok(r.changements && r.deplacement > 0 && r.deplacement <= 1.7, JSON.stringify(r));
    assert.deepEqual(modifierEscalier(b, escalier.id, r.changements), { ok: true });
    assert.equal(escalier.angle, 0);
  });
  test('ce qui tient ne bouge pas ; sans étage, rien à chercher', () => {
    const b = maison();
    const { escalier } = ajouterEscalier(b, 'n0', { depart: { x: 4, z: 5.8 }, angle: angleHaut });
    assert.deepEqual(essayerEscalier(b, escalier.id, { largeur: 1 }), { changements: { largeur: 1 }, deplacement: 0 });
    b.niveaux = b.niveaux.slice(0, 1);
    assert.equal(essayerEscalier(b, escalier.id, { largeur: 1 }).erreur, 'sansEtage');
  });
});

describe('l’aimant et les contraintes (demandé)', () => {
  function maisonEtPieces(){ const b = maison(); actualiserPieces(b, 'n0', fr); return b; }
  test('l’aimant colle l’escalier au mur proche ; les contacts se lisent', () => {
    const b = maisonEtPieces();
    // Un flanc à 8 cm de la face du mur de gauche (x = 0,1) : il s'y colle.
    const esc = { niveauId: 'n0', type: 'droit', depart: { x: 0.63, z: 5.8 }, angle: angleHaut, largeur: 0.9 };
    const d = aimanterEscalier(b, esc, 0.15);
    proche(d.x, 0.55, 1e-6);
    assert.ok(contactsDeLEscalier(b, { ...esc, depart: d }).length >= 1);
    assert.deepEqual(aimanterEscalier(b, { ...esc, depart: { x: 4, z: 3 } }, 0.15), { x: 4, z: 3 }, 'rien à moins de 15 cm');
  });
  test('tourné, un escalier du bâtiment y reste et garde le mur qu’il touchait', () => {
    const b = maisonEtPieces();
    const depart = aimanterEscalier(b, { niveauId: 'n0', type: 'droit', depart: { x: 0.6, z: 5.85 }, angle: angleHaut, largeur: 0.9 }, 0.15);
    const { escalier } = ajouterEscalier(b, 'n0', { depart, angle: angleHaut });
    const avant = contactsDeLEscalier(b, escalier);
    assert.ok(avant.length >= 1, JSON.stringify(avant));
    const faces = [...formesDesPieces(b, 'n0').values()];
    const r = essayerEscalier(b, escalier.id, { type: 'L' }, faces);
    assert.ok(r.changements, JSON.stringify(r));
    modifierEscalier(b, escalier.id, r.changements);
    const apres = contactsDeLEscalier(b, escalier);
    assert.ok(avant.some(c => apres.includes(c)), `contacts ${avant} → ${apres}`);
  });
  test('dans un coin : tourné, il garde ses deux murs ; un mur lâché seulement s’il le faut', () => {
    const b = maisonEtPieces();
    // Contre le mur de gauche et le mur du bas, en montant vers le haut.
    const depart = aimanterEscalier(b, { niveauId: 'n0', type: 'droit', depart: { x: 0.6, z: 5.85 }, angle: angleHaut, largeur: 0.9 }, 0.2);
    const { escalier } = ajouterEscalier(b, 'n0', { depart, angle: angleHaut });
    const avant = contactsDeLEscalier(b, escalier);
    assert.equal(avant.length, 2, JSON.stringify(avant));
    const faces = [...formesDesPieces(b, 'n0').values()];
    const r = essayerEscalier(b, escalier.id, { angle: 0 }, faces);
    modifierEscalier(b, escalier.id, r.changements);
    assert.deepEqual(contactsDeLEscalier(b, escalier).sort(), avant.slice().sort(), 'les deux mêmes murs');
  });
  test('aucune place dans le bâtiment : refusé, plutôt que d’en sortir', () => {
    const b = creerBatiment('Petite', fr);
    ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 2, z: 6 }, 0.2);
    ajouterEtage(b, fr); actualiserPieces(b, 'n0', fr);
    const { escalier } = ajouterEscalier(b, 'n0', { depart: { x: 1, z: 5.8 }, angle: angleHaut });
    const faces = [...formesDesPieces(b, 'n0').values()];
    assert.equal(essayerEscalier(b, escalier.id, { angle: 0 }, faces).erreur, 'hors', 'tourné, il ne tient dans aucune place de la pièce');
  });
});
