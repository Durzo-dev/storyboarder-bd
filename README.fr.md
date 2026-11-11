<img src="assets/icone/storyboarder-bd-128.png" alt="Icône de Storyboarder BD" width="96">

# Storyboarder BD

> 🇬🇧 [English version](README.md)

**Version 1.17.2**

**Application de découpage de Bandes Dessinées** : outil de storyboard pour créer, organiser et visualiser des planches de BD avec rendu 3D des scènes.

> Application de bureau Windows, construite avec Electron + Three.js.

## ⬇️ Télécharger

[![Télécharger pour Windows](https://img.shields.io/badge/T%C3%A9l%C3%A9charger-Installeur_Windows-0078D6?style=for-the-badge&logo=windows)](https://github.com/Durzo-dev/storyboarder-bd/releases/latest/download/Storyboarder-BD-Setup.exe)

Lancez le fichier téléchargé et suivez les étapes, sans ligne de commande. L'application se met
ensuite à jour d'elle-même.

Versions précédentes et notes de version : [toutes les releases](https://github.com/Durzo-dev/storyboarder-bd/releases).

---

## ✨ Fonctionnalités

- 📖 **Storyboard** : Tomes, Chapitres, Planches et Cases, avec résumés, images de Case, planches importées et formats à vous
- 💬 **Bulles** : formes, pointes, textures, soixante-cinq polices et les vôtres, styles enregistrés, Bulles fusionnées
- 🎬 **Scènes 3D** : décors réutilisables avec Personnages, Animaux, mobilier, véhicules, lumière et ombres, chargés dans n'importe quelle Case, avec les mêmes gestes 3D partout
- ⛰️ **Éditeur de terrain** : relief, Zones, routes, murets et eau, façonnés en vue de dessus avec un aperçu 3D
- 🏠 **Éditeur de bâtiment** : murs, pièces, ouvertures, escaliers, niveaux et sous-sols, revêtements, mobilier, toits et cours
- 📦 **Modèles 3D** : import glTF, bibliothèque de modèles, modèles en ligne (Sketchfab avec votre compte, Poly Haven), en 1k, 2k ou d'origine, modèles articulés que l'on pose
- 🧩 **Textures** : un store (Poly Haven, ambientCG, vos dossiers) pour les sols, routes, murets et revêtements
- 📚 **Lecteur & export** : lire un Tome comme un livre, exporter les Planches en PNG ou PDF
- 💾 **Application** : Projets JSON lisibles, sauvegarde automatique, annulation, mises à jour intégrées, hors ligne, thèmes sombre et clair, manuel intégré

---

## 🧑‍💻 Développement

Pour utiliser l'application, le bouton [Télécharger](#️-télécharger) plus haut suffit. Ce qui suit
sert à la lancer depuis les sources ou à contribuer.

### Prérequis
- [Node.js LTS](https://nodejs.org) (v22 ou supérieur ; v20 est en fin de vie depuis avril 2026)

### Lancer en développement
```bash
git clone https://github.com/Durzo-dev/storyboarder-bd.git
cd storyboarder-bd
npm install
npm start
```

### Générer l'installeur Windows (.exe)
```bash
npm run dist
```
L'installeur apparaît dans le dossier `dist/`. Il crée des raccourcis Bureau et Menu Démarrer.
Les versions publiées sont construites par GitHub Actions, et l'application installée se met à jour
d'elle-même : voir [docs/fr/updates.md](docs/fr/updates.md).

### Contribuer

Mise en route, les trois règles qui font refuser une modification, et ce qu'on attend d'un test :
**[CONTRIBUTING.fr.md](.github/CONTRIBUTING.fr.md)**. Une étape compte plus que les autres :
`npm run setup-hooks`, que git ne peut pas transmettre au clonage.

### Lancer les tests unitaires
```bash
npm test
```
Le test runner natif de Node, sans framework ni navigateur. Ce qui est couvert et ce qui ne l'est
pas : [CONTRIBUTING.fr.md](.github/CONTRIBUTING.fr.md#tests).

---

## 🗂️ Structure du projet

```
storyboarder-bd/
├── electron/               # Processus principal Electron (CommonJS) : main.js, preload.js, fenêtre,
│   │                       # mises à jour, dossier des Projets, écran de blocage
│   └── bibliotheque/       # Store de modèles, vignettes et bibliothèque des modèles importés
├── src/                    # L'interface : index.html, style.css et les modules ES ; src/events.js
│                           # est le vrai point d'entrée
├── assets/                 # Polices et textures embarquées, avec leurs licences
├── build/                  # Personnalisation de l'installeur (NSIS)
├── tests/                  # Tests unitaires (test runner natif de Node)
├── tools/                  # Outillage : version, hooks git, notes de version, textures, attestation
├── docs/fr, docs/en/       # Notes de contributeur, un dossier par langue : commencer par docs/fr/README.md
└── package.json            # Config Electron + electron-builder
```

Chaque fichier s'ouvre sur un commentaire qui dit ce qu'il fait et pourquoi ; les notes de `docs/`
vont plus loin.

---

## 🛠️ Stack technique

| Technologie | Rôle |
|---|---|
| [Electron](https://www.electronjs.org/) | Application de bureau cross-platform |
| [Three.js r128](https://threejs.org/) | Rendu 3D des scènes |
| HTML / CSS / JS vanilla | Interface utilisateur complète |

Pas de framework front-end. Pas de bundler.

---

## ☕ Soutenir le projet

Si ce projet vous est utile et que vous souhaitez me remercier, un petit don est toujours apprécié !

[![Faire un don via PayPal](https://img.shields.io/badge/Faire_un_don-PayPal-0070ba?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.me/valentinP34)

---

## 📄 Licence

**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**

Vous pouvez librement utiliser, modifier et redistribuer ce projet, **à condition de** :
- Créditer l'auteur original
- Ne pas en faire un usage commercial
- Redistribuer les versions modifiées sous la même licence

🔗 [Lire la licence complète](https://creativecommons.org/licenses/by-nc-sa/4.0/)

**Exception : l'icône de l'application** (`assets/icone/`) fait partie de l'identité visuelle de Storyboarder BD et n'est **pas** couverte par cette licence : tous droits réservés.

---

## 👤 Auteur

**Durzo**, [@Durzo-dev](https://github.com/Durzo-dev)
