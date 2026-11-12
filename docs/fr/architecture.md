# Architecture et nomenclature

*[English version](../en/architecture.md)*

Le README liste les fichiers. Cette note donne les **règles** : ce qui a le droit d'aller où, et
comment on nomme les choses.

## Règle 1 : le code applicatif vit dans `src/`

**`electron/`** contient le processus principal (CommonJS, chargé par Node, jamais par le renderer) :
- `main.js` : la fenêtre, l'accès disque, les canaux IPC ;
- `preload.js` : le pont `window.storyboarderAPI` ;
- l'écran bloquant et son pont (`preload-blocage.js`) ;
- les décisions pures qu'ils appliquent : `window-state.js` (géométrie de la fenêtre), dossier des
  Projets, `update-policy.js` et `updater.js` (mises à jour) ;
- `electron/bibliotheque/` : store de modèles, vignettes, bibliothèque des modèles importés.

`main.js` résout la racine de l'application (`RACINE`) pour `assets/` et les fixtures.

**`src/`** contient toute l'interface : `index.html`, `style.css` et les modules ES qu'ils chargent.
`src/app.js` importe `events.js`, le vrai point d'entrée.

**La racine** ne garde que ce que les outils y cherchent : `package.json`, README, licence,
configurations d'ESLint et de la vérification de types.

### Une information du processus principal descend en fichier généré

Le renderer ne lit pas `package.json`. Quand une information connue à la construction lui est utile,
elle est **générée** dans `src/` plutôt que servie par un canal :
- `src/version.js`, écrit par `tools/bump-version.mjs` ;
- `assets/fonts/`, écrit par `node tools/fetch-fonts.mjs`, et `assets/fonts/dafont/`, par
  `node tools/import-dafont.mjs` (cf. [polices.md](polices.md)). Les polices voyagent dans
  l'installeur ; `style.css` les importe.

### Quand un canal IPC est justifié

Un canal ne s'ouvre pour une fonctionnalité que si **les trois** conditions tiennent :
- il fait de l'**accès disque** (l'attribution de `main.js`), qu'aucun canal existant ne sait faire ;
- les données arrivent **à l'exécution**, choisies par l'utilisateur : rien ne peut les générer à la
  construction ;
- la décision reste dans `src/` : `main.js` fait l'entrée-sortie et **se défend** (refus de tout nom
  qui n'est pas un nom de fichier nu), le module de `src/` **décide** (nom retenu, collisions,
  messages) et se teste. Exemple : `src/model-store.js` et `tests/model-store.test.mjs`.

