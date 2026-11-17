# L'affichage des modèles importés

*[English version](../en/imported-models-display.md)*

## Rôle

Un modèle importé (`.glb`, ou `.gltf` empaqueté à l'import) doit s'afficher dans une Case comme dans
sa vignette et dans l'aperçu du store. Tout passe par **un seul chemin**, `preparerModeleImporte3D`
(`src/model-cache.js`), une fois au décodage ; l'aperçu 3D du store l'emprunte aussi.

## Ce que fait la préparation

1. **Couleurs** : GLTFLoader décode les textures de couleur en linéaire et lit les couleurs de
   matériau comme linéaires, alors que le rendu ne ré-encode pas en sRGB. Les textures sont lues
   telles quelles, les couleurs converties vers l'écran.
2. **Couleurs de sommets** : même conversion, une fois par géométrie partagée.
3. **Métaux** : dans three, l'ambiante n'éclaire que la part diffuse, qu'un métal n'a pas. Une ligne
   de shader fait refléter au métal l'ambiante de la Case, comme un environnement uniforme : il suit
   l'éclairage de chaque Case, nuit comprise.
4. **Intensité d'émission** : `KHR_materials_emissive_strength`, ignorée par three 0.128, est lue dans
   le JSON et appliquée.
5. **Lumières et caméras du fichier** : retirées. Posé dans une Case, un modèle éclairerait sinon
   toute la Case, autant de fois qu'il a d'exemplaires.
6. **Découpes** (`MASK` du glTF, feuilles) : elles écrivent un alpha de 1 là où elles sont dessinées
   (`opaqueCutouts`, `src/opaque-cutout.js`, partagé avec les arbres générés et les cultures). L'image 3D
   d'une Case est posée sur la page : des feuilles qui écrivaient l'alpha de leurs mipmaps (0,45 à 0,8 de
   loin) laissaient passer la page blanche, et les couronnes paraissaient presque blanches. Les plantes de
   la banque de modèles (arbres, conifères, palmiers : `isBankPlantFile`) voient aussi leurs matériaux
   texturés **en mélange** dessinés en découpe (seuil 0,5) ; le verre et l'eau des autres modèles restent en
   mélange.

## À l'import

- **Un `.gltf`** : ses voisins (`.bin`, textures) sont lus et empaquetés en un vrai `.glb`
  (`gltf-glb.js`). Un voisin hors du dossier du `.gltf` est refusé.
- **Une compression sans décodeur** (Draco, Meshopt, KTX2) exigée par le fichier : refusée, avec son
  nom.

## Le cadrage de l'aperçu

- `boiteDeCadrageModele3D` n'unit que les os qui **déforment** quelque chose (poids non nul, ou
  maillage rigide accroché) : les os d'effets ou d'attache d'un modèle de jeu, placés loin du corps,
  n'étirent pas la boîte. L'orbite de l'Éditeur de modèle tourne autour du centre de cette boîte.
- En filet, l'aperçu d'une fiche est rendu une fois au cadrage de base ; le rectangle de ses pixels
  opaques est relevé, et la caméra est recentrée sur lui et rapprochée, en trois passes au plus
  (`src/cadrage-apercu.js` pour le calcul, pur ; `cadrageAjusteModele3D` dans `scene3d.js`). C'est la
  **distance** au point visé qui est réglée, jamais un dézoom. Le résultat est mémorisé par modèle,
  pose, orientation et format du rendu.

## Limites

- **`KHR_materials_specular` et `KHR_materials_ior`** sont ignorés par three 0.128 : le reflet reste
  celui par défaut (4 %).
- **Les animations** ne sont pas jouées : le modèle est posé dans sa pose de repos, puis par les
  curseurs du squelette.
