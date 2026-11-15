/** tools/ez-tree/preload.cjs: the trial page's two calls to the tool (save a .glb, say it is done). */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ez', {
  save: (name, bytes, info) => ipcRenderer.invoke('ez:save', name, bytes, info),
  done: (error) => ipcRenderer.invoke('ez:done', error || null),
});
