# Lire un plan d'architecte : sources, conventions par époque, et ce qu'on en tire pour #456

*[English version](../en/plan-sources.md)*

> **L'import de plan a été abandonné le 8 novembre 2026**, et retiré du code. Ce document reste une
> référence pour y revenir : voir [plan-modele.md](plan-modele.md), « Bilan, et comment y revenir ».

> Tâche #456, « créer un bâtiment à partir d'une photo de plan d'architecte ». Avant d'écrire
> l'outil, Durzo a demandé, le 4 novembre 2026, de chercher des sources de plans, « des sources
> très anciennes (plusieurs siècles pour certains manoirs ou châteaux) à des sources
> contemporaines », et les normes de chaque période quand il y en a. Ce document en est le
> résultat ; il complète la section « De la photo de plan au bâtiment » de
> [building-research.md](building-research.md).

## Méthode, et ce qu'elle vaut

Recherche documentaire du 4 novembre 2026. Trois sources ont été lues **dans le texte** :

- le traité d'Henri Gautier (1697), dans sa numérisation d'archive.org ;
- l'aperçu public d'ISO 7519:1991 ;
- les *HABS Guidelines* de 2008 (domaine public).

Le reste vient de notices de bibliothèques, de résumés d'articles, d'essais d'historiens (Basile
Baudez, Émilie d'Orgeix) et de pages de projets. Les normes AFNOR, DIN et ISO complètes sont
payantes et n'ont pas été lues. **Aucun plan n'a encore été passé dans un détecteur** : ce qui suit
dit ce que les plans montrent, pas encore ce qu'un algorithme en tire. Ce qui n'a pu être recoupé
est marqué « (à vérifier) ». Les sources sont en fin de document.

## L'essentiel en dix lignes

1. **Le mur coupé est toujours ce qu'il y a de plus lourd sur un plan**, à toutes les époques.
   Selon le cas, c'est un trait épais, un remplissage noir, un lavis carmin ou rose, un gris ou des
   hachures. Le détecteur doit donc chercher la **masse** et l'**épaisseur**, pas une couleur.
2. **La coupe se fait à hauteur d'appui de fenêtre** depuis le XVIe siècle environ (HABS : 4 pieds,
   soit 1,22 m). Une fenêtre apparaît ainsi comme une interruption du mur, avec des traits fins.
3. **Les portes des plans anciens n'ont souvent pas de symbole** : une baie est un vide dans le mur.
   L'arc de 90° est une convention moderne, et ISO 7519 admet aussi un vantail à 30° sans arc.
4. **L'échelle s'écrit de six façons** : une échelle graphique (en toises, pieds ou mètres), une
   échelle chiffrée (« 1/100 », « 0,01 p. m. », « 1/4" = 1'-0" »), des cotes, des surfaces de pièces
   (m²), des dimensions inscrites dans les pièces (Palladio), ou rien du tout.
5. **Sur une photo, une échelle chiffrée seule ne sert à rien**, car on ignore la taille du papier
   photographié. Seule une longueur connue mesurée sur l'image donne l'échelle : la barre graphique,
   une cote, ou le « ce mur mesure 4 m » de l'utilisateur.
6. **Les unités anciennes sont nécessaires.** Une toise vaut 6 pieds du roi, soit 1,949 m ; un pied
   du roi vaut 32,48 cm. Un plan de château du XVIIe siècle est gradué en toises.
7. **Couleurs anciennes.** Chez les ingénieurs militaires, la maçonnerie est en carmin et ce qui est
   en projet en jaune (gomme-gutte). L'architecture civile met du noir dans l'épaisseur des murs
   (Gautier, 1697).
8. **Les ombres portées** (à 45°, venant du haut à gauche) et le trait renforcé côté ombre
   épaississent un seul côté des murs. Il ne faut pas les prendre pour du mur.
9. **Les plans anciens sont imprécis**, avec des traits pas tout à fait droits et des symboles non
   normalisés (constat du projet VERSPERA sur les plans de Versailles). Il faut une tolérance et un
   alignement sur les angles dominants.
10. **La recherche donne la même conclusion que nos planches importées.** Les méthodes se
    généralisent mal d'un style de plan à l'autre (revue de Pizarro et al., 2022). D'où une
    détection modeste, l'échelle donnée par l'utilisateur, et une **correction directe**.

## Les périodes

### Antiquité et Moyen Âge : l'empreinte au sol

**Ce qui existe.**
- **Vitruve** nomme le plan *ichnographia*, l'empreinte du bâtiment sur le sol.
- **Le plan de Saint-Gall** (vers 820-830) est la plus ancienne représentation conservée d'un
  ensemble bâti médiéval. Il occupe cinq feuilles de parchemin, environ 112 × 77,5 cm, et montre une
  quarantaine de bâtiments. Il n'a jamais été construit.
