# Tree species

The sheet of each tree species the application generates with EZ-Tree (`src/tree-species.js`). It says
what the tree must look like, from reference photos, and how it is obtained: the EZ-Tree preset to start from,
the settings, the bark and the drawn foliage.

**Rule: every new species has its sheet here, in both languages, BEFORE it is tuned.** A test checks it
(`tests/tree-species.test.mjs`): every species of `species.js` must have its section in this document and in
`docs/fr/tree-species.md`.

What each sheet holds:

- **Silhouette**: grown height in a town, crown width, shape (dome, column, umbrella…).
- **Trunk**: height under the branches, diameter, habit (straight, twisted), bark (look, colour).
- **Branches**: where they start, their angle, their density.
- **Leaves**: shape, size, arrangement on the twig, colours (upper and under side), evergreen or not.
- **In EZ-Tree**: the preset to start from, the settings that matter, the bark (Poly Haven, CC0), the foliage
  drawn (`species.js`).
- **References**: the photos (Wikimedia Commons) the tuning used.

## How the application uses them

EZ-Tree (Dan Greenheck, MIT) is copied into the application, in `src/vendor/ez-tree/`, adapted to its three r128
(no wind, no trellis, no textures of its own). `src/ez-trees.js` generates a species' variant once (3 variants a
species, `VARIANTS`) and every tree of that variant is a clone of it, set to its height.

When a Scene is created from a place (Detailed and Realistic levels), a tree whose genus is one of a species (OSM
tags, else drawn from the flora) is given that species (`essence`), a variant drawn from its place and, without a
measured height, the species' usual one (±15 %). It takes no model of the bank nor of the stores.

Barks are loaded after the first drawing (an image each, `assets/textures/ecorce-*.jpg`). ⚠️ A Panel's image is
cached by a signature of what it shows: `barkSettled(species)` enters it, so a Panel drawn before its trees' bark
arrived is drawn again once it has arrived (or is found missing). Without it, the first Panel kept branches drawn
from an empty texture: transparent, plain white over the page.

## EZ-Tree updates

`node tools/ez-tree/check-update.mjs` says whether a newer EZ-Tree is out. A new version is proposed to Durzo,
then, if accepted:

1. Copy its `src/lib/` changes into `src/vendor/ez-tree/ez-tree.js` (and `presets.js`), keeping the adaptations
   listed at the top of the file, and set `EZ_TREE_VERSION`.
2. Measure the fingerprints of its presets with the new version, in a browser, and update them in
   `tests/ez-tree.test.mjs`: the test checks the copy grows the very trees of EZ-Tree.
3. Look at our species again: a change of growth changes their silhouettes.

## Platane — London plane (*Platanus × hispanica*)

- **Silhouette**: 20 to 30 m in a town (often pruned lower), broad wide crown, nearly as wide as it is high.
- **Trunk**: tall and straight, 0.6 to 1.5 m across. Bark flaking off in plates: the typical mottling of
  grey-green, cream and beige.
- **Branches**: big limbs rising at a slant (40 to 50°), then spreading.
- **Leaves**: palmate, 3 to 5 pointed lobes, deep sinuses, a few teeth; 12 to 25 cm; alternate; mid green above,
  paler under. Deciduous.
- **In EZ-Tree**: from « Oak Large »; long trunk (60), angle 40, 8 branches, radius 3.4; dense foliage (size 8,
  12 a twig). Bark `bark_platanus` (the real one). Foliage `leafTwig` shape `plane`, greens `#4f8a3e` to
  `#5a9445`.
- **References**: Commons, « Fallen leaf of Platanus x hispanica (1).jpg », « Leafless London plane tree
  (Platanus × hispanica) », « Plane trees in Sóller being pruned ».

## Tilleul — Linden (*Tilia cordata*, *T. platyphyllos*)

- **Silhouette**: 15 to 25 m, oval dome-shaped crown, dense.
- **Trunk**: straight, 0.4 to 1 m. Grey-brown bark, fine regular lengthwise ridges.
- **Branches**: many, rising then arching outwards.
- **Leaves**: heart-shaped, uneven base, drawn-out tip, finely toothed edge; 5 to 10 cm; alternate; mid green.
  Deciduous.
- **In EZ-Tree**: from « Ash Large »; angles 50 and 45, upward push 0.025; foliage (size 5, 12). Bark
  `tree_bark_03` tinted grey (`#d8d4cc`). Foliage shape `linden`, greens `#4e8a35` to `#5c9a3f`.