Canaux ouverts : `models:*` (modèles 3D importés), `images:*` (images de Case, cf.
[panel-images.md](panel-images.md)), `fonts:*` (polices de l'utilisateur, cf. [polices.md](polices.md)),
`skeletons:*` (le fichier de correspondances), `batiments:*` (les bâtiments, cf.
[building-editor.md](building-editor.md)), `textures:*`, `fontstore:*`, `project:*`, `settings:*`,
`maj:*` (mises à jour, cf. [updates.md](updates.md)) et `mcp:*` (la connexion d'une IA, cf. [mcp.md](mcp.md)). La liste complète est dans `electron/preload.js`,
et sa déclaration dans `types/globals.d.ts`.

## Règle 2 : les imports circulaires se cassent par injection

Les modules ont des besoins croisés (`scene3d.js` redessine la page, `draw.js` met à jour le panneau
latéral). Un module qui a besoin d'appeler « vers le haut » expose un `set*Callbacks()` qu'`events.js`
appelle au démarrage :

```js
setScene3DCallbacks({ drawCurrentPage, refreshCameraSliders, renderSideCameraGizmo });
setDrawCallbacks({ canvas, ctx, applyZoom, updateSidePanel, … });
setPersonaEditorCallbacks({ buildPersonaPositionOptions });
```

Ordre de préférence : une **fonction pure** dans `utils.js` (ou un module pur) → un **callback
injecté** → un import direct, seulement si le graphe reste acyclique.

## Règle 3 : l'état partagé passe par `S`

`src/state.js` exporte `S`, l'état mutable de l'application (`S.selectedId`, `S.modalTarget`,
`S.traceTool`, `S.tomes`…). Une dépendance à `S` est invisible dans les signatures : la dire dans le
commentaire de la fonction.

### La scène 3D partagée : un aperçu passe par `rendreApercu3D`

Le rendu des Cases et les aperçus d'un seul Élément (fiches, Éditeur de modèle) partagent la même
scène et le même renderer (`src/rig3d.js`). Un aperçu ne dessine **jamais** la scène lui-même : il
appelle `rendreApercu3D(type, id, caméra)`, qui masque tout sauf son Élément puis dessine. Seuls
cette fonction et le rendu d'une Case dessinent la scène partagée ; `tests/rig3d.test.mjs` le vérifie.
Les écrans qui ont leur propre aperçu (store, Éditeur de bâtiment) ont leur propre renderer.

## Règle 4 : la vérification de types est un linter

`jsconfig.json` fait passer TypeScript sur `src/**/*.js` en mode `checkJs`, sans compilation ni
fichier `.ts` : `npm run typecheck`, et `npm run typecheck:report` pour un résumé classé. Elle est
**facultative** et n'est pas branchée au hook pre-commit (l'essentiel des diagnostics vient de l'accès
au DOM non typé).

Ce qui compte : `types/globals.d.ts` déclare le pont Electron, et `tests/electron-bridge.test.mjs`
refuse toute divergence entre cette déclaration et `preload.js`.

Pièges :
- une signature d'index (`[clé: string]: unknown`) sur une interface de frontière autorise tout et ne
  vérifie rien ;
- un test qui lit du code source doit d'abord en retirer les commentaires.

## Nomenclature

Ces règles portent sur le **code**. Les données enregistrées suivent les leurs
([persisted-data.md](persisted-data.md)).

### Suffixe `3D`

Toute fonction ou constante en unités monde 3D le porte : `tracéWallHeight3D`, `GROUND_Y_DEFAULT_3D`.
Il distingue d'un coup d'œil un calcul monde d'un calcul canvas.

### Préfixe `ensure*`

`ensurePersonaRigEntry3D`, `ensureWallRenderEntry3D` : renvoient l'existant ou le construisent (cache,
ajout à la scène). `get*` est réservé à ce qui ne modifie rien.

### Préfixe `_`

Seulement pour un temporaire de calcul dans une portée dense (`_tracéPos`). Il ne signifie pas
« privé ».

### Deux homonymes à connaître

**`trace` (l'outil) et `tracé` (l'objet).** `S.traceTool`, `startTraceTool` désignent l'outil de dessin
à la souris (Routes, Chemins, zones de Terrain). `tracéBBox`, `drawTracé`, `type: 'tracé'` désignent
l'objet enregistré (route, chemin, muret, clôture, haie, barrière). Une recherche sur l'un rate
l'autre : chercher les deux. `'tracé'` est une valeur enregistrée, il ne se renomme pas.

**`render` a trois sens** : rendu WebGL (`renderPanelScene3D`), construction du DOM
(`renderSideElementRow`, `renderTree`), et `renderAll()` qui orchestre les deux. Un `render*` de
`sidebar.js` ou `project-tree.js` ne touche pas à three.

### Langue

- **Le code est en anglais** : identifiants, commentaires, noms de fichiers. Les modules plus récents,
  encore en français, sont traduits au fil des modifications (tout code nouveau ou touché s'écrit en
  anglais).
- **Exception : les données enregistrées.** Les noms de champs et les valeurs discriminantes restent
  tels quels, français compris (`tracé`, `objType: 'batiment'`, `pieceId`…), cf.
  [persisted-data.md](persisted-data.md). `tracé` n'est jamais traduit.
- **L'interface** est bilingue (`src/i18n.js`, `tr(en, fr)`) ; **`docs/`** existe en anglais et en
  français.
- **Renvois vers la doc** : toujours `docs/en/…` ; `tests/docs.test.mjs` vérifie que la cible existe et
  qu'elle est anglaise.

## Règle 5 : ce qui accompagne un changement

Dans le **même commit** :
- **visible par l'utilisateur** : `README.md` et `README.fr.md`, le manuel `src/help-content.js` dans
  ses deux langues, `src/i18n.js` pour un libellé ajouté ;
- **changement de fonctionnement** : la note de `docs/` qui le décrit, dans ses deux langues (règles
  et gabarit dans [README.md](README.md)).

Le travail interne (refactorisation, tests) n'y est pas tenu.
