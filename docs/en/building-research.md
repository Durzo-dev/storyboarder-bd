# Building construction: what games and architecture software do

*[Version française](../fr/building-research.md)*

> Task #455, requested by Valentin on 13 October 2026: "an exhaustive analysis of architect
> software and house-building games (the Sims included), to draw features and recommendations from
> them". It prepares #454 (floors and basements) and #456 (a building from a photo of a floor plan),
> and it deliberately comes before #454: levels touch the format saved in Projects (see
> [persisted-data.md](persisted-data.md)), and now is the time to choose it well.

## Method, and what it is worth

Desk research, done on 13 October 2026: official help (Autodesk, Graphisoft, Planner 5D, Space
Designer 3D, Blender), patch notes, publisher forums (Sweet Home 3D, Graphisoft, EA), player wikis
and specialist articles. **No software was tried**: this document reports what their users and
publishers write about them. Player wikis are sometimes approximate, and games change from one
update to the next; what could not be cross-checked is marked "(to check)". Sources are at the end.

Thirty-odd references, grouped in seven families. For each: what sets it apart, what we keep,
what we avoid.

## What Storyboarder does today

From a reading of the code (`src/canvas-tools.js`, `src/events.js`, `src/modals.js`,
`src/sidebar.js`):

- **Two ways to create.** "Add a room" places a box: four walls, a floor and a ceiling, six
  `objet3d` Elements sharing a `pieceId`. "Build a building", in top view inside a Scene, draws walls
  click by click: alignment on points already placed (guides), vertex snapping, extending a wall
  along its axis, splitting a wall hit in its middle (T junction), right-click to start again
  elsewhere, Esc to undo everything.
- **A wall is an independent Element**: world position (`wxFloor`, `wzFloor`), length
  (`realLenFloor`), height (`realHeightFloor`, 3 m by default), rotation. Its thickness is a ratio of
  its height (6 %), not a value of its own.
- **Openings** (door, window, patio door, and the staircase) snap to a wall (`magnetWallId`,
  `wallAlongFrac`, `wallYFrac`) and become its children when rendered.
- **A building does not exist in the data**: it is a COMPUTED grouping of the rooms whose walls
  touch (union-find, `getRoomConnectedComponents`), identified by the sorted list of their
  `pieceId`s. Its name and rotation are stored under that key (`batimentNames`, `batimentRotY`).
- **What is missing**: levels, roofs, slabs for a drawn building, a real staircase between two
  levels, adjustable wall thickness, basements (the Ground is a plane that cannot be dug), a section
  view of a building.

⚠️ **A building's key is unstable**: adding or removing a room changes the list, hence the key, and
the name and rotation stored under the old key are lost. This is the first point to settle before
hanging levels on it (see below, "The proposed data model").

## Life and house games

### The Sims (2, 3, 4), and inZOI

The reference of the genre, and the closest to what Storyboarder is after: building a credible
house quickly, without an architect's skills.

- **The room is the unit.** In The Sims 4, any area enclosed by walls or covered by a floor is a
  room, detected automatically, which gets a floor and a ceiling. It can be dragged out in one go
  (room tool), SELECTED, then moved, rotated or given another wall height from a widget at its
  centre; furniture and coverings follow.
- **Levels are whole floors**, four above ground and two below since 2015 ("4 up and 2 down"). One
  moves from floor to floor; the current floor is built on the previous one.
- **The basement is a tool of its own**, next to the wall: it is DRAGGED under the current floor like
  a room, the terrain digs itself, and a staircase connects it. Players advise doing it before the
  foundation and keeping room for the stairs.
- **The foundation** raises the house by one step; since 2018 a widget raises or lowers it for a
  given room. **Platforms** (2020) make intermediate, stackable levels.
- **The staircase is configurable** (2019): straight, L, U, adjustable landing; it adapts to the
  height, and follows the house when it is moved as a whole.
- **Roofs** are pieces placed then stretched, with pitch and curvature handles; an automatic roof
  exists (to check).
- **The view**: walls down, cutaway (the walls between the camera and the inside disappear), or
  up. The Sims 3 made it famous (Home/End keys), and The Sims 4 kept it.
