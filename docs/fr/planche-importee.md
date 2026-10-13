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

Clic droit dans un espace vide de la Planche affichée, **« Importer une planche »** (sous « Créer une
case » et « Créer une bulle de dialogue », et nulle part ailleurs). On choisit une image (PNG, JPG,
WebP) : l'image est rangée, les Cases détectées, et la nouvelle Planche s'ouvre juste après celle
affichée, dans le même Chapitre, **en correction des Cases**.

**La correction se fait sur la Planche** (demandé le 13 octobre 2026, la première version passait
par une modale) : un clic sélectionne une Case (hors des Cases : désélectionne), la tirer la déplace,
tirer un coin la redimensionne, un **clic droit sans glisser en crée une** (le seul moyen), Suppr la
retire, Échap ou un clic hors de la Planche termine ; en sortant, plus rien n'est sélectionné. Le menu de la Planche porte
la section **« Cases détectées »** : « Modifier les cases » y ramène à tout moment, « Terminer » en
sort (le curseur de sensibilité a été retiré : la correction suffit). Les numéros suivent l'ordre de
lecture à l'import ; ensuite, on les change en **glissant** les lignes de la liste du menu de la Planche
(sauf depuis leur champ), et un clic sur une ligne **met la Case en surbrillance** (un second clic la
désélectionne). Un
import se défait d'un Ctrl+Z.

## La détection

Réécrite le 13 octobre 2026 sur quinze planches réelles fournies par Valentin (manga, BD
franco-belge, comics, doubles pages, captures d'écran avec leur cadre), gardées hors dépôt dans
`apercus/planches-test/`. La première version (une découpe sur les seules lignes de papier pleines)
ne trouvait qu'une Case sur la plupart d'entre elles.

1. **Le papier** est le niveau de gris clair (à défaut sombre) des longues plages uniformes de
   l'image ; le **cadre** d'une capture d'écran ou d'une visionneuse est retiré.
2. **Le papier du dehors** : celui qu'on atteint depuis le bord sans traverser d'encre (marges et
   gouttières). Tout le reste appartient aux Cases, y compris l'intérieur blanc d'une Case de manga.
3. Ses **composantes**, après une légère érosion qui coupe les traits fins enjambant une gouttière.
4. Chacune est **recoupée** le long de ses séparateurs : bande de papier du dehors refermée par un
   débord, bande mince d'une couleur uniforme (gouttière sombre), ou, dans une boîte presque sans
   papier, **arête encrée** droite (Cases jointives d'un comics à fond perdu).
5. L'ordre de lecture donne les numéros ; une **double page** se lit page par page.

**Ce qu'elle ne sait pas faire**, d'où la vérification : une illustration pleine page sous des
Cases posées dessus, des Cases inclinées (rendues par leur rectangle), une Case incrustée dans une
autre, des Cases sans bordure sur papier blanc (elles s'émiettent).

**Les bulles ne sont pas détectées** (décidé avec Valentin).

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
4 ; **maintenir le clic droit** sur la Planche déplace l'image, les bordures des Cases s'effaçant le
temps du geste ; « Recentrer » supprime les trois champs.

## Ce qui est verrouillé

Sur une Planche importée, un clic sélectionne une Case, tirer cadre l'ensemble, et rien d'autre :
ni menu contextuel, ni création, ni Suppr, ni mode Caméra. Le menu d'une Case se réduit à
**Dimensions** et **Description** ; le menu de la Planche montre le **Cadrage**, et la liste des
Cases où **chaque description se tape directement**.
