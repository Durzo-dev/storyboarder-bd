# Un modèle appris pour lire les plans : étude (#456)

*[English version](../en/plan-modele.md)*

> Demandée par Valentin le 8 novembre 2026, après la notation de nos règles sur CubiCasa5K : les
> règles écrites à la main plafonnaient (portes et fenêtres autour de 20 %). Question posée :
> faut-il un modèle appris (apprentissage automatique), à quel prix, sous quelle licence ? Contrainte
> de Valentin : Storyboarder n'est pas fait pour être vendu, mais le modèle doit pouvoir être
> **débranché et retiré facilement** si cela changeait.

## En bref

- **Pas besoin d'entraîner nous-mêmes.** Un modèle déjà entraîné existe et convient. Il s'agit de
  *Floorplan Studio* : un SegFormer-B0 de 3,7 millions de paramètres, entraîné sur les **vraies
  images** de CubiCasa5K, dans un fichier ONNX de 15 Mo prévu pour tourner dans un navigateur.
- **Il fait beaucoup mieux que nos règles.** Mesuré sur 60 plans de la partie « test » officielle de
  CubiCasa5K, que le modèle n'a jamais vus :

| Mesure | Nos règles | Le modèle |
|---|---|---|
| Murs, F1 (précision, rappel) | 0,617 (0,70, 0,64) | **0,805** (0,90, 0,73) |
| Portes retrouvées / justes | 23,5 % / 23,5 % | **80 % / 73 %** |
| Fenêtres retrouvées / justes | 19 % / 16 % | **73 % / 77 %** |
| Temps de calcul, processeur, un fil | environ 1 s | **0,2 s** |

- **Il tient sur nos plans** : maison, bureaux (mur courbe et façade en biais compris), immeuble,
  annonces en couleur, photo redressée. Sur les châteaux anciens, il est passable.
- **Licence** : le code du projet est sous MIT. Les **poids** restent sous les restrictions **non
  commerciales** de CubiCasa5K (CC BY-NC 4.0) et du modèle de départ de NVIDIA (SegFormer). C'est
  compatible avec un Storyboarder non vendu, à condition de pouvoir tout retirer : c'est
  l'architecture proposée plus bas.
- **Coût** dans l'application : environ 15 Mo pour le modèle, plus environ 10 Mo pour le moteur
  d'exécution (ONNX Runtime Web, MIT).

## Ce qui a été examiné

**Les modèles existants**

