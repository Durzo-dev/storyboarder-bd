# Tree species

The sheet of each tree species the application generates with EZ-Tree (`tools/ez-tree/species.js`). It says
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
