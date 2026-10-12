# Les polices

> Tâche #423, octobre 2026. Les polices des Bulles : celles livrées avec l'application, et celles
> que l'utilisateur ajoute.

## Dix polices intégrées, une par usage

Choisies avec Valentin le 11 octobre 2026, à partir d'une règle : **une police de Bulle est
complète**, c'est-à-dire que le normal, le gras, l'italique et le gras italique sont dessinés par son
auteur. Les dix polices d'avant n'en comptaient qu'une ; huit sont donc remplacées, et les candidates
ont été triées pour qu'aucune ne double une autre.

| Usages d'origine | Police | Styles |
|---|---|---|
| Dialogue, Narration | Comic Neue | complète |
| Écrit à la main | Shantell Sans | complète |
| Narration | Nunito | complète |
| Cris | Kanit | complète |
| Onomatopées | Grandstander | complète |
| Onomatopées | Bangers | un seul style |
| Robotique | Chakra Petch | complète |
| Narration | EB Garamond | complète |
| Machine à écrire | Courier Prime | complète |
| Horreur | Creepster | un seul style |

Les usages d'origine ont été revus par Valentin le 12 octobre 2026 (`USAGES_POLICES` et
`POLICES_BULLES`, `src/constants.js`) ; chacun les change ensuite dans « Mes polices ».

Bangers et Creepster n'ont pas d'équivalent libre et complet : elles restent, et leurs variantes
sont simulées. Les murmures n'ont pas de police à part : ils se marquent par la bulle (pointillés)
et l'italique de la police de dialogue.

Toutes sont sous SIL Open Font License 1.1, vérifié sur les fichiers `METADATA.pb` du dépôt
`google/fonts`. Elles sont téléchargées une fois par `tools/fetch-fonts.mjs`, avec leurs licences, dans
`assets/fonts/`. La table de l'application est `POLICES_BULLES` (`src/constants.js`) ; un test
tient l'accord avec l'outil, la liste des Bulles et `BUBBLE_FONT_PRELOAD_LIST`.

**Les polices retirées ne réécrivent aucun Projet.** Une Bulle garde le nom écrit dans son fichier ;
`policeDeBulle` la dessine avec sa remplaçante (`POLICES_BULLES_RETIREES`). Cf.
[persisted-data.md](persisted-data.md).

## Cinquante-cinq polices venues de DaFont

Ajoutées le 12 octobre 2026, avec Valentin. DaFont n'a pas d'API et son libellé de licence n'est
« qu'une indication » : les zips ont été téléchargés à la main dans `apercus/dafont/` (hors dépôt),
et la licence de **chaque** police lue dans son zip et dans ses métadonnées. N'ont été gardées que
celles dont la licence écrite permet la redistribution **sans demander l'accord de l'auteur** (CC0,
domaine public, SIL OFL 1.1, GPL 2, CC BY-SA 4.0), sans caractère français manquant, puis une seule
par groupe de polices trop ressemblantes, et aucune qui double une police de Google.

**Les fichiers sont embarqués tels quels**, ni convertis ni allégés (une quinzaine de Mo) : pour
l'OFL, une conversion ou un sous-ensemble est une version modifiée, qui perd le droit de porter un
nom réservé.

`node tools/import-dafont.mjs` (la liste est dans l'outil) écrit `assets/fonts/dafont/` (un dossier
par police, avec son `LICENSE.txt`, une feuille `dafont.css` et un `LICENSES.md`) et
`src/polices-dafont.js`, qui rejoint `POLICES_BULLES`. Trois sont complètes (Gargle, Just Breathe,
Morning Breeze) ; les autres ont seulement les variantes que leur auteur a dessinées, le reste est
simulé. Un test tient l'accord entre l'outil, le dépôt et la liste des Bulles
(`tests/import-dafont.test.mjs`).

**Si l'utilisateur a déjà modifié ses usages**, les polices ajoutées reçoivent leurs usages d'origine
**traduits dans les siens** (`traductionDesUsages`, `src/polices-utilisateur.js`) : par le nom
(« Cris », sans casse ni accents), sinon par l'usage qu'il a donné aux polices de Google qui
portaient le même. Sans réponse unique, pas d'usage deviné. L'index note les polices intégrées déjà
vues (`policesVues`, opération `completer`) : cela ne se fait qu'une fois, et une police que
l'utilisateur a vidée le reste.

## Le gras et l'italique

Deux interrupteurs, **G** et **I**, cumulables, sous la police d'une Bulle. Deux champs ajoutés,
`bulleGras` et `bulleItalique`.

**Une variante manquante est simulée, jamais refusée** (décidé par Valentin) : le navigateur épaissit
ou penche la police, et l'application le dit, par un `~` sur l'interrupteur et une infobulle. Une
première version grisait l'interrupteur ; elle a été écartée, parce qu'une police importée incomplète
doit rester utilisable.

`styleDuTexteDeBulle` donne le préfixe de `ctx.font` ; `variantesDeLaPolice`
(`src/polices-utilisateur.js`) dit, pour une police intégrée ou importée, si chaque variante est vraie
ou simulée. Les quatre styles de chaque police sont préchargés au démarrage.

## La fenêtre des Polices

« Mes polices », ouverte par le bouton **Aa** du bandeau, à droite de la bibliothèque de modèles
(`src/polices-ui.js`) :