- **References**: Commons, « 2020 year. Herbarium. Tilia cordata », « Tilia platyphyllos(01).jpg »,
  « Tilia cordata bark beentree.jpg ».

## Cypres — Italian cypress (*Cupressus sempervirens*)

- **Silhouette**: 15 to 25 m, narrow pointed « flame » column, 6 to 10 times as high as it is wide.
- **Trunk**: straight, little seen under the foliage. Grey-brown bark, fibrous, in strips.
- **Branches**: very many, close to the trunk, upright (15 to 20°).
- **Leaves**: neither leaves nor needles: **scales** of 1 mm, packed on flat twigs that branch in fans. Dark
  green, lighter tips. Evergreen.
- **In EZ-Tree**: from « Pine Medium »; long trunk (70), angle 16, short (13) and many (80) branches from the
  bottom, strong upward push (0.08). Bark `chinese_cedar_bark`. Foliage `cypressSpray`: sprays branching three
  times, covered with scales, greens `#2f4f27` to `#456d33`, tips `#7d9a44`.
- **References**: Commons, « Mediterranean Cypress (Cupressus sempervirens) foliage », « Tuscany - Cypress
  Trees (5698663059).jpg », « Cypress tree alley at sunset in Asciano, Tuscany ».

## Olivier — Olive (*Olea europaea*)

- **Silhouette**: 4 to 8 m, broad rounded crown, wider than high on old trees.
- **Trunk**: short (1 to 2 m under the branches), thick, twisted, often hollow or split. Grey bark, deeply
  furrowed.
- **Branches**: a few big twisted limbs, open (55 to 60°).
- **Leaves**: lance-shaped, narrow (1 cm by 4 to 8 cm), opposite pairs; dark grey-green above, silvery under.
  Evergreen.
- **In EZ-Tree**: from « Oak Small »; short (18) thick (3) trunk, branches from half-way up (start 0.5), gnarled
  (0.3 to 0.35) and twisted (0.5), angle 58; light foliage so the trunk shows (size 4.5, 16, start 0.3). Bark
  `bark_willow_02` tinted grey (`#cfcabd`). Foliage shape `olive` in pairs, `#55634a` to `#5f6d50`, under
  `#b3bba4`.
- **References**: Commons, « Olea europaea FruitsandLeaves 2009December13 DehesaBoyalPuertollano »,
  « Portuguese Olive Grove - Apr 2011.jpg », « Old olive tree (Olea europaea) ».

## Erable — Norway maple (*Acer platanoides*, and the town maples)

- **Silhouette**: 12 to 20 m, dense rounded to oval crown, often as wide as two thirds of its height.
- **Trunk**: straight, short under the crown (2 to 3 m), 0.4 to 0.8 m. Grey-brown bark, fine regular ridges.
- **Branches**: many, rising at 50 to 60°, the crown starting low.
- **Leaves**: palmate, five pointed lobes with a few large teeth, rounded sinuses; 10 to 18 cm; opposite; mid
  green; yellow to orange in autumn. Deciduous.
- **In EZ-Tree**: from « Ash Medium »; angle 55, 8 branches of 5, little gnarl (0.12), branches from 30 %; dense
  foliage (size 4.5, 18). Bark `trident_maple_bark` tinted grey (`#d6d0c6`). Foliage shape `maple`, opposite,
  `#4f8b3b` to `#5d9a44`.
- **References**: Commons, category « Acer platanoides » (habit, leaves, bark).

## Chene — Pedunculate oak (*Quercus robur*, *Q. petraea*)

- **Silhouette**: 20 to 30 m, broad irregular crown, wider than high when free-standing.
- **Trunk**: thick (0.8 to 1.5 m), short, often forked. Grey bark, deeply furrowed in long plates.
- **Branches**: big tortuous limbs, spreading nearly level (60 to 70°).
- **Leaves**: obovate, four or five rounded lobes a side, short stalk; 7 to 14 cm; alternate, clustered at the
  tips; dark green; brown in autumn, often held through winter. Deciduous.
- **In EZ-Tree**: from « Oak Large »; thick trunk (3.6), angle 65, gnarled branches (0.25), trunk 40; leaves size
  6, 14. Bark `jolcham_oak_bark_01`. Foliage shape `oak`, `#3f6f2f` to `#4a7a35`.
