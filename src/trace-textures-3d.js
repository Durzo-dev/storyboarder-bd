/**
 * @file src/trace-textures-3d.js
 * Les TEXTURES des Traces en 3D (#437) : route, chemin, muret, clôture, haie, barrière.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI UN PLAQUAGE EN COORDONNÉES MONDE
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Les géométries des Traces sont construites à la main (rubans à onglets, murs extrudés le long
 * d'un tracé lissé, poteaux en boîtes), et la plupart n'ont pas de coordonnées de texture qui
 * vaillent : elles n'en avaient jamais eu besoin, tout était en aplat. Leur en ajouter une par
 * constructeur ferait six chantiers, et chacun devrait gérer les angles et les ouvertures.
 *
 * Deux plaquages, tous deux en MÈTRES, ce qui donne à une pierre du muret la même taille partout,
 * quelle que soit la longueur du tracé :
 *
 *   - « monde » : par projection sur les trois axes (« box mapping »). Un sol prend (x, z), une
 *     face verticale (son horizontale, y), et la normale choisit en fondu. Parfait pour ce qui est
 *     plat (route, chemin) ou petit (poteaux et lisses de la clôture) ;
 *   - « tracé » : les coordonnées portées par la géométrie des murs, l'abscisse le long du tracé
 *     et la hauteur (buildTracéWallGeometry3D les écrit). ⚠️ LA PROJECTION DÉDOUBLAIT LE MOTIF SUR
 *     UN MUR EN BIAIS : à 30° des axes, deux projections se mélangeaient, vu au banc. Le long du
 *     tracé, le motif suit le mur, courbes comprises.
 *
 * ⚠️ LA TEXTURE N'ARRIVE QU'APRÈS SON GRAIN. Le préchargement est asynchrone ; tant que le grain
 * manque, la Trace garde son aplat d'avant, et l'état du grain entre dans les signatures pour
 * qu'elle se refasse à son arrivée.
 */
import { TRACÉ_TEXTURES, couleurDeTrace3D } from './constants.js';
import { textureDuTrace } from './textures-utilisateur.js';
import { grainCharge3D } from './bubble-grain.js';
import { appliquerTeinteAuMotif3D, rvbDeCouleur3D, natureDuNom3D } from './bubble-texture.js';
import { GLSL_PAVAGE, GLSL_PAVAGE_RELIEF } from './ground-tiling-3d.js';

/** La netteté du fondu entre les trois projections : plus grand, plus franc. */
export const PLAQUAGE_NETTETE = 4.0;

/**
 * Le GLSL du plaquage monde. Inséré après `map_pars_fragment`, il remplace `map_fragment`.
 * `uTuile` est la taille d'une tuile en mètres : x pour l'horizontale, y pour la verticale.
 */
export const GLSL_PLAQUAGE_DECLARATIONS = `
uniform vec2 uTuile;
varying vec3 vTraceMonde;
varying vec3 vTraceNormale;
vec4 traceEchantillon( vec2 uv ) { return mapTexelToLinear( texture2D( map, uv ) ); }
// On the ground, a texture without a regular pattern is paved as the Ground is (ground-tiling-3d.js): each cell
// shifted at random, so a 3 m tile of asphalt does not show the same crack every 3 m.
vec4 traceSol( vec2 uv ) { return uPavage > 0.5 ? pavageMap( uv ) : traceEchantillon( uv ); }
`;

/** Le plaquage le long du tracé : la géométrie porte (abscisse, hauteur) en mètres dans `uv`. */
export const GLSL_PLAQUAGE_TRACE = `
#ifdef USE_MAP
  vec4 texelColor = traceEchantillon( vUv / uTuile );
  diffuseColor *= texelColor;
#endif
`;

export const GLSL_PLAQUAGE_FRAGMENT = `
#ifdef USE_MAP
  vec3 nT = abs( normalize( vTraceNormale ) );
  vec3 wT = pow( nT, vec3( ${PLAQUAGE_NETTETE.toFixed(1)} ) );
  wT /= ( wT.x + wT.y + wT.z );
  // Une face tournée vers x se lit en (z, y), vers z en (x, y), vers le haut en (x, z).
  vec4 texelColor = wT.x * traceEchantillon( vec2( vTraceMonde.z / uTuile.x, vTraceMonde.y / uTuile.y ) )
                  + wT.z * traceEchantillon( vec2( vTraceMonde.x / uTuile.x, vTraceMonde.y / uTuile.y ) )
                  + wT.y * traceSol( vec2( vTraceMonde.x / uTuile.x, vTraceMonde.z / uTuile.x ) );
  diffuseColor *= texelColor;
#endif
`;