- les intégrées, puis les ajoutées (les deux groupes ne sont nommés que s'il y a des ajoutées), en
  grille de vignettes ou en liste (le choix est retenu), avec un filtre par usage ; en liste, un
  champ change la phrase d'exemple, la même que celle du détail ;
- un clic ouvre le détail à la place de la liste, sans la barre d'outils, avec « Retour » en bas,
  toujours visible : ses usages, alphabets, chiffres, ponctuation, accents, une phrase d'essai
  modifiable dans les quatre styles (les simulés marqués `~`), la licence et les droits ;
- les **usages** se manient comme les tags de « Mes modèles », par la même liste
  (`src/liste-etiquettes.js`) : en poser sur une police, en créer, renommer, supprimer, depuis le
  détail ou le filtre. Le filtre garde les polices qui portent AU MOINS UN des usages cochés. Ils
  sont rangés dans l'index (`usages`, `usagesDesPolices`, canal `fonts:usage`) ; tant que
  l'utilisateur n'y a pas touché, ce sont ceux d'origine (un par police intégrée), amorcés dans sa
  langue au premier changement ;
- un clic droit sur une police importée la renomme ou la supprime ;
- « Ajouter une police » : depuis un fichier, ou « Rechercher en ligne », qui ouvre l'onglet
  « En ligne » (ci-dessous).

## Importer un fichier

Formats : `.ttf`, `.otf`, `.woff`, `.woff2`. Les fichiers sont copiés dans
`<dossier de Projets>/Polices`, à côté de `Modeles` et `Images`, et pour la même raison : ce que
l'utilisateur fait pour sauvegarder ses Projets couvre ses polices.

**Ce qu'on lit dans le fichier** (`electron/bibliotheque/polices-fichiers.js`, Node nu) : le nom de
famille (table `name`, nom 16 sinon 1, sans le mot de graisse qu'une police variable y laisse), la
graisse et l'italique (`OS/2`, sinon `head`), les graisses d'une police variable (`fvar`), la
licence et son adresse (noms 13 et 14), le copyright et le créateur, et `fsType`, les droits que la
police se donne. Le WOFF2 est décompressé (Brotli) : `name`, `OS/2`, `head` et `fvar` n'y sont
jamais transformées. **Ce que la police dit d'elle-même n'est pas une preuve** : on le montre, avec
un avertissement si elle se déclare restreinte, et on ne refuse rien.

**Les fichiers d'une même famille n'en font qu'une** (Regular, Bold, Italic…). Le nom affiché est
celui de la famille, pas celui du fichier (demandé).

**L'index** `Polices/polices.json` range les familles et leurs fichiers, et garde les **renommages** :
renommer une police ne réécrit aucun Projet, une Bulle qui cite l'ancien nom est dessinée avec le
nouveau, en chaîne et sans boucle. Les décisions (index, conflits de nom, renommages) sont dans
`electron/bibliotheque/polices.js`, testées sous Node nu.

**L'import se fait en deux temps** : `fonts:pick` choisit et lit, garde les octets sous un jeton ;
l'interface tranche les conflits de nom (une police importée du même nom : remplacer ou garder les
deux ; une intégrée : la vôtre sous un autre nom, ou passer) ; `fonts:commit` écrit.

**Les canaux** `fonts:list`, `fonts:read`, `fonts:pick`, `fonts:commit`, `fonts:rename`,
`fonts:delete`, `fonts:usage` relèvent de l'exception documentée dans [architecture.md](architecture.md) : des octets
choisis par l'utilisateur à l'exécution. Chaque police est chargée dans le navigateur par `FontFace`
(`chargerPolicesUtilisateur`), avec sa plage de graisses si elle est variable.

## Le store de polices

L'onglet « En ligne » de « Mes polices ». Source : **Fontsource** (vérifié le 12 octobre 2026) :
une API publique sans clé, tout Google Fonts et d'autres polices libres, et pour chaque police, avant
tout téléchargement, sa catégorie, sa licence, ses graisses et ses styles. Écartées : l'API Google
Fonts (clé obligatoire, même catalogue), DaFont et 1001 Fonts (aucune API, licences variables).

- **Recherche** dans le catalogue, gardé une heure en mémoire : texte (sans accents ni majuscules),
  catégorie, **« Complètes seulement »** (vrai gras et vrai italique, cochée par défaut), tri par nom
  ou par date. Par pages de 48 ; la suite se charge au fil du défilement (`suiteADemander`,
  `src/store-ui.js`, la même règle que les stores de modèles).
- **Les aperçus** sont téléchargés quand la vignette devient visible (`IntersectionObserver`), sous
  un nom de famille propre au store (« SB apercu <id> ») ; le détail charge les vraies variantes.
- **Une police déjà là** porte une coche, et son bouton d'ajout est grisé.
- **« Ajouter à mes polices »** télécharge le normal, le gras, l'italique et le gras italique qui
  existent, en latin (français et anglais compris), puis suit le chemin d'un import de fichiers :
  lu, gardé sous un jeton, conflits de nom tranchés, écrit par `fonts:commit`.
- Le code : `electron/bibliotheque/store-fontsource.js` (décisions, testées sous Node nu),
  `store-polices.js` (requêtes et caches), `src/polices-store-ui.js` (l'onglet). Canaux
  `fontstore:infos`, `fontstore:chercher`, `fontstore:apercu`, `fontstore:ajouter`.
- **Simulation** : `STORYBOARD_SIMULER_STORE`, comme le store de modèles ; un extrait enregistré du
  catalogue (`tests/fixtures/fontsource-catalogue.json`), et les fichiers des polices intégrées quand
  une police de l'extrait en est une.

## Ce qui reste

- D'autres sources, en second onglet si besoin (Fontshare : une centaine de polices, licence propre
  à la fonderie).
- Une police importée absente (fichier supprimé, Projet envoyé à quelqu'un) est signalée dans
  « Fichiers introuvables » ([missing-resources.md](missing-resources.md)) ; la Bulle s'affiche
  dans une police de secours en attendant.
