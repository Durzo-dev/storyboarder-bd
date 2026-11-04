# Reading an architect's plan: sources, conventions by period, and what #456 takes from them

*[Version française](../fr/plan-sources.md)*

> Task #456, "create a building from a photo of an architect's plan". Before writing the tool,
> Valentin asked on 4 November 2026 for plan sources "from very old ones (several centuries for some
> manors or castles) to contemporary ones", and for each period's standards where they exist. This
> document is the result. It extends the "From plan photo to building" section of
> [building-research.md](building-research.md).

## Method, and how far to trust it

Desk research, 4 November 2026. Three sources were read **in full text**:

- Henri Gautier's treatise (1697), from its archive.org scan;
- the public preview of ISO 7519:1991;
- the 2008 *HABS Guidelines* (public domain).

The rest comes from library records, paper abstracts, essays by historians (Basile Baudez, Émilie
d'Orgeix) and project pages. The full AFNOR, DIN and ISO standards are paid and were not read.
**No plan has yet been run through a detector.** What follows says what plans show, not yet what
an algorithm gets from them. Anything not cross-checked is marked "(to verify)". Sources are at the
end.

## The gist in ten lines

1. **The cut wall is always the heaviest thing on a plan**, in every period. Depending on the case,
   it is a thick line, a black fill, a carmine or pink wash, a grey or hatching. So the detector
   must look for **mass** and **thickness**, not for a colour.
2. **The cut is at window-sill height** since about the 16th century (HABS: 4 feet, i.e. 1.22 m). A
   window therefore shows as a break in the wall, with thin lines.
3. **Doors on old plans often have no symbol**: an opening is a gap in the wall. The 90° arc is a
   modern convention, and ISO 7519 also allows a leaf at 30° without an arc.
4. **Scale is written six ways**: a graphic scale bar (in toises, feet or metres), a ratio ("1/100",
   "0,01 p. m.", "1/4" = 1'-0""), dimension lines, room areas (m²), dimensions written inside rooms
   (Palladio), or nothing at all.
5. **On a photo, a ratio alone is useless**, because the size of the photographed paper is unknown.
   Only a known length measured on the image gives the scale: the scale bar, a dimension, or the
   user's "this wall is 4 m".
6. **Old units are needed.** A toise is 6 pieds du roi, i.e. 1.949 m; a pied du roi is 32.48 cm. A
   17th-century château plan is graduated in toises.
7. **Old colours.** Military engineers put masonry in carmine and anything planned in yellow
   (gamboge). Civil architecture fills wall thickness with black (Gautier, 1697).
8. **Cast shadows** (at 45°, from the top left) and the line reinforced on the shadow side thicken
   only one side of the walls. They must not be taken for wall.
9. **Old plans are imprecise**, with lines that are not quite straight and symbols that are not
   standardised (the VERSPERA project's finding on the Versailles plans). This calls for tolerance
   and snapping to dominant angles.
10. **Research reaches the same conclusion as our imported pages.** Methods generalise poorly from
    one plan style to another (Pizarro et al. survey, 2022). Hence a modest detection, the scale
    given by the user, and **direct correction**.

## The periods

### Antiquity and Middle Ages: the footprint

**What survives.**
- **Vitruvius** calls the plan *ichnographia*, the building's footprint on the ground.
- **The Plan of Saint Gall** (c. 820–830) is the oldest surviving depiction of a medieval building
  complex. It covers five parchment sheets, about 112 × 77.5 cm, and shows some forty buildings. It
  was never built.
- **Villard de Honnecourt's album** (c. 1220–1235) contains church plans, laid out by geometric
  construction rather than at a declared scale.

**The conventions.**
- There is no scale bar.
- The plan is cut at ground level, so windows do not appear.
- Walls are drawn as double lines or as mass.
- Dimensions are rare. Proportions come from geometry, squares and ratios.

**For the tool.** These plans are mainly useful as robustness tests: stained parchment, irregular
lines, no scale. The scale will **always** be asked for.

### Renaissance (15th–16th centuries): the cut rises to the window, engraving fixes black and white

**The cut.** Early Renaissance plans were cut at ground level. It soon became clear that windows
did not show there. After the 15th century, European draughtsmen widely adopted a cut at
window-sill height (Baudez, *Shadowed plans*, 2026).

**Black and white.** Italian Renaissance drawings are mostly monochrome. Their conventions formed
under pressure from engraving: a printed line cannot be coloured (Baudez, 2017 lecture).

**Palladio, *I quattro libri dell'architettura* (1570).**
- These are woodcut plans with **dimensions written inside the rooms**, in Vicenza feet (about 14
  English inches, roughly 0.357 m; to verify). One reads for example "18" or "4 ½".
- The numbers also convey proportions.
- A recent reconstruction notes that these dimensions seem to include half the wall thickness.
- For the tool, this is a case where the scale comes from a dimension **inside** the room.

**Androuet du Cerceau, *Les plus excellents bastiments de France* (1576 and 1579).** Two volumes
of about 60 plates each: Louvre, Vincennes, Chambord, Blois, Anet… These are engraved château
plans with solid walls (to verify on the plates). Digitised copies are at the Morgan Library, the
Metropolitan Museum, the Royal Academy and CESR Tours.

### 17th–18th centuries in France: toises, washes and colour codes

This is the period of the châteaux and manors Valentin targets first. Conventions were set by
**military engineers**, then passed to architects.

**Henri Gautier, *L'art de dessiner proprement les plans…* (1697)** (read in full text):
- **Civil architecture**: "draw your lines in India ink, filling the thicknesses with black". This
  is already black poché.
- **Military plan**: walls are drawn "in carmine" and washed the same way. For a fortified place,
  the inner line is the strongest, and the space between is washed with a light carmine that fades
  towards the outer line.
- **Planned work**: a light layer of **gamboge** (yellow) over everything.
- **Turf**: lines in India ink, washed with light India ink.
- **Wood**: bistre mixed with a little vermilion.
- **Prints**: in engraving, lines are black, "it not being possible in a print to make them red".

**Nicolas Buchotte, *Les règles du dessein et du lavis* (1721–1722, reissued 1754).** The
engineers' "best-seller", spread across Europe until the 19th century. It helped standardise the
graphic codes of engineers and architects. Its content was not read here.

**The transfer to architects.** At the end of Louis XIV's reign, French architects adopted the
engineers' colour codes, mainly to inform. In the mid-18th century, a "colour revolution" extended
them to persuade juries and clients (Baudez, *Inessential Colors*, 2021). By the Revolution, cut
walls **washed in pink** are a "by-then-established" convention (Baudez, *Shadowed plans*).

**Shadows.**
- Cast shadows fall at 45°, **from the top-left corner**.
- In plans, they appear in 1758 (Cherpitel) and spread in the second half of the century.
- Delagardette (*Nouvelles règles pour la pratique du dessin et du lavis*, 1803) keeps them for
  steps, pedestals and basins, "never" for walls. Instead he recommends "coups de force": going
  over the shadow-side lines two or three times thicker. This is the forerunner of poché.

**Units.**

| Unit | Value | Note |
|---|---|---|
| toise (du Châtelet) | 6 pieds, i.e. 1.949 m | 54,000 / 27,706 m, about 1.949036 m |
| pied du roi | 12 pouces, i.e. 0.3248 m | |
| pouce | 12 lignes, i.e. 2.707 cm | |
| ligne | 2.256 mm | |

Scale bars read "échelle de 10 toises", "de 15 toises", "de 20 toises". For example, two Versailles
drawings from 1688 (Hardouin-Mansart, at the BnF) are at "a scale of 15 toises" and "a scale of 20
toises".

**Digitised holdings.**
- **Robert de Cotte collection** (BnF): plans and drawings of 430 buildings, fully digitised on
  Gallica. It includes, for example, the *château de Clagny, ground floor*.
- **Archives nationales, sub-series O1** (Bâtiments du roi): about 7,500 drawings.
- **VERSPERA project** (Versailles research centre, BnF, Archives nationales, ETIS lab): nearly
  9,000 plans digitised between 2013 and 2023, then modelled in 3D. Their finding matches #456
  exactly: **the lack of standardised symbols and imprecise lines** make automatic processing hard.
- **Jean Marot, *L'Architecture française***: engraved plans (Tuileries, Louvre…), on Wikimedia
  Commons after Gallica.
- **Versailles ground-floor plan** (1693–1695), BnF, ark `btv1b531283341`.

### 19th century: the metre, poché, the grid

**The metre.** The metric system became mandatory in France on 1 January 1840 (law of 4 July
1837). Plans then carry scales in metres. A common phrasing is "0,01 pour mètre", i.e. 1/100, and
"0,005 p. m." for 1/200.

**Durand, *Précis des leçons d'architecture* (1802–1805).**
- The plan becomes an abstract **horizontal section**.
- It is composed on a **grid**, with walls on axes.
- Before Durand, the plan was read as the imprint of the building's weight. After him, as a set of
  conventions (Emmons, quoted by Baudez).

**The Beaux-Arts.**
- **Poché** is the thickness of cut walls, blackened in India ink or washed.
- It is used for **presentation** drawings, not working drawings.
- The term was never formally defined by Beaux-Arts teaching (Guadet).

**Viollet-le-Duc.** His *Dictionnaire raisonné de l'architecture française* (1854–1868) holds many
plans of medieval castles, engraved with solid walls and a metric scale (to verify). They are in
the public domain and on Wikimedia Commons. They make good cases for **very thick** walls (over a
metre) with splayed embrasures, angled through the thickness.

**The cadastre.** The Napoleonic cadastre (law of 15 September 1807) is not an architect's plan,
but a user may photograph one.
- Its scales run from 1/5,000 to 1/500. The first Paris cadastre is at 1/2,000 per quarter.
- It shows only building footprints (hatching or cross-hatching, a flat yellow in the vector
  cadastre).
- There are no interior walls and no openings. At best the tool can extract an outline.

### 20th century: standards

**Reference handbooks.**
- *Architectural Graphic Standards* (Ramsey and Sleeper, 1932) in the United States.
- *Bauentwurfslehre* (Neufert, 1936) in Europe: 39 German editions, 17 languages.
- Both set a symbol vocabulary that office plans then reuse.

**National standards.**
- **France**: NF P 02-001 (1985), principles of representation for architectural and building
  drawings. NF P 02-005 (1986), dimensioning, now withdrawn.
- **Germany**: DIN 1356, *Bauzeichnungen*.
- Not read here, all paid.

**ISO 128 (lines).** The width series follows a √2 ratio: 0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1, 1.4
and 2 mm. Narrow, wide and extra-wide lines are in a 1:2:4 ratio.

**ISO 7519:1991**, construction drawings (public preview, read in full text):
- **Relative widths**: thin = 1, thick = 2, extra-thick = 4. A drawing uses two or three widths.
- **Parts in section** (walls): thick or extra-thick lines. Parts in view use thinner lines, in a
  1:2 ratio. Hatching or shading is allowed to tell sectioned parts apart.
- **Material patterns** (marble, parquet): normally **not** shown on the plan.
- **Doors and windows**: thin or thick lines. **A door's opening must be shown.** A side-hung door
  is drawn **leaf at 30° without an arc**, or **at 90° with an arc**. At 1:50 and larger, type,
  placement and threshold are shown. Sliding doors have their own symbol (leaf along the wall, with
  or without a recess).
- **Stairs**: thin line, an arrow on the centre line, with an **open circle at the bottom riser**
  and an **open arrowhead at the top**. The cut of a flight is an oblique zigzag line.
- **Ramps and sloping floors**: an arrow pointing down the slope, with the gradient.

**HABS**, the *Historic American Buildings Survey*, active since 1933. Its 2008 guidelines are in
the public domain (read in full text), and the drawings are at the Library of Congress.
- **Cut**: plans are measured at **about 4 feet** (1.22 m) above the floor. The cut height may jog
  to catch a window or a fireplace.
- **Walls**: cut masonry, concrete and adobe are **poché'd** with the material symbol. Rotating the
  pattern tells **construction periods** apart. Wood-frame and log walls have **no poché**.
- **Openings**: doors between rooms swing **90°**; cabinet doors and casement windows swing
  **45°**.
- **Stairs**: **one** break line, and an "UP" or "DOWN" arrow.
- **Lines**:
  - hidden or missing items are **dashed**;
  - items above the cut plane are **dot-dash**;
  - widths at 1/4" = 1'-0": 0.1 mm for joints, 0.2 to 0.4 mm for edges, **0.5 mm for cut parts**.
- **Scale**: usually **1/4" = 1'-0"** (1:48). **Two scale bars** are required, imperial and metric.
  A north arrow is on every plan.
- **Layout**: the **main entrance faces the bottom of the sheet**. Each room's name is written at
  its centre. Dimensions sit **outside** the drawing, with no strings across it. Black ink only, no
  grey fills.

**Works colours.** In France, on works drawings, the practice is "demolish in yellow, build in
red". It is common practice, not a standard (to verify). It is a distant echo of Gautier's yellow
for planned work.

### Today: CAD, planning applications, property listings

**Plan sources.**
- **CAD** (DWG, DXF, vector PDF): walls are often **hatches** or **solid fills** on a layer. A
  vector PDF already contains the segments. Reading that format would be more reliable than a
  photo, but it is a separate project.
- **Office and planning-application plans**: usually at 1:100 or 1:50. They are dimensioned and
  carry each room's area (m²).
- **Property-listing plans**: the most numerous online, and the most varied. CubiCasa5K
  distinguishes three styles (figures from a secondary summary, to verify):
  - polished architectural: 3,732 plans;
  - black-and-white CAD: 992 plans;
  - colourful or "hand-drawn": 276 plans.

**Common symbols**, from practice and the datasets, not standardised:
- **Window**: two or three thin parallel lines within the wall thickness.
- **Hinged door**: a quarter-circle arc, with the leaf open.
- **Sliding door**: a line along the wall.
- **Double door**: two arcs.
- **Stair**: treads in thin lines, an arrow.

**Typical sizes in France.** These help **guess** a scale, or check one.

| Item | Typical size |
|---|---|
| Interior door leaf | 63, 73, 83 or 93 cm (clear width about 3 cm less), height 204 cm |
| Double door | 126 to 186 cm |
| Partition | 5 to 7 cm (frames 68 to 88 mm) |
| Contemporary load-bearing wall | about 20 cm, plus lining |
| Old château or manor wall | often 0.6 to over 2 m (order of magnitude, to verify per plan) |

## What the research says

**The overview.** Pizarro et al., *Automatic floor plan analysis and recognition* (*Automation in
Construction*, 2022), reviews rule-based then learning-based methods from 1995 to 2021. Their
finding: most assume **one plan style** and generalise poorly. Comparisons are hard, for lack of a
shared metric and of public datasets.

**The methods.**
- **Raster-to-Vector** (Liu et al., ICCV 2017): a network finds **junctions** (wall corners, door
  ends). Integer programming then assembles them into walls, doors and icons. Its data (over 100,000
  plans) is not public; a subset of 815 Japanese plans circulates.
- **DeepFloorplan** (Zeng et al., ICCV 2019): a two-task network. It predicts **boundary** pixels
  (wall, door, window) and **room types**, with boundary-guided attention. The code is on GitHub.
- **CubiCasa5K** (Kalervo et al., 2019): 5,000 Finnish plans annotated as SVG polygons, over 80
  categories. Doors (about 20% of icons) and windows (about 18%) dominate. It reuses the
  Raster-to-Vector network. Data on Zenodo; read the licence before any use.

**Getting to real-world scale, in products.**
- **RoomSketcher and Homestyler**: one dimension given by the user.
- **MONA**: reads only printed dimensions, and refuses to estimate from pixels.
- **A patent** (US 10395147): the scale comes from the OCR-read area, divided by the room's area in
  pixels.
- **Another patent**: checks that wall lengths are consistent, to detect a plan that is "not to
  scale".
- **ThirdEye** claims ±1.5%, with no published method.

## What holds across periods, and what follows

| Finding | Periods | Consequence for the tool |
|---|---|---|
| The cut wall is the heaviest element: thick line, solid black, carmine or pink, hatching | all | Look for **thick ink mass**, with a distance transform (local thickness), not a fixed colour |
| The background is not white: yellowed paper, parchment, badly lit photo | old, photos | Estimate the paper colour (the most frequent one), and measure "ink" as distance from it; local adaptive threshold |
| Walls washed in colour (carmine, pink, grey) with no black line | 17th–19th c. | Detect a wall hue **automatically**: a saturated colour (carmine, pink) forming thick masses counts as ink. The eyedropper is a last resort only |
| Hatching (tight thin lines) instead of a solid fill | 19th–20th c., CAD | A morphological closing turns hatching into a mass before measuring thickness |
| Cast shadow below-right of walls, or line reinforced on the shadow side | 18th–19th c., Beaux-Arts | Ignore a lighter band stuck to a wall; do not take one edge's thickness for the wall's |
| Window = break in the wall with thin lines; opening = gap | all since the 15th c. | An **opening** is a gap between two aligned wall pieces; its content decides its kind |
| Door = 90° arc, 30° leaf without an arc, 45°, or nothing | modern / ISO / HABS / old | An **arc** near the gap makes a door (and gives its swing); with nothing, it is an **opening** |
| Thick walls with splayed embrasures | castles, manors | Do not require openings with parallel sides |
| Lines not straight, symbols not standardised | old (VERSPERA) | Tolerance; snap to **dominant angles** (orientation histogram) |
| Text, dimensions, furniture, title block, legend, scale, north arrow, trees | all | Keep only the **largest connected wall mass**; ignore the rest, or offer it to the user |
| Several periods or states on one plan (existing in black, planned in yellow) | 17th c., HABS, works plans | Later: choose which hue to keep, as a last resort |
| Photo taken at an angle | photos | Straighten by the **four corners**, like imported pages |

**Scale, by reliability.**

1. **The user** picks two points and gives a length. It is the only reliable way on a photo. It is
   always asked for, pre-filled with any guess.
2. **The plan's scale bar**, if the user points it out: the same two points.
3. **A printed dimension**: same gesture.
4. **An estimate**, offered but never imposed:
   - a median **door width** of about 0.83 m, for a contemporary plan;
   - an **interior wall** of about 7 to 10 cm, and an exterior wall of about 30 cm;
   - for an old plan, nothing reliable: the user must enter a length.
5. **Automatic reading of numbers (OCR)** is not offered in the first version. It is heavy, and
   handwritten or engraved numbers are poorly read.

**Units to offer in the entry:** metre, centimetre, toise, pied du roi, pouce (du roi), English foot
(0.3048 m) and English inch (2.54 cm). The Vicenza foot and other regional feet can wait until
asked for.

## Proposed flow (to approve before writing code)

It is the same pattern as imported pages ([planche-importee.md](planche-importee.md)): a **rough
detection**, then **direct correction**, with the same gestures. One plan corresponds to **one
level** (#454).

1. **Import** an image (any common image format) or a **PDF**, its page rendered as an image. **Straighten** by the four corners if the photo is at an angle.
2. **Normalise**: estimate the paper colour and compute "ink", including a coloured wall hue found
   **automatically**. Nothing is asked of the user at this step.
3. **Find the walls**:
   - adaptive thresholding;
   - closing over hatching;
   - a thickness map;
   - a wall is a stroke clearly thicker than the thin lines, which give the reference;
   - keep the largest connected mass.
4. **Vectorise**: skeleton, segments snapped to dominant angles, and one thickness per segment.
5. **Find the openings**:
   - locate gaps between two aligned wall pieces;
   - classify each gap: arc nearby → door (with its side); thin parallel lines → window;
     nothing → plain opening.
6. **Ask for the scale**: two points and a length, a unit to choose, and the estimate pre-filled.
7. **Correct** on the plan: move or add a wall, change an opening's kind, adjust a thickness.
8. **Build**: walls, openings and level go into the Building editor.

Steps 2 to 5 are **pure** (no DOM), like `planche-importee.js`; they can be tested under Node, on
synthetic images.

## A test corpus

It would serve to **measure** detection, not to ship with the app. Each image stays with its
source. Public-domain status is to be checked image by image.

| Style | Where to find it | Why |
|---|---|---|
| Medieval plan | Plan of Saint Gall (Stiftsbibliothek, e-codices); Villard de Honnecourt (BnF) | No scale, parchment |
| Engraved Renaissance | Du Cerceau (Met, Morgan, Wikimedia Commons); Palladio 1570 (sourcelibrary.org) | Solid walls; dimensions inside rooms |
| Classical château, wash | Robert de Cotte collection (Gallica): Clagny; Versailles 1693–1695 (Gallica); Marot (Commons) | Toises, carmine or black, shadows |
| Restored medieval castle | Viollet-le-Duc (Commons) | Very thick walls, embrasures |
| Historic building survey | HABS (Library of Congress, public domain) | Imperial and metric scales; poché or not by material |
| Cadastre | Paris cadastral plans 1809–1856 (data.gouv.fr); departmental archives | Outline only |
| Contemporary, listings | CubiCasa5K (Zenodo) | Three styles, SVG annotations |
| Contemporary, CAD | FloorPlanCAD (about 15,600 plans, 30 categories); CVC-FP (122 plans); MLSTRUCT-FP (954 plans) | Hatching, thin lines, large buildings |
| Valentin's plans | his own plans | The real case |

## Valentin's decisions (4 November 2026)

1. **Units** for the scale entry: the list above suits.
2. **Formats**: every common image format, and PDF, from the first version.
3. **As automatic as possible.** Any extra action for the user comes **as a last resort**. Coloured
   walls are therefore detected without an eyedropper; the eyedropper comes, if at all, only during
   correction, when detection has failed. Only the scale is always asked for (pre-filled with the
   estimate), since it cannot be read reliably from a photo.
4. **Corpus**: the one in this document, with no particular plan in mind.

## Sources

The full, linked source list is in the [French version](../fr/plan-sources.md#sources). The main
ones:

- Henri Gautier, *L'art de dessiner proprement les plans…*, 1697: [archive.org](https://archive.org/details/lartdedessinerpr00giff); [CESR note](https://architectura.univ-tours.fr/?p=13966).
- Basile Baudez, ["Shadowed plans"](https://drawingmatter.org/shadowed-plans/), *Drawing Matter*, 2026; ["Inessential Colors" lecture](https://bgc.bard.edu/research/articles/217/inessential-colors-a-history-of), 2017.
- [ISO 7519:1991 preview](https://cdn.standards.iteh.ai/samples/14288/4686cac1237f435c860a8389c9b871bf/ISO-7519-1991.pdf); [ISO 128-20 preview](https://cdn.standards.iteh.ai/samples/1408/b6ac8542838a49d69a08e98033748017/ISO-128-20-1996.pdf).
- [HABS Guidelines, Measured Drawings (2008)](https://www.nps.gov/subjects/heritagedocumentation/upload/HABS-Guidelines-Measured-Drawings_508.pdf).
- VERSPERA: [press release](https://www.chateauversailles-recherche.fr/IMG/pdf/cp_verspera.pdf), [CNRS](https://news.cnrs.fr/node/1155).
- Pizarro et al., [*Automatic floor plan analysis and recognition*](https://meshinglab.dcc.uchile.cl/publication/pizarro-2022104348/), 2022.
- [DeepFloorplan](https://github.com/zlzeng/DeepFloorplan); [CubiCasa5K](https://github.com/CubiCasa/CubiCasa5k); dataset comparison in [arXiv 2408.01526](https://arxiv.org/pdf/2408.01526).
- Toise and pied du roi: [techno-science.net](https://www.techno-science.net/fr/definitions/toise).
