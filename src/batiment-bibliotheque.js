/**
 * @file batiment-bibliotheque.js
 * LES BÂTIMENTS DANS « MES MODÈLES » (#454a-4b, décidé avec Valentin le 23 octobre 2026). Fonctions
 * PURES : les entrées de la bibliothèque, et la règle d'enregistrement.
 *
 * Un bâtiment est un Modèle pour l'utilisateur : il apparaît dans la même grille, rangé d'office dans
 * la catégorie « Architecture & bâtiments » (le filtre existant le retrouve, pas de filtre à part),
 * une icône sur sa vignette le distingue d'un modèle importé. Ses fichiers vivent pourtant à part
 * (`Batiments/`, cf. batiment-store.js) : la bibliothèque réunit les deux à l'affichage.
 *
 * OÙ IL SERT : un bâtiment placé depuis la bibliothèque garde le nom du fichier d'où il vient
 * (`batimentSource`, champ ajouté, informatif) ; c'est par lui que la fiche liste ses endroits.
 * Il reste une copie indépendante : retoucher le fichier ne le change pas.
 */
import { nomAfficheDuFichier, nomDeFichierDuBatiment } from './batiment.js';
import { encombrementDuBatiment, OBJ_TYPE_BATIMENT } from './batiment-element.js';
import { modelUsageLocations } from './model-usages.js';

/** La catégorie d'office d'un bâtiment (celle des sources, cf. store-categories.js). */
export const CATEGORIE_BATIMENTS = 'architecture';

/** Cet Élément est-il un bâtiment placé depuis le fichier `fichier` ? */
export function vientDuFichier(o, fichier){
  return !!o && o.objType === OBJ_TYPE_BATIMENT && typeof o.batimentSource === 'string'
    && o.batimentSource.toLowerCase() === String(fichier).toLowerCase();
}

/**
 * Les entrées de la bibliothèque pour les bâtiments lus : `lus` est `[{ fichier, batiment, taille?,
 * modifie? }]` (`batiment` null si le fichier est illisible). Même forme que les entrées des modèles
 * (local-library.js), plus `batiment: true` et ce qui ne vaut que pour un bâtiment (niveaux,
 * pièces, ouvertures). `os: 0` : rien à poser dans l'Éditeur de modèle.
 */
export function entreesBatiments(lus, projet = {}){
  return (lus || []).filter(x => x && x.fichier).map(({ fichier, batiment, taille = null, modifie = null }) => {
    const endroits = modelUsageLocations(fichier, projet, vientDuFichier);
    const enc = batiment ? encombrementDuBatiment(batiment) : null;
    return {
      fichier,
      batiment: true,
      titre: nomAfficheDuFichier(fichier),
      categorie: CATEGORIE_BATIMENTS, categorieChoisie: false,
      tags: [], nomsTags: [],
      dimensions: enc ? [enc.largeur, enc.profondeur, enc.hauteur] : null,
      os: 0,
      attribution: null,
      taille, modifie,
      introuvable: !batiment,
      niveaux: batiment ? batiment.niveaux.length : 0,
      pieces: batiment ? batiment.pieces.length : 0,
      ouvertures: batiment ? (batiment.ouvertures || []).length : 0,
      scenes: endroits.filter(e => e.kind === 'scene'),
      cases: endroits.filter(e => e.kind === 'panel'),
    };
  });
}

/**
 * Ce que fait « Enregistrer » pour un bâtiment ouvert depuis le fichier `fichier` (ou null, un
 * bâtiment neuf) et nommé `nom` (demandé : pas d'« Enregistrer sous »).
 *   - neuf : 'nouveau' (un fichier libre d'après son nom) ;
 *   - même nom que son fichier : 'remplacer' (le modèle de la bibliothèque change ; une confirmation
 *     le dit, et dit que les copies déjà placées ne changent pas) ;
 *   - RENOMMÉ dans l'éditeur : 'nouveau', le fichier d'origine reste tel quel. C'est la manière de
 *     faire une variante : changer le nom.
 */
export function actionDEnregistrement(fichier, nom){
  if (!fichier) return 'nouveau';
  return nomDeFichierDuBatiment(nom).toLowerCase() === String(fichier).toLowerCase() ? 'remplacer' : 'nouveau';
}