| Projet | Ce que c'est | Pourquoi oui ou non |
|---|---|---|
| [Floorplan Studio](https://github.com/ajayfjfj/floorplan-studio) | SegFormer-B0, 5 classes (fond, pièce, mur, porte, fenêtre), ONNX, 15 Mo | **Retenu.** Entraîné sur les images réelles, évalué sur 400 plans jamais vus, déjà prévu pour le navigateur. |
| [floorplan-to-3d](https://huggingface.co/Yytsi/floorplan-to-3d-walls) | U-Net ResNet-34, 98 Mo, MIT | **Écarté.** Entraîné sur les annotations RENDUES en image (les murs y sont déjà tracés), et non sur les images : son score de 0,98 ne dit rien des vrais plans. |
| CubiCasa5K, DeepFloorplan, Raster-to-Vector | Modèles de recherche (2017-2019) | Plus lourds, PyTorch ou TensorFlow, sans export prêt pour le navigateur. |

**Les jeux de données**, si l'on devait un jour entraîner le nôtre. Aucun n'est clairement
utilisable commercialement :
- CubiCasa5K : CC BY-NC 4.0 ;
- FloorPlanCAD : CC BY-NC 4.0 ;
- ResPlan : licence contradictoire selon la source ;
- RPLAN, ZInD : non vérifiés.

Un modèle « commercial » demanderait donc d'annoter nos propres plans.

**L'entraînement chez nous** n'est pas réaliste. Mon environnement n'a ni carte graphique ni
PyTorch, et il est hors réseau. Ce n'est pas nécessaire tant que le modèle existant suffit.

## Les mesures, et leurs limites

- **Banc** : `plans-test/banc/modele_noter.py`, avec la même notation que nos règles
  (`cubicasa_noter.py`). Les plans sont tirés de la partie « test » officielle, pour ne pas évaluer
  le modèle sur ce qu'il a appris.
- **Préparation de l'image** : reproduite à l'identique de la page d'origine (`app.js`,
  `inference-worker.js`) :
  - l'image est réduite dans un carré blanc de 512 px ;
  - elle est normalisée (moyenne et écart type ImageNet) ;
  - la sortie fait 128 × 128 sur 5 classes, puis est agrandie à la taille de l'image.
- **Limite connue** : CubiCasa5K est surtout fait de plans finlandais. Les plans à la main, les
  scans très anciens et les styles très différents sont hors de son domaine. L'auteur le dit, et
  nos châteaux le confirment.
- **Pas encore mesuré** : la chaîne complète « masques du modèle → nos murs vectorisés → pièces de
  l'éditeur ». Ce sera la première étape de l'intégration.

## L'architecture proposée : un modèle débranchable

Le principe : **le modèle est un greffon**. Sans lui, l'import fonctionne avec nos règles, comme
aujourd'hui. Le retirer, c'est supprimer un dossier et une dépendance.

1. **Un seul module le connaît : `src/plan-modele.js`.** Il charge le moteur et le modèle, et
   rend des masques (murs, portes, fenêtres, pièces), ou `null` s'ils sont absents. Il est chargé
   par un **import dynamique** : son absence ne casse rien.
2. **Le modèle vit à part** : `assets/modeles/plans/`, avec le fichier ONNX, `NVIDIA_LICENSE.txt` et
   une notice CubiCasa5K. Ce dossier figure dans la liste des fichiers embarqués par
   electron-builder.
3. **Le moteur** : ONNX Runtime Web (MIT), exécuté dans un *Web Worker* pour ne pas figer
   l'interface. Il ne demande ni binaire natif ni carte graphique.
4. **La chaîne** :
   - si le modèle est là, son masque de murs remplace celui de nos règles ;
   - ses portes et ses fenêtres deviennent les ouvertures ;
   - nos étapes suivantes restent : vectorisation, raccords, échelle, redressement des photos ;
   - sinon, ce sont les règles.
5. **Un test garde la porte de sortie** : aucun autre fichier n'importe `onnxruntime-web` ni ne
   lit `assets/modeles/`.
6. **Pour débrancher** :
   - supprimer `assets/modeles/plans/` ;
   - retirer la dépendance ;
   - supprimer `src/plan-modele.js`.

   L'application retombe d'elle-même sur les règles. La marche à suivre sera écrite dans la
   documentation, avec le rappel des licences.

## Ce qui reste à décider (Valentin)

- Intégrer le modèle selon cette architecture ? Le premier pas serait de **mesurer la chaîne
  complète** sur le banc avant de toucher à l'écran d'import.
- Garder nos règles en secours (modèle absent), ou les réserver aux plans anciens, où le modèle est
  plus faible ?

## Sources

- Floorplan Studio : [dépôt](https://github.com/ajayfjfj/floorplan-studio), [notices de tiers](https://raw.githubusercontent.com/ajayfjfj/floorplan-studio/main/THIRD_PARTY_NOTICES.md).
- SegFormer-B0 de NVIDIA : [fiche du modèle](https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512), [licence](https://github.com/NVlabs/SegFormer/blob/master/LICENSE).
- CubiCasa5K : [licence CC BY-NC 4.0](https://github.com/CubiCasa/CubiCasa5k/blob/master/LICENSE), [archive Zenodo](https://zenodo.org/records/2613548).
- floorplan-to-3d : [fiche du modèle](https://huggingface.co/Yytsi/floorplan-to-3d-walls).
- FloorPlanCAD : [site](https://floorplancad.github.io/) ; ResPlan : [Kaggle](https://www.kaggle.com/datasets/resplan/resplan).
- ONNX Runtime Web : [npm](https://npmjs.com/package/onnxruntime-web).
