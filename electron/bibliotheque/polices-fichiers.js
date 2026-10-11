/**
 * @file electron/bibliotheque/polices-fichiers.js
 * #423 : LIRE un fichier de police apporté par l'utilisateur (.ttf, .otf, .woff, .woff2) pour en
 * connaître le NOM (celui que la police se donne, pas celui du fichier, demandé), le STYLE (graisse,
 * italique, graisses d'une police variable) et ce qu'elle dit de sa LICENCE.
 *
 * CommonJS, testé sous Node nu ; il tourne dans le processus principal, qui a zlib (WOFF) et
 * Brotli (WOFF2) sous la main.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'ON LIT, ET POURQUOI CES TABLES-LÀ
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   name  le nom de famille (16, sinon 1), de style (17, sinon 2), complet (4), le copyright (0),
 *         le créateur (9), la description de la licence (13) et son adresse (14) ;
 *   OS/2  la graisse (usWeightClass), l'italique (fsSelection, bit 0) et fsType, les droits que la
 *         police se donne : installable, aperçu et impression seulement, modifiable, restreinte ;
 *   head  macStyle, le second avis sur le gras et l'italique quand OS/2 manque ;
 *   fvar  les axes d'une police VARIABLE : une seule « Nunito » couvre toutes les graisses.
 *
 * ⚠️ CE QUE LA POLICE DIT D'ELLE-MÊME N'EST PAS UNE PREUVE. Les champs de licence sont souvent vides
 * ou faux ; on les MONTRE, avec un avertissement quand fsType se déclare restreinte, et on ne refuse
 * rien : c'est à l'utilisateur de savoir ce qu'il a le droit d'utiliser.
 *
 * ⚠️ UN FICHIER ILLISIBLE REND `null`, il ne lève jamais : un fichier corrompu au milieu d'une
 * sélection de dix ne doit pas faire échouer les neuf autres.
 */

'use strict';

const zlib = require('zlib');

const lireU16 = (b, o) => b.readUInt16BE(o);
const lireU32 = (b, o) => b.readUInt32BE(o);
const etiquette = (b, o) => b.toString('latin1', o, o + 4);

/** Les 63 tables connues de WOFF2, dans l'ordre de la spécification (W3C, 5.1). */
const TABLES_WOFF2 = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca',
  'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
];

/** Les tables qu'on lit ; les autres ne sont pas extraites (un WOFF2 les décompresse quand même). */
const UTILES = new Set(['name', 'OS/2', 'head', 'fvar']);

/** Le format d'un fichier, d'après ses quatre premiers octets. */
function formatDe(b){
  if (!b || b.length < 12) return null;
  const sig = etiquette(b, 0);
  if (sig === 'wOFF') return 'woff';
  if (sig === 'wOF2') return 'woff2';
  if (sig === 'OTTO' || sig === 'true' || lireU32(b, 0) === 0x00010000) return 'sfnt';
  return null;
}

/** TTF / OTF : la table des tables, puis chaque table par son décalage. */
function tablesSfnt(b){
  const n = lireU16(b, 4);
  const out = {};
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    const tag = etiquette(b, r);
    if (!UTILES.has(tag)) continue;
    const debut = lireU32(b, r + 8), longueur = lireU32(b, r + 12);
    if (debut + longueur <= b.length) out[tag] = b.subarray(debut, debut + longueur);
  }
  return out;
}

/** WOFF 1 : une table par entrée, compressée par zlib quand elle y gagne. */
function tablesWoff(b){
  const n = lireU16(b, 12);
  const out = {};
  for (let i = 0; i < n; i++) {
    const r = 44 + i * 20;
    const tag = etiquette(b, r);
    if (!UTILES.has(tag)) continue;
    const debut = lireU32(b, r + 4), compresse = lireU32(b, r + 8), longueur = lireU32(b, r + 12);
    const brut = b.subarray(debut, debut + compresse);
    out[tag] = compresse < longueur ? zlib.inflateSync(brut) : brut;
  }
  return out;
}

/** Un entier UIntBase128 de WOFF2 : sept bits par octet, le bit fort dit « il en reste ». */
function base128(b, o){
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const octet = b[o + i];
    v = (v * 128) + (octet & 0x7f);
    if (!(octet & 0x80)) return { v, taille: i + 1 };
  }
  throw new Error('UIntBase128 trop long');
}

