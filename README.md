<img src="assets/icone/storyboarder-bd-128.png" alt="Storyboarder BD icon" width="96">

# Storyboarder BD

> 🇫🇷 [Version française](README.fr.md)

**Version 1.17.48**

**Comic book storyboarding application**: a desktop tool to create, organize and visualize comic book pages with real-time 3D scene rendering.

> Standalone Windows desktop app built with Electron + Three.js.

## ⬇️ Download

[![Download for Windows](https://img.shields.io/badge/Download-Windows_installer-0078D6?style=for-the-badge&logo=windows)](https://github.com/Durzo-dev/storyboarder-bd/releases/latest/download/Storyboarder-BD-Setup.exe)

Run the downloaded file and follow the steps; no command line needed. The application then updates
itself.

Previous versions and release notes: [all releases](https://github.com/Durzo-dev/storyboarder-bd/releases).

---

## ✨ Features

- 📖 **Storyboard**: volumes, chapters, pages and panels, with summaries, panel images, imported pages and your own formats
- 💬 **Speech bubbles**: shapes, tails, textures, sixty-five fonts plus your own, saved styles, merged bubbles
- 🎬 **3D scenes**: reusable settings with characters, animals, furniture, vehicles, light and shadows, loaded into any panel, with the same 3D gestures everywhere
- ⛰️ **Terrain editor**: relief, zones, roads, walls and water, shaped from above with a 3D preview
- 🏠 **Building editor**: walls, rooms, openings, stairs, levels and basements, finishes, furniture, roofs and courtyards
- 📦 **3D models**: glTF import, a model library, online models (Sketchfab with your account, Poly Haven), at 1k, 2k or original size, articulated models you can pose
- 🧩 **Textures**: a store (Poly Haven, ambientCG, your folders) for grounds, roads, walls and finishes
- 📚 **Reader & export**: read a volume like a book, export pages as PNG or PDF
- 💾 **Application**: readable JSON projects, auto-save, undo, built-in updates, offline use, dark and light themes, built-in manual

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

**Durzo**, [@Durzo-dev](https://github.com/Durzo-dev)
