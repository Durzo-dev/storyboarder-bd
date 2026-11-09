# Sources de lumière posées

*[English version](../en/positioned-lights.md)*

## Rôle

Clic droit → Ajouter → **Lumière** pose une source ponctuelle (une sphère lumineuse) dans une Case ou une
Scène. Elle se déplace comme un Élément, se règle par sa fiche (double-clic), et figure dans un bloc
**à part** en tête de la liste des Éléments. Le soleil d'une Case est décrit dans
[lighting.md](lighting.md).

## Une lumière est un `objet3d`

Une lumière est un `objet3d` d'`objType: 'lumiere'` (`OBJ_TYPE_LUMIERE`, `src/light-source-3d.js`).
Elle hérite ainsi de tout ce que font les objets 3D (sélection, glisser, appartenance à une Case,
annulation, signature de cache), et seules ses **exclusions** sont écrites et testées.

## Données

Un `objet3d` ordinaire (`id`, boîte 2D, `homePanelId`, coordonnées monde), plus :

```js
{
  objType: 'lumiere',
  color: '#FFFFFF',      // la couleur de la lumière (le champ commun des objet3d)
  intensite: 0.77,       // CLE_ACTUELLE × MAJORATION_LUMIERE_POSEE (0,55 × 1,4)
  portee: 0,             // 0 = sans limite
  sphereVisible: true,
  projetteOmbre: false,
  realHeightFloor: 0.2,  // le diamètre de la sphère, en mètres
}
```

- `sphereVisible` ne cache que la sphère, **à l'écran comme à l'export** ; la lumière éclaire toujours.
  `hidden3d` l'éteint.
- `portee` est aussi le plan éloigné de la caméra d'ombre d'une source qui projette ; à 0, il est dérivé
  du champ visible de la Case (`cameraOmbreSource3D`).
- `projetteOmbre` est décoché par défaut : l'ombre d'une source ponctuelle est une carte cubique, six
  passes de profondeur par image (cf. [cast-shadows.md](cast-shadows.md)).

## Le rendu

La scène Three.js est **partagée** entre les Cases. `planLumieresPosees3D` décide, pour chaque rendu,
quelles `PointLight` du cache allumer et placer, et lesquelles éteindre : tout id du cache sort du plan
exactement une fois. Une lumière laissée allumée éclairerait sinon la Case suivante.

`computePanelSceneSignature3D` clone l'Élément entier : position, couleur, intensité, portée et
sphère d'une lumière y entrent sans code de plus.

## Les exclusions

1. **Pas de mode Caméra ouvert pour une lumière seule** : il faut au moins un autre Élément. Une
   lumière ne bloque pas non plus l'insertion d'une image.
2. **Hors de la boîte du cadrage automatique** : une lumière lointaine ferait reculer la caméra.
3. **Pas d'aimantation au sol** : une source flotte où on la pose. Mais elle **ne passe pas sous le
   sol**, sauf avec « Peut traverser le sol » (`traverseGround`) : l'aimantation et la garde du sol
   sont deux prédicats distincts.
4. **Hors de la liste des Éléments**, dans son bloc en tête, et jamais dans « Non visible ».

La fiche d'une lumière montre une section « Luminosité » (couleur, intensité, portée, ombre, sphère) et
masque ce qui n'a pas de sens pour elle (`dispositionFicheLumiere3D`, `CHAMPS_FICHE_LUMIERE`).

## Coût

Par image, une source sans ombre ne coûte presque rien. Le coût est à la **première rencontre** d'un
nombre de lumières dans une session (environ 30 ms par lumière), parce que ce nombre entre dans la clé
du programme GLSL ; déplacer ou recolorer une lumière ne recompile rien. Mesures dans
[rendering-performance.md](rendering-performance.md).

## Pièges

- **Un prédicat peut garder deux portes** : exclure une lumière de l'aimantation ne doit pas l'exclure de
  la garde du sol.
- **`buildPropRig3D` retombe sur la voiture** pour un `objType` sans constructeur : tout nouveau type
  doit y être inscrit (un test compte les maillages du rig).
- **`lumiere` est une valeur enregistrée** : elle ne se renomme pas.
