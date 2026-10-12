/**
 * @file tools/import-dafont.mjs
 * Intégrer à l'application les polices choisies sur DaFont, avec leurs licences.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * D'OÙ VIENNENT CES POLICES (#423, choisies avec Valentin le 12 octobre 2026)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * DaFont n'a pas d'API, et son libellé de licence « n'est qu'une indication » (sa propre FAQ). On a
 * donc procédé à la main : une pré-sélection par usage, les zips téléchargés par Valentin dans
 * `apercus/dafont/<slug>/` (dossier ignoré par git), puis la licence de CHAQUE police lue dans son
 * zip et dans ses métadonnées. N'ont été gardées que celles dont la licence ÉCRITE permet la
 * redistribution sans demander l'accord de l'auteur (CC0, domaine public, SIL OFL 1.1, GPL,
 * CC BY-SA 4.0), puis une seule par groupe de polices trop ressemblantes. Le verdict complet, avec
 * les polices écartées et pourquoi : `apercus/dafont/VERDICT-LICENCES.md` (hors dépôt).
 *
 * ⚠️ LES FICHIERS SONT EMBARQUÉS TELS QUELS, NI CONVERTIS NI ALLÉGÉS. L'OFL appelle « version
 * modifiée » toute conversion de format ou tout sous-ensemble, et une version modifiée perd le droit
 * de porter un nom réservé : or plusieurs de ces polices en ont un (Beth Ellen, Pecita, Some Time
 * Later, Xolonium…). Garder l'original évite la question, au prix du poids (une quinzaine de Mo).
 *
 * ⚠️ IL S'ARRÊTE SANS RIEN ÉCRIRE AU MOINDRE MANQUE (même règle que tools/fetch-fonts.mjs) : un
 * fichier absent, illisible, ou une licence introuvable, et rien n'est touché.
 *
 * Il écrit :
 *   assets/fonts/dafont/<cle>/…        les fichiers de police, renommés de façon stable, et LICENSE.txt ;
 *   assets/fonts/dafont/dafont.css     les @font-face (importée par src/style.css) ;
 *   assets/fonts/dafont/LICENSES.md    le récapitulatif ;
 *   src/polices-dafont.js              la table lue par l'application (POLICES_BULLES).
 *
 * Usage :  node tools/import-dafont.mjs              (depuis apercus/dafont/)
 *          node tools/import-dafont.mjs --dry-run    (n'écrit rien, dit ce qu'il ferait)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, copyFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(RACINE, 'apercus', 'dafont');
const DOSSIER = join(RACINE, 'assets', 'fonts', 'dafont');

/** Les codes de licence ; leurs libellés et adresses sont dans LICENCES_POLICES (src/constants.js). */
export const CODES_LICENCE = ['ofl', 'cc0', 'dp', 'gpl2', 'ccbysa4'];

/**
 * ⚠️ LA SOURCE UNIQUE. `dossier` : le dossier du zip dans apercus/dafont (c'est aussi l'identifiant
 * de téléchargement DaFont). `fichiers` : le normal, puis les VRAIS gras, italique et gras italique
 * quand l'auteur les a dessinés (le reste sera simulé, et l'application le dit). `licenceFichier` :
 * le texte de licence du zip ; absent, il est reconstitué à partir des métadonnées de la police.
 * `usages` : les clés de USAGES_POLICES (src/constants.js).
 */
