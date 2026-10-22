/**
 * @file batiment-store.js
 * Les bâtiments de la bibliothèque (#454a) : lister, lire, enregistrer, renommer, supprimer.
 *
 * Même partage des rôles que model-store.js : ce module DÉCIDE (nom retenu, collisions, relecture),
 * le pont Electron écrit et lit (cf. main.js, section « BÂTIMENTS »).
 *
 * UN DOSSIER À PART, `<dossier de Projets>/Batiments`, et non `Modeles` : `models:list` n'accepte
 * que des `.glb`, et tout le chemin des modèles importés (cache, vignettes, store) suppose un glTF.
 * Y glisser des `.batiment.json` obligerait à percer cette garde partout, pour la même raison que
 * les images ont eu leur propre dossier. Un bâtiment reste un Modèle pour l'UTILISATEUR (listé avec
 * eux, décision 7) : c'est la bibliothèque des modèles qui réunit les deux dossiers à l'affichage.
 */
import { lireBatiment, ecrireBatiment, nomDeFichierLibre, nomDeFichierDuBatiment } from './batiment.js';

let _pont = null;
/** Le seau des tests : un pont simulé à la place de `window.storyboarderAPI`. */
export function setBatimentBridge(pont){ _pont = pont; }
function pont(){
  return _pont || (typeof window !== 'undefined' ? window.storyboarderAPI : null);
}

/** Les fichiers de bâtiment présents. Tableau vide sans pont (mode navigateur, tests). */
export async function listerBatiments(){
  const p = pont();
  if (!p || !p.listBatimentFiles) return [];
  try { return await p.listBatimentFiles() || []; } catch { return []; }
}

/**
 * Lit un bâtiment. `{ ok: true, batiment, recent? }`, ou `{ ok: false, error }` : fichier absent
 * (cas nominal, il a pu être déplacé), ou illisible.
 */
export async function lireBatimentDuDisque(fichier, traduire){
  const p = pont();
  if (!p || !p.readBatimentFile) return { ok: false, error: 'indisponible hors de l\'application' };
  const r = await p.readBatimentFile(fichier);
  if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'lecture impossible' };
  const lu = lireBatiment(r.texte, traduire);
  if (lu.erreur) return { ok: false, error: 'ce fichier n\'est pas un bâtiment lisible' };
  return { ok: true, ...lu };
}

/**
 * Enregistre un bâtiment. Sans `fichier`, c'est un NOUVEAU : un nom libre est choisi d'après son
 * nom (« Maison (2) » si « Maison » est pris). Avec `fichier`, on réécrit celui-là. Rend
 * `{ ok: true, fichier }` ou `{ ok: false, error }`.
 */
export async function enregistrerBatiment(batiment, fichier){
  const p = pont();
  if (!p || !p.writeBatimentFile) return { ok: false, error: 'indisponible hors de l\'application' };
  const nom = fichier ? nomDeFichierDuBatiment(fichier) : nomDeFichierLibre(batiment && batiment.nom, await listerBatiments());
  const r = await p.writeBatimentFile(nom, ecrireBatiment(batiment));
  return r && r.ok ? { ok: true, fichier: nom } : { ok: false, error: (r && r.error) || 'écriture impossible' };
}

/** Renomme un fichier ; refuse un nom déjà pris (le pont le refuse aussi). */
export async function renommerBatiment(ancien, nouveauNom){
  const p = pont();
  if (!p || !p.renameBatimentFile) return { ok: false, error: 'indisponible hors de l\'application' };
  const nouveau = nomDeFichierDuBatiment(nouveauNom);
  if (nouveau.toLowerCase() !== String(ancien).toLowerCase()
    && (await listerBatiments()).some(n => n.toLowerCase() === nouveau.toLowerCase())) {
    return { ok: false, error: 'un bâtiment porte déjà ce nom' };
  }
  const r = await p.renameBatimentFile(ancien, nouveau);
  return r && r.ok ? { ok: true, fichier: nouveau } : { ok: false, error: (r && r.error) || 'renommage impossible' };
}

/**
 * Supprime un fichier. Les copies déjà placées dans des Scènes n'en dépendent PAS (décision 6) :
 * elles embarquent leur bâtiment, rien ne casse.
 */
export async function supprimerBatiment(fichier){
  const p = pont();
  if (!p || !p.deleteBatimentFile) return { ok: false, error: 'indisponible hors de l\'application' };
  const r = await p.deleteBatimentFile(fichier);
  return r && r.ok ? { ok: true } : { ok: false, error: (r && r.error) || 'suppression impossible' };
}
