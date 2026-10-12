# Planches importées

*[English version](../en/planche-importee.md)*

> Demandé par Valentin le 12 octobre 2026. Le code : `src/planche-importee.js` (les décisions,
> testées sous Node), `src/import-planche-ui.js` (la vérification), et les branches marquées dans
> `draw.js`, `events.js` et `sidebar.js`.

## Ce que c'est

Une planche déjà dessinée (scan, export d'un autre logiciel) entre dans un Tome comme une Planche à
part entière : elle se lit dans le Lecteur, se range dans un Chapitre, s'exporte, et chacune de ses
Cases se décrit. **Rien ne s'y modifie** : ni les Cases, ni le dessin. Seul le cadrage de
l'ensemble se règle.

## Le geste

Clic droit sur une Planche, dans le menu de gauche, **« Importer une planche »**. On choisit une
image (PNG, JPG, WebP), l'application **détecte les Cases**, puis une fenêtre de **vérification**
les montre sur l'image : on les déplace, les redimensionne par un coin, en trace de nouvelles dans
le vide, en retire (Suppr). Le curseur « Sensibilité » relance la détection, et remplace les
retouches. **Rien n'est écrit avant « Importer la planche »** : ni la Planche, ni l'image dans le
dossier Images. La nouvelle Planche se place juste après celle du clic, dans le même Chapitre.

## La détection

Une découpe récursive (« XY-cut ») : la couleur du fond est lue sur le pourtour de l'image, une
gouttière est une bande de lignes presque entièrement de cette couleur, et l'image est coupée le
long des bandes horizontales puis verticales, tant qu'il y en a. Les morceaux restants, rognés de
leurs marges, sont les Cases ; les trop petits (numéro de page, signature) sont écartés. L'ordre de
lecture (rangées, puis de gauche à droite) donne les numéros.

**Ce qu'elle ne sait pas faire**, et c'est la raison de la vérification : une bulle ou un dessin qui
enjambe une gouttière la bouche (deux Cases n'en font qu'une) ; une Case sans bordure sur fond
blanc perd ses marges vides ; une Case inclinée est rendue par son rectangle. Ses seuils
(`DETECTION`) ont été posés sur des planches synthétiques, pas mesurés sur un corpus.

**Les bulles ne sont pas détectées** (décidé avec Valentin) : on ne pourrait rien en faire, faute de
pouvoir les modifier ; lire leur texte serait un autre chantier.

## Ce qui est persisté

Deux champs **ajoutés**, rien de renommé :

- sur la Planche, `importee: { largeur, hauteur }` (les dimensions de l'image), plus le cadrage de
  l'ensemble, sous les noms de celui d'une image de Case : `imageAnchorX`, `imageAnchorY`,
  `imageZoom` (absents = centré, 1) ;
- sur chaque Case, `imageFile` (l'image de la Planche) et `regionImage: { x, y, w, h }`, sa zone
  dans l'image, en fractions.

**Le nom de l'image vit sur les Cases**, pas sur la Planche : c'est ce qui donne à la Planche
importée, sans une ligne de plus, ce que savent les images de Case (préchargement, section Images,
renommage, Fichiers introuvables). Une seconde copie sur la Planche serait restée en arrière au
premier renommage. `casePorteUneImage3D` répond pourtant **non** pour ces Cases : elle gouverne les
menus d'une Case à image (Image, Cadrage, recadrage au clic droit), qu'elles n'ont pas.

**La place d'une Case se déduit.** `x`, `y`, `w`, `h` et `pts` sont recalculés à chaque dessin
depuis la région et le cadrage (`placerCasesImportees`). Une version de l'application qui ignore
tout cela lit des Cases ordinaires, à leur place, sans image.

## Le cadrage

À 1×, l'image est **entière** (« contenir »), et non « couvrir » comme une image de Case : une
planche n'a presque jamais les proportions exactes du format du Tome, et couvrir rognerait les
Cases du bord. Les bandes qui restent prennent la couleur de fond de la Planche. Le zoom va de 1 à
4 ; **tirer sur la Planche** déplace l'image (un clic, en deçà de 3 pixels, ne fait que
sélectionner) ; « Recentrer » supprime les trois champs.

## Ce qui est verrouillé

Sur une Planche importée, un clic sélectionne une Case, tirer cadre l'ensemble, et rien d'autre :
ni menu contextuel, ni création, ni Suppr, ni mode Caméra. Le menu d'une Case se réduit à
**Dimensions** et **Description** ; le menu de la Planche montre le **Cadrage**, et la liste des
Cases où **chaque description se tape directement**.