- **L'album de Villard de Honnecourt** (vers 1220-1235) contient des plans d'églises, tracés par
  construction géométrique plutôt qu'à une échelle déclarée.

**Les conventions.**
- Il n'y a pas d'échelle graphique.
- Le plan est coupé au niveau du sol : les fenêtres n'apparaissent pas.
- Les murs sont en double trait ou en masse.
- Les cotes sont rares. Les proportions viennent de la géométrie, carrés et rapports.

**Pour l'outil.** Ces plans sont surtout utiles comme tests de robustesse : parchemin taché, traits
irréguliers, aucune échelle. L'échelle y sera **toujours** demandée.

### Renaissance (XVe-XVIe siècles) : la coupe monte à la fenêtre, la gravure fixe le noir et blanc

**La coupe.** Les premiers plans de la Renaissance étaient coupés au niveau du sol. On s'est vite
aperçu que les fenêtres n'y apparaissaient pas. Après le XVe siècle, les dessinateurs européens ont
largement adopté une coupe à hauteur des appuis de fenêtre (Baudez, *Shadowed plans*, 2026).

**Le noir et blanc.** Les dessins de la Renaissance italienne sont surtout monochromes. Leurs
conventions se sont formées sous la pression de la gravure : un trait d'estampe ne se colore pas
(Baudez, conférence de 2017).

**Palladio, *I quattro libri dell'architettura* (1570).**
- Ce sont des plans gravés sur bois, avec **les dimensions écrites dans les pièces**, en pieds
  vicentins (environ 14 pouces anglais, soit à peu près 0,357 m ; à vérifier). On y lit par exemple
  « 18 » ou « 4 ½ ».
- Les chiffres servent aussi à afficher des proportions.
- Une reconstruction récente note que ces dimensions semblent inclure la moitié de l'épaisseur des
  murs.
- Pour l'outil, c'est un cas où l'échelle vient d'une cote **intérieure** à la pièce.

**Androuet du Cerceau, *Les plus excellents bastiments de France* (1576 et 1579).** Deux volumes
d'environ 60 planches chacun : Louvre, Vincennes, Chambord, Blois, Anet… Ce sont des plans gravés
de châteaux, avec des murs pleins (à vérifier sur les planches). Les exemplaires numérisés sont à
la Morgan Library, au Metropolitan Museum, à la Royal Academy et au CESR de Tours.

### XVIIe-XVIIIe siècles en France : toises, lavis et codes de couleur

C'est la période des châteaux et des manoirs que Durzo vise en premier. Les conventions s'y
fixent par les **ingénieurs militaires**, puis passent aux architectes.

**Henri Gautier, *L'art de dessiner proprement les plans…* (1697)** (lu dans le texte) :
- **Architecture civile** : « tirez vos lignes d'encre de la Chine, remplissant les épaisseurs de
  noir ». C'est déjà le poché noir.
- **Plan militaire** : les murailles se tirent « de carmin » et se lavent de même. Pour une place
  forte, la ligne intérieure est la plus forte, l'entre-deux est lavé d'une teinte claire de carmin
  qui se perd vers l'extérieur.
- **En projet** : une couche claire de **gomme-gutte** (jaune) sur le tout.
- **Gazon** : lignes à l'encre de Chine, lavis à l'encre de Chine claire.
- **Bois** : bistre mêlé d'un peu de vermillon.
- **Estampe** : en gravure, les lignes sont noires, « n'étant pas possible en estampe de les faire
  rouges ».

**Nicolas Buchotte, *Les règles du dessein et du lavis* (1721-1722, réédité en 1754).** Le
« best-seller » des ingénieurs, diffusé dans toute l'Europe jusqu'au XIXe siècle. Il a contribué à
normaliser les codes graphiques des ingénieurs et des architectes. Son contenu n'a pas été lu ici.

**Le transfert vers les architectes.** À la fin du règne de Louis XIV, les architectes français
reprennent les codes de couleur des ingénieurs, surtout pour informer. Au milieu du XVIIIe siècle,
une « révolution de la couleur » les étend pour séduire les jurys et les clients (Baudez,
*Inessential Colors*, 2021). À la Révolution, les murs coupés **lavés en rose** sont une convention
« désormais établie » (Baudez, *Shadowed plans*).

**Les ombres.**
- Les ombres portées sont à 45°, venant **du coin supérieur gauche**.
- Dans les plans, elles apparaissent en 1758 (Cherpitel) et se répandent dans la seconde moitié du
  siècle.