- **References**: Commons, categories « Quercus robur » (habit, leaves) and « Quercus robur (bark) ».

## Marronnier — Horse chestnut (*Aesculus hippocastanum*)

- **Silhouette**: 15 to 25 m, tall dense dome, the lower branches sweeping down then up at their tips.
- **Trunk**: straight, 0.6 to 1 m. Red-brown to grey bark, scaling in thin plates.
- **Branches**: strong, rising at 45°, then drooping.
- **Leaves**: palmately compound, five to seven obovate toothed leaflets from one point; 20 to 30 cm across;
  opposite; dark green; early brown in autumn. White flower candles in May. Deciduous.
- **In EZ-Tree**: from « Oak Large »; angle 45, branches weighed down (force −0.02), trunk 45; leaves size 7, 16.
  Bark `bark_brown_02` tinted (`#e0d8cc`). Foliage shape `chestnut` (seven leaflets), opposite, `#3f7a33` to
  `#4b8a3a`.
- **References**: Commons, category « Aesculus hippocastanum » (habit, leaves, flowers).

## Frene — Ash (*Fraxinus excelsior*)

- **Silhouette**: 20 to 30 m, tall, light and open crown, the sky showing through.
- **Trunk**: tall and straight, 0.5 to 1 m. Pale grey bark, smooth when young, then in a fine diamond mesh.
- **Branches**: ascending (30 to 40°), their tips upturned, from mid-height.
- **Leaves**: pinnate, 9 to 13 lance-shaped toothed leaflets; 20 to 35 cm; opposite; light green; falling green or
  pale yellow. Black buds. Deciduous.
- **In EZ-Tree**: from « Ash Large »; angle 35, branches from 45 %; light foliage (size 4, 8). Bark `bark_brown_01`
  tinted grey (`#cfcfc8`). Foliage: leaflets shape `lance` in opposite pairs, `#5a9445` to `#66a04d`.
- **References**: Commons, category « Fraxinus excelsior » (habit, leaves, bark).

## Cerisier — Cherry (*Prunus avium*, *P. serrulata*, and the plums)

