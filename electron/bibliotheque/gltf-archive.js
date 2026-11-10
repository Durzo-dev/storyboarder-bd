/**
 * gltf-archive.js, #444d: a glTF archive (.zip: one `.gltf`, its `.bin`, its images) turned into a `.glb`.
 *
 * Sketchfab offers nearly every model as a `.glb`; a few only as this archive. It is unpacked in
 * memory (zip-lecture.js) and packed into one file (gltf-glb.js), the format the models folder stores.
 * PURE (no network, no disk): tested under bare Node.
 */
'use strict';
const zip = require('./zip-lecture');
const { empaqueterGlb } = require('./gltf-glb');

/**
 * The `.glb` bytes of a glTF archive. Throws when the archive is unreadable, holds no `.gltf` or several
 * (which scene to take would be a guess), or lacks a file the `.gltf` names.
 */
function glbDepuisArchiveGltf(octets, tailleTotaleMax){
  const fichiers = zip.fichiersDuZip(Buffer.from(octets), tailleTotaleMax);
  const scenes = [...fichiers.keys()].filter(n => /\.gltf$/i.test(n));
  if (scenes.length !== 1) throw new Error(scenes.length ? 'plusieurs scènes .gltf' : 'aucune scène .gltf');
  const scene = scenes[0];
  // The .gltf names its files relative to its own folder.
  const dossier = scene.includes('/') ? scene.slice(0, scene.lastIndexOf('/') + 1) : '';
  const ressources = new Map();
  for (const [nom, b] of fichiers) if (nom !== scene && nom.startsWith(dossier)) ressources.set(nom.slice(dossier.length), b);
  return empaqueterGlb(JSON.parse(fichiers.get(scene).toString('utf8')), ressources);
}

module.exports = { glbDepuisArchiveGltf };
