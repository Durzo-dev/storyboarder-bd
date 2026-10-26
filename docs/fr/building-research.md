# Construire des bâtiments : ce que font les jeux et les logiciels d'architecture

*[English version](../en/building-research.md)*

> Tâche #455, demandée par Valentin le 13 octobre 2026 : « une analyse exhaustive des logiciels
> d'architecte et des jeux de construction de maisons (dont les Sims), pour en tirer des features
> et des recommandations ». Elle prépare #454 (étages et sous-sols) et #456 (bâtiment à partir
> d'une photo de plan), et elle précède délibérément #454 : les niveaux touchent au format
> enregistré dans les Projets (cf. [persisted-data.md](persisted-data.md)), et c'est maintenant
> qu'il faut bien le choisir.

## Méthode, et ce qu'elle vaut

Recherche documentaire, faite le 13 octobre 2026 : aides officielles (Autodesk, Graphisoft,
Planner 5D, Space Designer 3D, Blender), notes de mise à jour, forums d'éditeurs (Sweet Home 3D,
Graphisoft, EA), wikis de joueurs et articles spécialisés. **Aucun logiciel n'a été essayé** : ce
document dit ce que leurs utilisateurs et leurs éditeurs en écrivent. Les wikis de joueurs sont
parfois approximatifs, et les jeux changent d'une mise à jour à l'autre ; ce qui n'a pu être
recoupé est signalé « (à vérifier) ». Les sources sont en fin de document.

Trente et quelques références, regroupées en sept familles. Pour chacune : ce qui la distingue, ce
qu'on en retient, ce qu'on évite.

## Ce que Storyboarder sait faire aujourd'hui

D'après une lecture du code (`src/canvas-tools.js`, `src/events.js`, `src/modals.js`,
`src/sidebar.js`) :

- **Deux façons de créer.** « Ajouter une pièce » pose une boîte : quatre murs, un plancher et un
  plafond, six Éléments `objet3d` qui partagent un `pieceId`. « Construire un bâtiment », en vue de
  dessus dans une Scène, trace des murs au clic : alignement sur les points déjà posés (guides),
  aimantation aux sommets, prolongement d'un mur dans son axe, coupure d'un mur touché en son milieu
  (jonction en T), clic droit pour repartir d'ailleurs, Échap pour tout annuler.
- **Un mur est un Élément indépendant** : position monde (`wxFloor`, `wzFloor`), longueur
  (`realLenFloor`), hauteur (`realHeightFloor`, 3 m par défaut), rotation. Son épaisseur est une
  proportion de sa hauteur (6 %), pas une valeur à part.
- **Les ouvertures** (porte, fenêtre, baie vitrée, et l'escalier) s'aimantent à un mur
  (`magnetWallId`, `wallAlongFrac`, `wallYFrac`) et en deviennent des enfants au rendu.
- **Un bâtiment n'existe pas dans les données** : c'est un regroupement CALCULÉ des pièces dont les
  murs se touchent (union-find, `getRoomConnectedComponents`), identifié par la liste triée de leurs
  `pieceId`. Son nom et sa rotation sont rangés sous cette clé (`batimentNames`, `batimentRotY`).
- **Ce qui manque** : les niveaux, les toits, les dalles d'un bâtiment tracé, un vrai escalier entre
  deux niveaux, l'épaisseur de mur réglable, le sous-sol (le Sol est un plan qu'on ne creuse pas), la
  vue en coupe d'un bâtiment.

⚠️ **La clé d'un bâtiment est instable** : ajouter ou retirer une pièce change la liste, donc la clé,
et le nom et la rotation rangés sous l'ancienne clé sont perdus. C'est le premier point à régler
avant d'y accrocher des niveaux (cf. plus bas, « Le modèle de données »).

## Les jeux de vie et de maison

### Les Sims (2, 3, 4), et inZOI

La référence du genre, et la plus proche de ce que Storyboarder cherche : construire vite une
maison crédible, sans compétence d'architecte.

- **La pièce est l'unité.** Dans les Sims 4, toute zone fermée par des murs ou couverte d'un sol est
  une pièce, détectée automatiquement, qui reçoit sol et plafond. On peut la tirer d'un bloc (outil
  pièce), la SÉLECTIONNER, puis la déplacer, la tourner ou changer la hauteur de ses murs d'un
  gadget posé au centre ; meubles et revêtements suivent.
- **Les niveaux sont des étages entiers**, quatre au-dessus du sol et deux en dessous depuis 2015
  (« 4 up and 2 down »). On passe d'un étage à l'autre ; l'étage courant se construit sur le
  précédent.
- **Le sous-sol est un outil à part**, rangé à côté du mur : on le TIRE sous l'étage courant comme
  une pièce, le terrain se creuse tout seul, et un escalier le relie. Les joueurs signalent qu'il
  vaut mieux le faire avant la fondation et prévoir la place de l'escalier.
- **La fondation** surélève la maison d'un cran ; un gadget, depuis 2018, la monte ou la baisse pour
  une pièce donnée. Les **plateformes** (2020) font des niveaux intermédiaires, empilables.
- **L'escalier est configurable** (2019) : droit, en L, en U, palier réglable ; il s'adapte à la
  hauteur, et il suit la maison quand on la déplace d'un bloc.
- **Les toits** sont des pièces qu'on pose puis qu'on étire, avec poignées de pente et de courbure ;
  un toit automatique existe (à vérifier).
