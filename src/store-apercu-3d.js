/**
 * @file src/store-apercu-3d.js
 * L'aperçu 3D d'un modèle du store, quand la source n'offre pas de visionneuse intégrable (#445 :
 * Poly Haven). Le .glb arrive du processus principal, EN MÉMOIRE (store:apercu) : rien n'est rangé
 * dans le dossier Modeles tant qu'on n'a pas cliqué « Télécharger ».
 *
 * Même chaîne que les Cases, pour que l'aperçu ne mente pas : GLTFLoader, la préparation des modèles
 * importés (preparerModeleImporte3D : couleurs, émission, métaux), l'éclairage par défaut d'une Case (ambiante et
 * clé de lighting-3d.js). Les gestes sont ceux de la visionneuse de Sketchfab (demandé, pour que
 * tous les aperçus du store se manient pareil) : clic gauche maintenu pour tourner autour, clic droit
 * maintenu pour déplacer, molette pour zoomer.
 *
 * Le dessin se fait À LA DEMANDE (un geste, un redimensionnement), pas en boucle : une fiche ouverte
 * ne doit pas faire tourner la carte graphique pour une image immobile. Tout est libéré à la
 * fermeture (géométries, matériaux, textures, contexte WebGL) : parcourir vingt fiches ne doit pas
 * en garder vingt.
 */
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { CLE_ACTUELLE, AMBIANTE_ACTUELLE } from './lighting-3d.js';
import { preparerModeleImporte3D } from './model-cache.js';
import { box3FromObjectSkinAware3D } from './skinned-box-3d.js';
import { maillagesHorsCorps3D, maillagesParNom3D } from './stray-meshes-3d.js';
import { deplacement3D, vitesseRotation3D } from './utils.js';

/** L'angle de vue de la caméra, en degrés. */
const CHAMP = 35;
/** L'inclinaison maximale, en radians : on ne passe ni dessus ni dessous le modèle. */
const INCLINAISON_MAX = 1.4;

/**
 * Le cadrage d'une boîte englobante : le point visé (son centre) et la distance qui la fait tenir
 * dans le champ, avec une marge. Fonction PURE.
 */
export function cadrage3D(min, max, champDeg = CHAMP, aspect = 1){
  const centre = [0, 1, 2].map(i => (min[i] + max[i]) / 2);
  const [dx, dy, dz] = [0, 1, 2].map(i => Math.max(1e-3, max[i] - min[i]));
  const rayon = Math.hypot(dx, dy, dz) / 2;
  // ⚠️ LA BOÎTE, PAS SA SPHÈRE. Cadrer sur la sphère englobante éloignait trop une silhouette haute et
  // fine (un personnage : sa sphère est presque deux fois plus large que lui), d'où une vignette où
  // il flottait, minuscule (signalé). On fait tenir la HAUTEUR dans le champ vertical, la largeur vue
  // de trois quarts dans le champ horizontal (qui dépend du format de l'image), puis on recule de la
  // demi-profondeur, avec un peu de marge.
  const v = (champDeg * Math.PI / 180) / 2;
  const h = Math.atan(Math.tan(v) * Math.max(0.1, aspect));
  const largeur = Math.hypot(dx, dz) * 0.85;
  const distance = (Math.max((dy / 2) / Math.tan(v), (largeur / 2) / Math.tan(h)) + Math.max(dx, dz) / 2) * 1.08;
  return { centre, rayon, distance };
}

/**
 * LE CADRAGE EXACT POUR UN ANGLE DE VUE DONNÉ (l'aperçu de l'Éditeur de bâtiment, signalé : des
 * parties du bâtiment sortaient de l'image). `cadrage3D` suppose une vue de trois quarts ; ici, les
 * huit coins de la boîte sont projetés dans le repère de la caméra (`angles`, ceux de
 * positionCamera3D), et l'on cherche la distance la plus courte qui les fait tous tenir, champ
 * horizontal et vertical, avec le décalage latéral qui les équilibre. Pour un axe de l'écran de
 * demi-ouverture t, un point (x, z vers la caméra) est vu si |x − s| ≤ t (D − z) : il faut
 * D ≥ (max(x + t z) − min(x − t z)) / 2t, et s au milieu. `marge` élargit d'autant. Rend
 * `{ centre, distance }`, le centre étant le point visé. PURE.
 */