- Delagardette (*Nouvelles règles pour la pratique du dessin et du lavis*, 1803) les réserve aux
  marches, socles et bassins, « jamais » aux murs. Il recommande à la place des « coups de force » :
  repasser les lignes du côté de l'ombre deux ou trois fois plus épais. C'est l'ancêtre du poché.

**Les unités.**

| Unité | Valeur | Remarque |
|---|---|---|
| toise (du Châtelet) | 6 pieds, soit 1,949 m | 54 000 / 27 706 m, environ 1,949036 m |
| pied du roi | 12 pouces, soit 0,3248 m | |
| pouce | 12 lignes, soit 2,707 cm | |
| ligne | 2,256 mm | |

Les échelles graphiques s'écrivent « échelle de 10 toises », « de 15 toises », « de 20 toises ». Par
exemple, deux dessins de Versailles de 1688 (Hardouin-Mansart, à la BnF) sont à « une échelle de 15
toises » et « une échelle de 20 toises ».

**Les fonds numérisés.**
- **Fonds Robert de Cotte** (BnF) : plans et dessins de 430 édifices, entièrement numérisé sur
  Gallica. On y trouve par exemple le *château de Clagny, rez-de-chaussée*.
- **Archives nationales, sous-série O1** (Bâtiments du roi) : environ 7 500 dessins.
- **Projet VERSPERA** (Centre de recherche du château de Versailles, BnF, Archives nationales,
  laboratoire ETIS) : près de 9 000 plans numérisés entre 2013 et 2023, puis modélisés en 3D. Leur
  constat rejoint exactement #456 : **l'absence de normalisation des symboles et l'imprécision des
  traits** rendent le traitement automatique difficile.
- **Jean Marot, *L'Architecture française*** : plans gravés (Tuileries, Louvre…), visibles sur
  Wikimedia Commons d'après Gallica.
- **Plan du rez-de-chaussée de Versailles** (1693-1695), BnF, ark `btv1b531283341`.

### XIXe siècle : le mètre, le poché, la grille

**Le mètre.** Le système métrique est rendu obligatoire en France au 1er janvier 1840 (loi du 4
juillet 1837). Les plans portent alors des échelles en mètres. Une formulation courante est « 0,01
pour mètre », c'est-à-dire 1/100, et « 0,005 p. m. » pour 1/200.

**Durand, *Précis des leçons d'architecture* (1802-1805).**
- Le plan devient une **section horizontale** abstraite.
- Il se compose sur une **grille**, avec des murs sur des axes.
- Avant Durand, le plan était lu comme l'empreinte du poids du bâtiment. Après lui, comme un jeu de
  conventions (Emmons, cité par Baudez).

**Les Beaux-Arts.**
- Le **poché** est l'épaisseur des murs coupés, noircie à l'encre de Chine ou lavée.
- Il sert pour les dessins de **présentation**, pas pour les dessins d'exécution.
- Le terme n'a jamais été défini formellement par la pédagogie des Beaux-Arts (Guadet).

**Viollet-le-Duc.** Son *Dictionnaire raisonné de l'architecture française* (1854-1868) contient de
nombreux plans de châteaux médiévaux, gravés avec des murs pleins et une échelle en mètres (à
vérifier). Ils sont dans le domaine public et sur Wikimedia Commons. Ce sont de bons cas pour des
murs **très épais** (plus d'un mètre) avec des embrasures ébrasées, en biais dans l'épaisseur.

**Le cadastre.** Le cadastre napoléonien (loi du 15 septembre 1807) n'est pas un plan
d'architecte, mais un utilisateur peut en photographier un.
- Ses échelles vont de 1/5 000 à 1/500. Le premier cadastre de Paris est au 1/2 000 par quartier.
- Il montre seulement l'emprise des bâtiments (hachures ou croisillons, aplat jaune dans le cadastre
  vectoriel).
- Il n'y a ni murs intérieurs ni ouvertures. L'outil peut au mieux en tirer un contour.

### XXe siècle : les normes

**Manuels de référence.**
- *Architectural Graphic Standards* (Ramsey et Sleeper, 1932) aux États-Unis.
- *Bauentwurfslehre* (Neufert, 1936) en Europe : 39 éditions allemandes, 17 langues.
- Les deux fixent un vocabulaire de symboles que les plans d'agence reprennent ensuite.

**Normes nationales.**
- **France** : NF P 02-001 (1985), principes de représentation des dessins d'architecture et de
  bâtiment. NF P 02-005 (1986), cotation, aujourd'hui annulée.
- **Allemagne** : DIN 1356, *Bauzeichnungen*.
- Non lues ici, toutes payantes.