- **La vue** : murs baissés, en coupe (« cutaway », les murs entre la caméra et l'intérieur
  s'effacent), ou levés. Les Sims 3 l'ont rendue célèbre (touches Début/Fin), et les Sims 4
  l'ont gardée.
- **Déplacer toute la maison** est un outil (« Move Lot & House »), qui tourne aussi l'ensemble.
- Les Sims 2 sont l'origine des fondations et des sous-sols, au prix de bricolages (code de triche
  `constrainFloorElevation`) pour les demi-niveaux.

**inZOI** (Krafton, 2025) reprend le modèle : plusieurs étages (jusqu'à 30 en immeuble), plafond
OBLIGATOIRE avant l'étage supérieur, trou dans le plafond pour l'escalier, fondation réglable de 0 à
1,5 m, bascule entre grille magnétique et placement libre (Tab). Pas de sous-sol à ce jour : prévu
avec l'édition du terrain, ce qui confirme que le sous-sol est d'abord un problème de terrain.

**À retenir.** La pièce comme unité qu'on sélectionne, déplace et tourne d'un bloc ; des niveaux
entiers et peu nombreux ; le sous-sol tiré comme une pièce sous l'étage courant ; l'escalier qui
s'adapte à la hauteur ; la vue en coupe.
**À éviter.** Les cas limites de niveaux partiels réglés par des astuces : les joueurs les
subissent depuis vingt ans.

### Bloxburg et House Flipper 2

- **Bloxburg** (Roblox) : outil mur, sol qui remplit une pièce d'un clic, ouvertures posées comme
  des objets puis redimensionnées, copier-coller de murs, et sous-sol tiré à la souris puis
  « habillé » de murs et de sols (à vérifier : les guides ne s'accordent pas sur l'ordre).
- **House Flipper 2** (2023), mode bac à sable : murs tracés en trois clics (début, fin, hauteur),
  contour vert ou rouge selon que la place est libre, grille ou placement libre, hauteur de mur
  modifiable, maison déplaçable entière, vue de dessus pour le plan. **Un sol, ou un plafond, n'est
  qu'un mur horizontal** : un seul outil pour les deux.

**À retenir.** Le retour visuel avant de valider (vert / rouge) ; la hauteur choisie au troisième
clic ; un seul objet « paroi » qu'on oriente au sol, au mur ou au plafond.

## Les jeux de construction en jeu de survie

### Valheim, Fallout 4, Enshrouded, Planet Zoo

- **Valheim** : des pièces (poutres, murs, sols, toits) qui s'accrochent par **points
  d'accroche**, et une **intégrité structurelle** affichée en couleur (bleu au sol, rouge prêt à
  tomber). Touche pour désactiver l'accroche.
- **Fallout 4** : accroche seule, sans physique ; les joueurs se plaignent surtout quand elle les
  empêche de poser là où ils veulent, et s'en remettent à des mods pour la contourner.
- **Enshrouded** : monde en voxels, terrain creusable ; un sous-sol s'obtient en posant un gros bloc
  dans la roche puis en le supprimant. Grille de 10 cm pour le détail.
- **Planet Zoo** : pièces sur grille de pas réglable, monter et descendre sur la grille (Maj),
  déplacement avancé au clavier, accroche angulaire désactivable ; les petites erreurs d'angle
  s'additionnent sur un grand bâtiment.

**À retenir.** Une accroche qu'on DÉSACTIVE d'une touche ; un pas de grille réglable ; montrer, en
couleur, pourquoi une pose est refusée.
**À éviter.** La physique de structure : inutile pour un décor de BD, et une source de refus
incompréhensibles.

## Les jeux de construction procédurale

### Tiny Glade et Townscaper

- **Tiny Glade** (2024) est né d'un générateur procédural de murs. On trace des murs comme des
  lignes ; **cliquer dans un enclos de murs fait un toit** qui suit leur forme ; tirer un chemin
  dans un mur y ouvre une porte ; les fenêtres se fondent entre elles. Le joueur décide de la forme,
  le jeu décide des détails.
- **Townscaper** (Oskar Stålberg) : on clique des cases sur une grille irrégulière ; une variante
  des « marching cubes » choisit la pièce de bâtiment selon les cases voisines remplies, et la
  « wave function collapse » assemble des morceaux compatibles (toits, arches, escaliers).

**À retenir.** C'est la piste la plus prometteuse pour un storyboard : **dire l'intention (un
contour, une hauteur, un style), et laisser l'application faire les détails** (toit, encadrements,
corniches). Le toit déduit du contour est le meilleur exemple.

## Les logiciels de plan grand public

### Sweet Home 3D

Libre, très utilisé, et le plus documenté sur les niveaux.

- **Les niveaux** sont des onglets au-dessus du plan, avec une **élévation** et une hauteur ; un
  niveau ajouté prend son élévation des préférences ; une élévation NÉGATIVE fait un sous-sol ;
  « ajouter un niveau à la même élévation » sert aux demi-niveaux et aux calques (terrain,
  mobilier) ; le niveau inférieur s'affiche en grisé sous le plan.
- **L'escalier découpe le plafond** du niveau du dessus, selon sa boîte englobante, ou selon une
  forme de découpe (chemin SVG) déclarée avec le modèle. Il ne découpe jamais un mur.
- **Le plan de fond** : on importe une image, on indique la longueur RÉELLE d'un trait, et on
  trace les murs par-dessus. C'est exactement le geste de #456.
- Murs tracés au clic, double-clic pour finir ; une pièce se crée d'un double-clic à l'intérieur de
  murs fermés (à vérifier) ; magnétisme activable.

