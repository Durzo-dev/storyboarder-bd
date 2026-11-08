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
- **Not yet measured**: the full chain "model masks → our vectorised walls → editor rooms". That
  will be the first integration step.

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

## Left to decide (Valentin)

- Integrate the model along this architecture? The first step would be to **measure the full
  chain** on the bench before touching the import screen.
- Keep our rules as a fallback (model absent), or reserve them for old plans, where the model is
  weaker?

## Sources

- Floorplan Studio: [repository](https://github.com/ajayfjfj/floorplan-studio), [third-party notices](https://raw.githubusercontent.com/ajayfjfj/floorplan-studio/main/THIRD_PARTY_NOTICES.md).
- NVIDIA SegFormer-B0: [model card](https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512), [licence](https://github.com/NVlabs/SegFormer/blob/master/LICENSE).
- CubiCasa5K: [CC BY-NC 4.0 licence](https://github.com/CubiCasa/CubiCasa5k/blob/master/LICENSE), [Zenodo archive](https://zenodo.org/records/2613548).
- floorplan-to-3d: [model card](https://huggingface.co/Yytsi/floorplan-to-3d-walls).
- FloorPlanCAD: [site](https://floorplancad.github.io/); ResPlan: [Kaggle](https://www.kaggle.com/datasets/resplan/resplan).
- ONNX Runtime Web: [npm](https://npmjs.com/package/onnxruntime-web).
