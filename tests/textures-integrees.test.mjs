/**
 * Les textures livrées dans « Mes textures » (src/textures-integrees.js), et le mode « choisir ».
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROUND_TYPE_DEFS, TRACÉ_TEXTURES } from '../src/constants.js';
import * as I from '../src/textures-integrees.js';

const licences = readFileSync(new URL('../assets/textures/LICENSES.md', import.meta.url), 'utf8');

describe('les textures livrées, dans « Mes textures » (demandé)', () => {
  test('toutes y sont : chaque matière du Sol (Neutre et Eau comprises) et chaque texture de Tracé', () => {
    const t = I.texturesIntegrees();
    for (const d of GROUND_TYPE_DEFS.filter(x => !x.importee)) assert.ok(t.some(x => x.choix.sol === d.id), d.id);
    for (const type of Object.keys(TRACÉ_TEXTURES)) assert.ok(t.some(x => x.choix.trace === type), type);
    assert.equal(new Set(t.map(x => x.cle)).size, t.length, 'clés uniques');
  });

  test('RÉGRESSION : leur provenance est celle de LICENSES.md, ligne pour ligne', () => {
    for (const [grain, [ressource, banque, page]] of Object.entries(I.PROVENANCE)) {
      const ligne = licences.split('\n').find(l => l.startsWith(`| \`${grain}.png\``));
      assert.ok(ligne, `${grain} absent de LICENSES.md`);
      assert.ok(ligne.includes(`| ${ressource} | ${banque} |`) && ligne.includes(page), `${grain} : la provenance diffère`);
    }
    for (const t of I.texturesIntegrees()) if (t.grain) assert.ok(I.PROVENANCE[t.grain], `${t.grain} sans provenance`);
  });

  test('choisir une texture livrée : l\'identifiant de la matière pour le Sol, l\'originale (null) pour un Tracé', () => {
    const t = I.texturesIntegrees();
    assert.equal(I.valeurChoisie(t.find(x => x.choix.sol === 'gravier'), 'sol'), 'gravier');
    assert.equal(I.valeurChoisie(t.find(x => x.choix.trace === 'chemin'), 'chemin'), null);
    assert.equal(I.valeurChoisie(t.find(x => x.choix.trace === 'chemin'), 'sol'), undefined);   // pas cet usage
    assert.equal(I.valeurChoisie({ dossier: 'polyhaven-x', usages: ['sol'] }, 'sol'), 'tex:polyhaven-x');
  });

  test('le carré montre la texture posée : livrée, de l\'utilisateur, ou l\'originale d\'un Tracé', () => {
    const mes = [{ dossier: 'polyhaven-x', nom: 'X', usages: ['sol', 'chemin'] }];
    assert.equal(I.textureDeLaValeur('sable', 'sol').choix.sol, 'sable');
    assert.equal(I.textureDeLaValeur(undefined, 'sol').choix.sol, 'herbe');           // le Sol par défaut
    assert.equal(I.textureDeLaValeur('tex:polyhaven-x', 'sol', mes).nom, 'X');
    assert.equal(I.textureDeLaValeur(null, 'chemin').choix.trace, 'chemin');
    assert.equal(I.textureDeLaValeur('tex:absente', 'chemin', mes).choix.trace, 'chemin');
  });

  test('câblage : le carré dans la section Sol et dans la fenêtre d\'un Tracé, le store en mode « choisir »', () => {
    const lire = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.match(lire('sidebar.js'), /carreDeTexture\(\{\s*valeur: sel\.groundType \|\| 'herbe', usage: 'sol'/);
    assert.match(lire('modals.js'), /carreDeTexture\(\{\s*valeur: S\.tracéModalTexture, usage: USAGE_DU_TRACE\[type\]/);
    const ui = lire('textures-store-ui.js');
    assert.match(ui, /c\.onclick = \(\) => \(choix \? choisirCarte\(r, local\) : ouvrirFiche\(r, local\)\)/);
    assert.match(ui, /\$\('texturesUsage'\)\.disabled = true/);            // l'usage est verrouillé
    assert.match(ui, /await chargerTexturesUtilisateur\(api\(\), null\)/);   // inscrite AVANT d'être appliquée
  });

  test('RÉGRESSION : un identifiant de Sol inconnu se range sous la matière de repli (sinon figée pour la session)', () => {
    assert.match(readFileSync(new URL('../src/rig3d.js', import.meta.url), 'utf8'), /if \(!trouve\) type = def\.id;/);
  });
});