export const SELECTION = [
  { cle: 'bubblesans', nom: 'Bubble Sans', dossier: 'bubble_sans', licence: 'ofl', licenceFichier: 'OFL.txt', usages: ['dialogue'], fichiers: { normal: 'Bubble Sans 1.01.otf' } },
  { cle: 'primeminister', nom: 'Prime Minister of Canada', dossier: 'prime_minister_of_canada', licence: 'cc0', usages: ['dialogue'], fichiers: { normal: 'Prime Minister of Canada.otf' } },
  { cle: 'correctionbrush', nom: 'Correction Brush', dossier: 'correction_brush', licence: 'ofl', licenceFichier: 'License.txt', usages: ['dialogue', 'main'], fichiers: { normal: 'CorrectionBrush.ttf' } },
  { cle: 'misterbrush', nom: 'Mister Brush', dossier: 'mister_brush', licence: 'ofl', licenceFichier: 'License.txt', usages: ['dialogue', 'cris'], fichiers: { normal: 'MisterBrush.ttf' } },
  { cle: 'zerocool', nom: 'Zero Cool', dossier: 'zero_cool', licence: 'ofl', licenceFichier: 'License.txt', usages: ['dialogue', 'cris'], fichiers: { normal: 'ZeroCool.ttf' } },
  { cle: 'ruthlesssketch', nom: 'Ruthless Sketch', dossier: 'ruthless_sketch', licence: 'ofl', licenceFichier: 'License.txt', usages: ['cris'], fichiers: { normal: 'RuthlessSketch-Regular.ttf', italique: 'RuthlessSketch-Italic.ttf' } },
  { cle: 'pinzelan', nom: 'Pinzelan', dossier: 'pinzelan', licence: 'ofl', licenceFichier: 'License.txt', usages: ['cris'], fichiers: { normal: 'Pinzelan-Regular.ttf', italique: 'Pinzelan-Italic.ttf' } },
  { cle: 'unutterable', nom: 'Unutterable', dossier: 'unutterable', licence: 'ofl', licenceFichier: 'License.txt', usages: ['main', 'horreur'], fichiers: { normal: 'Unutterable-Regular.ttf', italique: 'Unutterable-Italic.ttf' } },
  { cle: 'kaph', nom: 'Kaph', dossier: 'kaph', licence: 'ofl', licenceFichier: 'License.txt', usages: ['cris', 'onomatopees'], fichiers: { normal: 'Kaph-Regular.ttf', italique: 'Kaph-Italic.ttf' } },
  { cle: 'foo', nom: 'Foo', dossier: 'foo', licence: 'cc0', usages: ['onomatopees'], fichiers: { normal: 'Foo.otf' } },
  { cle: 'baveuse', nom: 'Baveuse', dossier: 'baveuse', licence: 'cc0', usages: ['onomatopees'], fichiers: { normal: 'Baveuse.otf' } },
  { cle: 'ghostmeat', nom: 'Ghostmeat', dossier: 'ghostmeat', licence: 'cc0', licenceFichier: 'License.txt', usages: ['onomatopees'], fichiers: { normal: 'Ghostmeat.otf' } },
  { cle: 'degrassi', nom: 'Degrassi', dossier: 'degrassi', licence: 'cc0', usages: ['onomatopees'], fichiers: { normal: 'Degrassi.otf' } },
  { cle: 'hawkeye', nom: 'Hawkeye', dossier: 'hawkeye', licence: 'cc0', licenceFichier: 'license.txt', usages: ['onomatopees'], fichiers: { normal: 'Hawkeye.otf' } },
  { cle: 'planetbenson', nom: 'Planet Benson 2', dossier: 'planet_benson', licence: 'cc0', usages: ['onomatopees'], fichiers: { normal: 'Planet Benson 2.otf' } },
  { cle: 'huxtable', nom: 'Huxtable', dossier: 'huxtable', licence: 'cc0', usages: ['narration'], fichiers: { normal: 'Huxtable.otf' } },
  { cle: 'snidely', nom: 'Snidely', dossier: 'snidely', licence: 'cc0', licenceFichier: 'license.txt', usages: ['narration', 'cris'], fichiers: { normal: 'Snidely.otf' } },
  { cle: 'ltcowboy', nom: 'LT Cowboy', dossier: 'cowboy_3', licence: 'ofl', licenceFichier: 'OFL.txt', usages: ['cris'], fichiers: { normal: 'LTCowboy-Headline.ttf' } },
  { cle: 'wanders', nom: 'Wanders', dossier: 'wanders', licence: 'ofl', licenceFichier: 'OFL.txt', usages: ['cris'], fichiers: { normal: 'Wanders.otf' } },
  { cle: 'sometimelater', nom: 'Some Time Later', dossier: 'some_time_later', licence: 'ofl', usages: ['narration'], fichiers: { normal: 'Some Time Later.otf' } },
  { cle: 'ltmakeup', nom: 'LT Makeup', dossier: 'lt_makeup', licence: 'ofl', licenceFichier: 'OFL.txt', usages: ['cris'], fichiers: { normal: 'LTMakeup-Regular.otf' } },
  { cle: 'birdlandaeroplane', nom: 'Birdland Aeroplane', dossier: 'birdland_aeroplane', licence: 'cc0', licenceFichier: 'license.txt', usages: ['dialogue'], fichiers: { normal: 'Birdland Aeroplane.otf', gras: 'Birdland Aeroplane Bold.otf' } },
  { cle: 'greenfuz', nom: 'Green Fuz', dossier: 'green_fuz', licence: 'cc0', usages: ['horreur'], fichiers: { normal: 'Green Fuz.otf' } },
  { cle: 'riotact', nom: 'Riot Act 2', dossier: 'riot_act', licence: 'cc0', licenceFichier: 'license.txt', usages: ['horreur'], fichiers: { normal: 'Riot Act 2.otf' } },
  { cle: 'biometricjoe', nom: 'Biometric Joe', dossier: 'biometric_joe', licence: 'cc0', licenceFichier: 'license.txt', usages: ['horreur'], fichiers: { normal: 'Biometric Joe.otf' } },
  { cle: 'blackcraft', nom: 'Blackcraft', dossier: 'blackcraft', licence: 'ofl', licenceFichier: 'License.txt', usages: ['horreur'], fichiers: { normal: 'Blackcraft.ttf' } },
  { cle: 'sorundown', nom: 'So Run Down', dossier: 'so_run_down', licence: 'cc0', licenceFichier: 'License.txt', usages: ['horreur'], fichiers: { normal: 'So Run Down.otf' } },
  { cle: 'razorkeen', nom: 'Razor Keen', dossier: 'razor_keen', licence: 'cc0', licenceFichier: 'License.txt', usages: ['horreur', 'main'], fichiers: { normal: 'Razor Keen.otf' } },
  { cle: 'astronboy', nom: 'Astron Boy', dossier: 'astron_boy', licence: 'cc0', usages: ['robotique'], fichiers: { normal: 'Astron Boy.otf', italique: 'Astron Boy Italic.otf' } },
  { cle: 'xirod', nom: 'Xirod', dossier: 'xirod', licence: 'cc0', usages: ['robotique'], fichiers: { normal: 'Xirod.otf' } },
  { cle: 'savedbyzero', nom: 'Saved by Zero', dossier: 'saved_by_zero', licence: 'cc0', usages: ['robotique'], fichiers: { normal: 'Saved by Zero Rg.otf' } },
  { cle: 'xolonium', nom: 'Xolonium', dossier: 'xolonium', licence: 'ofl', licenceFichier: 'LICENSE.txt', usages: ['robotique'], fichiers: { normal: 'Xolonium-Regular.otf', gras: 'Xolonium-Bold.otf' } },
  { cle: 'wintermute', nom: 'Wintermute', dossier: 'wintermute', licence: 'cc0', licenceFichier: 'License.txt', usages: ['robotique'], fichiers: { normal: 'Wintermute.otf' } },
  { cle: 'droid', nom: 'Droid', dossier: 'droid', licence: 'cc0', usages: ['robotique'], fichiers: { normal: 'Droid 1997.otf' } },
  { cle: 'zorque', nom: 'Zorque', dossier: 'zorque', licence: 'cc0', usages: ['robotique', 'cris'], fichiers: { normal: 'Zorque.otf' } },
  { cle: 'lazenbycomputer', nom: 'Lazenby Computer', dossier: 'lazenby_computer', licence: 'ccbysa4', licenceFichier: 'lazenbycomputer.txt', usages: ['robotique'], fichiers: { normal: 'LazenbyCompSmooth.ttf' } },
  { cle: 'mainframe', nom: 'Mainframe', dossier: 'mainframe', licence: 'ccbysa4', licenceFichier: 'mainframe.txt', usages: ['robotique'], fichiers: { normal: 'mainframe-opto.ttf' } },
  { cle: 'supercomputer', nom: 'Supercomputer', dossier: 'supercomputer', licence: 'ccbysa4', licenceFichier: 'supercomputer.txt', usages: ['robotique'], fichiers: { normal: 'supercomputer.ttf' } },
  { cle: 'retrogaming', nom: 'Retro Gaming', dossier: 'retrogaming', licence: 'ccbysa4', usages: ['robotique'], fichiers: { normal: 'RetroGaming.ttf' } },
  { cle: 'gargle', nom: 'Gargle', dossier: 'gargle', licence: 'cc0', usages: ['dialogue', 'narration'], fichiers: { normal: 'Gargle Rg.otf', gras: 'Gargle Bd.otf', italique: 'Gargle Rg It.otf', grasItalique: 'Gargle Bd It.otf' } },
  { cle: 'bromine', nom: 'Bromine', dossier: 'bromine', licence: 'dp', licenceFichier: 'Readme.txt', usages: ['main'], fichiers: { normal: 'Bromine.ttf' } },
  { cle: 'justbreathe', nom: 'Just Breathe', dossier: 'just_breathe', licence: 'ofl', licenceFichier: 'SIL Open Font License.txt', usages: ['main', 'narration'], fichiers: { normal: 'JustBreathe.otf', gras: 'JustBreatheBd.otf', italique: 'JustBreatheObl1.otf', grasItalique: 'JustBreatheBdObl3.otf' } },
  { cle: 'thinpencil', nom: 'Thin Pencil Handwriting', dossier: 'thin_pencil_handwriting', licence: 'dp', usages: ['main'], fichiers: { normal: 'Thin Pencil Handwriting.ttf' } },
  { cle: 'levorotary', nom: 'Levorotary', dossier: 'levorotary', licence: 'ofl', usages: ['main'], fichiers: { normal: 'Levorotary_Medium.ttf' } },
  { cle: 'yourhighschoolcrush', nom: 'Your Highschool Crush', dossier: 'your_highschool_crush', licence: 'ofl', usages: ['main'], fichiers: { normal: 'YourHighschoolCrush-Regular.otf' } },
  { cle: 'domesticmanners', nom: 'Domestic Manners', dossier: 'domestic_manners', licence: 'gpl2', licenceFichier: 'license.txt', usages: ['main'], fichiers: { normal: 'Domestic_Manners.ttf' } },
  { cle: 'morningbreeze', nom: 'Morning Breeze', dossier: 'morning_breeze', licence: 'ofl', licenceFichier: 'readme.txt', usages: ['dialogue', 'narration'], fichiers: { normal: 'MorningBreeze.otf', gras: 'MorningBreeze-Bold.otf', italique: 'MorningBreeze-Italic.otf' } },
  { cle: 'lemontuesday', nom: 'Lemon Tuesday', dossier: 'lemon_tuesday', licence: 'ofl', licenceFichier: 'FREE FONT LICENSE.txt', usages: ['main'], fichiers: { normal: 'Lemon Tuesday.otf' } },
  { cle: 'odeanerik', nom: 'Ode an Erik', dossier: 'ode_an_erik_ah', licence: 'ofl', licenceFichier: 'Ode an Erik.txt', usages: ['main', 'cris'], fichiers: { normal: 'Ode-Erik.TTF' } },
  { cle: 'arkipelago', nom: 'Arkipelago', dossier: 'arkipelago', licence: 'ofl', licenceFichier: 'SIL Open Font License.txt', usages: ['main'], fichiers: { normal: 'Arkipelago 1.003.otf' } },
  { cle: 'bethellen', nom: 'Beth Ellen', dossier: 'beth_ellen', licence: 'ofl', licenceFichier: 'SIL Open Font License.txt', usages: ['main'], fichiers: { normal: 'Beth-Ellen-2.0.otf' } },
  { cle: 'pecita', nom: 'Pecita', dossier: 'pecita', licence: 'ofl', licenceFichier: 'Pecita.txt', usages: ['main'], fichiers: { normal: 'Pecita.otf' } },
  { cle: 'bristol', nom: 'Bristol', dossier: 'bristol', licence: 'ofl', licenceFichier: 'FREE FONT LICENSE.txt', usages: ['main'], fichiers: { normal: 'Bristol.otf' } },
  { cle: 'tippa', nom: 'Tippa', dossier: 'tippa', licence: 'ofl', licenceFichier: 'Open Font License.txt', usages: ['machine'], fichiers: { normal: 'Tippa.ttf' } },
  { cle: 'minya', nom: 'Minya', dossier: 'minya', licence: 'cc0', licenceFichier: 'license.txt', usages: ['machine'], fichiers: { normal: 'Minya.otf' } },
];