export function cadrageOriente3D(min, max, { lacet, tangage }, champDeg = CHAMP, aspect = 1, marge = 1.1){
  const d = [Math.cos(tangage) * Math.sin(lacet), Math.sin(tangage), Math.cos(tangage) * Math.cos(lacet)];
  // À droite : horizontal, perpendiculaire à la visée ; en haut : complète le repère.
  const lr = Math.hypot(d[0], d[2]) || 1;
  const r = [d[2] / lr, 0, -d[0] / lr];
  const u = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]];
  const c = [0, 1, 2].map(i => (min[i] + max[i]) / 2);
  const tv = Math.tan((champDeg * Math.PI / 180) / 2) / marge;
  const th = Math.tan(Math.atan(Math.tan((champDeg * Math.PI / 180) / 2) * Math.max(0.1, aspect))) / marge;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const axes = [[r, th], [u, tv]].map(([a, t]) => ({ a, t, hautMax: -Infinity, basMin: Infinity }));
  let zMax = -Infinity;
  for (let k = 0; k < 8; k++) {
    const p = [k & 1 ? max[0] : min[0], k & 2 ? max[1] : min[1], k & 4 ? max[2] : min[2]].map((v, i) => v - c[i]);
    const z = dot(p, d);
    zMax = Math.max(zMax, z);
    for (const ax of axes) {
      const x = dot(p, ax.a);
      ax.hautMax = Math.max(ax.hautMax, x + ax.t * z);
      ax.basMin = Math.min(ax.basMin, x - ax.t * z);
    }
  }
  const distance = Math.max(zMax + 0.5, ...axes.map(ax => (ax.hautMax - ax.basMin) / (2 * ax.t)));
  const [sr, su] = axes.map(ax => (ax.hautMax + ax.basMin) / 2);
  return { centre: [0, 1, 2].map(i => c[i] + sr * r[i] + su * u[i]), distance };
}

/** Tourner autour : le glisser horizontal fait le tour, le vertical incline, borné. PURE. */
export function orbite3D({ lacet, tangage }, dx, dy){
  return {
    lacet: lacet - dx * vitesseRotation3D(),
    tangage: Math.max(-INCLINAISON_MAX, Math.min(INCLINAISON_MAX, tangage + dy * vitesseRotation3D())),
  };
}

// Déplacer au clic droit : la fonction PURE vit dans utils.js, partagée avec l'Éditeur de modèle
// (mêmes gestes partout, demandé). Réexportée pour les tests de ce module.
export { deplacement3D };

/** Zoomer : la molette rapproche ou éloigne, entre deux bornes relatives au cadrage. PURE. */
export function zoom3D(distance, deltaY, distanceCadrage){
  const d = distance * Math.exp(deltaY * 0.001);
  return Math.max(distanceCadrage * 0.25, Math.min(distanceCadrage * 4, d));
}

/** La position de la caméra, d'après la cible, la distance et les deux angles. PURE. */
export function positionCamera3D(centre, distance, { lacet, tangage }){
  return [
    centre[0] + distance * Math.cos(tangage) * Math.sin(lacet),
    centre[1] + distance * Math.sin(tangage),
    centre[2] + distance * Math.cos(tangage) * Math.cos(lacet),
  ];
}

function decoder(octets){
  return new Promise((resolve, reject) => {
    const brut = octets.buffer ? octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) : octets;
    try { new GLTFLoader().parse(brut, '', resolve, reject); } catch (e) { reject(e); }
  });
}

/**
 * Ouvre l'aperçu dans `conteneur` (un élément vide) et rend `{ fermer }`. Lève si le modèle ne se
 * décode pas : l'appelant revient alors à l'image et le dit.
 */