- **Silhouette**: 6 to 12 m in a town, rounded to vase-shaped, open.
- **Trunk**: short, 0.2 to 0.5 m. Shiny red-brown bark with horizontal bands of lenticels, peeling in rings.
- **Branches**: few, ascending (40°), then spreading.
- **Leaves**: ovate, pointed tip, finely toothed; 6 to 15 cm; alternate; mid green; orange-red in autumn. White or
  pink blossom in spring (for #483). Deciduous.
- **In EZ-Tree**: from « Oak Small »; angle 40, branches 12; leaves size 4, 22 (2.2 left the crown bare). Bark `sakura_bark`. Foliage shape
  `ovate`, `#4c7f37` to `#578c3f`.
- **References**: Commons, categories « Prunus avium » and « Prunus serrulata » (habit, bark).

## Micocoulier — Hackberry (*Celtis australis*)

- **Silhouette**: 15 to 25 m, broad rounded crown, dense; the street tree of the South.
- **Trunk**: straight, 0.4 to 0.8 m. Smooth grey bark, like a beech's, all its life.
- **Branches**: many, rising at 45 to 55°, slender, a little drooping at their tips.
- **Leaves**: lance-shaped, the tip long drawn out, toothed, the base lopsided; 5 to 15 cm; alternate; dark
  green, rough above; pale yellow in autumn. Deciduous.
- **In EZ-Tree**: from « Ash Medium »; angle 50, 9 branches, little gnarl (0.15); leaves size 8, 22. Bark
  `chinese_hackberry_bark` (a hackberry's own) tinted grey (`#dcdad2`). Foliage shape `lance`, `#4d7a3c` to `#56853f`.
- **References**: Commons, category « Celtis australis » (habit, leaves, bark).

## Pin — Scots and maritime pine (*Pinus sylvestris*, *P. pinaster*)

- **Silhouette**: 20 to 35 m, a tall bare trunk under a high crown, irregular and flattened with age.
- **Trunk**: straight or a little bent, 0.4 to 1 m. Bark in deep plates, grey-brown below, orange-red high up
  (Scots pine).
- **Branches**: in whorls, nearly level (80 to 90°), only in the top third or two fifths.
- **Leaves**: needles in pairs, 4 to 7 cm (Scots, blue-green) or 10 to 25 cm (maritime, darker), in tufts at the
  twigs' ends. Evergreen.
- **In EZ-Tree**: from « Pine Large », but with branches of two levels (the preset is a spruce's cone): 14 branches
  from 60 %, level (88°), 34 long, hardly lifted (force 0.004), 5 twigs each; leaves size 4.5, 24. Bark
  `pine_bark`. Foliage `needleTuft` (needles in pairs, in tufts), `#3d5f2c` to `#52763c`.
- **References**: Commons, categories « Pinus sylvestris » and « Pinus pinaster » (habit, needles, bark).

## Peuplier — Black poplar (*Populus nigra*, its « Italica » column, and the hybrid poplars)

- **Silhouette**: 25 to 30 m, narrow: a column (Lombardy poplar) or a tall oval (the plantations' hybrids).
- **Trunk**: straight, tall, 0.5 to 1 m. Bark grey, deeply furrowed lengthwise.
- **Branches**: steeply ascending (20 to 30°), all along the trunk.
- **Leaves**: a triangle (deltoid), broad straight base, pointed tip, finely toothed, long flat stalk (they
  tremble); 5 to 10 cm; alternate; bright green; yellow in autumn. Deciduous.
- **In EZ-Tree**: from « Aspen Large »; angle 28, 14 branches 24 long; leaves size 6, 20. Bark `bark_willow` tinted
  grey (`#d4d4cc`). Foliage shape `delta`, `#5b8f42` to `#66994a`.
- **References**: Commons, categories « Populus nigra » and « Populus nigra 'Italica' » (habit, leaves).

## Robinier — Black locust (*Robinia pseudoacacia*)

- **Silhouette**: 12 to 25 m, light open crown, irregular, often leaning; in thickets on waste ground.
- **Trunk**: often forked, twisted, 0.3 to 0.8 m. Bark grey-brown, thick, in deep criss-crossed ridges.
- **Branches**: zigzag, thorny, rising at 50 to 60°.
- **Leaves**: pinnate, 9 to 19 small oval leaflets, rounded tip; 15 to 30 cm; alternate; light yellow-green; yellow
  in autumn. White scented flowers in hanging clusters in May. Deciduous.
- **In EZ-Tree**: from « Aspen Medium »; angle 55, gnarled (0.12 trunk, 0.25 branches), branches 12; leaves size
  6.5, 18. Bark `japanese_camphor_bark` (narrow ridges, deep fissures). Foliage: leaflets shape `ovate` in
  opposite pairs, `#6a9a4a` to `#76a653`.
- **References**: Commons, category « Robinia pseudoacacia » (habit, leaves, bark).

## Charme — Hornbeam (*Carpinus betulus*)

- **Silhouette**: 10 to 20 m, rounded to oval, dense; also clipped into hedges and arbours.
- **Trunk**: short, fluted (as if muscled), 0.3 to 0.6 m. Smooth grey bark, streaked paler.
- **Branches**: fine, numerous, rising at 40 to 50°.
- **Leaves**: ovate, pointed, doubly toothed, pleated along their parallel veins; 5 to 10 cm; alternate; mid green;
  yellow then brown, held through winter on hedges. Deciduous.
- **In EZ-Tree**: from « Oak Medium »; angle 45, 8 branches; leaves size 7, 20. Bark `chinese_hackberry_bark` tinted
  grey (`#c8c8c2`). Foliage shape `ovate`, `#4f8a3a` to `#5a9642`.
- **References**: Commons, category « Carpinus betulus » (habit, leaves, bark).

## Pommier — Apple and pear (*Malus domestica*, *Pyrus communis*, and the ornamental crabs and pears)

- **Silhouette**: 4 to 10 m (orchards: 3 to 6 m, pruned), a short trunk under a broad, low, rounded crown (the
  pear's narrower and higher).
- **Trunk**: short (1 to 2 m), 0.2 to 0.4 m. Bark grey-brown, flaking in small plates (apple) or in squares (pear).
- **Branches**: few, spreading (55°), tortuous, weighed down by the fruit.
- **Leaves**: ovate, finely toothed, the apple's downy and paler beneath; 5 to 10 cm; alternate; mid green.
  Blossom white or pink in April, fruit in autumn (for #485). Deciduous.
- **In EZ-Tree**: from « Oak Small »; angle 55, 6 branches, gnarled (0.3), a little weighed down (force −0.01);
  leaves size 4.2, 22. Bark `japanese_zelkova_bark` (flaky) tinted (`#d8d0c4`). Foliage shape `ovate`, `#557f3c`
  to `#5f8b44`, some leaves turned to their pale side (`#9db089`).
- **References**: Commons, categories « Malus domestica » and « Pyrus communis » (habit, leaves, bark).

## Bouleau — Silver birch (*Betula pendula*)

- **Silhouette**: 15 to 25 m, slender, narrow oval, light; the twigs hanging at the tips.
- **Trunk**: straight, thin (0.2 to 0.5 m). White bark, peeling in papery strips, black diamond-shaped marks; dark
  and cracked at the foot.
- **Branches**: ascending (30°), fine, the twigs weeping.
- **Leaves**: triangular-ovate, pointed, doubly toothed; 3 to 7 cm; alternate; light green; golden yellow in
  autumn. Deciduous.
- **In EZ-Tree**: from « Aspen Medium »; angle 32, hardly lifted (force 0.006); leaves size 3.6, 22. Bark
  `japanese_sycamore` (pale, mottled; no white birch bark on Poly Haven). Foliage shape `delta`, small, `#6c9c48`
  to `#78a852`.
- **References**: Commons, category « Betula pendula » (habit, leaves, bark).

## Hetre — Beech (*Fagus sylvatica*)

- **Silhouette**: 25 to 40 m in a forest (a tall clean trunk), a broad dome when free-standing, the branches down
  to the ground.
- **Trunk**: straight, 0.6 to 1.5 m. Smooth silver-grey bark all its life.
- **Branches**: strong, rising at 50 to 60°, the twigs in flat sprays.
- **Leaves**: oval, the edge wavy and fringed with hairs, 7 to 10 pairs of parallel veins; 5 to 10 cm; alternate;
  glossy bright green; copper in autumn. Deciduous.
- **In EZ-Tree**: from « Oak Large »; trunk 50, 3 thick; angle 55; leaves size 6.5, 18. Bark `bark_bluegum` (smooth)
  tinted grey (`#c8c8c0`). Foliage shape `ovate`, `#4d8a35` to `#58963e`.
- **References**: Commons, category « Fagus sylvatica » (habit, leaves, bark).

## Chataignier — Sweet chestnut (*Castanea sativa*)

- **Silhouette**: 20 to 30 m, a broad dome, massive; coppiced in many forests (several trunks from one stool).
- **Trunk**: thick (1 to 2 m), short. Bark grey-brown, in long ridges twisting round the trunk.
- **Branches**: big, spreading at 60°.
- **Leaves**: long and narrow (lance-shaped), a sharp tooth at the end of each of their many parallel veins; 10 to
  25 cm; alternate; glossy dark green; yellow-brown in autumn. Burrs in autumn (for #485). Deciduous.
- **In EZ-Tree**: from « Oak Large »; thick trunk (3.8), twisted (0.3), angle 60, gnarled (0.2); leaves size 6, 14.
  Bark `metasequoia_bark` (long furrows). Foliage shape `serrate`, `#4b8233` to `#56903b`.
- **References**: Commons, category « Castanea sativa » (habit, leaves, bark).

## Sapin — Silver fir and Norway spruce (*Abies alba*, *Picea abies*)

- **Silhouette**: 30 to 50 m, a narrow pointed cone, the branches down low; the fir's top flattened with age.
- **Trunk**: straight, 0.5 to 1.5 m, through to the top. Bark grey and smooth (fir) or red-brown in small scales
  (spruce).
- **Branches**: in whorls, level, the spruce's drooping then upturned at their tips.
- **Leaves**: short needles (1 to 3 cm), the fir's flat in two combs with two white lines beneath, the spruce's
  all round its twig; dark green. Evergreen.
- **In EZ-Tree**: from « Pine Medium » (its cone); leaves size 4. Bark `knotted_pine_bark` tinted grey (`#b8b4ac`).
  Foliage `firSpray` (a flat spray branching twice, needles combed on both sides), `#2c4a2a` to `#3c5f37`, some
  showing their pale side (`#5f7f5a`).
- **References**: Commons, categories « Abies alba » and « Picea abies » (habit, twigs, bark).