**ISO 128 (lignes).** La série des épaisseurs suit le rapport √2 : 0,13, 0,18, 0,25, 0,35, 0,5,
0,7, 1, 1,4 et 2 mm. Les traits fin, fort et très fort sont dans le rapport 1:2:4.

**ISO 7519:1991**, dessins de construction (aperçu public, lu dans le texte) :
- **Épaisseurs relatives** : trait fin = 1, fort = 2, très fort = 4. Un même dessin utilise deux ou
  trois épaisseurs.
- **Parties coupées** (les murs) : en trait fort ou très fort. Les parties vues sont en trait
  plus fin, dans un rapport 1:2. Hachures ou grisé sont admis pour distinguer les parties coupées.
- **Motifs de matériaux** (marbre, parquet) : normalement **absents** du plan.
- **Portes et fenêtres** : en trait fin ou fort. **L'ouverture d'une porte doit être montrée.** Une
  porte battante se dessine **vantail à 30° sans arc**, ou **à 90° avec arc**. Au 1:50 et plus
  grand, on montre le type, la position et le seuil. Les portes coulissantes ont leur propre
  symbole (vantail le long du mur, avec ou sans logement).
- **Escaliers** : trait fin, flèche sur l'axe, avec un **cercle à la marche du bas** et une **pointe
  ouverte en haut**. La coupe de la volée est un trait oblique en zigzag.
- **Rampes et sols en pente** : flèche dans le sens de la descente, avec la pente.

**HABS**, *Historic American Buildings Survey*, actif depuis 1933. Ses consignes de 2008 sont dans
le domaine public (lues dans le texte), et les dessins sont à la Library of Congress.
- **Coupe** : les plans sont relevés à **environ 4 pieds** (1,22 m) au-dessus du sol. La hauteur de
  coupe peut faire des décrochements pour attraper une fenêtre ou une cheminée.
- **Murs** : la maçonnerie, le béton et l'adobe coupés sont **pochés** avec le symbole du matériau.
  La rotation du motif distingue les **époques de construction**. Les murs à ossature bois et en
  rondins sont **sans poché**.
- **Ouvertures** : les portes entre pièces s'ouvrent à **90°** ; les portes de placard et les
  fenêtres à battants à **45°**.
- **Escaliers** : **une seule** ligne de coupe, une flèche « UP » ou « DOWN ».
- **Lignes** :
  - ce qui est caché ou disparu est en **tirets** ;
  - ce qui est au-dessus du plan de coupe est en **trait mixte** ;
  - épaisseurs au 1/4" = 1'-0" : 0,1 mm pour les joints, 0,2 à 0,4 mm pour les arêtes, **0,5 mm
    pour les parties coupées**.
- **Échelle** : en général **1/4" = 1'-0"** (1:48). **Deux échelles graphiques** sont obligatoires,
  impériale et métrique. Une flèche du nord figure sur chaque plan.
- **Mise en page** : l'**entrée principale est en bas de la feuille**. Le nom de chaque pièce est
  écrit au centre. Les cotes sont **en dehors** du dessin, sans chaînes de cotes en travers. Encre
  noire seulement, pas d'aplats gris.

**Les couleurs de chantier.** En France, sur les plans de travaux, l'usage est « à démolir en
jaune, à construire en rouge ». C'est un usage courant, non normatif (à vérifier). C'est un lointain
écho du jaune de projet de Gautier.

### Aujourd'hui : CAO, permis de construire, annonces immobilières

**Les sources de plans.**
- **CAO** (DWG, DXF, PDF vectoriel) : les murs y sont souvent des **hachures** ou des **aplats** sur
  un calque. Un PDF vectoriel contient déjà les segments. Lire ce format serait plus fiable qu'une
  photo, mais c'est un autre chantier.
- **Plans d'agence et de permis** : en général au 1:100 ou au 1:50. Ils sont cotés et portent la
  surface de chaque pièce (m²).
