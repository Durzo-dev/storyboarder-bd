/**
 * tools/ez-tree/fetch-barks.cjs: THE BARKS OF OUR TREE SPECIES (#480g, download agreed by Durzo on 15 Nov. 2026).
 * `npx electron tools/ez-tree/fetch-barks.cjs` from the project's root (Internet needed): for each species of
 * src/tree-species.js, Poly Haven's colour map of its bark (CC0, 1k JPEG), brought to 512 px, JPEG quality 90,
 * written as assets/textures/ecorce-<species>.jpg (`barkFile`). Each needs its row in assets/textures/LICENSES.md.
 *
 * A bark already there is left as it is (to fetch it again, delete its file first).
 *
 * 512 px: measured on the four first barks, 64 to 116 KB each (1024 px: 260 to 440 KB), and a trunk is never
 * seen bigger than that in a panel. Electron's nativeImage resizes (no image library in the project).
 */
const path = require('path');
const fs = require('fs');
const { app, nativeImage } = require('electron');

const OUT = path.join(__dirname, '..', '..', 'assets', 'textures');
const SIZE = 512;
const url = (id) => `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${id}/${id}_diff_1k.jpg`;

async function fetchBarks(){
  const { SPECIES, barkFile } = await import('../../src/tree-species.js');
  let failed = 0;
  for (const [name, sp] of Object.entries(SPECIES)) {
    if (fs.existsSync(path.join(OUT, barkFile(name)))) continue;
    try {
      const res = await fetch(url(sp.bark));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const img = nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer()));
      if (img.isEmpty()) throw new Error('not an image');
      const jpeg = img.resize({ width: SIZE, height: SIZE, quality: 'best' }).toJPEG(90);
      fs.writeFileSync(path.join(OUT, barkFile(name)), jpeg);
      console.log(`${barkFile(name)}: ${sp.bark}, ${Math.round(jpeg.length / 1024)} KB`);
    } catch (e) {
      failed++;
      console.error(`${name} (${sp.bark}): ${e.message}`);
    }
  }
  console.log(failed ? `\n${failed} failed.` : '\nDone.');
  app.exit(failed ? 1 : 0);
}

app.whenReady().then(fetchBarks);
