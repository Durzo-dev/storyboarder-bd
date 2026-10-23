// #454a-3c : les ouvertures (src/batiment-ouvertures.js) et les murs percés (morceauxDuMur).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARGE_OUVERTURE, hauteurDuMur, intervalleDe, placement, reglagesParDefaut, ajouterOuverture,
  deplacerOuverture, modifierOuverture, ouvertureSous, supprimerOuverture, monterOuverture, PAS_ALLEGE, essayerOuverture,
} from '../src/batiment-ouvertures.js';
import { morceauxDuMur, trancher, polygonesDesMurs } from '../src/batiment-geometrie.js';
import { creerBatiment, normaliserBatiment, DEFAUTS_OUVERTURE } from '../src/batiment.js';
import { ajouterMur, couperMur } from '../src/batiment-trace.js';

const fr = (en, f) => f;
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
function unMur(L = 5){
  const b = creerBatiment('B', fr);
  ajouterMur(b, 'n0', { x: 0, z: 0 }, { x: L, z: 0 }, 0.2);
  return { b, mur: b.murs[0] };
}

describe('les réglages', () => {
  test('quatre types, et leurs valeurs par défaut', () => {
    assert.deepEqual(Object.keys(DEFAUTS_OUVERTURE), ['porte', 'fenetre', 'baie', 'passage']);
    assert.deepEqual(reglagesParDefaut('fenetre'), { type: 'fenetre', largeur: 1.2, hauteur: 1.2, y: 0.9, battants: 2, coulissant: false, vitre: true, sens: 1, charniere: 'debut' });
    assert.equal(reglagesParDefaut('inconnu').largeur, 0.9);
  });
  test('relire : options par défaut, un passage n’a pas de battant', () => {
    const { batiment } = normaliserBatiment({ murs: [{ id: 'm', niveauId: 'n0', a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, epaisseur: 0.2 }],
      ouvertures: [{ id: 'o', murId: 'm', type: 'passage', battants: 2 }, { id: 'p', murId: 'm', type: 'fenetre', sens: -1, charniere: 'fin', battants: 3 }] }, fr);
    assert.equal(batiment.ouvertures[0].battants, 0);
    assert.deepEqual([batiment.ouvertures[1].sens, batiment.ouvertures[1].charniere, batiment.ouvertures[1].battants], [-1, 'fin', 2]);
  });
});

describe('poser', () => {
  test('au centre demandé, ramené dans le mur près d’un bout', () => {
    const { b, mur } = unMur();
    const r = ajouterOuverture(b, mur.id, 0.5, reglagesParDefaut('porte'));
    assert.ok(r.ouverture);
    proche(r.ouverture.le, 0.5);
    const r2 = ajouterOuverture(b, mur.id, 0.99, reglagesParDefaut('porte'));
    proche(intervalleDe(r2.ouverture, mur).s1, 5 - MARGE_OUVERTURE);
  });
  test('refus : trop large pour le mur, ou par-dessus une autre', () => {
    const { b, mur } = unMur(1);
    assert.deepEqual(ajouterOuverture(b, mur.id, 0.5, reglagesParDefaut('baie')), { erreur: 'large' });
    const c = unMur(5);
    ajouterOuverture(c.b, c.mur.id, 0.5, reglagesParDefaut('porte'));
    assert.deepEqual(ajouterOuverture(c.b, c.mur.id, 0.55, reglagesParDefaut('fenetre')), { erreur: 'chevauche' });
    assert.equal(placement(c.b, c.mur, 0.1, 1.2).ok, true, 'à gauche, il y a la place');
  });
  test('sous le plafond : la hauteur est ramenée, une allège trop haute est refusée', () => {
    const { b, mur } = unMur();
    assert.equal(hauteurDuMur(b, mur), 2.8);
    const r = ajouterOuverture(b, mur.id, 0.3, { ...reglagesParDefaut('fenetre'), y: 2, hauteur: 2 });
    proche(r.ouverture.hauteur, 0.75);
    assert.deepEqual(ajouterOuverture(b, mur.id, 0.8, { ...reglagesParDefaut('fenetre'), y: 2.7 }), { erreur: 'haute' });
  });
});

