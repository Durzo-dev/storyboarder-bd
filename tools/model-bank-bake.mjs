/**
 * tools/model-bank-bake.mjs: BAKES THE MODEL BANK (#480f), on Durzo's computer, after
 * tools/model-bank-download.cjs: `npx electron tools/model-bank-bake.mjs` from the project's root (dev
 * dependencies installed: npm install). In Electron for its images (nativeImage): sharp, first used, failed on
 * 62 models of 66 (« colourspace: parameter space not set », its libvips at odds with its JavaScript).
 *
 * Each source (model-bank/sources/<uid>.glb, as downloaded: up to 3 million faces) becomes a light
 * assets/model-bank/<file>: duplicates and unused data pruned, vertices welded, simplified to MAX_FACES at most
 * (meshoptimizer; above REFUSED_FACES still, left out), textures shrunk (shrinkTextures: Electron's nativeImage,
 * no compressed glTF: the application reads none), its base on the ground at the origin (`sink`: metres pushed under, roots for one oak).
 * Writes src/model-bank-data.js (what the application reads: files, uses, genera, credits, sizes) and
 * model-bank/bake-report.json (faces before and after, weights: to check by eye in the application).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, quantize, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { app, nativeImage } from 'electron';

/** The most faces a bank model keeps: a street holds dozens of trees. */
const MAX_FACES = 30000;
/** The largest texture side kept (pixels). */
const TEXTURE_PX = 1024;

/** The largest side of a texture other than a colour (normals, roughness, occlusion: their detail is not seen). */
const DETAIL_PX = 512;
/** A model still above this many faces after the loosest simplification is left out of the bank. */
const REFUSED_FACES = 2 * MAX_FACES;
/** The simplification's error bounds tried in turn (fraction of the model's size): looser until MAX_FACES. */
const ERRORS = [0.02, 0.05, 0.1, 0.2, 0.4];

/** Whether an image has a pixel not fully opaque. */
function hasAlpha(img){
  const px = img.toBitmap();   // BGRA
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return true;
  return false;
}

/**
 * Every texture made light. MEASURED on the first bake (14 Nov. 2026: 403 MB for 66 models): the PNGs weighed most
 * (a palm: 17 images, 13.7 MB). A colour stays TEXTURE_PX a side at most, any other map DETAIL_PX; an opaque PNG
 * becomes a JPEG (a leaf's cut-out keeps its PNG).
 */
function shrinkTextures(doc){
  const colours = new Set();
  for (const m of doc.getRoot().listMaterials()) if (m.getBaseColorTexture()) colours.add(m.getBaseColorTexture());
  for (const t of doc.getRoot().listTextures()) {
    const bytes = t.getImage(), mime = t.getMimeType();
    if (!bytes || !/^image\/(png|jpeg)$/.test(mime)) continue;
    let img = nativeImage.createFromBuffer(Buffer.from(bytes));
    const { width, height } = img.getSize();
    if (!width) continue;
    const max = colours.has(t) ? TEXTURE_PX : DETAIL_PX;
    if (Math.max(width, height) > max) {
      const k = max / Math.max(width, height);
      img = img.resize({ width: Math.round(width * k), height: Math.round(height * k), quality: 'best' });
    }
    const png = mime === 'image/png' && hasAlpha(img);
    const out = png ? img.toPNG() : img.toJPEG(85);
    if (out.length < bytes.length || Math.max(width, height) > max) {
      t.setImage(new Uint8Array(out));
      t.setMimeType(png ? 'image/png' : 'image/jpeg');
      if (t.getURI()) t.setURI(t.getURI().replace(/\.\w+$/, png ? '.png' : '.jpg'));
    }
  }
}

function facesOf(doc){
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const idx = p.getIndices(), pos = p.getAttribute('POSITION');
    n += idx ? idx.getCount() / 3 : (pos ? pos.getCount() / 3 : 0);
  }
  return Math.round(n);
}