/** Les quatre variantes, dans l'ordre : leur graisse et leur style CSS. */
export const VARIANTES = [
  { champ: 'normal', graisse: 400, italique: false },
  { champ: 'gras', graisse: 700, italique: false },
  { champ: 'italique', graisse: 400, italique: true },
  { champ: 'grasItalique', graisse: 700, italique: true },
];

/** Le nom STABLE d'un fichier embarqué : `<cle>-<graisse>[-italic].<ext>`, l'extension d'origine en minuscules. PURE. */
export function nomDeFichierDafont(cle, variante, original){
  return `${cle}-${variante.graisse}${variante.italique ? '-italic' : ''}${extname(original).toLowerCase()}`;
}

/** Le `format()` CSS d'un fichier, d'après son extension. PURE. */
export function formatCss(fichier){
  return extname(fichier).toLowerCase() === '.otf' ? 'opentype' : 'truetype';
}

/** Ce que l'application sait d'une police : vrai gras, vrai italique. PURE. */
export function variantesDeLaSelection(p){
  return { gras: p.fichiers.gras ? 'vrai' : 'simule', italique: p.fichiers.italique ? 'vrai' : 'simule' };
}

/** Les @font-face, un par fichier. `font-display: block`, pour la même raison que fonts.css. PURE. */
export function feuilleDafont(selection){
  const entete = [
    '/* assets/fonts/dafont/dafont.css',
    ' *',
    ' * FICHIER GÉNÉRÉ PAR tools/import-dafont.mjs, NE PAS MODIFIER À LA MAIN.',
    ' *',
    ' * Les polices choisies sur DaFont (#423), embarquées telles quelles.',
    ' * Licences et attributions : voir LICENSES.md dans ce dossier.',
    ' */',
    '',
  ].join('\n');
  const blocs = [];
  for (const p of selection) {
    for (const v of VARIANTES) {
      const original = p.fichiers[v.champ];
      if (!original) continue;
      const f = nomDeFichierDafont(p.cle, v, original);
      blocs.push([
        '@font-face {',
        `  font-family: '${p.nom}';`,
        `  font-style: ${v.italique ? 'italic' : 'normal'};`,
        `  font-weight: ${v.graisse};`,
        '  font-display: block;',
        `  src: url(./${p.cle}/${f}) format('${formatCss(f)}');`,
        '}',
      ].join('\n'));
    }
  }
  return `${entete}\n${blocs.join('\n\n')}\n`;
}

