# Versionnage et publication

*[English version](../en/versioning.md)*

Format `major.minor.correctif`, affiché à côté du nom de l'application, en haut à gauche.

## Les trois niveaux

| Niveau | Quand | Comment |
|---|---|---|
| **major** | Sur demande explicite | `npm run bump major` |
| **minor** | À la validation d'une fonctionnalité | `npm run bump minor` |
| **correctif** | À chaque commit | Automatique (hook `pre-commit`) |

Passer une mineure remet le correctif à 0 ; passer une majeure remet les deux à 0.

## Les quatre fichiers qui portent la version

`package.json` fait foi (electron-builder en tamponne l'installeur). `tools/bump-version.mjs` en
dérive :
- `src/version.js`, importé par le renderer pour l'affichage (cf. [architecture.md](architecture.md)) ;
- la ligne `**Version x.y.z**` de `README.md` et `README.fr.md`.

`tests/version.test.mjs` interdit à ces quatre fichiers de diverger.

## Ce qui se passe à chaque commit

```
git commit
   │
   ├─ fusion / rebase / cherry-pick ?  →  rien n'est touché
   ├─ node absent du PATH ?  →  commit annulé, message explicite
   ├─ ESLint (sauté avec un message s'il n'est pas installé)
   │     └─ erreurs  →  commit annulé, aucun fichier modifié
   ├─ régénération de docs/design-system.html (système de design)
   ├─ suite de tests
   │     └─ échec  →  commit annulé, aucun fichier modifié
   ├─ incrément du correctif, les 4 fichiers ensemble
   │     ├─ version déjà changée à la main  →  pas de second incrément
   │     └─ un fichier invalide  →  aucune écriture
   ├─ les 4 fichiers rejoignent le commit
   └─ post-commit : mineure ou majeure ?  →  tag `vX.Y.Z` + rappel `--follow-tags`
```

Trois ordres comptent :
- **les tests avant l'incrément** : un échec ne laisse pas de version montée sans commit ;
- **dans le script, toutes les vérifications avant toutes les écritures** : un README invalide ne
  laisse pas `package.json` incrémenté seul ;
- **le tag dans `post-commit`** : au `pre-commit`, le commit qui porte la version n'existe pas encore.

## Commandes

```bash
npm i -D eslint          # active l'étape de lint du hook
npm run setup-hooks      # après un clone : installe les hooks (git ne versionne pas .git/hooks)
npm run bump sync        # régénère les fichiers dérivés depuis package.json
npm run bump minor       # ou major ; jamais correctif, le hook s'en charge
git push --follow-tags   # git push seul n'envoie pas les tags
```

`git commit --no-verify` saute tests et incrément, pour un commit de travail. Le `post-commit` tourne
quand même : un tag est posé si la version a changé.

## Limites connues

- **`git commit --amend` réincrémente** : un hook `pre-commit` ne peut pas distinguer un amend de façon
  fiable sous Windows. Amender avec `git commit --amend --no-verify`.
- **Les tags ne partent pas seuls** : `git push --follow-tags`, que le `post-commit` rappelle à
  l'écran à chaque tag posé.

## Intégration continue

`.github/workflows/ci.yml` lance le lint et les tests sur Linux, à chaque push et pull request, sur
les deux lignes LTS de Node. Elle couvre ce que le hook local ne voit pas : un clone sans hooks, un
autre système, `npm ci` (qui échoue si `package-lock.json` diverge de `package.json`, donc sur une
dépendance non déclarée), et les commits faits en `--no-verify`.

Volontairement absents : la vérification de types (cf. [architecture.md](architecture.md)) et la
construction de l'installeur.

`tests/ci-setup.test.mjs` vérifie que la CI lance les deux contrôles, utilise `npm ci`, et que les
versions de Node testées concordent avec `engines` de `package.json` et avec les README.

## Les notes de version

Sur tout tag `v*`, `.github/workflows/release.yml` publie la release GitHub avec, par ordre de
préférence :
1. la section de `CHANGELOG.md` titrée exactement `## <tag>` (un test exige ce format), qui sépare
   « ce qui change pour vous » de « sous le capot » ;
2. à défaut, la liste des sujets de commit depuis le tag précédent.

Avec une section rédigée, la liste des sujets suit dans un bloc `<details>` replié. Les deux formes
portent un lien de comparaison. Seules les mineures et majeures sont taguées, donc publiées.

La mise en forme vit dans `tools/release-notes.mjs`, une fonction pure testée à chaque commit, et non
dans le YAML. Les corps de messages ne sont jamais publiés.

## L'installeur embarque une liste blanche

`build.files`, dans `package.json`, est **exclusive** : un fichier qui n'y figure pas n'atteint pas
l'application installée, alors que tout marche en développement. **Ajouter un fichier chargé à
l'exécution, c'est aussi l'ajouter ici.** `tests/packaging.test.mjs` vérifie que tout asset local
référencé par `index.html` est couvert, et que tout motif vise un fichier existant.

## Pièges

- **`fetch-depth: 0` sur le checkout de `release.yml`** : sans lui, `git describe` ne voit aucun tag
  antérieur et chaque release s'annonce comme la première (un test le garde).
- **Ne pas laisser de section « À paraître » dans `CHANGELOG.md` au moment de taguer** : elle n'est
  pas reprise ; seule `## vX.Y.Z` l'est.
