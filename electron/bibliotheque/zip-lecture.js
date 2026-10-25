/**
 * zip-lecture.js, lire QUELQUES fichiers d'une archive zip en mémoire (#446b : les matières
 * ambientCG arrivent en zip, dont on ne garde que trois ou quatre images).
 *
 * Volontairement minimal : le répertoire central, les méthodes « stockée » (0) et « deflate » (8),
 * rien d'autre (ni chiffrement, ni zip64, ni archive multi-volume) ; ce qui sort de ce cadre est
 * refusé, jamais deviné. Une limite de taille par fichier écarte une archive piégée qui se
 * décompresserait en gigaoctets. Les noms avec un dossier ou une remontée sont ignorés : on ne lit
 * que des fichiers à la racine, par leur nom exact.
 */
'use strict';
const zlib = require('zlib');

const SIG_FIN = 0x06054b50;      // fin du répertoire central
const SIG_CENTRAL = 0x02014b50;  // une entrée du répertoire central
const SIG_LOCAL = 0x04034b50;    // l'en-tête local d'un fichier
const TAILLE_MAX_FICHIER = 64 * 1024 * 1024;

/** La position de la fin du répertoire central (cherchée depuis la fin : un commentaire peut suivre). */
function finDuRepertoire(buf){
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === SIG_FIN) return i;
  }
  return -1;
}

/** Les entrées de l'archive : `[{ nom, methode, taille, tailleCompressee, local }]`, ou null si illisible. */
function entreesDuZip(buf){
  if (!Buffer.isBuffer(buf) || buf.length < 22) return null;
  const fin = finDuRepertoire(buf);
  if (fin < 0) return null;
  const nombre = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const entrees = [];
  for (let k = 0; k < nombre; k++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CENTRAL) return null;
    const drapeaux = buf.readUInt16LE(p + 8);
    const methode = buf.readUInt16LE(p + 10);
    const tailleCompressee = buf.readUInt32LE(p + 20);
    const taille = buf.readUInt32LE(p + 24);
    const lNom = buf.readUInt16LE(p + 28), lExtra = buf.readUInt16LE(p + 30), lComm = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nom = buf.toString('utf8', p + 46, p + 46 + lNom);
    entrees.push({ nom, methode, taille, tailleCompressee, local, chiffre: !!(drapeaux & 1) });
    p += 46 + lNom + lExtra + lComm;
  }
  return entrees;
}

/**
 * Le contenu des fichiers `noms` (à la racine de l'archive) : `Map(nom → Buffer)`. Un nom absent
 * n'y figure pas ; une entrée chiffrée, trop grosse ou d'une méthode inconnue lève une erreur.
 */
function extraire(buf, noms){
  const entrees = entreesDuZip(buf);
  if (!entrees) throw new Error('archive illisible');
  const voulus = new Set(noms);
  const sortie = new Map();
  for (const e of entrees) {
    if (!voulus.has(e.nom) || e.nom.includes('/') || e.nom.includes('\\') || e.nom.includes('..')) continue;
    if (e.chiffre) throw new Error(`fichier chiffré : ${e.nom}`);
    if (e.taille > TAILLE_MAX_FICHIER) throw new Error(`fichier trop gros : ${e.nom}`);
    if (e.local + 30 > buf.length || buf.readUInt32LE(e.local) !== SIG_LOCAL) throw new Error('archive illisible');
    const debut = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
    const brut = buf.subarray(debut, debut + e.tailleCompressee);
    let donnees;
    if (e.methode === 0) donnees = Buffer.from(brut);
    else if (e.methode === 8) donnees = zlib.inflateRawSync(brut, { maxOutputLength: TAILLE_MAX_FICHIER });
    else throw new Error(`méthode de compression inconnue (${e.methode}) : ${e.nom}`);
    if (donnees.length !== e.taille) throw new Error(`fichier tronqué : ${e.nom}`);
    sortie.set(e.nom, donnees);
  }
  return sortie;
}

/** Les noms des fichiers à la racine de l'archive (pour choisir les cartes). */
function nomsDuZip(buf){
  const e = entreesDuZip(buf);
  return e ? e.map(x => x.nom).filter(n => !n.includes('/') && !n.endsWith('/')) : null;
}

module.exports = { entreesDuZip, extraire, nomsDuZip, TAILLE_MAX_FICHIER };
