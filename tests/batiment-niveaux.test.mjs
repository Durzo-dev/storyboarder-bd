// #454b : les niveaux (src/batiment-niveaux.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  niveauxTries, niveauDessous, niveauDessus, recalerNiveaux, ajouterEtage, dupliquerNiveau, supprimerNiveau,
  modifierNiveau, hauteurDesMursDuNiveau, deplacerNiveau,
} from '../src/batiment-niveaux.js';
import { creerBatiment } from '../src/batiment.js';
import { ajouterRectangle } from '../src/batiment-trace.js';
import { ajouterOuverture, reglagesParDefaut } from '../src/batiment-ouvertures.js';
import { actualiserPieces } from '../src/batiment-pieces.js';

const fr = (en, f) => f;
function maison(){
  const b = creerBatiment('Maison', fr);
  ajouterRectangle(b, 'n0', { x: 0, z: 0 }, { x: 6, z: 4 }, 0.2);
  ajouterOuverture(b, b.murs[0].id, 0.5, reglagesParDefaut('porte'));
  actualiserPieces(b, 'n0', fr);
  b.pieces[0].nom = 'Salon';
  return b;
}

describe('ajouter', () => {
  test('un étage vide au-dessus du plus haut : élévation = hauteur + dalle', () => {
    const b = maison();
    const n = ajouterEtage(b, fr);
    assert.equal(n.elevation, 3);
    assert.equal(n.nom, 'Étage 1');
    assert.equal(b.murs.filter(m => m.niveauId === n.id).length, 0);
    assert.equal(ajouterEtage(b, fr).elevation, 6);
    assert.deepEqual(niveauxTries(b).map(x => x.nom), ['Rez-de-chaussée', 'Étage 1', 'Étage 2']);
  });
  test('voisins', () => {
    const b = maison(); const e1 = ajouterEtage(b, fr);
    assert.equal(niveauDessous(b, e1.id).id, 'n0');
    assert.equal(niveauDessus(b, 'n0').id, e1.id);
    assert.equal(niveauDessus(b, e1.id), null);
  });
});

describe('dupliquer', () => {
  test('les murs, les ouvertures et les pièces sont copiés au-dessus, avec de nouveaux ids', () => {
    const b = maison();
    const n = dupliquerNiveau(b, 'n0', fr);
    assert.equal(n.elevation, 3);
    const siens = b.murs.filter(m => m.niveauId === n.id);
    assert.equal(siens.length, 4);
    assert.ok(siens.every(m => !b.murs.some(x => x !== m && x.id === m.id)), 'ids uniques');
    const o = b.ouvertures.find(x => siens.some(m => m.id === x.murId));
    assert.ok(o, 'la porte suit');
    assert.deepEqual(b.pieces.filter(p => p.niveauId === n.id).map(p => p.nom), ['Salon']);
    siens[0].a.x = 99;
    assert.notEqual(b.murs.find(m => m.niveauId === 'n0').a.x, 99, 'copie profonde');
  });
  test('au milieu : les niveaux du dessus remontent', () => {
    const b = maison(); const e1 = ajouterEtage(b, fr);
    dupliquerNiveau(b, 'n0', fr);
    assert.equal(b.niveaux.find(x => x.id === e1.id).elevation, 6);
  });
});

describe('supprimer et modifier', () => {
  test('supprimer emporte ce que porte le niveau, le dessus redescend ; jamais le dernier', () => {
    const b = maison(); const copie = dupliquerNiveau(b, 'n0', fr); const e2 = ajouterEtage(b, fr);
    assert.deepEqual(supprimerNiveau(b, copie.id), { ok: true });
    assert.equal(b.murs.length, 4);
    assert.equal(b.ouvertures.length, 1);
    assert.equal(b.niveaux.find(x => x.id === e2.id).elevation, 3);
    supprimerNiveau(b, 'n0');
    assert.equal(b.niveaux[0].elevation, 0, 'le suivant prend sa place au sol');
    assert.deepEqual(supprimerNiveau(b, b.niveaux[0].id), { erreur: 'dernier' });
  });
  test('changer une hauteur monte les niveaux du dessus ; bornes ; nom', () => {
    const b = maison(); const e1 = ajouterEtage(b, fr);
    modifierNiveau(b, 'n0', { hauteur: 3.5, nom: ' Boutique ' });
    assert.equal(b.niveaux.find(x => x.id === e1.id).elevation, 3.7);
    assert.equal(b.niveaux.find(x => x.id === 'n0').nom, 'Boutique');
    modifierNiveau(b, e1.id, { dalle: 9 });
    assert.equal(b.niveaux.find(x => x.id === e1.id).dalle, 1);
    assert.equal(b.niveaux.find(x => x.id === e1.id).elevation, 4.5);
  });
  test('les murs montent jusqu’au dessus de la dalle qui les couvre (plancher du dessus, ou toit plat)', () => {
    const b = maison(); const e1 = ajouterEtage(b, fr);
    assert.equal(hauteurDesMursDuNiveau(b, 'n0'), 3);
    assert.equal(hauteurDesMursDuNiveau(b, e1.id), 3, 'le dernier : sa hauteur + le toit plat');
    assert.equal(recalerNiveaux(b), b);
  });
});

describe('réordonner (glisser-déposer)', () => {
  test('le rez-de-chaussée monte au-dessus de l’étage : élévations refaites, noms par défaut suivis, noms choisis gardés', () => {
    const b = maison(); const e1 = ajouterEtage(b, fr); const e2 = ajouterEtage(b, fr);
    modifierNiveau(b, e2.id, { nom: 'Grenier' });
    assert.equal(deplacerNiveau(b, 'n0', 1, fr), true);
    const t = niveauxTries(b);
    assert.deepEqual(t.map(n => n.id), [e1.id, 'n0', e2.id]);
    assert.deepEqual(t.map(n => n.elevation), [0, 3, 6]);
    assert.deepEqual(t.map(n => n.nom), ['Rez-de-chaussée', 'Étage 1', 'Grenier']);
    assert.equal(deplacerNiveau(b, 'n0', 1, fr), false, 'déjà là');
  });
});

test('signalé : dupliquer deux fois le rez-de-chaussée ne laisse pas deux « Étage 1 »', async () => {
  const { creerBatiment } = await import('../src/batiment.js');
  const { dupliquerNiveau, niveauxTries } = await import('../src/batiment-niveaux.js');
  const fr = (en, f) => f;
  const b = creerBatiment('M', fr);
  dupliquerNiveau(b, 'n0', fr);
  dupliquerNiveau(b, 'n0', fr);
  const noms = niveauxTries(b).map(n => n.nom);
  assert.deepEqual(noms.slice(1), ['Étage 1', 'Étage 2']);
  // Un nom choisi reste.
  niveauxTries(b)[2].nom = 'Grenier';
  dupliquerNiveau(b, 'n0', fr);
  assert.equal(niveauxTries(b)[3].nom, 'Grenier');
});