### Planner 5D, Space Designer 3D, HomeByMe, Homestyler, RoomSketcher, Floorplanner

- **Planner 5D** : jusqu'à six étages sur le web, trois dans les applications ; le niveau inférieur
  est grisé quand on construit au-dessus ; « décidez où va l'escalier AVANT d'ajouter l'étage ».
  Pas de sous-sol documenté ; les utilisateurs simulent un étage de plus avec un cube en lévitation.
- **Space Designer 3D** a le modèle le plus clair de toute la famille. Un niveau a quatre mesures :
  **hauteur du niveau** (plancher à plancher), **épaisseur du plafond**, **hauteur sous plafond**,
  **distance au sol**. On ajoute un étage OU un sous-sol. La **trémie** (trou dans la dalle) se
  dessine sur le niveau du DESSUS ; la **mezzanine** est un niveau à mi-hauteur avec une trémie.
  Dupliquer un niveau passe par copier-coller.
- **HomeByMe, Homestyler, Floorplanner** : 2D et 3D synchronisés, bibliothèques de meubles,
  rendus. **RoomSketcher et Homestyler** importent une photo de plan, demandent UNE cote réelle
  pour l'échelle, puis détectent murs, portes et fenêtres (en bêta chez RoomSketcher) en laissant
  l'utilisateur corriger.

**À retenir.** Les quatre mesures d'un niveau (Space Designer 3D) ; l'étage du dessous grisé ;
l'escalier qui découpe la dalle ; la trémie dessinée sur le niveau du dessus ; l'échelle donnée par
une seule cote.

## La modélisation libre

### SketchUp, et Blender (Archimesh, Building Tools)

- **SketchUp** : on dessine une face, on la **pousse / tire** en volume. L'habitude des
  architectes : un groupe par étage (sol, puis murs tirés à la hauteur, puis ouvertures), des
  **balises** (calques) par étage pour afficher ou masquer, des **scènes** qui mémorisent caméra,
  balises et **plans de coupe**.
- **Archimesh** (Blender) : une pièce se dessine au crayon puis se génère avec sol, plafond et mur
  de fermeture en option ; épaisseur et hauteur restent modifiables après coup (modificateurs).
- **Building Tools** (Blender) : « ajouter des étages » sur une empreinte ; nombre d'étages, hauteur
  et débord de dalle se règlent après coup.

**À retenir.** Le « tirer en hauteur » pour faire un volume ; des paramètres qui restent
modifiables après la création ; une scène qui mémorise une coupe et une caméra, ce qui ressemble
beaucoup à une Case.

## Les logiciels d'architecte professionnels (BIM)

### Revit et Archicad

- **Le niveau est une référence horizontale**, pas un conteneur : il a une élévation et un nom, et
  chaque vue en plan lui est attachée. Changer l'élévation d'un niveau déplace tout ce qui s'y
  rapporte.