- **Moving the whole house** is a tool ("Move Lot & House"), which also rotates the whole.
- The Sims 2 introduced foundations and basements, at the cost of tricks (the
  `constrainFloorElevation` cheat) for half-levels.

**inZOI** (Krafton, 2025) follows the model: several floors (up to 30 for apartment blocks), a
ceiling REQUIRED before the next floor, a hole in the ceiling for the stairs, a foundation adjustable
from 0 to 1.5 m, a toggle between magnetic grid and free placement (Tab). No basement yet: planned
together with terrain editing, which confirms that a basement is first a terrain problem.

**What we keep.** The room as a unit selected, moved and rotated in one go; whole, few levels; the
basement dragged like a room under the current floor; stairs that adapt to the height; the cutaway
view.
**What we avoid.** Partial-level edge cases solved with tricks: players have suffered them for
twenty years.

### Bloxburg and House Flipper 2

- **Bloxburg** (Roblox): wall tool, a floor that fills a room in one click, openings placed as
  objects then resized, copy-paste of walls, and a basement dragged with the mouse then "dressed" with
  walls and floors (to check: guides disagree on the order).
- **House Flipper 2** (2023), sandbox mode: walls drawn in three clicks (start, end, height), an
  outline green or red depending on whether the space is free, grid or free placement, adjustable
  wall height, the whole house movable, a top view for the plan. **A floor, or a ceiling, is just a
  horizontal wall**: one tool for both.

**What we keep.** Visual feedback before confirming (green / red); the height chosen at the third
click; a single "panel" object oriented as floor, wall or ceiling.

## Survival building games

### Valheim, Fallout 4, Enshrouded, Planet Zoo

- **Valheim**: pieces (beams, walls, floors, roofs) that attach by **snap points**, and a
  **structural integrity** shown in colour (blue on the ground, red about to fall). A key turns
  snapping off.
- **Fallout 4**: snapping only, no physics; players mostly complain when it stops them placing
  where they want, and rely on mods to get around it.
- **Enshrouded**: a voxel world, diggable terrain; a basement is made by placing a large block in the
  rock and then deleting it. A 10 cm grid for detail.
- **Planet Zoo**: pieces on a grid of adjustable step, moving up and down the grid (Shift),
  keyboard advanced move, angle snapping that can be turned off; small angle errors add up on a large
  building.

**What we keep.** Snapping that a key TURNS OFF; an adjustable grid step; showing, in colour, why a
placement is refused.
**What we avoid.** Structural physics: useless for a comic's set, and a source of incomprehensible
refusals.

## Procedural building games

### Tiny Glade and Townscaper

- **Tiny Glade** (2024) grew out of a procedural wall generator. Walls are drawn as lines;
  **clicking inside a ring of walls makes a roof** that follows their shape; dragging a path into a
  wall opens a door in it; windows blend together. The player decides the shape, the game decides
  the details.
- **Townscaper** (Oskar Stålberg): one clicks cells on an irregular grid; a variant of "marching
  cubes" picks the building piece from the filled neighbouring cells, and "wave function collapse"
  assembles compatible pieces (roofs, arches, stairs).

**What we keep.** This is the most promising lead for a storyboard: **state the intent (an outline,
a height, a style), and let the application do the details** (roof, frames, cornices). The roof
deduced from the outline is the best example.

## Consumer floor plan software

### Sweet Home 3D

Free, widely used, and the best documented on levels.

- **Levels** are tabs above the plan, with an **elevation** and a height; a new level takes its
  elevation from the preferences; a NEGATIVE elevation makes a basement; "add a level at the same
  elevation" serves half-levels and layers (terrain, furniture); the level below is shown greyed out
  under the plan.
- **The staircase cuts the ceiling** of the level above, following its bounding box, or a cut-out
  shape (SVG path) declared with the model. It never cuts a wall.
- **The background plan**: an image is imported, the REAL length of one line is given, and walls are
  drawn over it. This is exactly the gesture of #456.
- Walls drawn click by click, double-click to finish; a room is created by double-clicking inside
  closed walls (to check); magnetism can be toggled.

### Planner 5D, Space Designer 3D, HomeByMe, Homestyler, RoomSketcher, Floorplanner

