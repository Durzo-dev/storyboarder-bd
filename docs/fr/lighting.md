# Éclairage d'une Case et d'une Scène

*[English version](../en/lighting.md)*

## Rôle

La section **Lumière** du menu de droite d'une Case ou d'une Scène règle un soleil : sa direction, sa
couleur, son intensité, et les ombres portées. Trois modes : **Jour**, **Nuit** et **Personnalisé**.
Les sources de lumière posées dans la Scène sont décrites dans
[positioned-lights.md](positioned-lights.md), les ombres dans [cast-shadows.md](cast-shadows.md).

## Fichiers

- `src/lighting-3d.js` : tout ce qui décide, pur et testé : les presets, la résolution de l'éclairage
  (`resoudreEclairage3D`), le ciel, la géométrie du dôme, la lecture et l'écriture du réglage d'une
  Case.
- `src/rig3d.js` : pose les lumières dans la scène Three.js partagée avant chaque rendu de Case.
- `src/sidebar.js`, `src/events.js` : la section Lumière et le dôme.

## Données

Le champ vit sur le `panel` ; la Planche verrouillée d'une Scène étant un panel (`isLockedScenePanel`),
un seul champ couvre la Case et la Scène.

```js
lumiere: {
  mode: 'jour',          // 'jour' | 'nuit' | 'perso'
  azimut: -63.43,        // degrés : d'où vient le soleil
  elevation: 41.81,      // degrés au-dessus de l'horizon
  couleur: '#FFFFFF',
  intensite: 1,          // 0 à 1
  ombresPortees: false,
}
```

- **Absent** : Jour, sans ombres (`LUMIERE_DEFAUT`). Jour rend exactement l'éclairage de base : clé
  blanche à 0,55 en (1, 2, 2), ambiante blanche à 0,75.
- Les valeurs du Personnalisé **restent** quel que soit le mode : repasser en Personnalisé retrouve ce
  qu'on y avait réglé.
- Lecture par `lumiereDeCase3D` (défauts compris), écriture par `definirLumiereDeCase3D`, effacement par
  `effacerLumiereDeCase3D`, copie **par valeur** par `copierLumiere3D`.

## La résolution de l'éclairage

`resoudreEclairage3D` rend ce que le rendu pose : en Jour et en Nuit, les valeurs de `PRESETS_LUMIERE` ;
en Personnalisé, celles du réglage. L'intensité pilote le soleil **et** l'ambiance :

```
soleil   = 0,55 × intensité
ambiante = 0,75 × intensité²
```

À intensité 1 on retrouve l'éclairage de base ; à 0, le noir complet. L'ambiante prend la couleur du
soleil.

**Le ciel** (`couleurCielDeCase3D`) : bleu clair (`CIEL_JOUR`) en Jour, bleu nuit (`CIEL_NUIT`) en Nuit,
et en Personnalisé la couleur de la lumière assombrie par son intensité. Le rendu le peint opaque.

L'éclairage résolu, ciel compris, entre dans la **signature** de la Case
(`computePanelSceneSignature3D`) : le changer redessine. L'export passe par la même fonction que
l'écran.

## La section Lumière et le dôme

| Mode | Ce qui est visible |
|---|---|
| Jour, Nuit | la liste des modes, les ombres portées |
| Personnalisé | en plus : le dôme, la couleur, l'intensité |

Le **dôme** est dessiné sur un canevas 2D : une demi-sphère vue en légère plongée
(`INCLINAISON_DOME_DEG`), sur laquelle le soleil est un point. Cliquer-glisser déplace le soleil, le
clic droit glissé tourne la vue. Projection et test de clic sont des fonctions pures
(`projeterSurDome3D`, `directionDepuisDome3D`). Les repères cardinaux (`AZIMUTS_CARDINAUX`) sont
dérivés de la caméra par défaut d'une Case ; le Nord est en rouge par le jeton `--nord-boussole`, défini
dans les quatre rendus. Le dôme déroge à la règle globale `canvas { background: var(--fond-3d) }` : il
est posé sur le papier de la section.

## Scène et Case

Charger une Scène dans une Case **copie** son éclairage, par valeur, comme ses modèles : la Case est
d'abord effacée, puis reçoit le réglage de la Scène s'il y en a un. Une Scène sans réglage rend donc la
Case à Jour. Ensuite, les deux sont indépendantes.

## Pièges

- **Tout nouveau réglage doit entrer dans la signature de la Case**, sinon le changer ne redessine rien.
- **Copier par valeur**, jamais par référence : sinon le premier réglage de l'une changerait l'autre.
- **Mesurer un contraste contre le vrai fond** : le dôme est sur `--paper`, les autres canevas sur
  `--fond-3d` ; le test le lit dans la feuille de style au lieu de l'écrire en dur.
