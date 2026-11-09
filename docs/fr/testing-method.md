# Méthode de test

*[English version](../en/testing-method.md)*

La suite s'exécute en entier à chaque commit (hook `pre-commit`, cf. [versioning.md](versioning.md)).
Cette note dit comment les tests sont organisés et comment en écrire.

## L'outillage

Le test runner natif de Node, sans dépendance :

```bash
npm test                              # toute la suite
node --test tests/scene3d.test.mjs    # un seul fichier
```

- **Un fichier par module** : `tests/<module>.test.mjs`.
- **`tests/helpers/dom-stub.mjs`** importe le vrai `three` et bouchonne le DOM : les tests travaillent
  sur de la vraie géométrie Three.js. `render-stub.mjs` remplace le rendu, `source.mjs` lit le code
  source (commentaires retirés) pour les tests qui l'inspectent.
- L'**en-tête** de chaque fichier de test dit ce qu'il couvre et ce qu'il exclut ; le tenir à jour.

## Rendre le code testable : des fonctions pures

Toute **décision** (calcul, règle, validation) vit dans une fonction pure exportée, sans DOM ni
three ; l'écran ne fait que l'appeler et dessiner. C'est ce qui permet de la tester sous Node. Une
logique enfermée dans un écouteur d'événement ou une boucle de rendu ne se teste pas : l'extraire.

## Le test par mutation

Un test qui passe ne prouve rien. Après une correction :
1. casser volontairement le code corrigé, de plusieurs façons ;
2. vérifier que la suite tombe **à chaque fois** ;
3. si une mutation passe, le test est décoratif : le renforcer ou extraire la logique.

Deux précautions : vérifier que la mutation a bien été appliquée **au bon endroit** (une substitution
textuelle peut toucher une ligne identique ailleurs) ; et, quand une correction a plusieurs couches
(une cause et un filet), écrire **un test par couche**, sinon chacune masque la disparition de
l'autre.

## Les seuils se mesurent

Un seuil se choisit entre la valeur réelle mesurée et celle que produiraient les régressions
plausibles, et les trois chiffres s'écrivent dans le test :

```js
// Valeur réelle 0.0100 ; régressions plausibles 0.0147 et 0.0200 : seuil 0.012.
assert.ok(debord <= 0.012, …);
```

## Les tests d'invariants

`tests/scene3d.test.mjs` vérifie des **relations entre fonctions** : que le trou, le rig, la boîte de
rendu et la caméra désignent le même endroit, sur toute la plage des paramètres. Un test unitaire ne
voit jamais deux fonctions correctes qui ne parlent pas de la même chose.

## Les tests-gardes

Des tests qui ne visent pas un module, mais une règle du dépôt :

| Test | Ce qu'il garde |
|---|---|
| `tests/persisted-format.test.mjs` | Les noms et valeurs enregistrés (cf. [persisted-data.md](persisted-data.md)). |
| `tests/dom-ids.test.mjs` | Un `getElementById` vise un id réel d'`index.html`. |
| `tests/html.test.mjs`, `tests/style.test.mjs` | L'imbrication du HTML, les règles CSS qui interagissent. |
| `tests/design-system.test.mjs` | L'interface respecte le système de design. |
| `tests/modal-stack.test.mjs` | Chaque modale s'enregistre dans la pile (Échap, clic à l'extérieur). |
| `tests/code-mort.test.mjs` | Un export que personne n'appelle doit être justifié dans le fichier. |
| `tests/docs.test.mjs` | `docs/` : parité des langues, index, liens, renvois depuis le code. |
| `tests/electron-bridge.test.mjs` | Le pont Electron et sa déclaration de types concordent. |
| `tests/packaging.test.mjs` | Ce que l'application charge est dans l'installeur. |
| `tests/events.test.mjs` | Les chemins chauds passent par l'ordonnanceur. |

## L'analyse statique

```bash
npm i -D eslint     # une fois
npm run lint
```

ESLint couvre la grammaire (variable jamais lue ou non déclarée, clé dupliquée, code inatteignable).
Le hook le lance avant les tests, et le saute avec un message s'il n'est pas installé. Ce qui est
propre au projet (HTML, CSS, Markdown, règles métier) reste dans `tests/`.

## Ce qui est hors de portée

- **Ce qui construit un `THREE.WebGLRenderer`** : échoue sous Node (tout ce qui passe par
  `ensurePersonaScene3D()`, `renderPanelScene3D`, `panelDragRayOnPlane`…).
- **Le câblage des événements** : seule la logique extraite est testée.
- **L'allure d'un dessin** : un test vérifie qu'un chemin est fermé ou qu'une géométrie est la bonne,
  pas qu'un texte tient dans sa bulle. Quand la sortie est une image, **produire l'image et la
  regarder**.

## Pièges

- **Un seuil posé « au jugé »** donne un test qui ne mord pas, ou qui casse pour rien.
- **Une exclusion périmée dans un en-tête** fait croire à une couverture qui n'existe pas.
- **`git commit --no-verify`** saute les tests : seulement pour un commit de travail.
