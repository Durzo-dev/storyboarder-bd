/**
 * @file src/texture-maps-3d.js
 * The other maps of a texture of « My textures » (#494a): its OCCLUSION (the shade in its hollows) and its
 * ROUGHNESS, beside its colour and its relief (normal map).
 *
 * Occlusion is multiplied into the colour when its tile is drawn (buildings, Paths, Ground): one place for every
 * surface, no shader. Only on a photographed albedo (a grain `.couleur`): a grey grain was baked with its hollows
 * shaded already (tools/bake-textures.mjs, PART_OMBRAGE), it would be shaded twice.
 *
 * Roughness: three's `roughnessMap` where the surface reads its colour through `vUv` (buildings, Zones, an unpaved
 * Ground); a Path and a paved Ground read it with their own coordinates, as their colour (GLSL below).
 */
import { natureDuNom3D } from './bubble-texture.js';

/** How much of the occlusion shows in the colour: all of it would darken the lit faces too (it is meant for the shade). */
export const PART_OCCLUSION = 0.6;

/** Whether a grain takes its occlusion: a photographed albedo only. */
export const prendLOcclusion = (grain) => natureDuNom3D(grain) === 'couleur';

/**
 * Multiplies the occlusion `ao` (an image) into the tile drawn on `ctx` (`w` × `h`), at PART_OCCLUSION: before its
 * pixels are read (tint, mean colour). Both are the same square map, stretched alike by the baker.
 */
export function occulterLaTuile3D(ctx, ao, w, h){
  if (!ctx || !ao) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = PART_OCCLUSION;
  ctx.drawImage(ao, 0, 0, w, h);
  ctx.restore();
}

/** A map image as a repeating texture of three (`T`), never tinted. */
export function carteRepetee3D(T, img){
  const t = new T.Texture(img);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}
