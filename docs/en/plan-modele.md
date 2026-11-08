# A trained model to read plans: study (#456)

*[Version française](../fr/plan-modele.md)*

> Requested by Valentin on 8 November 2026, after scoring our rules on CubiCasa5K: hand-written rules
> had plateaued (doors and windows around 20%). The question: should we use a trained (machine
> learning) model, at what cost, under which licence? Valentin's constraint: Storyboarder is not
> meant to be sold, but the model must be **easy to unplug and remove** if that changed.

## In short

- **No need to train our own.** A ready-made trained model fits. It is *Floorplan Studio*: a
  SegFormer-B0 with 3.7 million parameters, trained on CubiCasa5K's **real images**, shipped as a
  15 MB ONNX file meant to run in a browser.
- **It does far better than our rules.** Measured on 60 plans from CubiCasa5K's official test split,
  which the model never saw:

| Measure | Our rules | The model |
|---|---|---|
| Walls, F1 (precision, recall) | 0.617 (0.70, 0.64) | **0.805** (0.90, 0.73) |
| Doors found / correct | 23.5% / 23.5% | **80% / 73%** |
| Windows found / correct | 19% / 16% | **73% / 77%** |
| Run time, CPU, one thread | about 1 s | **0.2 s** |

- **It holds on our plans**: house, offices (curved wall and slanted facade included), apartment
  block, colour listings, straightened photo. On old châteaux it is fair.
- **Licence**: the project code is MIT. The **weights** carry the **non-commercial** restrictions of
  CubiCasa5K (CC BY-NC 4.0) and of NVIDIA's starting model (SegFormer). That fits a Storyboarder that
  is not sold, provided everything can be removed: that is the architecture proposed below.
- **Cost** in the app: about 15 MB for the model, plus about 10 MB for the runtime (ONNX Runtime
  Web, MIT).

## What was examined

**Existing models**