/**
 * WOFF 2 : une table des tables à longueurs variables, puis UN flux Brotli qui contient toutes les
 * tables à la suite. `name`, `OS/2`, `head` et `fvar` n'y sont jamais transformées (seules glyf,
 * loca et hmtx peuvent l'être) : leurs octets décompressés sont ceux de la police.
 */
function tablesWoff2(b){
  const n = lireU16(b, 12);
  const compresse = lireU32(b, 20);
  let o = 48;
  const entrees = [];
  for (let i = 0; i < n; i++) {
    const drapeaux = b[o++];
    let tag;
    if ((drapeaux & 0x3f) === 63) { tag = etiquette(b, o); o += 4; } else tag = TABLES_WOFF2[drapeaux & 0x3f];
    const orig = base128(b, o); o += orig.taille;
    const version = (drapeaux >> 6) & 3;
    // glyf et loca sont transformées en version 0 ; toute autre table l'est hors version 0.
    const transformee = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
    let longueur = orig.v;
    if (transformee) { const t = base128(b, o); o += t.taille; longueur = t.v; }
    entrees.push({ tag, longueur });
  }
  if (etiquette(b, 4) === 'ttcf') return {};   // une collection : hors de portée, et rare
  const flux = zlib.brotliDecompressSync(b.subarray(o, o + compresse));
  const out = {};
  let p = 0;
  for (const e of entrees) {
    if (UTILES.has(e.tag)) out[e.tag] = flux.subarray(p, p + e.longueur);
    p += e.longueur;
  }
  return out;
}

/** Une chaîne de la table `name` : Windows (UTF-16 BE) d'abord, en anglais si possible, puis Mac. */
function noms(t){
  if (!t || t.length < 6) return {};
  const nombre = lireU16(t, 2), stockage = lireU16(t, 4);
  const candidats = {};
  for (let i = 0; i < nombre; i++) {
    const r = 6 + i * 12;
    if (r + 12 > t.length) break;
    const plateforme = lireU16(t, r), codage = lireU16(t, r + 2), langue = lireU16(t, r + 4);
    const id = lireU16(t, r + 6), longueur = lireU16(t, r + 8), decalage = lireU16(t, r + 10);
    const debut = stockage + decalage;
    if (debut + longueur > t.length) continue;
    const octets = t.subarray(debut, debut + longueur);
    let texte = null, rang = 9;
    if (plateforme === 3 && (codage === 1 || codage === 10)) { texte = utf16be(octets); rang = langue === 0x409 ? 0 : 1; }
    else if (plateforme === 0) { texte = utf16be(octets); rang = 2; }
    else if (plateforme === 1 && codage === 0) { texte = octets.toString('latin1'); rang = langue === 0 ? 3 : 4; }
    if (texte == null) continue;
    if (!candidats[id] || rang < candidats[id].rang) candidats[id] = { texte: texte.trim(), rang };
  }
  const out = {};
  for (const [id, c] of Object.entries(candidats)) if (c.texte) out[id] = c.texte;
  return out;
}

function utf16be(octets){
  const copie = Buffer.from(octets);
  if (copie.length % 2) return null;
  copie.swap16();
  return copie.toString('utf16le');
}

/** Ce que fsType autorise. 0 : installable ; 2 : restreinte ; 4 : aperçu et impression ; 8 : modifiable. */
function droits(fsType){
  if (fsType & 0x0002) return 'restreinte';
  if (fsType & 0x0004) return 'apercu';
  if (fsType & 0x0008) return 'modifiable';
  return 'installable';
}

/** Les graisses couvertes par l'axe `wght` d'une police variable, ou null. */
function axeGraisse(t){
  if (!t || t.length < 16) return null;
  const debut = lireU16(t, 4), nombre = lireU16(t, 8), taille = lireU16(t, 10);
  for (let i = 0; i < nombre; i++) {
    const r = debut + i * taille;
    if (r + 20 > t.length) break;
    if (etiquette(t, r) !== 'wght') continue;
    const fixe = (o) => t.readInt32BE(o) / 65536;
    return [Math.round(fixe(r + 4)), Math.round(fixe(r + 12))];
  }
  return null;
}

/** Les mots de graisse et de style qu'une famille « héritée » (nom 1) porte en fin de nom. */
const MOTS_DE_STYLE = /\s+(Hairline|Thin|ExtraLight|Extra Light|UltraLight|Light|Book|Regular|Normal|Medium|SemiBold|Semi Bold|DemiBold|Bold|ExtraBold|Extra Bold|UltraBold|Heavy|Black|ExtraBlack|Italic|Oblique)$/i;

