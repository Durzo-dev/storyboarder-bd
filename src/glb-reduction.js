/**
 * @file glb-reduction.js
 * #467: shrinks the textures of a .glb to a resolution (1k: 1024 px on the longest side), in the
 * interface: decoding and encoding images needs a canvas, which the main process has not. The reading
 * and rewriting of the file are pure and tested (glb-images.js); this part is checked in the app.
 */
import { lireGlb, imagesDuGlb, remplacerImages, tailleReduite } from './glb-images.js';

/**
 * An image at `l × h`, drawn in halving steps (a single big step makes a grainy result), then encoded in
 * its own format.
 */
async function redimensionner(bmp, l, h, mime){
  let source = bmp, sl = bmp.width, sh = bmp.height;
  while (sl / 2 >= l && sh / 2 >= h) {
    const demi = new globalThis.OffscreenCanvas(Math.round(sl / 2), Math.round(sh / 2));
    const c = demi.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(source, 0, 0, demi.width, demi.height);
    source = demi; sl = demi.width; sh = demi.height;
  }
  const toile = new globalThis.OffscreenCanvas(l, h);
  const c = toile.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.drawImage(source, 0, 0, l, h);
  const blob = await toile.convertToBlob({ type: mime, quality: 0.9 });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * The .glb `octets` with every texture larger than `max` pixels brought down to it. An image that cannot
 * be decoded, or that would come out heavier, is kept as it is. `avance(fait, total)` follows the images.
 * Returns the original bytes when nothing changed.
 */
export async function reduireTexturesGlb(octets, max, avance = () => {}){
  const { json, bin } = lireGlb(octets);
  const images = imagesDuGlb(json, bin);
  const remplacements = new Map();
  let fait = 0;
  for (const im of images) {
    let bmp = null;
    try {
      // No colour conversion, no premultiplied alpha: normal and roughness maps are data, not pictures.
      bmp = await createImageBitmap(new Blob([im.octets], { type: im.mime }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const t = tailleReduite(bmp.width, bmp.height, max);
      if (t.reduite) {
        const nouveaux = await redimensionner(bmp, t.l, t.h, im.mime);
        if (nouveaux.byteLength > 0 && nouveaux.byteLength < im.octets.byteLength) remplacements.set(im.index, { octets: nouveaux, mime: im.mime });
      }
    } catch (e) {
      /* an image the canvas cannot read stays as it is */
    } finally {
      if (bmp && bmp.close) bmp.close();
      avance(++fait, images.length);
    }
  }
  return remplacements.size ? remplacerImages(json, bin, remplacements) : octets;
}
