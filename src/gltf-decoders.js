/**
 * @file gltf-decoders.js
 * THE GLTF LOADER WITH ITS DECODERS: every .glb the application reads (the Scene's models, their thumbnails, the
 * store's 3D preview) goes through one loader that also decodes EXT_meshopt_compression (#480f: the model bank's
 * geometry, compressed without simplification; src/vendor/meshopt_decoder.module.js, meshoptimizer 0.22, MIT).
 */
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';

/** A new GLTFLoader that reads Meshopt-compressed files too. */
export function chargeurGltf(){
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}