// ⚠️ NOT `await app.whenReady()` AT THE TOP: Electron waits for its main module to finish loading before it is
// ready, so a module waiting for « ready » waits forever (seen: 10 minutes, nothing written).
async function bake(){
  await MeshoptSimplifier.ready;
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const work = path.join(root, 'model-bank'), bank = path.join(root, 'assets', 'model-bank');
  fs.mkdirSync(bank, { recursive: true });
  // Made anew: a model left out must not stay shipped from an earlier bake.
  for (const f of fs.readdirSync(bank)) if (f.endsWith('.glb')) fs.unlinkSync(path.join(bank, f));
  const { models } = JSON.parse(fs.readFileSync(path.join(work, 'sources.json'), 'utf8'));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);


  const report = [], data = [];
  for (const m of models) {
    const src = path.join(work, 'sources', `${m.uid}.glb`);
    if (!fs.existsSync(src)) { report.push({ file: m.file, error: 'source missing' }); console.log(`${m.file}: source missing`); continue; }
    try {
      const doc = await io.read(src);
      const before = facesOf(doc);
      await doc.transform(dedup(), prune(), weld());
      // Looser and looser until MAX_FACES: a model made of many small parts (leaves) stops early at a tight error.
      for (const error of ERRORS) {
        const now = facesOf(doc);
        if (now <= MAX_FACES) break;
        await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_FACES / now, error }));
      }
      if (facesOf(doc) > REFUSED_FACES) throw new Error(`too heavy: ${facesOf(doc)} faces left`);
      shrinkTextures(doc);
      // MEASURED on the second bake (120 MB, 70 of geometry): 30 000 faces weighed up to 5 MB, their vertices
      // carrying tangents, unused texture coordinates, float32 everywhere. Tangents dropped (three computes the
      // normal maps without them), unused attributes pruned, the rest quantised (KHR_mesh_quantization: three
      // r128's GLTFLoader reads it; gltf-glb.js refuses only Draco, Meshopt and Basis).
      for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) if (p.getAttribute('TANGENT')) p.setAttribute('TANGENT', null);
      await doc.transform(prune({ keepAttributes: false }), quantize());
      // Its base on the ground, centred: one node above the scene's roots, moved.
      const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
      const b = getBounds(scene);
      const holder = doc.createNode('bank');
      for (const child of scene.listChildren()) { scene.removeChild(child); holder.addChild(child); }
      scene.addChild(holder);
      holder.setTranslation([-(b.min[0] + b.max[0]) / 2, -b.min[1] - (m.sink || 0), -(b.min[2] + b.max[2]) / 2]);
      const out = path.join(bank, m.file);
      await io.write(out, doc);
      const after = facesOf(doc), bytes = fs.statSync(out).size;
      const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]].map(v => Math.round(v * 100) / 100);
      report.push({ file: m.file, name: m.name, facesBefore: before, faces: after, mb: Math.round(bytes / 1e5) / 10, size });
      data.push({ file: m.file, use: m.use, objType: m.objType, genera: m.genera, generic: !!m.generic, ...(m.rural ? { rural: true } : {}),
        name: m.name, author: m.author, licence: m.licence, url: m.url, ratio: Math.round(Math.max(size[0], size[2]) / size[1] * 100) / 100 });
      console.log(`${m.file}: ${before} -> ${after} faces, ${(bytes / 1e6).toFixed(1)} MB`);
    } catch (e) {
      report.push({ file: m.file, error: e.message });
      console.log(`${m.file}: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(work, 'bake-report.json'), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(root, 'src', 'model-bank-data.js'), `/**
 * @file model-bank-data.js
 * THE BUILT-IN MODEL BANK (#480f), WRITTEN BY tools/model-bank-bake.mjs (do not edit by hand): the light .glb
 * files of assets/model-bank, each with its use (a built-in object it stands for), the genera it shows (OSM's
 * and GBIF's names), whether it may stand for any of its use (\`generic\`), its width over its height, and its
 * credit (CC-BY: author, licence, Sketchfab page). PURE.
 */
export const MODEL_BANK = Object.freeze(${JSON.stringify(data, null, 1)});
`);
  const total = report.reduce((s, r) => s + (r.mb || 0), 0);
  console.log(`\n${data.length} models baked, ${report.length - data.length} failed, ${total.toFixed(1)} MB in all. Report: model-bank/bake-report.json`);
}

app.whenReady().then(bake).catch(e => console.error(e)).finally(() => app.quit());
