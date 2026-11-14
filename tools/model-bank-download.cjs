/**
 * tools/model-bank-download.cjs: DOWNLOADS THE MODEL BANK'S SOURCES (#480f) from Sketchfab, once, on Durzo's
 * computer: `npx electron tools/model-bank-download.cjs` from the project's root.
 *
 * Sketchfab's download API needs a signed-in account (API Agreement 4.6): the application's own session is
 * used (the token stays in sketchfab-session.js, never printed). Sign in to Sketchfab in Storyboarder first.
 * Each model of model-bank/sources.json goes to model-bank/sources/<uid>.glb (not shipped, not
 * in git); a file already there is kept. Then: `node tools/model-bank-bake.mjs`.
 */
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// The application's own data (its session): in development, the folder of package.json's `name`.
app.setPath('userData', path.join(app.getPath('appData'), require('../package.json').name));

app.whenReady().then(async () => {
  const session = require('../electron/bibliotheque/sketchfab-session');
  const store = require('../electron/bibliotheque/store');
  const root = path.join(__dirname, '..', 'model-bank');
  const out = path.join(root, 'sources');
  fs.mkdirSync(out, { recursive: true });
  const { models } = JSON.parse(fs.readFileSync(path.join(root, 'sources.json'), 'utf8'));
  const status = await session.status();
  if (!status || !status.connected) {
    console.log('Not signed in to Sketchfab: sign in from Storyboarder (the store, or a Realistic import), then run this again.');
    app.quit();
    return;
  }
  let done = 0, kept = 0;
  const failed = [];
  for (const m of models) {
    const file = path.join(out, `${m.uid}.glb`);
    if (fs.existsSync(file)) { kept++; continue; }
    process.stdout.write(`${m.file} (${m.name})… `);
    const r = await store.telecharger('sketchfab', m.uid, 'origine', null, null, () => session.accessToken());
    if (!r || r.erreur || !r.data) { console.log(`failed: ${(r && r.erreur) || 'no answer'}`); failed.push(m.file); continue; }
    fs.writeFileSync(file, Buffer.from(r.data));
    console.log(`${(r.data.length / 1e6).toFixed(1)} MB`);
    done++;
  }
  console.log(`\nDownloaded ${done}, already there ${kept}, failed ${failed.length}${failed.length ? `: ${failed.join(', ')}` : ''}.`);
  console.log('Next: node tools/model-bank-bake.mjs');
  app.quit();
});
