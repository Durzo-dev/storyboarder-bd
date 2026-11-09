# Imported skeletons

*[Version française](../fr/imported-skeletons.md)*

## Role

An articulated imported model (`.glb` with a skeleton) is posed like a Character: the application must
recognise which bone plays which role, in files whose naming conventions, rest rotations and axes have
nothing in common. This note describes how it does so, for a humanoid as for a creature (quadruped,
winged, snake…).

## Files

| File | What it holds |
|---|---|
| `src/skeleton-map.js` | Recognition: the eighteen humanoid slots (`SLOTS`), `inferSkeletonMap`, chains (`membresDuSquelette3D`), the suggested morphology (`archetypeSuggere3D`), the mapping screen's rows. |
| `src/skeleton-store.js` | Storing and reading back mappings, and merging what the user corrected with what recognition proposes. |
| `src/archetype-roles.js` | Chain roles per archetype, and their automatic proposal (`propositionDeRoles3D`). |
| `src/skeleton-pose.js` | Posing an imported skeleton: keys, angles, composition with the rest rotation, slider groups. |
| `src/skeleton-retarget.js` | Translating a gesture from one body to another through bone geometry. |
| `src/pose-bridge.js` | The passage between the built-in Character's poses and an imported model's slots. |
| `src/constants.js` | `ARCHETYPES_3D`, `ANIMAL_ARCHETYPES_3D`, `ANIMAL_JOINT_DEFS`. |

## Recognising bones

- **The name gives the side**, not the role: "Left", "_L", "_l_" are recognised in every convention met
  (`coteDuNom`). A bone's role cannot be read from its name ("Left_leg" may be the thigh, "Left_elbow"
  the forearm): a wrongly assigned bone is worse than a missing one.
- **Structure gives the role**: hierarchy, lengths, position relative to the body.
- **The body frame** (up, front, left) is derived from the skeleton's geometry, without reading any name
  (`repereDuCorpsPourFichier3D`).
- **Scaffolding bones** (roots, controllers, a game model's effect bones) are excluded from candidates
  (`estEchafaudage3D`).

## Morphologies and archetypes

A model's morphology is a key of `ARCHETYPES_3D`: `humanoide`, `bipede_queue`, `quadrupede`,
`bipede_aile`, `quadrupede_aile`, `centaure`, `arachnide`, `radial`, `serpentin`, `complexe`.
`archetypeSuggere3D` proposes one, with its origin (chain names, or structure alone); it is never a
verdict: the user can change it, and "Complex" gives the generic screen where each chain is ticked and
named by hand. Built-in Animals each have theirs (`ANIMAL_ARCHETYPES_3D`).

- **Humanoid**: eighteen slots (`tete`, `avantbras_g`, `cuisse_d`…), mapping stored in `os`.
- **Other morphology**: the skeleton is split into **chains** (limbs); each chain receives an archetype
  **role** (front left leg, wing, tail…), mapping stored in `roles`. Roles reuse the built-in Animals'
  joint ids (`ANIMAL_JOINT_DEFS`); the head is searched for on the trunk.

## The mapping

- It belongs to the **file**, not to the Element or the Project: stored next to the `Modeles` folder,
  indexed by file name, it applies to every copy of the model. It does not travel with a Project sent to
  someone (neither does the `.glb`).
- It stores **bone names**, never node indices (a re-export renumbers everything).
- What the user corrected **wins** over recognition; the rest comes from it.
- A mapping can serve **another file** with the same skeleton: the `empreinte` (bone count and digest)
  recognises it (`correspondancesApplicables3D`).
- The format (keys `os`, `roles`, `membres`, `morphologie`, `valide`, `empreinte`) is in
  [persisted-data.md](persisted-data.md).

The mapping screen ("Mapping table", from the Model editor) shows the same thing as the sliders: slots
or chains and their roles, with the proposal and what was corrected.

## Posing a skeleton

- **Rest rotations are not zero**: in a real file, almost every bone is already rotated at rest. A pose
  is therefore applied **on top of** the rest rotation (`orientationFinale`), never instead of it.
- **The pose** is a `skeletonPose3d` dictionary: `{ key: {x, y, z} }` in radians, the key being a slot
  or a bone prefixed `os:` (`PREFIXE_OS_3D`). Angles bounded to ±180°; the pelvis is not posable
  (`SLOTS_NON_POSABLES`).
- **Sliders** come from the morphology: slots for a humanoid, chains and roles for a creature
  (`groupesPosablesMembres3D`, `clesARecolter3D`).
- **A library pose** (the built-in Character's vocabulary: `lElbow`…) is translated to slots by
  `pose-bridge.js`, and to each bone's real axes by `skeleton-retarget.js`, which measures bone direction
  instead of assuming an axis (files align their bones on +Y, ±X or +Z depending on the exporter).
- **"Lying down"** is a whole-body gesture, carried by the intention (`joints3d`, `position`), not by a
  bone angle.

## Front and framing

- The built-in Character faces −Z (`rotY: Math.PI` at creation), an imported model faces +Z
  (`rotY: 0`). The Model editor opens its camera on the measured front side (`orbiteDeFace3D`).
- The framing box only unites bones that deform something (see
  [imported-models-display.md](imported-models-display.md)).

## Testing

`tests/skeleton-*.test.mjs`, on skeletons read from real files (humanoids and creatures, `tests/fixtures/squelette-*.json`).
What tests cannot tell (a limb going askew, a model seen from behind) is checked on screen in the Model
editor, on each morphology.

## Pitfalls

- **Never infer a role from a bone name.**
- **Every key of a mapping entry must be named in `normaliserFichier`** (see
  [persisted-data.md](persisted-data.md)).
- **Three Element makers** feed an imported model's rig: the Panel, the sheet preview
  (`drawObjectPreview`) and the editor (`dessinerModeleDansEditeur`). An added field must reach all
  three; a test derives the list of fields read by `ensureObjectRigEntry3D`.
- **Do not hard-code the front**: it is measured per file.
