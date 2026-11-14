/**
 * tools/model-bank-bake.mjs: BAKES THE MODEL BANK (#480f), on Durzo's computer, after
 * tools/model-bank-download.cjs: `npx electron tools/model-bank-bake.mjs` from the project's root (dev
 * dependencies installed: npm install). In Electron for its images (nativeImage): sharp, first used, failed on
 * 62 models of 66 (« colourspace: parameter space not set », its libvips at odds with its JavaScript).
 *
 * Each source (model-bank/sources/<uid>.glb, as downloaded: up to 3 million faces) becomes a light
 * assets/model-bank/<file>: duplicates and unused data pruned, vertices welded, simplified to MAX_FACES at most
 * (meshoptimizer), textures shrunk to TEXTURE_PX (Electron's nativeImage; JPEG stays JPEG, the rest PNG: the
 * application reads no compressed glTF), its base on the ground at the origin (`sink`: metres pushed under, roots for one oak).
 * Writes src/model-bank-data.js (what the application reads: files, uses, genera, credits, sizes) and
 * model-bank/bake-report.json (faces before and after, weights: to check by eye in the application).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { app, nativeImage } from 'electron';

/** The most faces a bank model keeps: a street holds dozens of trees. */
const MAX_FACES = 30000;
/** The largest texture side kept (pixels). */
const TEXTURE_PX = 1024;

/** Every texture of a document no larger than TEXTURE_PX a side (its proportions kept). Returns how many shrank. */
function shrinkTextures(doc){
  let n = 0;
  for (const t of doc.getRoot().listTextures()) {
    const bytes = t.getImage(), mime = t.getMimeType();
    if (!bytes || !/^image\/(png|jpeg)$/.test(mime)) continue;
    const img = nativeImage.createFromBuffer(Buffer.from(bytes));
    const { width, height } = img.getSize();
    if (!width || Math.max(width, height) <= TEXTURE_PX) continue;
    const k = TEXTURE_PX / Math.max(width, height);
    const small = img.resize({ width: Math.round(width * k), height: Math.round(height * k), quality: 'best' });
    t.setImage(new Uint8Array(mime === 'image/jpeg' ? small.toJPEG(88) : small.toPNG()));
    n++;
  }
  return n;
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
      if (before > MAX_FACES) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_FACES / before, error: 0.02 }));
      shrinkTextures(doc);
      await doc.transform(prune());
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
      console.log(`${m.file}: ${before} → ${after} faces, ${(bytes / 1e6).toFixed(1)} MB`);
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