- **Planner 5D**: up to six floors on the web, three in the apps; the level below is greyed out when
  building above; "decide where the staircase goes BEFORE adding the floor". No documented basement;
  users fake one more floor with a levitating cube.
- **Space Designer 3D** has the clearest model of the whole family. A level has four measurements:
  **level height** (floor to floor), **ceiling thickness**, **ceiling height**, **distance from the
  ground**. One adds a floor OR a basement. The **stairwell** (hole in the slab) is drawn on the
  level ABOVE; a **mezzanine** is a level at mid-height with a stairwell. Duplicating a level goes
  through copy-paste.
- **HomeByMe, Homestyler, Floorplanner**: synchronised 2D and 3D, furniture libraries, renders.
  **RoomSketcher and Homestyler** import a photo of a plan, ask for ONE real dimension for the scale,
  then detect walls, doors and windows (in beta at RoomSketcher) and let the user correct them.

**What we keep.** The four measurements of a level (Space Designer 3D); the floor below greyed out;
the staircase that cuts the slab; the stairwell drawn on the level above; the scale given by a single
dimension.

## Free modelling

### SketchUp, and Blender (Archimesh, Building Tools)

- **SketchUp**: one draws a face, then **pushes / pulls** it into a volume. Architects' habit: one
  group per floor (floor, then walls pulled to height, then openings), **tags** (layers) per floor
  to show or hide, **scenes** that remember the camera, tags and **section planes**.
- **Archimesh** (Blender): a room is drawn with the pencil then generated with optional floor,
  ceiling and closing wall; thickness and height stay editable afterwards (modifiers).
- **Building Tools** (Blender): "add floors" on a footprint; number of floors, height and slab
  overhang are set afterwards.

**What we keep.** "Pulling up" to make a volume; parameters that stay editable after creation; a
scene that remembers a section and a camera, which looks very much like a Panel.

## Professional architecture software (BIM)

### Revit and Archicad

- **A level is a horizontal datum**, not a container: it has an elevation and a name, and each plan
  view is attached to it. Changing a level's elevation moves everything that refers to it.
- **A wall has a constrained base and top** (Revit: base constraint, "up to level" top constraint,
  offsets; or a fixed "unconnected" height). **Archicad** says the same with the "home story" and the
  **top link** ("home story + 1"): wall heights follow when a story's height changes. A wall can span
  several stories, or go below its level (basement).
- **Doors and windows are hosted** by a wall; their level is that of their sill.
- **Rooms** ("rooms", "zones") are deduced from the elements bounding them, with separation lines
  where there is no wall.
- **The plan view is a cut** at a given height; what is above or below is shown or not by rules.

### Chief Architect

The most "automatic" of the professional tools, and the closest to what a storyboarder would want:
one draws the **first** floor, and the software builds **upwards** (roofs, floors) and **downwards**
(foundation: full basement, crawlspace, piers) from the plan. **Roofs build over rooms**,
automatically, with a rebuild that can be turned off to edit by hand. Reported drawback: roofs and
foundations apply to the whole model, which hurts when a lot holds two buildings.

**What we keep.** The datum level and walls linked to the level above (change a floor height,
everything follows); hosted openings (already the case here); roof and foundation DEDUCED from the
plan; the horizontal cut as working view.
**What we avoid.** All the rest: wall layers, structure, dimensioning, quantities. A storyboarder
does not need them.

## The exchange format: IFC

The open building standard (buildingSMART) gives a hierarchy worth copying, at least in spirit:
**project → site → building → storey (IfcBuildingStorey) → space (IfcSpace)**. A storey has an
**elevation** relative to a reference height of the building; its height is not in the storey but in
its properties (floor to floor). A storey can be split into **partial storeys** (split-level houses).
Every element is "contained" in a storey; an opening is a void in a wall, filled by a door or a
window. Importing or exporting IFC is not a goal; drawing on it for the model is.

## From a plan photo to a building (for #456)

Research (TUM, Budapest, 3DPlanNet…) always works in two steps: **segment the walls** (wall pixels),
then **detect the openings** (doors as arcs, windows), before post-processing that vectorises and
extrudes. Real-estate listing plans, varied in style and low in resolution, defeat methods based on
simple thresholding. Products (RoomSketcher, Homestyler) do: a straight photo, **one real dimension
for the scale**, detection, then correction by the user. It is the same scheme as imported pages
(#452), and it is what we recommend: modest detection (thick walls = wide dark strokes, doors =
arcs), the scale asked for, and direct correction on the plan.

