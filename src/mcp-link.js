/**
 * @file mcp-link.js
 * THE AI CONNECTION, the window's side (docs/en/mcp.md): the messages an AI's client sends to the local
 * endpoint (electron/mcp-server.js) arrive here, are answered by mcp-protocol.js with the tools of
 * mcp-tools.js, bound here to the application's gestures; and the AI tab of Settings.
 */

import { S, tr } from './state.js';
import { handleMessage, describeTool } from './mcp-protocol.js';
import { makeTools, INSTRUCTIONS } from './mcp-tools.js';
import { importerPourIA } from './real-place-ui.js';
import { connectionTexts } from './mcp-status.js';

const $ = (id) => document.getElementById(id);
const frames = (n = 2) => new Promise(ok => { const step = (k) => (k ? requestAnimationFrame(() => step(k - 1)) : ok()); step(n); });

/** Waits until nothing is being built or imported (the cards over the Scene and the « New scene » window). */
async function untilBuilt(){
  for (let i = 0; i < 1200; i++) {
    const loading = $('sceneLoading');
    const importing = $('realPlaceModal') && !$('realPlaceModal').classList.contains('hidden');
    if ((!loading || loading.hidden) && !importing) return;
    await new Promise(ok => setTimeout(ok, 250));
  }
}

let _rappels = { openScene: () => {}, version: '' };

/**
 * Wires the connection once (events.js): `openScene(id)`, the application's; `version`, its version. The
 * tools are made here; their list is given to the main process, which keeps it for the bridge.
 */
export function cablerConnexionIA(rappels){
  _rappels = { ..._rappels, ...rappels };
  const api = window.storyboarderAPI;
  if (!api || !api.onMcpRequest) return;
  const tools = makeTools({
    scenes: () => S.scenes,
    importPlace: (args) => importerPourIA(args),
    preview: async (scene) => {
      await untilBuilt();
      if (S.editingSceneId !== scene.id) _rappels.openScene(scene.id);
      await untilBuilt();
      await frames(3);
      const r = $('board').getBoundingClientRect();
      return api.mcpCapture({ x: r.left, y: r.top, width: r.width, height: r.height });
    },
  });
  const serverInfo = { name: 'storyboarder', title: 'Storyboarder', version: _rappels.version || '' };
  api.onMcpRequest(async (n, message) => {
    let response;
    try { response = await handleMessage(message, { tools, serverInfo, instructions: INSTRUCTIONS }); } catch (e) {
      response = { jsonrpc: '2.0', id: message && message.id !== undefined ? message.id : null, error: { code: -32603, message: String(e && e.message || e) } };
    }
    api.mcpRespond(n, response);
  });
  api.mcpTools(tools.map(describeTool));
  cablerReglage();
}

// ── The AI tab of Settings ───────────────────────────────────────────────────────────────────────

/** The clients, in the tab's order: their card's ids. */
const CLIENTS = [
  ['claude', 'mcpInstallClaude', 'mcpClaudeEtat'],
  ['lmstudio', 'mcpInstallLmStudio', 'mcpLmStudioEtat'],
  ['antigravity', 'mcpInstallAntigravity', 'mcpAntigravityEtat'],
  ['gemini', 'mcpInstallGemini', 'mcpGeminiEtat'],
];
/** A message under a card, said after a click (it holds until the client is connected). */
const _messages = {};
let _etat = null;

/** Is the AI tab the one shown? (« Disconnect » lives in the modal's buttons, shown on this tab only.) */
const ongletIaAffiche = () => {
  const page = document.querySelector('#settingsModal .config-page[data-onglet="ia"]');
  return !!page && !page.hidden;
};

/** The tab from the connection's state (mcp-status.js decides the words). */
function montrerEtat(etat){
  if (!etat) return;
  _etat = etat;
  const t = connectionTexts(etat, tr);
  $('mcpStatus').textContent = t.general;
  for (const [k, , id] of CLIENTS) {
    const el = $(id);
    const message = _messages[k] && t[k].level !== 'connected' ? _messages[k] : null;
    el.textContent = message || t[k].text;
    el.dataset.niveau = t[k].level;
  }
  $('mcpDisconnect').hidden = !(etat.enabled && ongletIaAffiche());
}