/** How strong a texture's relief is drawn (#494a), as on the buildings (batiment-revetements.js). */
export const RELIEF_DE_TRACE = 0.8;

/**
 * A texture's RELIEF (#494a) on a Path: its normal map, read with the same coordinates as its colour. three's own
 * reading takes `vUv`, which these Paths do not use; `traceRelief` is three's `perturbNormal2Arb` (the frame from
 * the screen's derivatives, no tangents needed) with the coordinates given. Inserted after
 * `normalmap_pars_fragment`, where `normalMap` and `normalScale` are declared.
 */
export const GLSL_RELIEF_DECLARATIONS = `
#ifdef TANGENTSPACE_NORMALMAP
vec3 traceReliefDe( vec3 eye, vec3 N, vec3 m, vec2 uv, float fd ) {
  m.xy *= normalScale;
  vec3 q0 = dFdx( eye ), q1 = dFdy( eye );
  vec2 s0 = dFdx( uv ), s1 = dFdy( uv );
  vec3 q1p = cross( q1, N ), q0p = cross( N, q0 );
  vec3 T = q1p * s0.x + q0p * s1.x, B = q1p * s0.y + q0p * s1.y;
  float d = max( dot( T, T ), dot( B, B ) );
  float k = d == 0.0 ? 0.0 : fd * inversesqrt( d );
  return normalize( T * ( m.x * k ) + B * ( m.y * k ) + N * m.z );
}
vec3 traceRelief( vec3 eye, vec3 N, vec2 uv, float fd ) {
  return traceReliefDe( eye, N, texture2D( normalMap, uv ).xyz * 2.0 - 1.0, uv, fd );
}
// On the ground, in the same cells as the colour (traceSol).
vec3 traceReliefSol( vec3 eye, vec3 N, vec2 uv, float fd ) {
  return uPavage > 0.5 ? traceReliefDe( eye, N, pavageNormale( uv ), uv, fd ) : traceRelief( eye, N, uv, fd );
}
#endif
`;

/** The relief along the Path (walls): the same (abscissa, height) as the colour. Replaces `normal_fragment_maps`. */
export const GLSL_RELIEF_TRACE = `
#ifdef TANGENTSPACE_NORMALMAP
  normal = traceRelief( -vViewPosition, normal, vUv / uTuile, faceDirection );
#endif
`;

/**
 * The relief projected on the three axes, weighted as the colour: each projection's own frame (its coordinates
 * are continuous, so are their derivatives), blended.
 */
export const GLSL_RELIEF_MONDE = `
#ifdef TANGENTSPACE_NORMALMAP
  vec3 nR = abs( normalize( vTraceNormale ) );
  vec3 wR = pow( nR, vec3( ${PLAQUAGE_NETTETE.toFixed(1)} ) );
  wR /= ( wR.x + wR.y + wR.z );
  normal = normalize( wR.x * traceRelief( -vViewPosition, normal, vec2( vTraceMonde.z / uTuile.x, vTraceMonde.y / uTuile.y ), faceDirection )
                    + wR.z * traceRelief( -vViewPosition, normal, vec2( vTraceMonde.x / uTuile.x, vTraceMonde.y / uTuile.y ), faceDirection )
                    + wR.y * traceReliefSol( -vViewPosition, normal, vec2( vTraceMonde.x / uTuile.x, vTraceMonde.z / uTuile.x ), faceDirection ) );
#endif
`;