## Recurring patterns

| Question | House games | Consumer | BIM | What we recommend here |
|---|---|---|---|---|
| Building unit | the room | the wall, then the room | the wall hosted by a level | the **room**, made of walls |
| Levels | whole floors, few | floors with elevation | datum levels | **building levels**, with elevation |
| Wall height | per room | per level | linked to the level above | **linked to the level**, editable per wall |
| Basement | dedicated tool, terrain dug | negative elevation | wall below the level | **negative level**, Ground pierced under the footprint |
| Staircase | adapts to height | cuts the slab | connects two levels | **connects two levels, cuts the slab** |
| Roof | placed or automatic | placed | automatic over rooms | **deduced from the outline**, editable |
| View | walls down / cutaway / up | floor below greyed | horizontal cut | **cut per level**, and per Panel |
| Drawing aid | grid, snapping | magnetism | constraints | **already there**; add a key to turn it off |
| Moving | the room, the house | the selection | (none) | **room, level, building** in one go |

## What is specific to Storyboarder

Three fundamental differences with everything above, and they shape the recommendations:

1. **We build a SET to be framed, not a house to be lived in.** Nobody walks in it, nothing has to
   stand up. Centimetre precision and structure are useless; SPEED and readability on screen count
   more.
2. **What matters is what a Panel's camera sees.** The Sims remove the walls between the camera and
   the inside so the player can see; here it is a staging choice, PER PANEL: one Panel wants the
   facade, another the inside through a removed wall, another the floor alone. The cutaway view must
   therefore be a Panel setting, not a global state.
3. **A Scene is copied into Panels** (see the manual). What we add (levels, roofs) must survive that
   copy, and stay light to draw, since every Panel renders it.

## Recommendations

Ranked by priority. Estimated effort: S (one session), M (a few sessions), L (a project).

### Priority 1: the foundations of the model (before any floor)

1. **Make the building explicit** (M). A `batimentId` ADDED on each room, instead of the computed key
   that changes as soon as a room is added. When reading an older Project, the computed groupings
   receive an id, and their names and rotations are carried over.
2. **Levels per building** (M). An ordered list of levels, each with a name, an **elevation** and a
   **storey height** (floor to floor), a slab thickness; each room carries its level. Level 0 always
   exists; an older building has only that one.