- **Plans d'annonces immobilières** : les plus nombreux en ligne, et les plus variés. CubiCasa5K
  distingue trois styles (chiffres d'un résumé secondaire, à vérifier) :
  - architectural soigné : 3 732 plans ;
  - CAO noir et blanc : 992 plans ;
  - coloré ou « dessiné à la main » : 276 plans.

**Les symboles courants**, d'après la pratique et les jeux de données, non normés :
- **Fenêtre** : deux ou trois traits fins parallèles dans l'épaisseur du mur.
- **Porte battante** : arc d'un quart de cercle, avec le vantail ouvert.
- **Porte coulissante** : trait le long du mur.
- **Porte double** : deux arcs.
- **Escalier** : marches en traits fins, flèche.

**Les dimensions types en France.** Elles servent à **deviner** une échelle, ou à vérifier celle
qu'on a.

| Élément | Dimension type |
|---|---|
| Vantail de porte intérieure | 63, 73, 83 ou 93 cm (passage utile environ 3 cm de moins), hauteur 204 cm |
| Porte à deux vantaux | 126 à 186 cm |
| Cloison | 5 à 7 cm (huisseries de 68 à 88 mm) |
| Mur porteur contemporain | environ 20 cm, plus le doublage |
| Mur de château ou de manoir ancien | souvent 0,6 à plus de 2 m (ordre de grandeur, à vérifier par plan) |

## Ce que dit la recherche

**Le panorama.** Pizarro et al., *Automatic floor plan analysis and recognition* (*Automation in
Construction*, 2022), passe en revue les méthodes à règles puis à apprentissage, de 1995 à 2021.
Leur constat : la plupart supposent **un style de plan** et se généralisent mal. Les comparaisons
sont difficiles, faute de métrique commune et de jeux de données publics.

**Les méthodes.**
- **Raster-to-Vector** (Liu et al., ICCV 2017) : un réseau trouve les **jonctions** (coins de mur,
  extrémités de porte). Une programmation en nombres entiers les assemble ensuite en murs, portes et
  icônes. Ses données (plus de 100 000 plans) ne sont pas publiques ; un sous-ensemble de 815 plans
  japonais circule.
- **DeepFloorplan** (Zeng et al., ICCV 2019) : un réseau à deux tâches. Il prédit les pixels de
  **limite** (mur, porte, fenêtre) et les **types de pièce**, avec une attention guidée par les
  limites. Le code est sur GitHub.
- **CubiCasa5K** (Kalervo et al., 2019) : 5 000 plans finlandais annotés en polygones SVG, plus de 80
  catégories. Les portes (environ 20 % des icônes) et les fenêtres (environ 18 %) dominent. Il
  reprend le réseau de Raster-to-Vector. Données sur Zenodo, licence à lire avant tout usage.

**Le passage à l'échelle réelle, dans les produits.**
- **RoomSketcher et Homestyler** : une cote donnée par l'utilisateur.
- **MONA** : ne lit que les cotes imprimées, et refuse d'estimer à partir des pixels.
- **Un brevet** (US 10395147) : l'échelle vient de la surface lue par OCR, divisée par la surface
  de la pièce en pixels.
- **Un autre brevet** : vérifie la cohérence des longueurs de murs, pour détecter un plan « pas à
  l'échelle ».
- **ThirdEye** annonce ±1,5 %, sans méthode publiée.

## Ce qui reste vrai d'une époque à l'autre, et ce qu'on en tire

| Constat | Époques | Conséquence pour l'outil |
|---|---|---|
| Le mur coupé est l'élément le plus lourd : trait épais, plein noir, carmin ou rose, hachures | toutes | Chercher la **masse d'encre épaisse**, avec une transformée de distance (épaisseur locale), et non une couleur fixe |
| Le fond n'est pas blanc : papier jauni, parchemin, photo mal éclairée | anciennes, photos | Estimer la couleur du papier (la plus fréquente), et mesurer l'« encre » comme un écart à cette couleur ; seuil adaptatif local |
| Murs lavés de couleur (carmin, rose, gris) sans trait noir | XVIIe-XIXe | Détecter **automatiquement** une teinte de murs : une couleur saturée (carmin, rose) qui forme des masses épaisses compte comme de l'encre. La pipette n'est qu'un dernier recours |
| Hachures (traits fins serrés) au lieu d'un plein | XIXe-XXe, CAO | Une fermeture morphologique pour faire une masse des hachures avant de mesurer l'épaisseur |
| Ombre portée en bas à droite des murs, ou trait renforcé côté ombre | XVIIIe-XIXe, Beaux-Arts | Ignorer une bande plus claire collée au mur ; ne pas prendre l'épaisseur d'un seul bord pour celle du mur |
| Fenêtre = interruption du mur avec des traits fins ; baie = vide | toutes depuis le XVe | Une **ouverture** est un trou entre deux bouts de mur alignés ; son contenu décide de sa nature |
| Porte = arc de 90°, vantail à 30° sans arc, à 45°, ou rien | moderne / ISO / HABS / ancien | Un **arc** près du trou fait une porte (et donne son sens d'ouverture) ; sans rien, c'est une **baie** |
| Murs épais avec embrasures en biais | châteaux, manoirs | Ne pas exiger des ouvertures à bords parallèles |
| Traits pas droits, symboles non normalisés | anciens (VERSPERA) | Une tolérance ; aligner sur les **angles dominants** (histogramme d'orientation) |
| Texte, cotes, mobilier, cartouche, légende, échelle, nord, arbres | toutes | Ne garder que la **plus grande masse de murs connexe** ; le reste est ignoré, ou proposé à l'utilisateur |
| Plusieurs époques ou états sur un plan (existant noir, projet jaune) | XVIIe, HABS, plans de travaux | Plus tard : choisir la teinte retenue, en dernier recours |
| Photo prise en biais | photos | Redresser par les **quatre coins**, comme les planches importées |

**L'échelle, par ordre de fiabilité.**

1. **L'utilisateur** désigne deux points et donne une longueur. C'est le seul moyen sûr sur une
   photo. On le demande toujours, et on pré-remplit avec ce qu'on a deviné.
2. **L'échelle graphique** du plan, si l'utilisateur la désigne : ce sont les mêmes deux points.
3. **Une cote** imprimée : même geste.
4. **Une estimation**, proposée mais jamais imposée :
   - une **largeur de porte** médiane d'environ 0,83 m, pour un plan contemporain ;
   - un **mur intérieur** d'environ 7 à 10 cm, et un mur extérieur d'environ 30 cm ;
   - pour un plan ancien, rien de fiable : il faut une saisie.
5. **La lecture automatique des chiffres (OCR)** n'est pas proposée en première version. Elle est
   lourde, et les chiffres manuscrits ou gravés sont mal lus.

**Les unités à proposer dans la saisie :** mètre, centimètre, toise, pied du roi, pouce (du roi),
pied anglais (0,3048 m) et pouce anglais (2,54 cm). Le pied vicentin et les autres pieds régionaux
peuvent attendre d'être demandés.

## Le déroulé proposé (à valider avant d'écrire le code)

C'est le même schéma que les planches importées
([planche-importee.md](planche-importee.md)) : une **détection approximative**, puis une
**correction directe**, avec les mêmes gestes. Un plan correspond à **un niveau** (#454).

1. **Importer** une image (tous les formats d'image courants) ou un **PDF**, dont la page est
   rendue en image. **Redresser** par les quatre coins si la photo est de biais.
2. **Normaliser** : estimer la couleur du papier et calculer l'« encre », y compris une teinte de
   murs colorée trouvée **automatiquement**. Aucune action n'est demandée à l'utilisateur à cette
   étape.
3. **Trouver les murs** :
   - seuillage adaptatif ;
   - fermeture des hachures ;
   - carte d'épaisseur ;
   - un mur est un trait dont l'épaisseur dépasse nettement celle des traits fins, qui donne la
     référence ;
   - on garde la plus grande masse connexe.
4. **Vectoriser** : squelette, segments alignés sur les angles dominants, et une épaisseur par
   segment.
5. **Trouver les ouvertures** :
   - repérer les trous entre deux bouts de mur alignés ;
   - classer chaque trou : arc proche → porte (avec son côté) ; traits fins parallèles → fenêtre ;
     rien → baie.
6. **Demander l'échelle** : deux points et une longueur, une unité au choix, et l'estimation
   pré-remplie.
7. **Corriger** sur le plan : déplacer ou ajouter un mur, changer le type d'une ouverture, ajuster
   une épaisseur.
8. **Construire** : murs, ouvertures et niveau passent dans l'Éditeur de bâtiment.

Les étapes 2 à 5 sont **pures** (sans DOM), comme `planche-importee.js` ; elles se testent sous
Node, sur des images synthétiques.

## Un corpus de test

Il servirait à **mesurer** la détection, pas à être livré avec l'application. Chaque image
reste chez sa source. Le domaine public est à vérifier image par image.

| Style | Où le trouver | Intérêt |
|---|---|---|
| Plan médiéval | Plan de Saint-Gall (Stiftsbibliothek, e-codices) ; Villard de Honnecourt (BnF) | Aucune échelle, parchemin |
| Renaissance gravée | Du Cerceau (Met, Morgan, Wikimedia Commons) ; Palladio 1570 (sourcelibrary.org) | Murs pleins ; cotes dans les pièces |
| Château classique, lavis | Fonds Robert de Cotte (Gallica) : Clagny ; Versailles 1693-1695 (Gallica) ; Marot (Commons) | Toises, carmin ou noir, ombres |
| Château médiéval restitué | Viollet-le-Duc (Commons) | Murs très épais, embrasures |
| Relevé d'un bâtiment historique | HABS (Library of Congress, domaine public) | Échelles impériale et métrique ; poché ou non selon le matériau |
| Cadastre | Plans cadastraux de Paris 1809-1856 (data.gouv.fr) ; archives départementales | Contour seul |
| Contemporain, annonces | CubiCasa5K (Zenodo) | Trois styles, annotations SVG |
| Contemporain, CAO | FloorPlanCAD (environ 15 600 plans, 30 catégories) ; CVC-FP (122 plans) ; MLSTRUCT-FP (954 plans) | Hachures, traits fins, grands immeubles |
| Plans de Durzo | ses propres plans | Le cas réel |

## Décisions de Durzo (4 novembre 2026)

1. **Les unités** de la saisie d'échelle : la liste ci-dessus convient.
2. **Les formats** : tous les formats d'image courants, et le PDF, dès la première version.
3. **Le plus automatique possible.** Toute action ajoutée pour l'utilisateur se fait **en dernier
   recours**. Les murs colorés sont donc détectés sans pipette ; la pipette ne vient, si elle vient,
   qu'à la correction, quand la détection a échoué. Seule l'échelle reste demandée d'office
   (pré-remplie par l'estimation), faute de pouvoir la lire de façon sûre sur une photo.
4. **Le corpus** : celui de ce document, sans plan particulier en tête.

## Sources

**Histoire du dessin d'architecture**
- Henri Gautier, *L'art de dessiner proprement les plans…*, Paris, 1697 : [archive.org](https://archive.org/details/lartdedessinerpr00giff) ; notice d'É. d'Orgeix au [CESR, Architectura](https://architectura.univ-tours.fr/?p=13966).
- N. Buchotte, *Les règles du dessein et du lavis*, 1722 : [notice Heidelberg](https://biblio.ub.uni-heidelberg.de/drawingbooks/Record/KXP-PPN1564537498/Details), [CCA](https://www.cca.qc.ca/en/search/details/library/publication/1179173008).
- Basile Baudez, [« Shadowed plans »](https://drawingmatter.org/shadowed-plans/), *Drawing Matter*, 2026.
- Basile Baudez, [« Inessential Colors », conférence au Bard Graduate Center](https://bgc.bard.edu/research/articles/217/inessential-colors-a-history-of), 2017 ; *Inessential Colors*, Princeton University Press, 2021 ([présentation](https://enfilade18thc.com/2021/12/15/new-book-inessential-colors-architecture-on-paper/)).
- Le poché : [OASE 94](https://oasejournal.nl/en/Downloads/5530129dc79eb3adf9000012/OASE%2094%20-%20125%20Poch.pdf) ; [learnarchitecture.net](https://learnarchitecture.net/articles/39298-architectural-hatch-patterns.html).
- Plan de Saint-Gall : [Wikipédia](https://en.wikipedia.org/wiki/Plan_of_Saint_Gall) ; Villard de Honnecourt : [Columbia](https://projects.mcah.columbia.edu/medieval-architecture/htm/sw/ma_sw_prim_villard_dehonne.htm).
- Palladio, *I quattro libri*, 1570 : [Source Library](https://sourcelibrary.org/book/f20894c1-495f-4afe-815b-e8bf3c8938a5/page-number/98) ; reconstruction des villas : [Nexus Network Journal](https://link.springer.com/article/10.1007/s00004-022-00592-1).
- Du Cerceau, *Les plus excellents bastiments de France* : [Morgan Library](https://www.themorgan.org/printed-books/168392), [Met](https://www.metmuseum.org/art/collection/search/399300), [CESR](https://architectura.univ-tours.fr/wp-content/themes/cesr/pdf/pdf-text/ENSBA_LES1594_1595.pdf).
- Durand, *Précis des leçons* : [Getty (traduction)](https://www.getty.edu/publications/virtuallibrary/0892365803.html).
- Neufert : [*Architects' Data*](https://en.wikipedia.org/wiki/Architects%27_Data) ; Ramsey et Sleeper : [CCA](https://cca.qc.ca/en/search/details/library/publication/173683613).

**Unités**
- Toise et pied du roi : [techno-science.net](https://www.techno-science.net/fr/definitions/toise), [convertunits](https://www.convertunits.com/from/pied+de+roi/to/metre).

**Fonds et archives**
- VERSPERA : [communiqué](https://www.chateauversailles-recherche.fr/IMG/pdf/cp_verspera.pdf), [10 ans](https://chateauversailles-recherche.fr/IMG/pdf/cp_10_ans_verspera.pdf), [CNRS](https://news.cnrs.fr/node/1155), [Archives nationales](https://www.archives-nationales.culture.gouv.fr/en/versailles-3d).
- Échelles en toises à Versailles : [Université de Lille](https://omekas-histoire.univ-lille.fr/omeka-s/s/equipement-draconique/item/238) ; Versailles 1693-1695 cité par [Heidelberg](https://books.ub.uni-heidelberg.de/arthistoricum/catalog/view/879/1473/98700) ; Clagny (Robert de Cotte) sur [Europeana](https://www.europeana.eu/item/9200518/ark__12148_btv1b53050190v).
- POP (Mérimée) : [à propos](https://pop.culture.gouv.fr/a-propos), [données ouvertes](https://pop.culture.gouv.fr/donnees-ouvertes).
- Wikimedia Commons : catégorie *Plans of castles in France*.
- Cadastre : [BOFiP](https://bofip.impots.gouv.fr/bofip/5359-PGP.html/identifiant%3DBOI-CAD-DIFF-10-20191105), [plans de Paris 1809-1856](https://www.data.gouv.fr/datasets/plans-cadastraux-des-immeubles-de-paris-1809-1856).

**Normes**
- [ISO 7519:1991, aperçu](https://cdn.standards.iteh.ai/samples/14288/4686cac1237f435c860a8389c9b871bf/ISO-7519-1991.pdf) ; [prEN ISO 7519 (révision)](https://standards.iteh.ai/catalog/standards/cen/5cbee7ab-b198-4e76-ab8f-24c60ba3e0a7/pren-iso-7519).
- [ISO 128-20:1996, aperçu](https://cdn.standards.iteh.ai/samples/1408/b6ac8542838a49d69a08e98033748017/ISO-128-20-1996.pdf) ; [ISO 128-23](https://cdn.standards.iteh.ai/samples/22292/b4450830d18c4f95920c088bef347793/ISO-128-23-1999.pdf) ; [ISO 4157-1](https://cdn.standards.iteh.ai/samples/9923/2bc69d4e60f24d88b2644a4b29d8a119/ISO-4157-1-1980.pdf).
- [NF P02-001](https://www.boutique.afnor.org/en-gb/standard/nf-p02001/conventional-signs-architectural-drawings-architectural-building-and-civil-/fa032301/245), [NF P02-005](https://www.boutique.afnor.org/en-gb/standard/nf-p02005/architectural-building-and-civil-engineering-drawings-dimensioning/fa033682/10513) (AFNOR).
- DIN 1356 : [cours de l'Université de Hambourg](https://epub.sub.uni-hamburg.de/epub/volltexte/2010/4886/pdf/Bauzeichnen_I.pdf).
- [HABS Guidelines, Measured Drawings (2008)](https://www.nps.gov/subjects/heritagedocumentation/upload/HABS-Guidelines-Measured-Drawings_508.pdf) ; [Heritage Documentation Programs](https://home.nps.gov/subjects/heritagedocumentation/guidelines.htm).

**Dimensions courantes**
- Portes intérieures : [Batiman](https://www.batiman.fr/assets/fiches_bati/batprat06_pi_220127_0.pdf), [Brico Dépôt](https://www.bricodepot.fr/projets-chantiers-renovation/menuiserie/comment-choisir-porte-interieure).

**Recherche et jeux de données**
- Pizarro et al., [*Automatic floor plan analysis and recognition*](https://meshinglab.dcc.uchile.cl/publication/pizarro-2022104348/), 2022.
- Zeng et al., [DeepFloorplan](https://github.com/zlzeng/DeepFloorplan), ICCV 2019 ([article](https://openaccess.thecvf.com/content_ICCV_2019/html/Zeng_Deep_Floor_Plan_Recognition_Using_a_Multi-Task_Network_With_Room-Boundary-Guided_ICCV_2019_paper.html)).
- Kalervo et al., [CubiCasa5K](https://github.com/CubiCasa/CubiCasa5k) ([article](https://arxiv.org/abs/1904.01920)).
- [CVC-FP](https://portalrecerca.uab.cat/en/publications/cvc-fp-and-sgt-a-new-database-for-structural-floor-plan-analysis-/) ; comparatif des jeux de données dans [arXiv 2408.01526](https://arxiv.org/pdf/2408.01526) et [WAFFLE](https://arxiv.org/pdf/2412.00955).
- Plans de bâtiment et assurance : [arXiv 2205.01671](https://arxiv.org/pdf/2205.01671) ; vectorisation avec OCR : [Buildings (MDPI)](https://mdpi.com/2075-5309/15/7/1178).
- Échelle par OCR : [Towards Data Science](https://towardsdatascience.com/finding-m²-details-on-a-floorplan-using-unsupervised-learning-f8f8891befa9/), [MONA](https://monaverse.com/help/floor-plan-dimensions-and-scale), [ThirdEye](https://thirdeyedata.ai/wp-content/uploads/2026/04/Arch-Plan-AI-Technical-Document-ThirdEye-Data.pdf), brevet [US 10395147](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10395147).
