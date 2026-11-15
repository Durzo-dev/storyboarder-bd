/**
 * tools/ez-tree/export.cjs: A TRIAL OF EZ-TREE (#480f, asked by Durzo on 15 Nov. 2026): trees GENERATED, ours,
 * instead of searched under licences. `npx electron tools/ez-tree/export.cjs` from the project's root (dev
 * dependencies: npm install). EZ-Tree (Dan Greenheck, MIT; its barks from Poly Haven and TextureCan, CC0) needs
 * three 0.167 or later: a hidden window loads it with its own three (`three-ez`, an alias: the application keeps
 * its three 0.128), generates each preset, exports it as .glb into the Projects' « Modeles » folder (« EZ … »),
 * to be seen in « My models ». A trial: nothing of it is shipped.
 */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');

app.setPath('userData', path.join(app.getPath('appData'), require('../../package.json').name));

/** The application's « Modeles » folder (its settings' Projects folder, else the default one). */
function modelsDir(){
  let projets = null;
  try { projets = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8')).projectsDir || null; } catch (e) { /* default */ }
  return path.join(projets || path.join(__dirname, '..', '..', 'Projets'), 'Modeles');
}

app.whenReady().then(() => {
  const out = modelsDir();
  fs.mkdirSync(out, { recursive: true });
  ipcMain.handle('ez:save', (event, name, bytes, info) => {
    fs.writeFileSync(path.join(out, name), Buffer.from(bytes));
    console.log(`${name}: ${info.triangles} triangles, ${(bytes.byteLength / 1e6).toFixed(1)} MB, ${info.size.join(' x ')} m`);
  });
  ipcMain.handle('ez:done', (event, error) => {
    console.log(error ? `Failed: ${error}` : `\nDone: in ${out}`);
    app.quit();
  });
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs') } });
  win.loadFile(path.join(__dirname, 'export.html'));
});
