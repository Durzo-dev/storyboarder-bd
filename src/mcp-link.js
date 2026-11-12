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

/** A message under a card, said after a click (it stays until the next state that changes the card). */
const _messages = { claude: null, antigravity: null, gemini: null };

/** The tab from the connection's state (mcp-status.js decides the words). */
function montrerEtat(etat){
  if (!etat) return;
  const t = connectionTexts(etat, tr);
  $('mcpEnabledCheckbox').checked = !!etat.enabled;
  $('mcpStatus').textContent = t.general;
  for (const [k, id] of [['claude', 'mcpClaudeEtat'], ['antigravity', 'mcpAntigravityEtat'], ['gemini', 'mcpGeminiEtat']]) {
    const el = $(id);
    // A click's message holds until the client is seen.
    const message = _messages[k] && t[k].level !== 'connected' ? _messages[k] : null;
    el.textContent = message || t[k].text;
    el.dataset.niveau = t[k].level;
  }
}

/** While the AI tab is shown, its state is read again every few seconds (a client connects meanwhile). */
const REFRESH_MS = 3000;
function suivreEtat(){
  const api = window.storyboarderAPI;
  setInterval(() => {
    const modale = $('settingsModal');
    const page = document.querySelector('#settingsModal .config-page[data-onglet="ia"]');
    if (modale && !modale.classList.contains('hidden') && page && !page.hidden) api.mcpStatus().then(montrerEtat);
  }, REFRESH_MS);
}

function cablerReglage(){
  const api = window.storyboarderAPI;
  const box = $('mcpEnabledCheckbox');
  if (!box) return;
  api.mcpStatus().then(montrerEtat);
  suivreEtat();
  $('configOngletIa').addEventListener('click', () => api.mcpStatus().then(montrerEtat));
  box.onchange = async () => montrerEtat(await api.mcpSetEnabled(box.checked));
  // Claude Desktop: an extension made for this computer, which Claude Desktop offers to install in one click.
  // Installing turns the connection on (main.js).
  const installerClaude = async () => {
    const r = await api.mcpInstallClaude();
    _messages.claude = r && r.ok
      ? tr('Claude Desktop shows its installation window: click « Install », then restart Claude Desktop.',
        'Claude Desktop affiche sa fenêtre d\'installation : cliquez sur « Installer », puis relancez Claude Desktop.')
      : tr('Claude Desktop does not seem to be installed. The extension file is shown in its folder: drag it into Claude Desktop\'s window.',
        'Claude Desktop ne semble pas installé. Le fichier de l\'extension est montré dans son dossier : glissez-le dans la fenêtre de Claude Desktop.');
    montrerEtat(r && r.state);
  };
  // Google Antigravity and Gemini CLI: Storyboarder added to the client's file; a file it cannot rewrite: the
  // configuration copied, to paste in it.
  const ajouter = async (kind) => {
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
  };
  const installer = { claude: installerClaude, antigravity: () => ajouter('antigravity'), gemini: () => ajouter('gemini') };
  // The whole card answers, not only its title (the button keeps the keyboard), as a new Scene's choice.
  for (const [kind, id] of [['claude', 'mcpInstallClaude'], ['antigravity', 'mcpInstallAntigravity'], ['gemini', 'mcpInstallGemini']]) {
    $(id).onclick = (e) => { e.stopPropagation(); installer[kind](); };
  }
  document.querySelectorAll('#settingsModal .ia-client').forEach(c => {
    c.addEventListener('click', () => installer[c.dataset.client]());
  });
}