/** Le module de l'application. PURE. */
export function moduleApplication(selection){
  const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`;
  const lignes = selection.map(p => {
    const v = variantesDeLaSelection(p);
    return `  { nom: ${q(p.nom)}, usages: [${p.usages.map(q).join(', ')}], gras: '${v.gras}', italique: '${v.italique}', licence: '${p.licence}' },`;
  });
  return [
    '/**',
    ' * @file polices-dafont.js',
    ' * GÉNÉRÉ PAR tools/import-dafont.mjs, NE PAS MODIFIER À LA MAIN.',
    ' *',
    ' * Les polices choisies sur DaFont (#423), dans le même ordre que l\'outil. Elles rejoignent',
    ' * POLICES_BULLES (src/constants.js) ; leurs fichiers sont dans assets/fonts/dafont/.',
    ' */',
    'export const POLICES_DAFONT = Object.freeze([',
    ...lignes,
    ']);',
    '',
  ].join('\n');
}

const TEXTES_LICENCE = {
  cc0: 'Released under Creative Commons Zero v1.0 Universal (CC0 1.0): no rights reserved.\nhttps://creativecommons.org/publicdomain/zero/1.0/',
  dp: 'This font is in the public domain.',
  ccbysa4: 'Licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).\nhttps://creativecommons.org/licenses/by-sa/4.0/',
};

/**
 * Le LICENSE.txt d'une police : ce qu'elle dit d'elle-même (copyright, créateur), puis le texte de
 * licence de son zip. Sans texte dans le zip : celui de ses métadonnées s'il est complet, sinon le
 * texte de référence de sa licence (l'OFL entière, que la licence exige de faire voyager). PURE.
 */
export function texteLicence(p, infos, texteDuZip, ofl){
  const tete = [
    `${p.nom}`,
    `Source: DaFont, https://dl.dafont.com/dl/?f=${p.dossier} (archive as downloaded on 12 October 2026).`,
    `Files: ${VARIANTES.filter(v => p.fichiers[v.champ]).map(v => nomDeFichierDafont(p.cle, v, p.fichiers[v.champ])).join(', ')} (unmodified).`,
  ];
  if (infos.auteur) tete.push(`Designer: ${infos.auteur}`);
  if (infos.copyright) tete.push(`Copyright notice in the font: ${infos.copyright.replace(/\s+/g, ' ').trim()}`);
  let corps;
  if (p.licence === 'ofl') {
    corps = texteDuZip;
    if (!corps && infos.licence && /PERMISSION & CONDITIONS/.test(infos.licence)) corps = infos.licence;
    // Un readme qui se contente de NOMMER l'OFL : le texte entier suit, puisque la licence l'exige.
    if (!corps || !/PERMISSION & CONDITIONS/.test(corps)) corps = [corps, ofl].filter(Boolean).join('\n\n');
  } else if (p.licence === 'gpl2') {
    corps = texteDuZip;
  } else {
    corps = [TEXTES_LICENCE[p.licence], texteDuZip || infos.licence].filter(Boolean).join('\n\n');
  }
  if (!corps) throw new Error(`${p.nom} : aucun texte de licence`);
  return `${tete.join('\n')}\n\n${'-'.repeat(60)}\n\n${String(corps).replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()}\n`;
}