/**
 * Le nom de FAMILLE. Le nom 16 (« famille typographique ») est le bon ; à défaut, le nom 1, qui
 * dans une police variable ou une graisse hors du quatuor normal/gras porte souvent la graisse en
 * suffixe : « Nunito ExtraLight » pour la Nunito variable. On retire alors ces mots, sans quoi deux
 * fichiers d'une même police feraient deux familles.
 */
function nomDeFamille(n, variable, graisse){
  if (n[16]) return n[16];
  let f = n[1];
  if (!f) return null;
  if (variable || (graisse !== 400 && graisse !== 700)) {
    let avant;
    do { avant = f; f = f.replace(MOTS_DE_STYLE, ''); } while (f !== avant && f.includes(' '));
  }
  return f || n[1];
}

/**
 * Ce qu'un fichier de police dit de lui-même, ou `null` s'il n'est pas une police lisible.
 * @returns {{ famille, style, nomComplet, graisse, italique, graisses, format, licence, url,
 *             copyright, auteur, droits } | null}
 */
function lirePolice(octets){
  try {
    const b = Buffer.isBuffer(octets) ? octets : Buffer.from(octets);
    const format = formatDe(b);
    if (!format) return null;
    const t = format === 'sfnt' ? tablesSfnt(b) : format === 'woff' ? tablesWoff(b) : tablesWoff2(b);
    const n = noms(t.name);
    const os2 = t['OS/2'], head = t.head;
    const graisse = os2 && os2.length >= 6 ? lireU16(os2, 4) : (head && head.length >= 46 && (lireU16(head, 44) & 1) ? 700 : 400);
    const graisses = axeGraisse(t.fvar);
    const famille = nomDeFamille(n, !!graisses, graisse);
    if (!famille) return null;
    const italique = os2 && os2.length >= 64 ? !!(lireU16(os2, 62) & 1) : !!(head && head.length >= 46 && (lireU16(head, 44) & 2));
    const fsType = os2 && os2.length >= 10 ? lireU16(os2, 8) : 0;
    return {
      famille,
      style: n[17] || n[2] || '',
      nomComplet: n[4] || famille,
      graisse,
      italique,
      graisses,
      format,
      licence: n[13] || null,
      url: n[14] || null,
      copyright: n[0] || null,
      auteur: n[9] || n[8] || null,
      droits: droits(fsType),
    };
  } catch (e) {
    return null;
  }
}

/**
 * Les fichiers lus, regroupés en FAMILLES (demandé : « Regular », « Bold » et « Italic » d'une même
 * police n'en font qu'une). Pour chacune : ses fichiers, et si elle a un VRAI gras (une graisse de
 * 600 ou plus, ou un axe variable qui y monte) et un VRAI italique. Ce qui manque sera simulé.
 */
function regrouperEnFamilles(lus){
  const parNom = new Map();
  for (const l of lus) {
    if (!l || !l.info) continue;
    const cle = l.info.famille;
    if (!parNom.has(cle)) parNom.set(cle, []);
    parNom.get(cle).push(l);
  }
  return [...parNom.entries()].map(([famille, fichiers]) => {
    const infos = fichiers.map(f => f.info);
    const premier = infos.find(i => i.licence || i.url || i.copyright) || infos[0];
    return {
      famille,
      fichiers: fichiers.map(f => ({ fichier: f.fichier, graisse: f.info.graisse, italique: f.info.italique, graisses: f.info.graisses })),
      gras: infos.some(i => i.graisse >= 600 || (i.graisses && i.graisses[1] >= 600)) ? 'vrai' : 'simule',
      italique: infos.some(i => i.italique) ? 'vrai' : 'simule',
      licence: premier.licence, url: premier.url, copyright: premier.copyright, auteur: premier.auteur,
      droits: infos.some(i => i.droits === 'restreinte') ? 'restreinte' : infos.some(i => i.droits === 'apercu') ? 'apercu' : premier.droits,
    };
  });
}

/** Extensions acceptées à l'import. */
const EXTENSIONS_POLICE = ['.ttf', '.otf', '.woff', '.woff2'];

module.exports = { lirePolice, regrouperEnFamilles, EXTENSIONS_POLICE, base128 };