| Project | What it is | Why yes or no |
|---|---|---|
| [Floorplan Studio](https://github.com/ajayfjfj/floorplan-studio) | SegFormer-B0, 5 classes (background, room, wall, door, window), ONNX, 15 MB | **Chosen.** Trained on real images, evaluated on 400 unseen plans, already built for the browser. |
| [floorplan-to-3d](https://huggingface.co/Yytsi/floorplan-to-3d-walls) | ResNet-34 U-Net, 98 MB, MIT | **Rejected.** Trained on the annotations RENDERED as images (walls already drawn), not on the images: its 0.98 score says nothing about real plans. |
| CubiCasa5K, DeepFloorplan, Raster-to-Vector | Research models (2017–2019) | Heavier, PyTorch or TensorFlow, no browser-ready export. |

**Datasets**, should we ever train our own. None is clearly usable commercially:
- CubiCasa5K: CC BY-NC 4.0;
- FloorPlanCAD: CC BY-NC 4.0;
- ResPlan: licence contradicts itself depending on the source;
- RPLAN, ZInD: not verified.

A "commercial" model would therefore mean annotating our own plans.

**Training in-house** is not realistic. My environment has no GPU, no PyTorch and no network. It is
not needed while the existing model is good enough.

## The measurements, and their limits

- **Bench**: `plans-test/banc/modele_noter.py`, with the same scoring as our rules
  (`cubicasa_noter.py`). The plans are drawn from the official test split, so the model is not
  scored on what it learned.
- **Image preparation**: reproduced exactly from the original page (`app.js`,
  `inference-worker.js`):
  - the image is scaled into a 512 px white square;
  - it is normalised (ImageNet mean and standard deviation);
  - the 128 × 128 output over 5 classes is scaled back to the image size.
- **Known limit**: CubiCasa5K is mostly Finnish plans. Hand drawings, very old scans and very
  different styles are outside its domain. The author says so, and our châteaux confirm it.
- **The full chain**, measured at integration time (see below).

## The integration (#456g, 8 November 2026)

Decided by Valentin: the model is integrated, and our rules remain the **fallback** when it is
absent.

**The full chain, measured.** The model reads the plan, then our steps take over: vectorisation,
joins, openings, editor rooms. The 60 plans of CubiCasa5K's test split were scored with
`plans-test/banc/modele_banc.sh test`, and the preparation and decoding are those of
`src/plan-modele.js` (`JS=1`).

| Measure | Rules | Model + our chain |
|---|---|---|
| Walls, F1 (precision, recall) | 0.617 | **0.875** (0.80, 0.97) |
| Doors found / correct | 23.5% / 23.5% | **80% / 79%** |
| Windows found / correct | 19% / 16% | **71% / 84%** |
| Closed rooms / annotated | — | 82% |

The vectorised walls beat the raw mask (0.805), because they run across the openings.

**Three choices, taken from the bench**:
- **walls are taken from "wall, door or window" together**. Openings sit inside the wall, so it stays
  continuous and rooms close. Each door or window mass is then placed on the wall it crosses
  (`ouverturesDesMasques`, in `src/plan-ouvertures.js`). A door's side and hinge are read from its arc
  in the ink, when one is drawn;
- **a door is kept as soon as the model gives it 30%**, even when the wall wins. On test plan no. 2
  this finds twice as many doors, and CubiCasa loses nothing (at 20%, precision fell to 76%);
- **a remaining gap is closed only up to 3 wall thicknesses**, against 12 with the rules. Openings
  are already in the mask, and a wider limit threw "walls" across corridors.

**The runtime**: ONNX Runtime Web 1.22.0 (MIT), WASM, one thread. Several threads would need
cross-origin isolation, which the window does not have. It runs in the page rather than in a
*Web Worker*, because a plan is read in under a second while the screen shows "Reading the plan…". A
*Worker* is still possible if that becomes a problem. The model and runtime load on the first read,
then stay in memory.

## Unplugging the model

If Storyboarder were ever sold, or if the licence became a concern:

1. delete the `assets/modeles/plans/` folder;
2. `npm uninstall onnxruntime-web`, then remove its three `node_modules/onnxruntime-web/…` lines from
   `build.files` in `package.json`;
3. delete `src/plan-modele.js` and `tests/plan-modele.test.mjs`.

The plan import falls back to the rules by itself. `ouverturesDesMasques` (`src/plan-ouvertures.js`)
can stay: it only knows masks, whatever produced them, and would serve a model of our own. The
weights remain in the git history; only a history rewrite would remove them.

**What the licence says, exactly.** NVIDIA's licence (section 3.3) restricts use to
"non-commercial", which it defines as **"for research or evaluation purposes only"**. That is
narrower than "not sold". CubiCasa5K (CC BY-NC 4.0) only forbids commercial use. It is for Valentin to
judge whether his use of Storyboarder fits. This is not legal advice.

## Proposed architecture: an unpluggable model

The principle: **the model is a plug-in**. Without it, import works with our rules, as today.
Removing it means deleting one folder and one dependency.

1. **Only one module knows about it: `src/plan-modele.js`.** It loads the runtime and the model, and
   returns masks (walls, doors, windows, rooms), or `null` when they are absent. It is loaded through
   a **dynamic import**: its absence breaks nothing.
2. **The model lives apart**: `assets/modeles/plans/`, with the ONNX file, `NVIDIA_LICENSE.txt` and a
   CubiCasa5K notice. That folder is in electron-builder's list of bundled files.
3. **The runtime**: ONNX Runtime Web (MIT), run in a *Web Worker* so the interface does not freeze.
   It needs no native binary and no GPU.
4. **The chain**:
   - when the model is present, its wall mask replaces our rules' mask;
   - its doors and windows become the openings;
   - our later steps stay: vectorisation, joins, scale, photo straightening;
   - otherwise, the rules apply.
5. **A test guards the exit**: no other file imports `onnxruntime-web` or reads `assets/modeles/`.
6. **To unplug**:
   - delete `assets/modeles/plans/`;
   - remove the dependency;
   - delete `src/plan-modele.js`.

   The app falls back to the rules by itself. The procedure will be written down in the docs,
   together with the licence reminder.

## Detailed comparison, by plan style (added 8 November 2026)

**Modern plans, measured**: 60 plans from CubiCasa5K's test split. For doors and windows, the first
figure is the share found, the second the share correct.

| Style | Walls (F1) | Doors | Windows |
|---|---|---|---|
| Architect plans, 41 plans | rules 0.55 · **model 0.78** | rules 21% / 22% · **model 78% / 72%** | rules 14% / 12% · **model 70% / 78%** |
| Black-and-white CAD, 11 plans | rules 0.80 · **model 0.88** | rules 32% / 25% · **model 89% / 76%** | rules 51% / 28% · **model 91% / 87%** |
| Colour listings, 8 plans | rules 0.70 · **model 0.81** | rules 26% / 30% · **model 82% / 73%** | rules 19% / 27% · **model 75% / 66%** |

**Old and hand-drawn plans, judged by eye** (no annotations exist).

| Plan | Walls | Doors and windows |
|---|---|---|
| Tanlay (black poché) | rules: some; **model: nearly all** | model: a few windows |
| Pau (wash) | both fair, the model cleaner | few, on both sides |
| Pierrefonds (Viollet-le-Duc) | both fair, towers included | few, on both sides |
| Coloured Versailles | both struggle under the colour fills | weak on both sides |
| 1875 apartment (control) | rules: fair; **model: very good** | **model: windows and doors right** |
| Clagny, wash (control) | rules: almost nothing; **model: most** | weak |
| U-shaped house, by hand | rules: a fragment; **model: most** | model: some |
| Griswold, by hand (control) | rules: fragments; **model: good** | **model: most** |

The model's recurring flaw: it takes **courtyards** and the nearby outside for rooms. That does not
affect walls, and our own room deduction (from the walls) does not depend on it.

## Other models, and their licences (added 8 November 2026)

No floor-plan model is both **more permissive** and **usable**:
- nearly all are trained on CubiCasa5K, so their weights are non-commercial whatever their code
  licence: [floorplan-detection](https://github.com/xmarva/floorplan-detection), FloorPlanAnalyzer,
  DeepFloorplan;
- the [IIIT Bangalore Roboflow model](https://universe.roboflow.com/iiitbangalore/floor-plan-segmentation-dtr4r)
  is MIT, but learned from only 148 images: too few;
- general Apache 2.0 detectors (RF-DETR) know nothing about plans: they would need training.

Floorplan Studio remains the best available choice.

## Training our own model: estimate (added 8 November 2026)

**Free data exists, but as VECTORS, not images**:
- **MSD**, *Modified Swiss Dwellings*: 5,300 Swiss plans, CC BY 4.0 ([4TU](https://data.4tu.nl/export/cff/datasets/e1d89cb5-6872-48fc-be63-aadd687ee6f9), [paper](https://arxiv.org/abs/2407.10121v3));
- **ResPlan**: 17,000 South Asian listing plans, data CC BY 4.0 and code MIT ([repository](https://github.com/m-agour/ResPlan));
- a few **small real-image sets** under CC BY 4.0 on Roboflow Universe, a few hundred images each
  (to check one by one).

The method would therefore be to **draw the images ourselves** from these vector plans, in every
style we want to recognise:
- black poché, double line, hatching, pink wash;
- furniture, dimensions and text as noise;
- skewed photo, yellowed scan.

The annotations are then perfect by construction. We add the small real sets, and measure on our
bench (CubiCasa test, plus our plans). The starting network must be free too: for example a
torchvision ResNet U-Net (BSD), not NVIDIA's SegFormer.

**Time**:

| Step | On my side | On your side |
|---|---|---|
| Get and understand MSD and ResPlan | 1 to 2 h | download (a few GB) |
| The synthetic plan "drawer", in several styles | 4 to 8 h | — |
| Training | prepare the script | **a GPU**: yours if you have one, otherwise free Google Colab; 3 to 6 h of compute per run, 2 or 3 runs |
| Measure, fix, repeat | 2 to 4 h | — |
| ONNX export and integration | as for the existing model | — |

**In total, count 3 to 5 work sessions**, plus 10 to 20 h of GPU compute.

The main risk: synthetic images that are too "clean" make a model weaker on real scans. We measure
it, and fix it by dirtying the synthetic images more.

## Decided (Valentin)

- The model is integrated along this architecture (#456g, see "The integration").
- The rules remain the fallback when the model is absent.

## Sources

- Floorplan Studio: [repository](https://github.com/ajayfjfj/floorplan-studio), [third-party notices](https://raw.githubusercontent.com/ajayfjfj/floorplan-studio/main/THIRD_PARTY_NOTICES.md).
- NVIDIA SegFormer-B0: [model card](https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512), [licence](https://github.com/NVlabs/SegFormer/blob/master/LICENSE).
- CubiCasa5K: [CC BY-NC 4.0 licence](https://github.com/CubiCasa/CubiCasa5k/blob/master/LICENSE), [Zenodo archive](https://zenodo.org/records/2613548).
- floorplan-to-3d: [model card](https://huggingface.co/Yytsi/floorplan-to-3d-walls).
- FloorPlanCAD: [site](https://floorplancad.github.io/); ResPlan: [Kaggle](https://www.kaggle.com/datasets/resplan/resplan).
- ONNX Runtime Web: [npm](https://npmjs.com/package/onnxruntime-web).