const LIBELLES = { ofl: 'SIL OFL 1.1', cc0: 'CC0 1.0', dp: 'Public domain', gpl2: 'GNU GPL 2', ccbysa4: 'CC BY-SA 4.0' };

/** Le récapitulatif. PURE. */
export function recapitulatifDafont(fiches){
  const echappe = (s) => String(s || '?').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
  return [
    '# Fonts from DaFont bundled with Storyboarder BD',
    '',
    'GENERATED BY `tools/import-dafont.mjs`, DO NOT EDIT BY HAND.',
    '',
    'Each font was kept only because its written licence allows redistribution without asking the',
    'author: CC0, public domain, SIL Open Font License 1.1, GNU GPL or CC BY-SA 4.0. The files are',
    'bundled UNMODIFIED. None of these licences places any condition on the rest of this project;',
    'the OFL, the GPL and CC BY-SA ask that the copyright notice and the licence travel with the',
    'font, which is why each folder holds its own LICENSE.txt.',
    '',
    '| Family | Designer | Licence | Copyright |',
    '| --- | --- | --- | --- |',
    ...fiches.map(f => `| ${echappe(f.nom)} | ${echappe(f.auteur)} | ${LIBELLES[f.licence]} | ${echappe(f.copyright)} |`),
    '',
    'Full licence texts: `<family>/LICENSE.txt` in this folder.',
    '',
  ].join('\n');
}

