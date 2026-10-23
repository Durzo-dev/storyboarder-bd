/**
 * @file batiment-vignettes.js
 * LA VIGNETTE D'UN BÂTIMENT dans « Mes modèles » (#454a-4b). Rendue à la volée, vue de trois quarts,
 * par le même constructeur que l'éditeur et les Cases (batiment-3d.js), et gardée en mémoire tant
 * que le bâtiment ne change pas (clé : sa signature). Rien n'est écrit sur le disque : un bâtiment se
 * redessine en quelques millisecondes, et une vignette sur disque devrait suivre ses renommages.
 *
 * UN SEUL renderer, créé à la première vignette et gardé : en créer un par carte épuiserait les
 * contextes WebGL du navigateur.
 */
import { construireBatiment3D, materiauxBatiment3D } from './batiment-3d.js';
import { signatureDuBatiment } from './batiment-element.js';
import { cadrage3D, positionCamera3D } from './store-apercu-3d.js';

const LARGEUR = 320, HAUTEUR = 240, CHAMP = 35;
const cache = new Map();   // signature → URL de données
let rendu = null, mats = null;

/** L'URL (image PNG) de la vignette du bâtiment, ou null si le rendu 3D est indisponible. */
export function vignetteDuBatiment(batiment){
  if (!batiment) return null;
  const cle = signatureDuBatiment(batiment);
  if (cache.has(cle)) return cache.get(cle);
  const T = globalThis.THREE;
  if (!T || typeof document === 'undefined') return null;
  try {
    if (!rendu) {
      rendu = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      rendu.setSize(LARGEUR, HAUTEUR, false);
      mats = materiauxBatiment3D(T);
    }
    const scene = new T.Scene();
    scene.add(new T.AmbientLight(0xffffff, 0.65));
    const cle3D = new T.DirectionalLight(0xffffff, 1.5);
    scene.add(cle3D);
    const groupe = construireBatiment3D(T, batiment, mats);
    scene.add(groupe);
    const boite = new T.Box3().setFromObject(groupe);
    if (boite.isEmpty()) return null;
    const { centre, distance } = cadrage3D(boite.min.toArray(), boite.max.toArray(), CHAMP, LARGEUR / HAUTEUR);
    const camera = new T.PerspectiveCamera(CHAMP, LARGEUR / HAUTEUR, distance / 100, distance * 20);
    camera.position.fromArray(positionCamera3D(centre, distance * 0.9, { lacet: 0.7, tangage: 0.6 }));
    camera.lookAt(centre[0], centre[1], centre[2]);
    cle3D.position.copy(camera.position).add(new T.Vector3(distance * 0.5, distance, 0));
    rendu.render(scene, camera);
    const url = rendu.domElement.toDataURL('image/png');
    groupe.traverse(n => { if (n.geometry) n.geometry.dispose(); });
    cache.set(cle, url);
    return url;
  } catch {
    return null;
  }
}
