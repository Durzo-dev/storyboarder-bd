<img src="assets/icone/storyboarder-bd-128.png" alt="Storyboarder BD icon" width="96">

# Storyboarder BD

> 🇫🇷 [Version française](README.fr.md)

**Version 1.13.4**

**Comic book storyboarding application**: a desktop tool to create, organize and visualize comic book pages with real-time 3D scene rendering.

> Standalone Windows desktop app built with Electron + Three.js.

## ⬇️ Download

[![Download for Windows](https://img.shields.io/badge/Download-Windows_installer-0078D6?style=for-the-badge&logo=windows)](https://github.com/Durzo-dev/storyboarder-bd/releases/latest/download/Storyboarder-BD-Setup.exe)

Run the downloaded file and follow the steps; no command line needed. The application then updates
itself.

Previous versions and release notes: [all releases](https://github.com/Durzo-dev/storyboarder-bd/releases).

---

## ✨ Features

### Storyboard
- 📖 **Volume → Chapter → Page → Panel** organization (optional chapters) with automatic numbering, duplication and drag-and-drop reordering
- 📝 Per-panel summaries and descriptions
- 💬 **Speech bubbles**: eight shapes, five tails, photographed textures, sixty-five fonts sorted by use plus your own, from a file or an online store, bold and italic, saved styles, and merging two bubbles into one
- 🖼️ **Panel images** (PNG, JPG, WebP), with adjustable framing and zoom
- 📥 **Import a page** already drawn: its panels are detected, then corrected right on the page
- 📐 **Volume formats** of your own per project, in mm or px, renamable
- 🎨 Page background colour, adjustable panel and bubble borders

### 3D scenes
- 🎬 **Reusable scenes**: compose a 3D setting once, load it into any panel
- 🎥 **Free camera** in every panel, and a top-down view for placing elements
- 👤 **Ready-made elements**: characters with poses and emotions, animals, furniture, vehicles, vegetation, buildings, roads and walls, photographed grounds you can tint
- ☀️ **Light**: Day, Night or Custom mode with a computed sky, placed light sources, cast shadows

### Building editor
- 🏠 **Build from above**: snapping walls, detected rooms, doors, windows, bay windows and passages, straight, L- or U-shaped stairs, several levels
- 🧱 **Finishes**: facade, walls, floors and ceilings in textures and colours, room by room
- 🪑 **Furniture**: your models placed in the rooms, snapped to the walls, orientable
- 🏡 **Roofs**: automatic per level, flat (parapet, railing), single pitch, gable or hip, even on L, T or U shapes; tiles, barrel tiles or slate; a chimney on top
- ⛲ **Courtyards**: a room becomes a courtyard open to the sky, which goes up through the floors; a terrace above a room
- 📍 **In scenes**: the building is placed as a copy; a character or an object is set in a room from its sheet; each panel can cut it at a level or hide walls, ceilings and floors

### Textures
- 🧩 **Texture store**: Poly Haven and ambientCG, your texture folders, and "My textures" for the ground, roads, low walls and building finishes

### Imported 3D models
- 📦 **glTF import** (`.glb` / `.gltf`) at real size, into a panel or a scene
- 🗂️ **Model library**: your models as thumbnails, with search, categories, tags and where each one is used
- 🔎 **Online models**: search Sketchfab and Poly Haven with a 3D preview; one-click download from Poly Haven, credits added to exports
- 🦴 **Articulated models**: morphology and bone mapping proposed on import, correctable and reusable

### Model editor
- 🎯 **Pose any figure** (character, animal or articulated model) by dragging a joint or with exact sliders, picking the figure among your models
- 📚 **Pose library** shared across every project, filed by archetype

### Project & application
- 💾 Readable **JSON** projects in **Documents\Storyboarder BD\Projets**, auto-save, undo over 50 actions
- 📖 **Reader**: read a volume or a chapter straight through, one or two pages, to the right or to the left, in book view (pages that turn), with automatic scrolling or panel by panel, full screen
- 🖼️ Export pages as **PNG** or **PDF**
- ⬆️ **Built-in updates**, and **works offline** for up to 14 days
- 🌗 **Dark and light themes**, increased contrast, four interface sizes, adjustable 3D gesture speeds
- ❓ **Built-in user manual**, grouped by topic, with keyword search

---

## 🧑‍💻 Development

To use the application, the [Download](#️-download) button above is all you need. What follows
is for running it from source or contributing.

### Prerequisites
- [Node.js LTS](https://nodejs.org) (v22 or higher; v20 reached end of life in April 2026)

### Run in development
```bash
git clone https://github.com/Durzo-dev/storyboarder-bd.git
cd storyboarder-bd
npm install
npm start
```

### Build the Windows installer (.exe)
```bash
npm run dist
```
The installer appears in the `dist/` folder and creates Desktop and Start Menu shortcuts automatically.
Published versions are built by GitHub Actions instead, and the installed application updates itself:
see [docs/en/updates.md](docs/en/updates.md).

### Contributing

Setup, the three rules that will get a change rejected, and what is expected of a test:
**[CONTRIBUTING.md](.github/CONTRIBUTING.md)**. One step matters more than the rest: `npm run setup-hooks`,
which git cannot carry over on clone.

### Run the unit tests
```bash
npm test
```
Node's built-in test runner, no framework, no browser. What is covered and what is not:
[CONTRIBUTING.md](.github/CONTRIBUTING.md#tests).

---

## 🗂️ Project structure

```
storyboarder-bd/
├── electron/               # Electron main process (CommonJS): main.js, preload.js, window,
│   │                       # updates, Projects folder, blocking screen
│   └── bibliotheque/       # Model store, thumbnails and the imported-model library
├── src/                    # The interface: index.html, style.css and the ES modules;
│                           # src/events.js is the real entry point
├── assets/                 # Bundled fonts and textures, with their licences
├── build/                  # Installer customisation (NSIS)
├── tests/                  # Unit tests (Node's built-in test runner)
├── tools/                  # Repo tooling: version, git hooks, release notes, textures, attestation
├── docs/en, docs/fr/       # Contributor notes, one folder per language: start with docs/en/README.md
└── package.json            # Electron + electron-builder config
```

Each file opens with a header comment saying what it does and why; the notes in `docs/` go further.

---

## 🛠️ Tech stack

| Technology | Role |
|---|---|
| [Electron](https://www.electronjs.org/) | Cross-platform desktop app |
| [Three.js r128](https://threejs.org/) | 3D scene rendering |
| Vanilla HTML / CSS / JS | Full UI, no framework, no bundler |

---

## ☕ Support

If you enjoy this project and want to say thanks, a small donation is always appreciated!

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-0070ba?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.me/valentinP34)

---

## 📄 License

**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**

You are free to use, modify and redistribute this project, provided you:
- Credit the original author
- Do not use it for commercial purposes
- Distribute modified versions under the same license

🔗 [Read the full license](https://creativecommons.org/licenses/by-nc-sa/4.0/)

**Exception: the application icon** (`assets/icone/`) is part of the visual identity of Storyboarder BD and is **not** covered by this license: all rights reserved.

---

## 👤 Author

**Valentin**, [@Durzo-dev](https://github.com/Durzo-dev)
