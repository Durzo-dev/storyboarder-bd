/**
 * @file glb-images.js
 * #467: the textures of a .glb, read and replaced. PURE (bytes in, bytes out), tested under Node.
 *
 * Sketchfab gives ONE .glb, its textures at the author's size. To offer 1k / 2k like Poly Haven, the
 * interface shrinks the images itself (reduireTexturesGlb, canvas: not here) and rewrites the file
 * with them (remplacerImages). The rest of the file is copied as is: geometry, animations, skeleton.
 */

const MAGIC = 0x46546c67;      // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const BIN_CHUNK = 0x004e4942;  // "BIN\0"
const aligner = (n) => (n + 3) & ~3;

/** The parts of a .glb: `{ json, bin }` (bin: Uint8Array or null). Throws on anything else. */
export function lireGlb(octets){
  const u8 = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.byteLength < 20 || dv.getUint32(0, true) !== MAGIC || dv.getUint32(4, true) !== 2) throw new Error('not a GLB 2.0');
  const lj = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== JSON_CHUNK) throw new Error('no JSON chunk');
  const json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + lj)));
  let bin = null;
  const p = 20 + lj;
  if (p + 8 <= u8.byteLength && dv.getUint32(p + 4, true) === BIN_CHUNK) bin = u8.subarray(p + 8, p + 8 + dv.getUint32(p, true));
  return { json, bin };
}

/**
 * The images stored in the binary chunk: `[{ index, mime, octets }]`. Images given by `uri` (rare in a
 * .glb) and compressed formats a canvas cannot read (KTX2) are left out: they are kept as they are.
 */
export function imagesDuGlb(json, bin){
  const vues = (json && json.bufferViews) || [];
  return ((json && json.images) || []).map((im, index) => {
    if (!im || !Number.isInteger(im.bufferView) || !bin) return null;
    const v = vues[im.bufferView];
    if (!v || (v.buffer || 0) !== 0) return null;
    const mime = im.mimeType || '';
    if (!/^image\/(png|jpeg|webp)$/.test(mime)) return null;
    const debut = v.byteOffset || 0;
    return { index, mime, octets: bin.subarray(debut, debut + v.byteLength) };
  }).filter(Boolean);
}

/**
 * A new .glb where the images of `remplacements` (`Map(index → { octets, mime })`) take the place of the
 * old ones. Every buffer view is copied into a new binary chunk, in order, aligned on 4 bytes; offsets
 * and lengths are rewritten, nothing else changes (accessors point to views, not to offsets).
 */
export function remplacerImages(json, bin, remplacements){
  const j = JSON.parse(JSON.stringify(json));
  const vues = j.bufferViews || [];
  const parVue = new Map();
  for (const [index, r] of remplacements) {
    const im = j.images && j.images[index];
    if (!im || !Number.isInteger(im.bufferView)) continue;
    parVue.set(im.bufferView, r.octets);
    if (r.mime) im.mimeType = r.mime;
  }
  const morceaux = [];
  let longueur = 0;
  vues.forEach((v, i) => {
    if ((v.buffer || 0) !== 0) return;
    const debut = v.byteOffset || 0;
    const octets = parVue.has(i) ? parVue.get(i) : bin.subarray(debut, debut + v.byteLength);
    const pos = aligner(longueur);
    if (pos > longueur) morceaux.push(new Uint8Array(pos - longueur));
    morceaux.push(octets);
    v.byteOffset = pos;
    v.byteLength = octets.byteLength;
    longueur = pos + octets.byteLength;
  });
  const nouveauBin = concatener(morceaux, aligner(longueur));
  if (j.buffers && j.buffers[0]) { j.buffers[0].byteLength = longueur; delete j.buffers[0].uri; }
  return ecrireGlb(j, nouveauBin);
}

function concatener(morceaux, total){
  const sortie = new Uint8Array(total);
  let p = 0;
  for (const m of morceaux) { sortie.set(m, p); p += m.byteLength; }
  return sortie;
}

/** A .glb from its JSON and its binary chunk (already padded to 4 bytes). */
export function ecrireGlb(json, bin){
  const texte = new TextEncoder().encode(JSON.stringify(json));
  const lj = aligner(texte.byteLength);
  const total = 12 + 8 + lj + (bin ? 8 + bin.byteLength : 0);
  const u8 = new Uint8Array(total);
  const dv = new DataView(u8.buffer);
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, lj, true); dv.setUint32(16, JSON_CHUNK, true);
  u8.set(texte, 20);
  u8.fill(0x20, 20 + texte.byteLength, 20 + lj);   // JSON pads with spaces
  if (bin) {
    const p = 20 + lj;
    dv.setUint32(p, bin.byteLength, true); dv.setUint32(p + 4, BIN_CHUNK, true);
    u8.set(bin, p + 8);
  }
  return u8;
}

/** The size of an image brought down to `max` pixels on its longest side; unchanged if already within. */
export function tailleReduite(l, h, max){
  const m = Math.max(l, h);
  if (!(max > 0) || m <= max) return { l, h, reduite: false };
  const k = max / m;
  return { l: Math.max(1, Math.round(l * k)), h: Math.max(1, Math.round(h * k)), reduite: true };
}

/** The pixels of a resolution: '1k' → 1024, '2k' → 2048; 'origine' (or anything else) → null. */
export function pixelsDe(resolution){
  const m = /^(\d+)k$/.exec(String(resolution || ''));
  return m ? Number(m[1]) * 1024 : null;
}

/**
 * The texture qualities offered for a Sketchfab model, from its largest texture: 1k and 2k when they
 * are SMALLER than it, then the original. `[{ resolution, octets }]`: only the original's weight is
 * known (the others are made on this computer). An unknown largest texture offers the original only.
 */
export function optionsSketchfab(textureMax, poids){
  const opts = [];
  if (textureMax > 1024) opts.push({ resolution: '1k', octets: null });
  if (textureMax > 2048) opts.push({ resolution: '2k', octets: null });
  opts.push({ resolution: 'origine', octets: poids > 0 ? poids : null });
  return opts;
}
