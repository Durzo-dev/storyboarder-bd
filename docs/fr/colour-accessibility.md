# Couleur et accessibilité visuelle

*[English version](../en/colour-accessibility.md)*

## Deux sortes de couleurs

Deux choses s'écrivent `#RRVVBB` dans ce dépôt, et elles se traitent à l'opposé.

- **La couleur qui DÉPEINT** : la peau d'un Personnage, la texture d'herbe, la teinte d'une haie
  (`rig3d.js`, `scene3d.js`, `constants.js`). Elle représente ; un thème n'y touche jamais.
- **La couleur qui SIGNALE** : sélectionné, en recadrage, aimanté, détaché. C'est de l'interface posée
  par-dessus le dessin (`draw.js`, `style.css`) ; elle passe par des jetons, que les thèmes
  redéfinissent.

## Les règles

- **La couleur ne porte jamais seule le sens** (WCAG 1.4.1) : le libellé ou l'infobulle le dit aussi.
  Un daltonien perd l'emphase, jamais l'information.
- **Toute couleur d'interface est un jeton** (`--paper`, `--ink`, `--accent`, `--danger`…), jamais une
  valeur en dur.
- **Quatre rendus** : Sombre et Clair, et le **contraste renforcé** de chacun. Le contraste est un
  modificateur qui se combine au thème, pas un thème de plus : dans `settings.json`, `theme` vaut
  `dark` ou `light`, et `contrast` s'y ajoute.

## Les seuils

| Jeton | Seuil |
|---|---|
| Texte courant | 4,5:1 (AA) ; 7:1 en contraste renforcé (AAA) |
| `--bord-actif` : frontière de ce qui se clique ou se saisit | 3:1 contre le voisin **extérieur** (WCAG 1.4.11) |
| `--focus` : bague de focus | 3:1 contre les couleurs voisines (WCAG 2.4.11), dans les quatre rendus |
| `--line`, `--line-strong` : cadres et séparateurs décoratifs | aucun seuil |

- La frontière d'un champ se mesure contre la **page**, pas contre son propre fond : c'est l'extérieur
  qui dit où le composant s'arrête.
- La bague de focus n'utilise pas `--accent` : en thème Clair, l'orange n'atteint pas 3:1 contre le
  papier.
- `:focus-visible` plutôt que `:focus` : un clic à la souris ne bague pas ce qu'il touche. La bague est
  un `outline` explicite, qui épouse le `border-radius` du champ.
- Le texte sur un bouton coloré a son jeton (`--sur-accent`, `--sur-danger`, `--sur-warn`).

`tests/theme-contrast.test.mjs` rejoue ces calculs sur la feuille de style réelle.

## Daltonisme

`--accent`, `--danger` et `--warn` sont de la famille rouge-orange-jaune, que le daltonisme rouge-vert
rapproche. Ce n'est pas corrigé par un thème, parce que ces couleurs portent l'emphase et non le sens
(règle ci-dessus), et que `--accent` est l'orange de l'application. Une palette daltonienne devrait
sortir l'une des trois de cette famille (par exemple `--accent` vers le bleu).

## Mesurer une paire de couleurs

Simulation de Brettel et Viénot (1999) : sRVB vers linéaire, vers LMS par la matrice de Viénot,
matrice de déficience, retour ; puis distance euclidienne en sRVB (sous 60, deux couleurs ne se
séparent plus d'un coup d'œil ; sous 90, c'est juste). Mesurer **les paires que l'utilisateur doit
distinguer** à l'écran, pas une palette dans l'abstrait.

## Pièges

- **Ne pas repeindre ce qui dépeint** pour un thème : le dessin deviendrait faux.
- **Pas d'`overflow:hidden` sur un conteneur de champs** : une bague de focus se dessine hors de son
  champ, et serait coupée.
- **Ne pas réutiliser `--line` pour une frontière interactive** : il est sous 3:1.