export async function ouvrirApercu3D(conteneur, octets, { objet = null } = {}){
  const T = globalThis.THREE;
  // #454a-4b : un objet DÉJÀ construit (un bâtiment) se montre tel quel ; sinon, des octets glTF.
  const modele = objet || preparerModeleImporte3D(await decoder(octets));

  const scene = new T.Scene();
  scene.add(new T.AmbientLight(0xffffff, AMBIANTE_ACTUELLE));
  const cle = new T.DirectionalLight(0xffffff, CLE_ACTUELLE);
  scene.add(cle);
  scene.add(modele);

  // Comme en Case : égarés masqués, pas d'élimination par le tronc de vue, et une boîte qui SUIT LE
  // SQUELETTE (la géométrie brute d'un modèle articulé décentrait ou rapetissait le cadrage).
  maillagesParNom3D(modele, maillagesHorsCorps3D(modele)).forEach(m => { m.visible = false; });
  modele.traverse(n => { if (n.isMesh) n.frustumCulled = false; });
  const boite = box3FromObjectSkinAware3D(modele);
  const { centre: centreCadrage, distance: distanceCadrage } = cadrage3D(boite.min.toArray(), boite.max.toArray(), CHAMP,
    (conteneur.clientWidth || 1) / (conteneur.clientHeight || 1));
  let centre = centreCadrage;
  let distance = distanceCadrage;
  let angles = { lacet: 0.6, tangage: 0.25 };

  const camera = new T.PerspectiveCamera(CHAMP, 1, distanceCadrage / 100, distanceCadrage * 20);
  const rendu = new T.WebGLRenderer({ antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
  rendu.domElement.className = 'store-apercu-3d';
  conteneur.appendChild(rendu.domElement);

  let demande = 0;
  const dessiner = () => {
    demande = 0;
    const l = conteneur.clientWidth || 1;
    const h = conteneur.clientHeight || 1;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
    camera.position.fromArray(positionCamera3D(centre, distance, angles));
    camera.lookAt(centre[0], centre[1], centre[2]);
    // La clé suit la caméra, de biais : le modèle reste éclairé de face quand on tourne autour.
    cle.position.copy(camera.position).add(new T.Vector3(distance * 0.5, distance, 0));
    rendu.render(scene, camera);
  };
  const redessiner = () => { if (!demande) demande = requestAnimationFrame(dessiner); };

  // Clic gauche : tourner. Clic droit : déplacer. Comme la visionneuse de Sketchfab.
  let glisser = null;
  const appui = (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    glisser = { x: e.clientX, y: e.clientY, deplacer: e.button === 2 };
    rendu.domElement.setPointerCapture(e.pointerId);
  };
  const deplacement = (e) => {
    if (!glisser) return;
    const dx = e.clientX - glisser.x, dy = e.clientY - glisser.y;
    if (glisser.deplacer) centre = deplacement3D(centre, angles, dx, dy, distance, conteneur.clientHeight || 1, CHAMP);
    else angles = orbite3D(angles, dx, dy);
    glisser = { ...glisser, x: e.clientX, y: e.clientY };
    redessiner();
  };
  // Le menu contextuel du navigateur volerait le glisser droit.
  const menu = (e) => e.preventDefault();
  const relache = () => { glisser = null; };
  const molette = (e) => { e.preventDefault(); distance = zoom3D(distance, e.deltaY, distanceCadrage); redessiner(); };
  const el = rendu.domElement;
  el.addEventListener('pointerdown', appui);
  el.addEventListener('pointermove', deplacement);
  el.addEventListener('pointerup', relache);
  el.addEventListener('pointercancel', relache);
  el.addEventListener('wheel', molette, { passive: false });
  el.addEventListener('contextmenu', menu);
  const Observateur = globalThis.ResizeObserver;
  const observateur = Observateur ? new Observateur(redessiner) : null;
  if (observateur) observateur.observe(conteneur);
  dessiner();

  return {
    fermer(){
      if (demande) cancelAnimationFrame(demande);
      if (observateur) observateur.disconnect();
      modele.traverse(n => {
        if (n.geometry) n.geometry.dispose();
        const mats = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
        mats.forEach(m => {
          Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); });
          m.dispose();
        });
      });
      rendu.dispose();
      if (rendu.forceContextLoss) rendu.forceContextLoss();
      el.remove();
    },
  };
}