/** While the AI tab is shown, its state is read again every few seconds (a client connects meanwhile). */
const REFRESH_MS = 3000;
function suivreEtat(){
  const api = window.storyboarderAPI;
  setInterval(() => {
    const modale = $('settingsModal');
    if (modale && !modale.classList.contains('hidden') && ongletIaAffiche()) api.mcpStatus().then(montrerEtat);
  }, REFRESH_MS);
}

/** An official logo that is not there: the card's generic illustration instead. */
function logosDeSecours(){
  document.querySelectorAll('#settingsModal .ia-client .ia-logo').forEach(img => {
    const secours = () => { img.hidden = true; const ill = img.parentElement.querySelector('.ia-illustration'); if (ill) ill.hidden = false; };
    img.addEventListener('error', secours);
    if (img.complete && !img.naturalWidth) secours();
  });
}

function cablerReglage(){
  const api = window.storyboarderAPI;
  if (!$('mcpStatus')) return;
  logosDeSecours();
  api.mcpStatus().then(montrerEtat);
  suivreEtat();
  // Settings opened again (on the AI tab, kept from last time): its state at once.
  new MutationObserver(() => { if (!$('settingsModal').classList.contains('hidden')) api.mcpStatus().then(montrerEtat); })
    .observe($('settingsModal'), { attributes: true, attributeFilter: ['class'] });
  // « Disconnect » shows on the AI tab only: the tabs' clicks are watched (events.js switches them).
  document.querySelectorAll('#configOnglets .onglet').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.onglet === 'ia') api.mcpStatus().then(montrerEtat);
    else $('mcpDisconnect').hidden = true;
  }));
  $('mcpDisconnect').onclick = async () => {
    for (const k of Object.keys(_messages)) delete _messages[k];
    montrerEtat(await api.mcpSetEnabled(false));
  };
  // Every install connects Storyboarder (main.js). A client not on this computer: its download page.
  const absent = (k) => _etat && _etat[k] && _etat[k].installed === false;
  const installer = {
    claude: async () => {
      const r = await api.mcpInstallClaude();
      _messages.claude = r && r.ok
        ? tr('Click « Install » in Claude Desktop, then restart it.', 'Cliquez sur « Installer » dans Claude Desktop, puis relancez-le.')
        : tr('Claude Desktop is not installed: its download page is open. Then click this card again.', 'Claude Desktop n\'est pas installé : sa page de téléchargement est ouverte. Recliquez ensuite sur cette carte.');
      montrerEtat(r && r.state);
    },
    lmstudio: async () => {
      if (absent('lmstudio')) { api.mcpOpenDownload('lmstudio'); return; }
      const r = await api.mcpInstallLmStudio();
      _messages.lmstudio = r && r.ok ? tr('Confirm in LM Studio.', 'Confirmez dans LM Studio.') : tr('LM Studio could not be opened.', 'LM Studio n\'a pas pu s\'ouvrir.');
      montrerEtat(r && r.state);
    },
    antigravity: () => ajouter('antigravity'),
    gemini: () => ajouter('gemini'),
  };
  // Google Antigravity and Gemini CLI: Storyboarder added to the client's file; a file it cannot rewrite: the
  // configuration copied, to paste in it.
  async function ajouter(kind){
    if (absent(kind)) { api.mcpOpenDownload(kind); return; }
    const r = await (kind === 'antigravity' ? api.mcpInstallAntigravity() : api.mcpInstallGemini());
    if (r && r.ok) _messages[kind] = tr('Added. Restart it if it was open.', 'Ajouté. Relancez-le s\'il était ouvert.');
    else {
      let copie = false;
      try { await navigator.clipboard.writeText(r.config); copie = true; } catch { /* the message says so */ }
      _messages[kind] = copie
        ? tr(`Its settings could not be changed (comments in the file?). The configuration is copied: paste it in ${r.file}.`,
          `Ses réglages n'ont pas pu être modifiés (commentaires dans le fichier ?). La configuration est copiée : collez-la dans ${r.file}.`)
        : tr('Its settings could not be changed.', 'Ses réglages n\'ont pas pu être modifiés.');
    }
    montrerEtat(r && r.state);
  }
  // The whole card answers, not only its title (the button keeps the keyboard), as a new Scene's choice.
  for (const [kind, id] of CLIENTS) $(id).onclick = (e) => { e.stopPropagation(); installer[kind](); };
  document.querySelectorAll('#settingsModal .ia-client').forEach(c => {
    c.addEventListener('click', () => installer[c.dataset.client]());
  });
}
