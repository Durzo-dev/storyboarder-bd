# Plan-reading model / Modèle de lecture des plans (#456g)

`floorplan-segformer.onnx` (15,023,709 bytes) — SegFormer-B0 from **Floorplan Studio**
(https://github.com/ajayfjfj/floorplan-studio, project code MIT). Five classes per pixel: background,
room, wall, door, window. Used only by `src/plan-modele.js`.

## Licences of the weights — NON-COMMERCIAL / NON COMMERCIALES

- Trained on **CubiCasa5K** — Copyright 2019, CubiCasa5K authors, licensed under Creative Commons
  Attribution-NonCommercial 4.0 International (https://creativecommons.org/licenses/by-nc/4.0/).
  Source: https://github.com/CubiCasa/CubiCasa5k, https://zenodo.org/records/2613548.
  Kalervo, Ylioinas, Häikiö, Karhu, Kannala, *CubiCasa5K: A Dataset and an Improved Multi-Task Model
  for Floorplan Image Analysis* (2019).
- Fine-tuned from NVIDIA's **SegFormer** checkpoint
  (https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512): NVIDIA Source Code License for
  SegFormer, copy in `NVIDIA_LICENSE.txt` (section 3.3: non-commercial use, "for research or evaluation
  purposes only"). Xie et al., *SegFormer: Simple and Efficient Design for Semantic Segmentation with
  Transformers* (2021).

Storyboarder is not sold. Should that change, **remove the model**: see `docs/en/plan-modele.md`,
"Unplugging the model". The plan import then falls back to the hand-written rules by itself.

Storyboarder n'est pas vendu. Si cela changeait, **retirer le modèle** : voir `docs/fr/plan-modele.md`,
« Débrancher le modèle ». L'import de plan revient alors de lui-même aux règles écrites à la main.