/**
 * Un fichier texte de zip : UTF-8, ou à défaut Latin-1 (plusieurs licences de ces zips, écrites
 * sous Windows, portent un « © » en Latin-1 que l'UTF-8 rendrait en « � »). PURE.
 */
export function texteLisible(octets){
  const utf8 = octets.toString('utf8');
  return utf8.includes('�') ? octets.toString('latin1') : utf8;
}

// ── À partir d'ici, l'entrée-sortie. ─────────────────────────────────────────────────────────────

function main(){
  const dryRun = process.argv.includes('--dry-run');
  const require = createRequire(import.meta.url);
  const { lirePolice } = require('../electron/bibliotheque/polices-fichiers.js');
  const ofl = readFileSync(join(RACINE, 'tools', 'licences', 'OFL-1.1.txt'), 'utf8');

  // Tout lire et tout vérifier AVANT d'écrire quoi que ce soit.
  const plan = [];
  const manques = [];
  for (const p of SELECTION) {
    if (!CODES_LICENCE.includes(p.licence)) manques.push(`${p.nom} : licence « ${p.licence} »`);
    const copies = [];
    let infos = null;
    for (const v of VARIANTES) {
      const original = p.fichiers[v.champ];
      if (!original) continue;
      const chemin = join(SOURCE, p.dossier, original);
      if (!existsSync(chemin)) { manques.push(chemin); continue; }
      const lu = lirePolice(readFileSync(chemin));
      if (!lu) { manques.push(`${chemin} : illisible`); continue; }
      if (!infos) infos = lu;
      copies.push({ de: chemin, vers: nomDeFichierDafont(p.cle, v, original) });
    }
    let texteDuZip = null;
    if (p.licenceFichier) {
      const chemin = join(SOURCE, p.dossier, p.licenceFichier);
      if (!existsSync(chemin)) manques.push(chemin);
      else texteDuZip = texteLisible(readFileSync(chemin));
    }
    plan.push({ p, copies, infos: infos || {}, texteDuZip });
  }
  if (manques.length) throw new Error(`rien n'est écrit, il manque :\n  ${manques.join('\n  ')}`);

  const nb = plan.reduce((n, x) => n + x.copies.length, 0);
  console.log(`${SELECTION.length} familles, ${nb} fichiers.`);
  if (dryRun) {
    plan.forEach(x => x.copies.forEach(c => console.log(`  ${x.p.cle}/${c.vers}  ←  ${c.de}`)));
    return;
  }

  // Le dossier est ENTIÈREMENT généré : on le refait, pour qu'une police retirée de la liste ne
  // laisse aucun orphelin (cf. fichiersPerimes3D de fetch-fonts.mjs).
  rmSync(DOSSIER, { recursive: true, force: true });
  mkdirSync(DOSSIER, { recursive: true });
  const fiches = [];
  for (const { p, copies, infos, texteDuZip } of plan) {
    const d = join(DOSSIER, p.cle);
    mkdirSync(d, { recursive: true });
    copies.forEach(c => copyFileSync(c.de, join(d, c.vers)));
    writeFileSync(join(d, 'LICENSE.txt'), texteLicence(p, infos, texteDuZip, ofl), 'utf8');
    fiches.push({ nom: p.nom, auteur: infos.auteur, licence: p.licence, copyright: infos.copyright });
  }
  writeFileSync(join(DOSSIER, 'dafont.css'), feuilleDafont(SELECTION), 'utf8');
  writeFileSync(join(DOSSIER, 'LICENSES.md'), recapitulatifDafont(fiches), 'utf8');
  writeFileSync(join(RACINE, 'src', 'polices-dafont.js'), moduleApplication(SELECTION), 'utf8');
  console.log(`Écrit : assets/fonts/dafont/ (${readdirSync(DOSSIER).length} entrées), src/polices-dafont.js.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { main(); } catch (e) { console.error(`\nÉCHEC : ${e.message}`); process.exitCode = 1; }
}
