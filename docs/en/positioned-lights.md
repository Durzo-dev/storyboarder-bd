# Placed light sources

*[Version française](../fr/positioned-lights.md)*

## Role

Right click → Add → **Light** places a point source (a glowing sphere) in a Panel or a Scene. It moves
like an Element, is set through its sheet (double-click), and appears in a **separate** block at the top
of the Element list. A Panel's sun is described in [lighting.md](lighting.md).

## A light is an `objet3d`

A light is an `objet3d` with `objType: 'lumiere'` (`OBJ_TYPE_LUMIERE`, `src/light-source-3d.js`). It
thereby inherits everything 3D objects do (selection, dragging, belonging to a Panel, undo, cache
signature), and only its **exclusions** are written and tested.

## Data

An ordinary `objet3d` (`id`, 2D box, `homePanelId`, world coordinates), plus:

```js
{
  objType: 'lumiere',
  color: '#FFFFFF',      // the light's colour (the common objet3d field)
  intensite: 0.77,       // CLE_ACTUELLE × MAJORATION_LUMIERE_POSEE (0.55 × 1.4)
  portee: 0,             // 0 = unlimited
  sphereVisible: true,
  projetteOmbre: false,
  realHeightFloor: 0.2,  // the sphere's diameter, in metres
}
```

- `sphereVisible` only hides the sphere, **on screen and in the export**; the light still shines.
  `hidden3d` switches it off.
- `portee` is also the far plane of a casting source's shadow camera; at 0, it is derived from the
  Panel's visible field (`cameraOmbreSource3D`).
- `projetteOmbre` is unticked by default: a point source's shadow is a cube map, six depth passes per
  frame (see [cast-shadows.md](cast-shadows.md)).

## Rendering

The Three.js scene is **shared** between Panels. `planLumieresPosees3D` decides, for each render, which
cached `PointLight`s to switch on and place, and which to switch off: every cached id leaves the plan
exactly once. A light left on would otherwise light the next Panel.

`computePanelSceneSignature3D` clones the whole Element: a light's position, colour, intensity, range
and sphere enter it without extra code.

## Exclusions

1. **No Camera mode for a light alone**: at least one other Element is needed. A light does not block
   inserting an image either.
2. **Outside the automatic framing box**: a distant light would push the camera back.
3. **No ground snapping**: a source floats where it is put. But it **does not go below the ground**,
   unless "Can pass through the ground" (`traverseGround`): snapping and the ground guard are two
   separate predicates.
4. **Outside the Element list**, in its block at the top, and never under "Not visible".

A light's sheet shows a "Brightness" section (colour, intensity, range, shadow, sphere) and hides what
means nothing for it (`dispositionFicheLumiere3D`, `CHAMPS_FICHE_LUMIERE`).

## Cost

Per frame, a source without a shadow costs almost nothing. The cost is at the **first encounter** of a
number of lights in a session (about 30 ms per light), because that number enters the GLSL program key;
moving or recolouring a light recompiles nothing. Measurements in
[rendering-performance.md](rendering-performance.md).

## Pitfalls

- **One predicate can guard two doors**: excluding a light from snapping must not exclude it from the
  ground guard.
- **`buildPropRig3D` falls back to the car** for an `objType` without a builder: every new type must be
  registered there (a test counts the rig's meshes).
- **`lumiere` is a saved value**: it is never renamed.