/** Installe le plaquage monde sur un matériau standard. */
export function installerPlaquageMonde3D(materiau, tuile, mode = 'monde', moyenne = null){
  const THREE = globalThis.THREE;
  const uTuile = { value: new THREE.Vector2(tuile[0], tuile[1]) };
  // The ground's anti-repetition: on when the tile's mean colour is given (the blend keeps its variance around it).
  const uPavage = { value: moyenne ? 1 : 0 };
  const uPavageMoyenne = { value: new THREE.Vector3(...(moyenne || [0.5, 0.5, 0.5])) };
  materiau.onBeforeCompile = (shader) => {
    shader.uniforms.uTuile = uTuile;
    shader.uniforms.uPavage = uPavage;
    shader.uniforms.uPavageMoyenne = uPavageMoyenne;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTraceMonde;\nvarying vec3 vTraceNormale;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n'
        + 'vTraceMonde = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n'
        + 'vTraceNormale = mat3( modelMatrix ) * objectNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n' + GLSL_PAVAGE + GLSL_PLAQUAGE_DECLARATIONS)
      .replace('#include <map_fragment>', mode === 'trace' ? GLSL_PLAQUAGE_TRACE : GLSL_PLAQUAGE_FRAGMENT)
      .replace('#include <normalmap_pars_fragment>', '#include <normalmap_pars_fragment>\n' + GLSL_PAVAGE_RELIEF + GLSL_RELIEF_DECLARATIONS)
      .replace('#include <normal_fragment_maps>', mode === 'trace' ? GLSL_RELIEF_TRACE : GLSL_RELIEF_MONDE);
  };
  // Derivatives for the relief's frame (WebGL 1; WebGL 2 has them).
  materiau.extensions = Object.assign({}, materiau.extensions, { derivatives: true, shaderTextureLOD: true });
  materiau.customProgramCacheKey = () => 'trace-plaquage-1-' + mode;
  materiau.userData.uTuile = uTuile;
  materiau.userData.uPavage = uPavage;
  materiau.needsUpdate = true;
  return materiau;
}

/** Each tinted texture's mean colour (for the anti-repetition). */
const _moyennes = new WeakMap();

/** Les textures teintées, par grain et couleur. Une Trace n'en a qu'une par couleur choisie. */
const _textures = new Map();

/**
 * La teinte d'une Trace qui porte `tex` : sa teinte naturelle tant que la couleur est celle par
 * défaut (couleurDeTrace3D rend alors celle de la texture d'origine), la couleur choisie sinon.
 */
function teinteDe(type, couleur, tex){
  const t = couleurDeTrace3D(type, couleur);
  return TRACÉ_TEXTURES[type] && t === TRACÉ_TEXTURES[type].teinte ? tex.teinte : t;
}

/**
 * La texture teintée d'une Trace, ou `null` si son grain n'est pas encore chargé. `texture` : une
 * texture de « Mes textures » choisie pour ce Tracé (#446d), sinon celle de son type.
 */
export function textureDeTrace3D(type, couleur, texture = null){
  const tex = textureDuTrace(type, texture);
  if (!tex) return null;
  const img = grainCharge3D(tex.grain);
  if (!img) return null;
  const teinte = teinteDe(type, couleur, tex);
  const cle = tex.grain + '|' + teinte;
  if (_textures.has(cle)) return _textures.get(cle);
  const rvb = rvbDeCouleur3D(teinte);
  if (!rvb || typeof document === 'undefined') return null;
  const tuile = document.createElement('canvas');
  tuile.width = img.width; tuile.height = img.height;
  const tc = tuile.getContext('2d');
  tc.drawImage(img, 0, 0);
  const donnees = tc.getImageData(0, 0, tuile.width, tuile.height);
  appliquerTeinteAuMotif3D(donnees.data, rvb, natureDuNom3D(tex.grain));
  tc.putImageData(donnees, 0, 0);
  const THREE = globalThis.THREE;
  const carte = new THREE.CanvasTexture(tuile);
  // Its mean colour, for the anti-repetition's blend (as the Ground's, tuileDuGrainDuSol3D): the pixels are read here.
  const px = donnees.data;
  let r = 0, v = 0, b = 0;
  for (let i = 0; i < px.length; i += 4) { r += px[i]; v += px[i + 1]; b += px[i + 2]; }
  const n = Math.max(1, px.length / 4);
  _moyennes.set(carte, [r / n / 255, v / n / 255, b / n / 255]);
  carte.wrapS = carte.wrapT = THREE.RepeatWrapping;
  carte.anisotropy = 4;
  carte.needsUpdate = true;
  evincerTexturesDeTrace3D();
  _textures.set(cle, carte);
  return carte;
}

/** The relief maps (#494a), by key: never tinted, one per texture. */
const _reliefs = new Map();

/** A Path texture's normal map, or null (none, or not loaded yet). */
export function reliefDeTrace3D(type, texture = null){
  const tex = textureDuTrace(type, texture);
  const img = tex && tex.normale ? grainCharge3D(tex.normale) : null;
  if (!img) return null;
  if (_reliefs.has(tex.normale)) return _reliefs.get(tex.normale);
  const THREE = globalThis.THREE;
  const carte = new THREE.Texture(img);
  carte.wrapS = carte.wrapT = THREE.RepeatWrapping;
  carte.anisotropy = 4;
  carte.needsUpdate = true;
  _reliefs.set(tex.normale, carte);
  return carte;
}