3. **Walls linked to their level** (S). A wall's height defaults to its level's height (like
   Archicad's top link): changing a storey height updates everything. A height of its own remains
   possible (low wall, parapet).
4. **Adjustable wall thickness** (S), decoupled from height (today 6 % of the height, which gives
   18 cm walls at 3 m, but 30 cm at 5 m).

### Priority 2: floors, basements, staircases

5. **A current level**, chosen in the building menu or with the keyboard (Page Up / Page Down as in
   The Sims and inZOI): one builds on it; the level below is shown greyed out in top view
   (Planner 5D, Sweet Home 3D).
6. **Add a floor, add a basement** (M), like Space Designer 3D: the floor takes the elevation of the
   top of the current level; the basement, a negative elevation. **Duplicate a level** (S): copy a
   floor's walls to the next one, the most frequent case.
7. **Automatic slabs** (M): every closed room gets its floor and, if there is a level above, the
   floor above is its ceiling (one slab, not two).
8. **The staircase between two levels** (M): it connects the level it is placed on to the next one,
   adapts to the storey height, and **cuts the slab** above following its footprint (Sweet Home 3D).
   The stairwell can also be drawn by hand on the level above (Space Designer 3D).
9. **The basement pierces the Ground** (L). The Scene's Ground is a single plane; under a basement's
   footprint it must disappear (a hole in its geometry, or a mask), and the basement walls go below
   the surface. This is the most delicate part, and the reason inZOI does not have it yet. To be done
   alone, after the floors.

### Priority 3: what saves time

10. **The roof deduced from the outline** (L): a click inside a building makes a roof that follows its
    walls (Tiny Glade, Chief Architect). Known algorithm: the outline's **straight skeleton** gives a
    hip roof; a gable is obtained by raising one side. Styles: flat, gable, hip; adjustable pitch.
11. **Cutaway view per Panel** (M): for a Panel showing a building, choose "facade", "cutaway" (the
    walls between the camera and the inside disappear, as in The Sims) or "up to level N" (the floors
    above disappear). Setting saved in the Panel.
12. **Select and move in one go** a room, a level or a building, with everything snapped to it (the
    building already rotates) (S to M).
13. **Visual feedback before confirming** (S): a wall being drawn that crosses another is shown in
    red (House Flipper 2); a key (Alt) turns snapping off for one gesture (Valheim, Planet Zoo).
14. **Ready-made rooms** (S): rectangle, L, T, and a "drag a room" that places four walls in one drag
    (The Sims, Bloxburg), next to wall-by-wall drawing.

### What we advise against

- **Structural physics** (Valheim): incomprehensible refusals, no benefit on screen.
- **Wall layers, dimensioning, quantities** (BIM): another trade.
- A **mandatory grid**: the current snapping (guides, vertices) is better; keep it switchable.
- **IFC export**: costly, not requested.

## The proposed data model

ADDED fields, none renamed (see [persisted-data.md](persisted-data.md)); an older Project opens as
today, with a one-level building.

```
Panel (or Scene canvas)
  batiments: { <batimentId>: { nom, rotY,
                niveaux: [ { id, nom, elevation, hauteur, dalle } ] } }   ← ADDED
Wall / floor / opening Element of a room
  pieceId (existing), batimentId (ADDED), niveauId (ADDED, absent = level 0)
  hauteurPropre (ADDED, absent = level height), epaisseur (ADDED, absent = current rule)
Staircase
  niveauId (start); it goes up to the next level; its cut-out is deduced from its footprint
```

`batimentNames` and `batimentRotY` remain READ (older Projects) and are no longer written once
buildings are explicit; the two forms do not coexist in one file (same rule as the mappings, see
persisted-data.md). An element's vertical position is deduced from its level's elevation: changing
an elevation moves the whole level.

## Questions to settle with Valentin

1. **How many levels?** The Sims stop at 4 + 2; a storyboard rarely needs more, but a tower block
   has twenty. Proposal: no ceiling, but an interface designed for 1 to 6.
2. **The current level**: a Scene setting (like the floor shown in The Sims), or a building one?
   Proposal: the Scene's, while the cutaway view is per Panel.
3. **The basement**: is the pierced-Ground work worth doing now, or after floors and roofs?
4. **Roofs**: automatic only, or also roof pieces placed by hand (The Sims)?
5. **A wall over several floors** (a facade in one piece): useful on screen, or is one wall per
   floor enough?

## The proposed roadmap

- **#454a** explicit building and levels (priority 1, points 1 to 4), with nothing changing on
  screen for a one-level building.
- **#454b** current level, add / duplicate a floor, slabs (points 5 to 7).
- **#454c** staircase between levels and stairwell (point 8).
- **#454d** basement and pierced Ground (point 9).
- **#458** (new) roof deduced from the outline (point 10).
- **#459** (new) cutaway view per Panel (point 11).
- Points 12 to 14 along the way.
- **#456** (architect's plan) afterwards: it relies on levels (one plan = one level) and reuses the
  imported-pages scheme.

## Sources

- EA, *Basement tips* (The Sims 4): https://www.ea.com/games/the-sims/the-sims-4/news/basement-tips
- The Sims 4 patch notes (basements, 4 + 2 floors, move the house): https://www.pcgamesn.com/the-sims-4/cowa-bunker-the-sims-4-update-introduces-deep-down-basements
- November 2020 update (platforms, half walls): https://simscommunity.info/2020/11/10/the-sims-4-pc-console-new-update-november-10th-2020/
- Platforms, Carl's Sims 4 Guide: https://www.carls-sims-4-guide.com/tutorials/building/platforms.php
- Moving a room, Carl's Sims 4 Guide: https://www.carls-sims-4-guide.com/tutorials/building/houses.php
- The Sims 4 roofs: https://simscommunity.info/2022/03/04/ultimate-guide-to-building-roofs-in-the-sims-4/
- Configurable stairs (2019): https://www.pcgamer.com/au/you-can-finally-customize-staircases-in-the-sims-4
- Wall views, The Sims 3 (Prima): https://primagames.com/eguides/the-sims-3-world-adventures-eguide/essentials/the-sims-3-primer/creating-a-house
- The Sims 2 foundations: https://sims.fandom.com/wiki/File:Foundation_TS2.png
- Half-levels and `constrainFloorElevation`: https://forums.ea.com/discussions/the-sims-3-en/split-level-stairs/907026
- inZOI, build mode guide: https://www.playnews.gg/en/guides/inzoi-building-the-dream-house-complete-build-mode-guide-2026
- inZOI, foundations and basements: https://thegameswiki.com/inzoi/wiki/foundations-and-basements
- Bloxburg, basements: https://progameguides.com/roblox/how-to-make-a-basement-in-roblox-welcome-to-bloxburg/
- Bloxburg, floors: https://welcome-to-bloxburg.fandom.com/wiki/Floor
- House Flipper 2, wall tool: https://houseflipper.wiki.gg/wiki/Build_Walls_Tool
- House Flipper 2, sandbox mode: https://www.gematsu.com/2023/10/house-flipper-2-sandbox-mode-trailer-screenshots
- Valheim, building guide: https://mobalytics.gg/gamebase/guides/valheim-general-building-guide
- Enshrouded, building and terrain: https://guildorder.com/games/enshrouded/wiki/base-building-and-terraforming
- Planet Zoo, snapping: https://forums.frontier.co.uk/goto/post?id=8760303
- Tiny Glade, procedural roofs: https://80.lv/articles/a-look-at-procedural-tower-roofs-in-tiny-glade/
- Tiny Glade, origins: https://80.lv/articles/an-update-on-tiny-glade-a-cozy-castle-building-simulator
- Townscaper: https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making
- Sweet Home 3D, levels and elevation (forum): https://www.sweethome3d.com/support/forum/printthread_thread,10935
- Sweet Home 3D, staircase cut-out (forum): https://www.sweethome3d.com/support/forum/printthread_thread,12588_printall,yes
- Planner 5D, new floor: https://support.planner5d.com/en/articles/16475679-how-to-create-a-new-floor
- Planner 5D, fourth floor: https://support.planner5d.com/en/articles/5916686-adding-a-fourth-floor-windows
- Space Designer 3D, levels, stairwells, mezzanines: https://www.spacedesigner3d.com/resources/help/floors-and-stairwells
- RoomSketcher, tracing a plan: https://help.roomsketcher.com/hc/en-us/articles/213842649
- RoomSketcher, AI conversion: https://help.roomsketcher.com/hc/en-us/articles/31885247016605
- Homestyler, plans from an image: https://www.homestyler.com/article/how-to-create-functional-floor-plans-from-images
- SketchUp, sections and scenes (forum): https://forums.sketchup.com/t/sections-workflow-advice-please/288842
- Blender, Archimesh: https://docs.blender.org/manual/en/2.81/addons/add_mesh/archimesh.html
- Revit, height and depth of walls: https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-D69E6B7D-8D8D-40E4-A6D4-7CAF1A927894.htm
- Revit, rooms in plan views: https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-E5291792-0FFD-4171-939F-C056957BBC55.htm
- Archicad, top link: https://help.graphisoft.com/AC/23/INT/_AC23_Help/040_ElementsVB/040_ElementsVB-5.htm
- Chief Architect: https://www.chiefarchitect.com/architects-builders-remodelers/
- Chief Architect, roofs and foundations (forum): https://chieftalk.chiefarchitect.com/topic/36692-working-with-multiple-roofs-and-foundations-independently
- IFC 4, IfcBuildingStorey: https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcproductextension/lexical/ifcbuildingstorey.htm
- Plans to 3D, TUM: https://mediatum.ub.tum.de/doc/1748704/1748704.pdf
- Plans to 3D, 3DPlanNet: https://pure.korea.ac.kr/en/publications/3dplannet-generating-3d-models-from-2d-floor-plan-images-using-en/
- Straight skeleton and roofs (Sugihara): https://dspace.zcu.cz/items/80623541-f695-43b3-aff1-0cc05c3502dc
