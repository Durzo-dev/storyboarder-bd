// Pont sécurisé (contextIsolation: true, nodeIntegration: false) entre le renderer (index.html) et le
// process principal Electron, exposé sous window.storyboarderAPI. Nécessaire car l'API web File System
// Access (showSaveFilePicker/showOpenFilePicker) n'est PAS disponible pour les pages chargées en file://
// (ni dans Brave, ni dans Electron, qui utilise aussi file:// via win.loadFile), seule la voie native
// Electron (dialog + fs côté main process, cf. main.js) permet de choisir un fichier .json et d'y
// réécrire ensuite silencieusement, ce qui est indispensable pour la sauvegarde automatique.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('storyboarderAPI', {
  saveProjectAs: (json, suggestedName) => ipcRenderer.invoke('project:saveAs', json, suggestedName),
  writeProjectFile: (filePath, json) => ipcRenderer.invoke('project:write', filePath, json),
  openProjectDialog: () => ipcRenderer.invoke('project:open'),
  renameProjectFile: (filePath, newName) => ipcRenderer.invoke('project:rename', filePath, newName),
  deleteProjectFile: (filePath) => ipcRenderer.invoke('project:delete', filePath),
  getLastProject: () => ipcRenderer.invoke('project:getLastProject'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getProjectsDir: () => ipcRenderer.invoke('settings:getProjectsDir'),
  chooseProjectsDir: () => ipcRenderer.invoke('settings:chooseProjectsDir'),
  // Modèles 3D importés (.glb), rangés dans <dossier de Projets>/Modeles. Le pont ne fait que des
  // entrées-sorties : c'est src/model-store.js qui décide du nom retenu et des collisions, pour que
  // cette décision reste testable. Cf. l'exception documentée dans docs/en/architecture.md, règle n°1.
  pickModelFile: () => ipcRenderer.invoke('models:pick'),
  writeModelFile: (name, data) => ipcRenderer.invoke('models:write', name, data),
  readModelFile: (name) => ipcRenderer.invoke('models:read', name),
  listModelFiles: () => ipcRenderer.invoke('models:list'),
  deleteModelFile: (name) => ipcRenderer.invoke('models:delete', name),
  renameModelFile: (ancien, nouveau) => ipcRenderer.invoke('models:rename', ancien, nouveau),
  // Images de Case, rangées dans <dossier de Projets>/Images. Même partage des rôles que pour les
  // modèles : le pont fait des entrées-sorties, src/image-store.js décide. Cf. la même exception
  // documentée dans docs/en/architecture.md, règle n°1.
  pickImageFile: () => ipcRenderer.invoke('images:pick'),
  writeImageFile: (name, data) => ipcRenderer.invoke('images:write', name, data),
  readImageFile: (name) => ipcRenderer.invoke('images:read', name),
  listImageFiles: () => ipcRenderer.invoke('images:list'),
  deleteImageFile: (name) => ipcRenderer.invoke('images:delete', name),
  renameImageFile: (ancien, nouveau) => ipcRenderer.invoke('images:rename', ancien, nouveau),
  // Bâtiments (#454a), rangés dans <dossier de Projets>/Batiments. Même exception que les modèles
  // et les images (docs/en/architecture.md, règle n°1) ; src/batiment-store.js décide.
  listBatimentFiles: () => ipcRenderer.invoke('batiments:list'),
  readBatimentFile: (name) => ipcRenderer.invoke('batiments:read', name),
  writeBatimentFile: (name, texte) => ipcRenderer.invoke('batiments:write', name, texte),
  deleteBatimentFile: (name) => ipcRenderer.invoke('batiments:delete', name),
  renameBatimentFile: (ancien, nouveau) => ipcRenderer.invoke('batiments:rename', ancien, nouveau),
  // Polices de l'utilisateur (#423), rangées dans <dossier de Projets>/Polices. Même exception que
  // les modèles et les images (docs/en/architecture.md, règle n°1). L'import se fait en deux temps :
  // choisir et lire, puis écrire une fois les conflits de nom tranchés.
  listFonts: () => ipcRenderer.invoke('fonts:list'),
  readFontFile: (fichier) => ipcRenderer.invoke('fonts:read', fichier),
  pickFonts: (integrees) => ipcRenderer.invoke('fonts:pick', integrees),
  commitFonts: (jeton, choix, integrees) => ipcRenderer.invoke('fonts:commit', jeton, choix, integrees),
  renameFont: (ancien, nouveau, integrees) => ipcRenderer.invoke('fonts:rename', ancien, nouveau, integrees),
  deleteFont: (nom) => ipcRenderer.invoke('fonts:delete', nom),
  fontUsageOperation: (op, args, depart) => ipcRenderer.invoke('fonts:usage', op, args, depart),
  // Le store de polices (#423, Fontsource) : chercher, l'aperçu d'une police, et la télécharger,
  // ce qui rend un jeton pour commitFonts, comme un import de fichiers.
  fontStoreInfos: () => ipcRenderer.invoke('fontstore:infos'),
  fontStoreChercher: (params) => ipcRenderer.invoke('fontstore:chercher', params),
  fontStoreApercu: (id, graisse, italique) => ipcRenderer.invoke('fontstore:apercu', id, graisse, italique),
  fontStoreAjouter: (id, integrees) => ipcRenderer.invoke('fontstore:ajouter', id, integrees),
  readSkeletonMaps: () => ipcRenderer.invoke('skeletons:read'),
  writeSkeletonMaps: (contenu) => ipcRenderer.invoke('skeletons:write', contenu),
  // Flux de confirmation avant de quitter (cf. main.js, événement 'close' intercepté + quitConfirmModal
  // dans index.html), sur demande utilisateur : propose Enregistrer et quitter / Quitter sans
  // enregistrer / Annuler plutôt que d'empêcher la fermeture en attendant une sauvegarde.
  onRequestQuitConfirmation: (callback) => ipcRenderer.on('app:requestQuitConfirmation', () => callback()),
  confirmQuit: () => ipcRenderer.send('app:confirmQuit'),
  // Mises à jour (#442) : l'état décidé au démarrage par le processus principal, l'installation
  // (téléchargement vérifié puis redémarrage), et sa progression.
  majEtat: () => ipcRenderer.invoke('maj:etat'),
  majInstaller: () => ipcRenderer.invoke('maj:installer'),
  onMajProgression: (callback) => ipcRenderer.on('maj:progression', (e, recus, total) => callback(recus, total)),
  // Store de ressources (#444) : ce qu'il faut pour les filtres, et une recherche. Le processus
  // principal fait la requête et rend une page déjà normalisée (store-sources.js).
  // #446b : le store de textures (une fenêtre à part).
  texturesInfos: () => ipcRenderer.invoke('textures:infos'),
  texturesChercher: (sourceId, params) => ipcRenderer.invoke('textures:chercher', sourceId, params),
  texturesOptions: (sourceId, id) => ipcRenderer.invoke('textures:options', sourceId, id),
  texturesTelecharger: (sourceId, id, resolution) => ipcRenderer.invoke('textures:telecharger', sourceId, id, resolution),
  texturesMes: () => ipcRenderer.invoke('textures:mes'),
  texturesSupprimer: (cle) => ipcRenderer.invoke('textures:supprimer', cle),
  texturesImage: (cle, quoi) => ipcRenderer.invoke('textures:image', cle, quoi),
  texturesImporter: () => ipcRenderer.invoke('textures:importer'),
  texturesMatieres: (cle, matieres) => ipcRenderer.invoke('textures:matieres', cle, matieres),
  surProgressionTexture: (rappel) => {
    const f = (event, sourceId, id, recus, total) => rappel(sourceId, id, recus, total);
    ipcRenderer.on('textures:progression', f);
    return () => ipcRenderer.removeListener('textures:progression', f);
  },
  storeInfos: (sourceId) => ipcRenderer.invoke('store:infos', sourceId),
  storeChercher: (sourceId, params) => ipcRenderer.invoke('store:chercher', sourceId, params),
  // Les modèles déjà téléchargés depuis le store, pour ne pas les proposer deux fois.
  storeTelecharges: () => ipcRenderer.invoke('store:telecharges'),
  // Vignettes des modèles locaux : ce qui est à rendre, lire une vignette, en écrire une.
  vignettesEtat: () => ipcRenderer.invoke('vignettes:etat'),
  modelesInfos: () => ipcRenderer.invoke('models:infos'),
  // La catégorie choisie et les tags des modèles : lire, et une opération à la fois.
  bibliothequeLire: () => ipcRenderer.invoke('bibliotheque:lire'),
  bibliothequeOperation: (op, args) => ipcRenderer.invoke('bibliotheque:operation', op, args),
  vignettesLire: (nom) => ipcRenderer.invoke('vignettes:lire', nom),
  vignettesEcrire: (nom, data, meta) => ipcRenderer.invoke('vignettes:ecrire', nom, data, meta),
  vignettesMesures: (nom, meta) => ipcRenderer.invoke('vignettes:mesures', nom, meta),
  // #445 : poids annoncé, téléchargement (le .glb revient ici pour être rangé), attribution.
  storePoids: (sourceId, id) => ipcRenderer.invoke('store:poids', sourceId, id),
  storeTelecharger: (sourceId, id, resolution) => ipcRenderer.invoke('store:telecharger', sourceId, id, resolution),
  storeAttribuer: (resultat, fichier, resolution) => ipcRenderer.invoke('store:attribuer', resultat, fichier, resolution),
  onStoreProgression: (callback) => ipcRenderer.on('store:progression', (e, recus, total) => callback(recus, total)),
  // L'aperçu 3D d'une fiche : le .glb en mémoire, jamais rangé.
  storeApercu: (sourceId, id) => ipcRenderer.invoke('store:apercu', sourceId, id),
  onStoreApercuProgression: (callback) => ipcRenderer.on('store:apercuProgression', (e, s, id, recus, total) => callback(s, id, recus, total)),
});