/**
 * ⚠️ PLAFONNÉES : la couleur d'un Tracé s'applique EN DIRECT au glissé du sélecteur (demandé), et
 * chaque nuance traversée ferait une tuile (4 Mo) et un matériau. On garde les plus récentes ; une
 * texture évincée part avec ses matériaux, et une Trace qui l'employait la refait au rendu suivant
 * (sa couleur est dans sa signature).
 */
const TEXTURES_DE_TRACE_MAX = 24;
function evincerTexturesDeTrace3D(){
  while (_textures.size >= TEXTURES_DE_TRACE_MAX) {
    const [cle, carte] = _textures.entries().next().value;
    _textures.delete(cle);
    for (const [k, m] of _materiaux) if (m.map === carte) { _materiaux.delete(k); m.dispose(); }
    carte.dispose();
  }
}

/** Le grain d'une Trace est-il là ? Pour les signatures. */
export function grainDeTracePret3D(type, texture = null){
  const tex = textureDuTrace(type, texture);
  // A texture with a relief waits for it too: else the Path, drawn once without it, would keep it so (its
  // signature would not change when the relief arrives).
  return !!(tex && grainCharge3D(tex.grain) && (!tex.normale || grainCharge3D(tex.normale)));
}

/**
 * Le matériau d'une partie de Trace. Texturé si le grain est là, en aplat sinon (l'aplat d'avant).
 * `ombre` assombrit une couche (l'intérieur d'une haie, la base d'une barrière) sans changer la
 * couleur choisie : elle multiplie la texture.
 */
/**
 * ⚠️ LES MATÉRIAUX TEXTURÉS SONT PARTAGÉS, ET JAMAIS LIBÉRÉS (#437c). Mesuré dans un vrai WebGL
 * (ANGLE, Direct3D 11) : libérer le dernier matériau d'un programme LIBÈRE LE PROGRAMME, et le
 * suivant le recompile, 8,7 ms au lieu de 0,7 pour un rendu ordinaire (51,6 ms la toute première
 * fois). Or une Trace se reconstruit à chaque pas d'un glissé, et libérait ses matériaux : un muret
 * seul dans sa Case recompilait son programme à chaque image. Avant #437, ses aplats partageaient
 * le programme standard de tous les modèles, qui ne mourait jamais ; le plaquage, lui, a sa propre
 * clé. On garde donc une instance par réglage, marquée `partage`, que les libérations sautent.
 */
const _materiaux = new Map();

export function materiauDeTrace3D(type, couleur, options = {}){
  const THREE = globalThis.THREE;
  const { ombre = 1, couleurAplat, plaquage = 'monde', texture = null, ...reste } = options;
  const carte = textureDeTrace3D(type, couleur, texture);
  if (!carte) {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(couleurAplat || couleur), ...reste });
  }
  const tex = textureDuTrace(type, texture);
  const relief = reliefDeTrace3D(type, texture);
  const pave = !!(tex.pavage && plaquage === 'monde' && _moyennes.get(carte));
  const cle = [type, tex.grain, teinteDe(type, couleur, tex), ombre, plaquage, relief ? tex.normale : '', pave, JSON.stringify(reste)].join('|');
  if (_materiaux.has(cle)) return _materiaux.get(cle);
  const mat = new THREE.MeshStandardMaterial({ map: carte, color: new THREE.Color(ombre, ombre, ombre), ...reste });
  if (relief) { mat.normalMap = relief; mat.normalScale = new THREE.Vector2(RELIEF_DE_TRACE, RELIEF_DE_TRACE); }
  installerPlaquageMonde3D(mat, tex.tuile, plaquage, pave ? _moyennes.get(carte) : null);
  mat.userData.partage = true;
  _materiaux.set(cle, mat);
  return mat;
}

/** Libère un matériau de Trace, sauf s'il est partagé. Voir `materiauDeTrace3D`. */
export function libererMateriauDeTrace3D(materiau){
  if (materiau && !(materiau.userData && materiau.userData.partage)) materiau.dispose();
}

/** Pour les tests : oublier les textures. */
export function _viderTexturesDesTraces3D(){ _textures.clear(); _materiaux.clear(); _reliefs.clear(); }