- **Un mur a une base et un sommet contraints** (Revit : contrainte de base, contrainte supérieure
  « jusqu'au niveau », décalages ; ou hauteur fixe « non connectée »). **Archicad** dit la même chose
  avec l'« étage d'origine » et la **liaison haute** (« étage d'origine + 1 ») : la hauteur des murs
  suit quand on change la hauteur d'un étage. Un mur peut traverser plusieurs étages, ou descendre
  sous son niveau (sous-sol).
- **Les portes et fenêtres sont hébergées** par un mur ; leur niveau est celui de leur allège.
- **Les pièces** (« rooms », « zones ») se déduisent des éléments qui les bornent, avec des lignes
  de séparation quand il n'y a pas de mur.
- **La vue en plan est une coupe** à une hauteur donnée ; ce qui est au-dessus ou en dessous
  s'affiche ou non selon des règles.

### Chief Architect

Le plus « automatique » des outils pro, et le plus proche de ce qu'un storyboarder voudrait : on
dessine le **premier** étage, et le logiciel construit **vers le haut** (toits, étages) et **vers le
bas** (fondation : sous-sol complet, vide sanitaire, plots) à partir du plan. Les **toits se
construisent au-dessus des pièces**, automatiquement, avec une reconstruction qu'on peut couper pour
retoucher à la main. Revers signalé : toits et fondations valent pour tout le modèle, ce qui gêne
quand un terrain porte deux bâtiments.

**À retenir.** Le niveau-référence et les murs liés au niveau du dessus (on change une hauteur
d'étage, tout suit) ; les ouvertures hébergées (c'est déjà le cas ici) ; le toit et la fondation
DÉDUITS du plan ; la coupe horizontale comme vue de travail.
**À éviter.** Tout le reste : couches de murs, structure, cotation, métrés. Un storyboarder n'en a
pas besoin.

## Le format d'échange : IFC

Le standard ouvert du bâtiment (buildingSMART) donne une hiérarchie qui vaut d'être copiée, au
moins dans l'esprit : **projet → site → bâtiment → étage (IfcBuildingStorey) → espace (IfcSpace)**.
Un étage a une **élévation** relative à une hauteur de référence du bâtiment ; sa hauteur n'est pas
dans l'étage mais dans ses propriétés (plancher à plancher). Un étage peut se diviser en
**demi-étages** (maisons à niveaux décalés). Chaque élément est « contenu » dans un étage ; une
ouverture est un vide dans un mur, que remplit une porte ou une fenêtre. Importer ou exporter de
l'IFC n'est pas un objectif ; s'en inspirer pour le modèle, si.

## De la photo de plan au bâtiment (pour #456)

La recherche (TUM, Budapest, 3DPlanNet…) fait toujours en deux temps : **segmenter les murs**
(pixels de mur), puis **détecter les ouvertures** (portes en arc, fenêtres), avant un
post-traitement qui vectorise et extrude. Les plans d'annonces immobilières, de styles variés et en
basse résolution, mettent en échec les méthodes par simple seuillage. Les produits (RoomSketcher,
Homestyler) font : photo bien droite, **une cote réelle pour l'échelle**, détection, puis
correction par l'utilisateur. C'est le même schéma que les planches importées (#452), et c'est ce
qu'on recommande : une détection modeste (murs épais = traits sombres larges, portes = arcs),
l'échelle demandée, et une correction directe sur le plan.

## Les motifs qui reviennent

| Question | Jeux de maison | Grand public | BIM | Ce qu'on recommande ici |
|---|---|---|---|---|
| Unité de construction | la pièce | le mur, puis la pièce | le mur hébergé par un niveau | la **pièce**, faite de murs |
| Niveaux | étages entiers, peu nombreux | étages avec élévation | niveaux-références | **niveaux du bâtiment**, avec élévation |
| Hauteur des murs | par pièce | par niveau | liée au niveau du dessus | **liée au niveau**, modifiable par mur |
| Sous-sol | outil dédié, terrain creusé | élévation négative | mur sous le niveau | **niveau négatif**, Sol percé sous l'emprise |
| Escalier | adapté à la hauteur | découpe la dalle | relie deux niveaux | **relie deux niveaux, découpe la dalle** |
| Toit | posé ou automatique | posé | automatique sur les pièces | **déduit du contour**, retouchable |
| Vue | murs baissés / coupe / levés | étage du dessous grisé | coupe horizontale | **coupe par niveau**, et par Case |
| Aide au tracé | grille, accroche | magnétisme | contraintes | **déjà là** ; ajouter une touche pour la couper |
| Déplacer | la pièce, la maison | la sélection | (rien) | **pièce, niveau, bâtiment** d'un bloc |

## Ce qui est propre à Storyboarder

Trois différences de fond avec tout ce qui précède, et elles orientent les recommandations :

1. **On construit un DÉCOR à cadrer, pas une maison à habiter.** Personne n'y circule, rien n'a à
   tenir debout. La précision au centimètre et la structure sont inutiles ; la VITESSE et la
   lisibilité à l'image comptent davantage.
2. **Ce qui compte est ce que voit la caméra d'une Case.** Les Sims enlèvent les murs entre la
   caméra et l'intérieur pour qu'on voie le joueur ; ici, c'est un choix de mise en scène, PAR CASE :
   une Case veut la façade, une autre veut l'intérieur à travers un mur retiré, une autre l'étage
   seul. La vue en coupe doit donc être un réglage de la Case, pas un état global.
3. **Une Scène se recopie dans des Cases** (cf. le manuel). Ce qu'on ajoute (niveaux, toits) doit
   survivre à cette copie, et rester léger à dessiner, puisque chaque Case le rend.

## Les recommandations

Classées par priorité. Effort estimé : S (une séance), M (quelques séances), L (un chantier).

### Priorité 1 : les fondations du modèle (avant tout étage)

1. **Rendre le bâtiment explicite** (M). Un identifiant `batimentId` AJOUTÉ sur chaque pièce, au
   lieu de la clé calculée qui change dès qu'on ajoute une pièce. À la lecture d'un ancien Projet,
   les regroupements calculés reçoivent un identifiant, et leurs noms et rotations sont repris.
2. **Des niveaux par bâtiment** (M). Une liste ordonnée de niveaux, chacun avec un nom, une
   **élévation** et une **hauteur d'étage** (plancher à plancher), une épaisseur de dalle ; chaque
   pièce porte son niveau. Le niveau 0 existe toujours ; un bâtiment d'avant n'en a qu'un.
3. **Des murs liés à leur niveau** (S). La hauteur d'un mur vaut, par défaut, la hauteur de son
   niveau (comme la liaison haute d'Archicad) : changer une hauteur d'étage met tout à jour. Une
   hauteur propre reste possible (mur bas, muret).
4. **L'épaisseur de mur réglable** (S), découplée de la hauteur (aujourd'hui 6 % de la hauteur, ce
   qui donne des murs de 18 cm à 3 m, mais de 30 cm à 5 m).

### Priorité 2 : étages, sous-sols, escaliers

5. **Un niveau courant**, choisi dans le menu du bâtiment ou au clavier (Page haut / Page bas comme
   dans les Sims et inZOI) : on construit sur lui ; le niveau du dessous s'affiche en grisé en vue de
   dessus (Planner 5D, Sweet Home 3D).
6. **Ajouter un étage, ajouter un sous-sol** (M), comme Space Designer 3D : l'étage prend
   l'élévation du dessus du niveau courant ; le sous-sol, une élévation négative. **Dupliquer un
   niveau** (S) : copier les murs d'un étage sur le suivant, le cas le plus fréquent.
7. **Dalles automatiques** (M) : chaque pièce fermée reçoit son plancher et, s'il y a un niveau
   au-dessus, le plancher du dessus fait plafond (une seule dalle, pas deux).
8. **L'escalier entre deux niveaux** (M) : il relie le niveau où il est posé au suivant, s'adapte à
   la hauteur d'étage, et **découpe la dalle** du dessus selon son emprise (Sweet Home 3D). La trémie
   peut aussi se dessiner à la main sur le niveau du dessus (Space Designer 3D).
9. **Le sous-sol perce le Sol** (L). Le Sol de la Scène est un plan unique ; sous l'emprise d'un
   sous-sol il doit disparaître (un trou dans sa géométrie, ou un masque), et les murs du sous-sol
   descendent sous la surface. C'est la partie la plus délicate, et la raison pour laquelle inZOI ne
   l'a pas encore. À traiter seul, après les étages.

### Priorité 3 : ce qui fait gagner du temps

10. **Le toit déduit du contour** (L) : un clic dans un bâtiment fait un toit qui suit ses murs
    (Tiny Glade, Chief Architect). Algorithme connu : le **squelette droit** du contour donne un toit
    à quatre pans ; un pignon s'obtient en relevant un côté. Styles : plat, deux pans, quatre pans ;
    pente réglable.
11. **La vue en coupe par Case** (M) : pour une Case qui montre un bâtiment, choisir « façade »,
    « coupe » (les murs entre la caméra et l'intérieur s'effacent, comme les Sims) ou « jusqu'au
    niveau N » (les étages au-dessus disparaissent). Réglage enregistré dans la Case.
12. **Sélectionner et déplacer d'un bloc** une pièce, un niveau ou un bâtiment, avec tout ce qui y
    est aimanté (le bâtiment se tourne déjà) (S à M).
13. **Retour visuel avant de valider** (S) : un mur en cours de tracé qui en croise un autre
    s'affiche en rouge (House Flipper 2) ; une touche (Alt) coupe l'accroche le temps d'un geste
    (Valheim, Planet Zoo).
14. **Pièces toutes faites** (S) : rectangle, L, T, et un « tirer une pièce » qui pose quatre murs
    d'un glissé (Sims, Bloxburg), à côté du tracé mur par mur.

### Ce qu'on déconseille

- La **physique de structure** (Valheim) : des refus incompréhensibles, aucun bénéfice à l'image.
- Les **couches de murs, la cotation, les métrés** (BIM) : un autre métier.
- Une **grille obligatoire** : l'accroche actuelle (guides, sommets) est meilleure ; la garder
  désactivable.
- L'**export IFC** : coûteux, sans demande.

## Le modèle de données proposé

> Révisé le 22 octobre 2026 après les décisions ci-dessous : le bâtiment n'est plus construit dans
> la Scène mais dans un **éditeur**, et il devient un **Modèle**. La première version (niveaux rangés
> sur la Case, murs restant des Éléments de la Scène) est abandonnée.

Un **fichier de bâtiment** rangé dans la bibliothèque des modèles, comme un modèle importé, et
listé avec eux (catégorie Bâtiments, vignette) :

```
<nom>.batiment.json
  { version, nom,
    niveaux:    [ { id, nom, elevation, hauteur, dalle } ]        ← ordonnés, 0 = rez-de-chaussée
    murs:       [ { id, niveauId, a:{x,z}, b:{x,z}, epaisseur, hauteurPropre?,
                    revetement: { interieur, exterieur } } ]      ← un mur PAR ÉTAGE
    ouvertures: [ { id, murId, type, le long, y } ]               ← portes, fenêtres, baies
    escaliers:  [ { id, niveauId, ... } ]                         ← monte au niveau suivant
    pieces:     [ { id, niveauId, nom, sol, plafond } ]           ← déduites des murs fermés, NOMMÉES
    toit:       { type, pente, debord, matiere, terrasse, gardeCorps }
    elements:   [ ... ]                                           ← le mobilier fixe, la cheminée
  }
```

Dans une Scène ou une Case, **placer un bâtiment en fait une copie indépendante** : l'Élément
embarque le bâtiment entier (`batiment: { … }`) et garde le nom du fichier d'origine
(`batimentSource`, pour information). Retoucher cette copie ouvre l'éditeur sur elle, sans toucher
au fichier ni aux autres copies. **« Enregistrer dans la bibliothèque »** refait d'une copie retouchée
un Modèle, pour la réutiliser ailleurs (confirmé par Valentin le 22 octobre 2026).

Un Élément de la Scène posé **dans** un bâtiment (Personnage, objet, modèle) porte, en champs
AJOUTÉS : `dansBatiment` (l'id de l'Élément bâtiment), `niveauId` et, facultatif, `pieceId`. Sa
hauteur se déduit de l'élévation du niveau.

**Où, et en quel format** (#454a-1, fait) : `<dossier de Projets>/Batiments/<nom>.batiment.json`,
un dossier à part de `Modeles` (dont tout le chemin suppose un glTF), réuni aux modèles à
l'affichage. Le format et sa relecture sont dans `src/batiment.js` : unités en mètres, version 1,
champs inconnus gardés (un fichier plus récent ne perd rien), murs illisibles écartés un par un.

**L'éditeur** (#454a-2, fait) : `src/batiment-editeur-ui.js` pour l'écran, `src/batiment-plan.js` pour
la vue de dessus (repère en mètres, grille adaptative, zoom autour de la souris, cadrage). L'aperçu
3D a son propre renderer, comme celui du store : il ne touche pas à la scène partagée des Cases.
« Modifier » sur un Bâtiment ou une Pièce ouvre une copie de ses murs (`batimentDesPieces`, un
niveau, recentré) ; la Scène n'est pas touchée avant #454f.

**Le tracé des murs** (#454a-3a, fait) : `src/batiment-trace.js` (aimantation aux sommets puis au
milieu d'un mur, jonction en T qui coupe le mur touché, angle par 15°, longueur au centimètre,
guides d'alignement, Alt pour poser librement, croisement refusé) et `src/batiment-geometrie.js`
(les polygones des murs aux jonctions : onglet aux angles, T qui bute contre la face, bout libre
carré). La vue de dessus et l'aperçu 3D (murs extrudés) partagent ces polygones.

**Les pièces** (#454a-3b, fait) : `src/batiment-pieces.js`. Une pièce est une face fermée du réseau
des murs d'un niveau ; chacune garde un `repere` (un point intérieur, champ ajouté) par lequel la
face qui le contient après une modification hérite de son nom. Une pièce posée au milieu d'une
autre sans mur qui les relie (un îlot) la perce : son contour devient un trou de l'autre. Un glisser de l'outil Mur trace
une pièce rectangulaire (`ajouterRectangle`), dont un côté accolé à un mur existant n'est pas
doublé.

**Les ouvertures** (#454a-3c, fait) : `src/batiment-ouvertures.js` (porte, fenêtre, baie vitrée,
passage ; battants, coulissante, vitrée, sens, charnière ; placement dans le mur avec 10 cm de
maçonnerie aux bouts et entre deux ouvertures, sous le plafond). `morceauxDuMur`
(`src/batiment-geometrie.js`) tranche le polygone du mur aux ouvertures : coupé en plan, allège et
linteau en 3D. Gardés pour plus tard : porte de garage, vitrine, œil-de-bœuf, bow-window, verrière,
haut cintré, volets.

**Le placement** (#454a-4a, fait) : `src/batiment-element.js` (l'Élément `objType: 'batiment'`, sa
copie, sa hauteur réelle, son cadre 2D) et `src/batiment-3d.js` (le constructeur 3D partagé par
l'aperçu de l'éditeur et le rendu des Cases). « Créer un bâtiment » dans une Scène ouvre l'éditeur
avec « Placer dans la scène » ; « Modifier » (clic droit sur sa ligne) ou un double-clic sur un
bâtiment placé l'ouvre avec « Appliquer les modifications ».

**La bibliothèque** (#454a-4b, fait) : `src/batiment-bibliotheque.js` (les entrées de « Mes
modèles », catégorie `architecture` d'office ; la règle d'enregistrement : même nom → remplacer après
confirmation, renommé → nouveau modèle), `src/batiment-vignettes.js` (la vignette, rendue à la volée,
en mémoire). Un bâtiment placé depuis la bibliothèque garde `batimentSource` (champ ajouté,
informatif), par lequel sa fiche liste où il sert.

**Les niveaux** (#454b, fait) : `src/batiment-niveaux.js`. Un niveau commence au dessus de son
plancher (`elevation`), a `hauteur` sous plafond, et son plancher (`dalle`) est sous lui : le niveau
du dessus commence à `elevation + hauteur + dalle(du dessus)`. Les élévations se déduisent
(`recalerNiveaux`). Chaque pièce est couverte d'une dalle (le plancher de l'étage, ou un toit plat
en attendant #458) et les murs montent jusqu'au dessus de cette dalle (façade continue). Le tracé
s'aimante aussi au niveau du dessous (accroche 'repere').

**Les revêtements** (#454d avec #446e, fait) : `src/batiment-revetements.js`. Un revêtement est
`{ texture, couleur }` : une texture livrée (`int:…`, le jeu fourni : plancher, carrelage, marbre,
moquette, béton, briques, bois peint), une texture de « Mes textures » (`tex:…`) ou aucune (l'uni
d'avant), teinte d'une couleur. Une pièce a ses `murs`, son `sol`, son `plafond` ; le bâtiment, sa
`facade`, la même pour tous les étages (demandé). Une pièce née dans une autre (un îlot, une pièce
coupée en deux) en hérite les revêtements. Les murs se construisent FACE PAR FACE : chaque face regarde une pièce (ses murs) ou
l'extérieur (la façade), les faces collées à un autre mur ne sont pas faites, et les UV sont en
mètres. Dans l'éditeur, la section « Revêtements » : un carré de texture (le store en mode
« choisir ») et une couleur en direct : la façade dans la section Bâtiment ; les murs, le sol et
le plafond dans la section de la pièce choisie, titrée de son nom.

**Le mobilier** (#454e, première partie, faite) : `src/batiment-mobilier.js`. « Ajouter un
élément », dans la section de la pièce choisie, ouvre le store de modèles en mode « choisir » ; le
modèle est posé au centre de la pièce, au sol (toujours : il est fixé au sol). À l'outil Sélection :
glisser le déplace et l'aimante à la face des murs (deux dans un coin ; Alt : libre), le clic droit
le tourne d'un quart de tour, la molette le grandit ou le rétrécit, Suppr l'enlève. Un meuble est
`{ id, niveauId, modelFile, nom, x, z, rotY, echelle, dims, base }` dans `elements` : ses
dimensions sont celles du fichier (un modèle de plus de 6 m ou de moins de 5 cm est ramené à 1 m,
`base`). Le plan montre son empreinte et son devant ; la 3D, son modèle (une boîte tant qu'il n'est
pas décodé), dans l'éditeur comme dans les Cases, qui préchargent ces modèles avec la page.

**Poser un Élément dans un bâtiment** (#454e, seconde partie, faite) : `src/batiment-pose-ui.js`.
Les fiches d'un Personnage et d'un Objet ont, sous leur Position, un bloc « Dans un bâtiment » :
bâtiment (ceux de la même Case), étage, pièce, puis « Poser dans cette pièce ». Le bouton cache la
fiche et OUVRE L'ÉDITEUR sur une copie du bâtiment, l'Élément au centre de la pièce, au bon étage. Il
y devient un meuble (`@pose`, une copie de son rig : `elementCommeMeuble3D`, scene3d.js) et se manie
comme tel : déplacer, tourner, incliner, taille, élévation ; les pastilles l'emmènent à un autre
étage. Le bâtiment ne se touche pas : seul l'outil Sélection reste, et seul l'élément se prend
(`meubleVise`). Les autres Éléments de la Case qui sont dans le bâtiment s'y voient, figés (`@v:<id>`).
« Valider la position » et « Annuler » remplacent « Supprimer l'élément » et « Quitter » ; la croix
et Échap annulent. Valider : le centre de sa boîte (`centreDuMeuble`) passe du repère du bâtiment à
la Case (`pointDuBatimentPlace3D`), son orientation aussi (`rotationDansLaScene`), sa taille devient
la hauteur réelle qui lui garde celle vue dans l'éditeur ; tout cela est écrit dans les champs de la
fiche, qui est ENREGISTRÉE (avec le reste de ce qu'elle porte) et se ferme, puis la caméra de la
Scène va vers l'Élément. Annuler : la fiche revient telle quelle. La pose est ponctuelle : déplacer le
bâtiment ensuite ne déplace pas ce qu'on y a posé.

**Les escaliers** (#454c, fait) : `src/batiment-escaliers.js`. Droit, en L ou en U (le colimaçon
plus tard) ; marches d'environ 17 cm, giron de Blondel (2h + g = 63 cm, borné à 24–30 cm) ; la trémie
(l'emprise élargie) perce le plancher du dessus et le plafond de son niveau, dans la pièce qui la
contient. Refusé sans niveau au-dessus ou à travers un mur.

Les bâtiments déjà tracés dans les Scènes (murs Éléments, `pieceId`, `batimentNames`,
`batimentRotY`) restent LUS et sont **convertis** à l'ouverture en bâtiments d'un niveau, à la même
place : rien ne bouge à l'écran.

## Les décisions de Valentin (22 octobre 2026)

1. **Les niveaux** : le cas courant est un sous-sol et trois étages, mais sans limite (immeubles).
   L'interface est pensée pour une demi-douzaine de niveaux et reste utilisable au-delà.
2. **Un éditeur de bâtiments**, et non la Scène : on y construit le bâtiment, la Scène ne fait que
   le placer. Écran plein comme l'Éditeur de pose : vue de dessus du niveau courant (les autres en
   transparence), aperçu 3D, liste des niveaux, réglages du toit, revêtements des murs. À ajuster à
   l'usage.
3. **Le sous-sol** : après les étages.
4. **Les toits** : automatiques, avec des options (type, pente, couleur, matière : tuiles, ardoises,
   briques…), des Éléments posés dessus (cheminée…), et le **toit-terrasse**.
5. **Un mur par étage** : chaque étage habille l'intérieur de ses murs à sa façon (tapisserie…).
6. **Copie indépendante** : placer un bâtiment dans une Scène en fait une copie.
7. **Un bâtiment est un Modèle** : rangé et listé comme les modèles importés.
8. **Le mobilier** : dans l'éditeur (fixe) ET dans la Scène (mise en scène), pour l'instant ; à
   terme peut-être tout dans l'éditeur, à voir à l'usage.
9. **Placer un Élément dans un bâtiment** : à la main (en décochant « Collé au sol »), ou depuis la
   modale de l'Élément : un bâtiment, puis un étage, puis une pièce.
10. **L'outil « Construire un bâtiment » quitte la Scène** pour l'éditeur ; les bâtiments existants
    sont convertis. Le tracé y est repris, puis **amélioré** d'après les motifs de cette analyse
    (retour visuel, Alt, pièces toutes faites, etc.).
11. **Les matières** (briques, ardoises, tapisseries) : le store de textures (#446), plus un petit
    jeu fourni d'emblée.
12. **Les entrées de l'éditeur** : un bouton « Éditeur de bâtiment » dans le bandeau, à gauche de
    « Éditeur de modèle » ; « Créer un bâtiment » au clic droit dans une Scène, au-dessus de
    « Importer un modèle » ; « Modifier » au clic droit sur un Bâtiment ou une Pièce dans le menu de
    droite d'une Case ou d'une Scène.

## La feuille de route proposée

- **#454a** l'éditeur de bâtiments, un seul niveau : écran plein, tracé des murs repris de l'outil
  actuel, épaisseur réglable, pièces nommées, enregistrement comme Modèle, placement dans une Scène
  (copie indépendante).
- **#454b** les niveaux : liste, ajouter, dupliquer, renommer, hauteur d'étage, dalles
  automatiques, niveaux voisins en transparence.
- **#454c** l'escalier entre deux niveaux et sa trémie.
- **#454d** les revêtements : murs (face intérieure et extérieure, par pièce et par étage), sols,
  plafonds ; un jeu de matières fourni, puis le store (#446).
- **#454e** placer un Élément dans un bâtiment : le mobilier de l'éditeur, puis la pose depuis la
  fiche (bâtiment, étage, pièce). Fait.
- **#454f** la conversion des bâtiments tracés dans les Scènes, et le retrait de l'outil de la Scène.
- **#458** le toit automatique : types, pente, débord, matières, toit-terrasse avec garde-corps,
  Éléments sur le toit.
- **#459** la vue en coupe par Case (« jusqu'au niveau N », murs de devant effacés).
- **#454g** le sous-sol et le Sol percé, en dernier.
- **#456** (plan d'architecte) ensuite, dans l'éditeur : un plan = un niveau.

## Sources

- EA, *Basement tips* (Les Sims 4) : https://www.ea.com/games/the-sims/the-sims-4/news/basement-tips
- Notes de mise à jour des Sims 4 (sous-sols, 4 + 2 étages, déplacer la maison) : https://www.pcgamesn.com/the-sims-4/cowa-bunker-the-sims-4-update-introduces-deep-down-basements
- Mise à jour de novembre 2020 (plateformes, demi-murs) : https://simscommunity.info/2020/11/10/the-sims-4-pc-console-new-update-november-10th-2020/
- Plateformes, Carl's Sims 4 Guide : https://www.carls-sims-4-guide.com/tutorials/building/platforms.php
- Déplacer une pièce, Carl's Sims 4 Guide : https://www.carls-sims-4-guide.com/tutorials/building/houses.php
- Toits des Sims 4 : https://simscommunity.info/2022/03/04/ultimate-guide-to-building-roofs-in-the-sims-4/
- Escaliers configurables (2019) : https://www.pcgamer.com/au/you-can-finally-customize-staircases-in-the-sims-4
- Vues des murs, Les Sims 3 (Prima) : https://primagames.com/eguides/the-sims-3-world-adventures-eguide/essentials/the-sims-3-primer/creating-a-house
- Fondations des Sims 2 : https://sims.fandom.com/wiki/File:Foundation_TS2.png
- Demi-niveaux et `constrainFloorElevation` : https://forums.ea.com/discussions/the-sims-3-en/split-level-stairs/907026
- inZOI, guide du mode construction : https://www.playnews.gg/en/guides/inzoi-building-the-dream-house-complete-build-mode-guide-2026
- inZOI, fondations et sous-sols : https://thegameswiki.com/inzoi/wiki/foundations-and-basements
- Bloxburg, sous-sols : https://progameguides.com/roblox/how-to-make-a-basement-in-roblox-welcome-to-bloxburg/
- Bloxburg, sols : https://welcome-to-bloxburg.fandom.com/wiki/Floor
- House Flipper 2, outil mur : https://houseflipper.wiki.gg/wiki/Build_Walls_Tool
- House Flipper 2, mode bac à sable : https://www.gematsu.com/2023/10/house-flipper-2-sandbox-mode-trailer-screenshots
- Valheim, guide de construction : https://mobalytics.gg/gamebase/guides/valheim-general-building-guide
- Enshrouded, construction et terrain : https://guildorder.com/games/enshrouded/wiki/base-building-and-terraforming
- Planet Zoo, accroche : https://forums.frontier.co.uk/goto/post?id=8760303
- Tiny Glade, toits procéduraux : https://80.lv/articles/a-look-at-procedural-tower-roofs-in-tiny-glade/
- Tiny Glade, origines : https://80.lv/articles/an-update-on-tiny-glade-a-cozy-castle-building-simulator
- Townscaper : https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making
- Sweet Home 3D, niveaux et élévation (forum) : https://www.sweethome3d.com/support/forum/printthread_thread,10935
- Sweet Home 3D, découpe des escaliers (forum) : https://www.sweethome3d.com/support/forum/printthread_thread,12588_printall,yes
- Planner 5D, nouvel étage : https://support.planner5d.com/en/articles/16475679-how-to-create-a-new-floor
- Planner 5D, quatrième étage : https://support.planner5d.com/en/articles/5916686-adding-a-fourth-floor-windows
- Space Designer 3D, niveaux, trémies, mezzanines : https://www.spacedesigner3d.com/resources/help/floors-and-stairwells
- RoomSketcher, tracer un plan : https://help.roomsketcher.com/hc/en-us/articles/213842649
- RoomSketcher, conversion par IA : https://help.roomsketcher.com/hc/en-us/articles/31885247016605
- Homestyler, plans depuis une image : https://www.homestyler.com/article/how-to-create-functional-floor-plans-from-images
- SketchUp, coupes et scènes (forum) : https://forums.sketchup.com/t/sections-workflow-advice-please/288842
- Blender, Archimesh : https://docs.blender.org/manual/en/2.81/addons/add_mesh/archimesh.html
- Revit, hauteur et profondeur des murs : https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-D69E6B7D-8D8D-40E4-A6D4-7CAF1A927894.htm
- Revit, pièces en plan : https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-E5291792-0FFD-4171-939F-C056957BBC55.htm
- Archicad, liaison haute : https://help.graphisoft.com/AC/23/INT/_AC23_Help/040_ElementsVB/040_ElementsVB-5.htm
- Chief Architect : https://www.chiefarchitect.com/architects-builders-remodelers/
- Chief Architect, toits et fondations (forum) : https://chieftalk.chiefarchitect.com/topic/36692-working-with-multiple-roofs-and-foundations-independently
- IFC 4, IfcBuildingStorey : https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcproductextension/lexical/ifcbuildingstorey.htm
- Plans vers 3D, TUM : https://mediatum.ub.tum.de/doc/1748704/1748704.pdf
- Plans vers 3D, 3DPlanNet : https://pure.korea.ac.kr/en/publications/3dplannet-generating-3d-models-from-2d-floor-plan-images-using-en/
- Squelette droit et toits (Sugihara) : https://dspace.zcu.cz/items/80623541-f695-43b3-aff1-0cc05c3502dc
