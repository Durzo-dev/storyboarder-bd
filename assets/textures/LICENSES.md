# Textures bundled with Storyboarder BD

Every texture in this folder is BAKED by `tools/bake-textures.mjs` from a set of PBR maps
(colour, height, OpenGL normal) downloaded from one of two banks. Both publish every asset
under **CC0 1.0 Universal**, effectively public domain: copying, modifying and redistributing,
including commercially and inside an application, require neither permission nor attribution.
We credit them anyway, because it costs nothing and lets anyone trace a texture back to its
origin, and because a licence that changed one day would then be checkable file by file.

- ambientCG: licence https://docs.ambientcg.com/license/
- Poly Haven: licence https://polyhaven.com/license

The source maps themselves are NOT in the repository nor in the installer
(`assets/textures/sources/`, ignored and excluded from packaging): only the baked files below
are distributed.

The tree barks (`ecorce-*.jpg`, #480g) are not baked: Poly Haven's colour map itself, brought to 512 px
JPEG by `tools/ez-tree/fetch-barks.cjs`, for the trees generated with EZ-Tree (`src/tree-species.js`).

⚠️ EVERY BAKED FILE MUST HAVE ITS ROW. `tests/texture-licences.test.mjs` fails on a file without
a row, and on a row without a file. Add the row when you bake a new texture.

| File | Used for | Source asset | Bank | Licence | Page |
| --- | --- | --- | --- | --- | --- |
| `barriere.couleur.png` | Trace: barrier | Metal055A | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Metal055A |
| `beton.png` | Ground: concrete | Concrete030 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Concrete030 |
| `bitume.png` | Ground: asphalt | Asphalt025C | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Asphalt025C |
| `carrelage.couleur.png` | Ground: tiles | interior_tiles | Poly Haven | CC0 1.0 | https://polyhaven.com/a/interior_tiles |
| `chemin.couleur.png` | Trace: dirt path | Ground079L | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Ground079L |
| `cloture.couleur.png` | Trace: fence | PaintedWood007C | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=PaintedWood007C |
| `gazon.png` | Ground: lawn | Grass008 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Grass008 |
| `glace.png` | Bubble: ice | Ice002 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Ice002 |
| `gravier.png` | Ground: gravel | Gravel023 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Gravel023 |
| `haie.png` | Trace: hedge | Grass003 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Grass003 |
| `herbe.png` | Ground: grass | Grass001 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Grass001 |
| `lave.couleur.png` | Bubble: lava | Lava004 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Lava004 |
| `marbre.couleur.png` | Ground: marble | Marble023 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Marble023 |
| `moquette.png` | Ground: carpet | Carpet012 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Carpet012 |
| `muret.couleur.png` | Trace: low wall | Bricks102 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Bricks102 |
| `neige.png` | Ground: snow | Snow005 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Snow005 |
| `nuit-etoile.png` | Bubble: starry night | NightSkyHDRI012 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=NightSkyHDRI012 |
| `papier-froisse.png` | Bubble: crumpled paper | Paper005 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Paper005 |
| `plancher.png` | Ground: floorboards | WoodFloor040 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=WoodFloor040 |
| `route.png` | Trace: road | Asphalt033 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Asphalt033 |
| `sable.couleur.png` | Ground: sand | Ground033 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Ground033 |
| `terre.couleur.png` | Ground: dirt | Ground103 | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=Ground103 |
| `toit-ardoise.couleur.png` | Roof: slate | grey_roof_tiles_02 | Poly Haven | CC0 1.0 | https://polyhaven.com/a/grey_roof_tiles_02 |
| `toit-tuiles-canal.png` | Roof: barrel tiles | RoofingTiles014A | ambientCG | CC0 1.0 | https://ambientcg.com/view?id=RoofingTiles014A |
| `toit-tuiles-plates.couleur.png` | Roof: old flat tiles | roof_09 | Poly Haven | CC0 1.0 | https://polyhaven.com/a/roof_09 |
| `ecorce-cerisier.jpg` | Tree bark: cherry | sakura_bark | Poly Haven | CC0 1.0 | https://polyhaven.com/a/sakura_bark |
| `ecorce-chene.jpg` | Tree bark: oak | jolcham_oak_bark_01 | Poly Haven | CC0 1.0 | https://polyhaven.com/a/jolcham_oak_bark_01 |
| `ecorce-erable.jpg` | Tree bark: maple | trident_maple_bark | Poly Haven | CC0 1.0 | https://polyhaven.com/a/trident_maple_bark |
| `ecorce-frene.jpg` | Tree bark: ash | bark_brown_01 | Poly Haven | CC0 1.0 | https://polyhaven.com/a/bark_brown_01 |
| `ecorce-marronnier.jpg` | Tree bark: horse chestnut | bark_brown_02 | Poly Haven | CC0 1.0 | https://polyhaven.com/a/bark_brown_02 |
| `ecorce-cypres.jpg` | Tree bark: cypress | chinese_cedar_bark | Poly Haven | CC0 1.0 | https://polyhaven.com/a/chinese_cedar_bark |
| `ecorce-olivier.jpg` | Tree bark: olive | bark_willow_02 | Poly Haven | CC0 1.0 | https://polyhaven.com/a/bark_willow_02 |
| `ecorce-platane.jpg` | Tree bark: plane | bark_platanus | Poly Haven | CC0 1.0 | https://polyhaven.com/a/bark_platanus |
| `ecorce-tilleul.jpg` | Tree bark: linden | tree_bark_03 | Poly Haven | CC0 1.0 | https://polyhaven.com/a/tree_bark_03 |