describe('déplacer, retoucher, trouver, supprimer', () => {
  test('glisser le long du mur, sans passer sur une autre', () => {
    const { b, mur } = unMur(6);
    const a = ajouterOuverture(b, mur.id, 0.2, reglagesParDefaut('porte')).ouverture;
    ajouterOuverture(b, mur.id, 0.8, reglagesParDefaut('porte'));
    assert.equal(deplacerOuverture(b, a.id, { x: 2, z: 0.3 }), true);
    proche(a.le, 2 / 6);
    assert.equal(deplacerOuverture(b, a.id, { x: 4.8, z: 0 }), false, 'la place est prise');
  });
  test('changer de type reprend ses dimensions, garde position et sens ; refusé s’il ne tient plus', () => {
    const { b, mur } = unMur(5);
    const o = ajouterOuverture(b, mur.id, 0.5, { ...reglagesParDefaut('porte'), sens: -1 }).ouverture;
    assert.deepEqual(modifierOuverture(b, o.id, { type: 'fenetre' }), { ok: true });
    assert.deepEqual([o.type, o.largeur, o.y, o.sens, o.le], ['fenetre', 1.2, 0.9, -1, 0.5]);
    assert.deepEqual(modifierOuverture(b, o.id, { largeur: 9 }), { erreur: 'large' });
    assert.equal(o.largeur, 1.2, 'rien n’a changé');
    modifierOuverture(b, o.id, { type: 'passage' });
    assert.equal(o.battants, 0);
  });
  test('la molette : monter et descendre, entre le sol et le plafond', () => {
    const { b, mur } = unMur(5);
    const o = ajouterOuverture(b, mur.id, 0.5, reglagesParDefaut('fenetre')).ouverture;
    assert.equal(monterOuverture(b, o.id, PAS_ALLEGE), true);
    proche(o.y, 0.95);
    monterOuverture(b, o.id, 10);
    proche(o.y, 2.8 - 0.05 - 1.2, 1e-9);
    assert.equal(monterOuverture(b, o.id, 1), false, 'au plafond');
    monterOuverture(b, o.id, -10);
    assert.equal(o.y, 0);
    assert.equal(o.hauteur, 1.2, 'sa hauteur ne change pas');
  });
  test('la trouver sous la souris, puis la supprimer', () => {
    const { b, mur } = unMur(5);
    const o = ajouterOuverture(b, mur.id, 0.5, reglagesParDefaut('porte')).ouverture;
    assert.equal(ouvertureSous(b, 'n0', { x: 2.6, z: 0.05 }, 0.05), o.id);
    assert.equal(ouvertureSous(b, 'n0', { x: 1, z: 0 }, 0.05), null);
    supprimerOuverture(b, o.id);
    assert.deepEqual(b.ouvertures, []);
  });
  test('couper le mur : l’ouverture reste au même endroit', () => {
    const { b, mur } = unMur(6);
    const o = ajouterOuverture(b, mur.id, 0.75, reglagesParDefaut('porte')).ouverture;
    couperMur(b, mur.id, { x: 2, z: 0 });
    const hote = b.murs.find(m => m.id === o.murId);
    proche(hote.a.x + o.le * (hote.b.x - hote.a.x), 4.5);
  });
});

describe('les murs percés', () => {
  test('trancher un rectangle', () => {
    const poly = [{ x: 0, z: 0.1 }, { x: 5, z: 0.1 }, { x: 5, z: -0.1 }, { x: 0, z: -0.1 }];
    const t = trancher(poly, { x: 0, z: 0 }, { x: 1, z: 0 }, 1, 2);
    const xs = t.map(p => p.x).sort((a, b) => a - b);
    assert.deepEqual([xs[0], xs[xs.length - 1]], [1, 2]);
  });
  test('deux ouvertures : trois morceaux pleins, deux percées, et les longueurs se recollent', () => {
    const { b, mur } = unMur(6);
    const poly = polygonesDesMurs(b.murs).get(mur.id);
    const { pleins, percees } = morceauxDuMur(poly, mur, [{ s0: 1, s1: 2 }, { s0: 4, s1: 5 }]);
    assert.equal(pleins.length, 3);
    assert.equal(percees.length, 2);
    const largeur = (pts) => Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x));
    proche(pleins.reduce((s, p) => s + largeur(p), 0) + percees.reduce((s, p) => s + largeur(p), 0), 6);
  });
});

describe('une retouche qui chevaucherait glisse l’ouverture à la place libre la plus proche', () => {
  test('élargie contre sa voisine : elle s’en écarte, sur le même mur', () => {
    const { b, mur } = unMur(8);
    const a = ajouterOuverture(b, mur.id, 0.3, reglagesParDefaut('porte')).ouverture;
    ajouterOuverture(b, mur.id, 0.5, reglagesParDefaut('porte'));
    const r = essayerOuverture(b, a.id, { largeur: 2.2 });
    assert.ok(r.changements && r.deplacement > 0, JSON.stringify(r));
    assert.deepEqual(modifierOuverture(b, a.id, r.changements), { ok: true });
    assert.equal(a.largeur, 2.2);
  });
  test('trop large pour le mur entier : refusé, rien ne bouge', () => {
    const { b, mur } = unMur(2);
    const a = ajouterOuverture(b, mur.id, 0.5, reglagesParDefaut('porte')).ouverture;
    assert.equal(essayerOuverture(b, a.id, { largeur: 3 }).erreur, 'large');
    assert.deepEqual(essayerOuverture(b, a.id, { largeur: 1 }), { changements: { largeur: 1 }, deplacement: 0 });
  });
});
