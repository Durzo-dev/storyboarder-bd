# Lighting of a Panel and a Scene

*[Version française](../fr/lighting.md)*

## Role

The **Light** section of a Panel's or Scene's right-hand menu sets a sun: its direction, colour,
intensity, and cast shadows. Three modes: **Day**, **Night** and **Custom**. Light sources placed in the
Scene are described in [positioned-lights.md](positioned-lights.md), shadows in
[cast-shadows.md](cast-shadows.md).

## Files

- `src/lighting-3d.js`: everything that decides, pure and tested: presets, lighting resolution
  (`resoudreEclairage3D`), sky, dome geometry, reading and writing a Panel's setting.
- `src/rig3d.js`: sets the lights in the shared Three.js scene before each Panel render.
- `src/sidebar.js`, `src/events.js`: the Light section and the dome.

## Data

The field lives on the `panel`; since a Scene's locked Page is a panel (`isLockedScenePanel`), one field
covers both Panel and Scene.

```js
lumiere: {
  mode: 'jour',          // 'jour' | 'nuit' | 'perso'
  azimut: -63.43,        // degrees: where the sun comes from
  elevation: 41.81,      // degrees above the horizon
  couleur: '#FFFFFF',
  intensite: 1,          // 0 to 1
  ombresPortees: false,
}
```

- **Absent**: Day, no shadows (`LUMIERE_DEFAUT`). Day renders exactly the base lighting: white key at
  0.55 from (1, 2, 2), white ambient at 0.75.
- Custom values **stay** whatever the mode: switching back to Custom finds what was set there.
- Read by `lumiereDeCase3D` (defaults included), written by `definirLumiereDeCase3D`, cleared by
  `effacerLumiereDeCase3D`, copied **by value** by `copierLumiere3D`.

## Resolving the lighting

`resoudreEclairage3D` returns what the renderer sets: in Day and Night, the `PRESETS_LUMIERE` values; in
Custom, the setting's. Intensity drives the sun **and** the ambient light:

```
sun     = 0.55 × intensity
ambient = 0.75 × intensity²
```

At intensity 1 the base lighting is found again; at 0, complete black. The ambient takes the sun's
colour.

**The sky** (`couleurCielDeCase3D`): light blue (`CIEL_JOUR`) in Day, night blue (`CIEL_NUIT`) in Night,
and in Custom the light's colour darkened by its intensity. The renderer paints it opaque.

The resolved lighting, sky included, enters the Panel's **signature** (`computePanelSceneSignature3D`):
changing it redraws. Export goes through the same function as the screen.

## The Light section and the dome

| Mode | What is visible |
|---|---|
| Day, Night | the mode list, cast shadows |
| Custom | also: the dome, the colour, the intensity |

The **dome** is drawn on a 2D canvas: a half-sphere seen slightly from above (`INCLINAISON_DOME_DEG`),
on which the sun is a point. Click-drag moves the sun, right-drag turns the view. Projection and
hit-testing are pure functions (`projeterSurDome3D`, `directionDepuisDome3D`). The cardinal marks
(`AZIMUTS_CARDINAUX`) are derived from a Panel's default camera; North is red through the
`--nord-boussole` token, defined in all four renderings. The dome overrides the global rule
`canvas { background: var(--fond-3d) }`: it sits on the section's paper.

## Scene and Panel

Loading a Scene into a Panel **copies** its lighting, by value, like its models: the Panel is cleared
first, then receives the Scene's setting if it has one. A Scene without a setting therefore returns the
Panel to Day. Afterwards, the two are independent.

## Pitfalls

- **Every new setting must enter the Panel's signature**, otherwise changing it redraws nothing.
- **Copy by value**, never by reference: otherwise the first change to one would change the other.
- **Measure a contrast against the real background**: the dome sits on `--paper`, other canvases on
  `--fond-3d`; the test reads it from the stylesheet instead of hard-coding it.
