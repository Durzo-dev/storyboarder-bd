/**
 * @file mcp-link.js
 * THE AI CONNECTION, the window's side (docs/en/mcp.md): the messages an AI's client sends to the local
 * endpoint (electron/mcp-server.js) arrive here, are answered by mcp-protocol.js with the tools of
 * mcp-tools.js, bound here to the application's gestures; and the « AI connection » row of Settings.
 */

import { S, tr } from './state.js';
import { handleMessage, describeTool } from './mcp-protocol.js';
import { makeTools, INSTRUCTIONS } from './mcp-tools.js';
import { importerPourIA } from './real-place-ui.js';

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

// ── The Settings row ─────────────────────────────────────────────────────────────────────────────

/** The row's state: on or off, and what the endpoint does (listening, port taken). */
function montrerEtat(etat){
  $('mcpEnabledCheckbox').checked = !!etat.enabled;
  $('mcpConfigButtons').hidden = !etat.enabled;
  let texte = tr('Off: no AI can reach Storyboarder.', 'Désactivée : aucune IA ne peut joindre Storyboarder.');
  if (etat.enabled && etat.listening) texte = tr(`On: an AI connected to this computer can read and create your Scenes (port ${etat.port}).`, `Activée : une IA branchée sur cet ordinateur peut lire et créer vos Scènes (port ${etat.port}).`);
  else if (etat.enabled && etat.error === 'port-in-use') texte = tr(`Port ${etat.port} is used by another program: the connection could not start.`, `Le port ${etat.port} est pris par un autre logiciel : la connexion n'a pas pu démarrer.`);
  else if (etat.enabled) texte = tr('The connection could not start.', 'La connexion n\'a pas pu démarrer.');
  $('mcpStatus').textContent = texte;
}

function cablerReglage(){
  const api = window.storyboarderAPI;
  const box = $('mcpEnabledCheckbox');
  if (!box) return;
  api.mcpStatus().then(montrerEtat);
  box.onchange = async () => montrerEtat(await api.mcpSetEnabled(box.checked));
  // Gemini CLI: its configuration copied, to paste in its settings (docs/en/mcp.md).
  const copier = (kind, bouton) => async () => {
    const texte = await api.mcpClientConfig(kind);
    try { await navigator.clipboard.writeText(texte); } catch { return; }
    const avant = bouton.textContent;
    bouton.textContent = tr('Copied', 'Copiée');
    setTimeout(() => { bouton.textContent = avant; }, 1500);
  };
  // Claude Desktop: an extension made for this computer, which Claude Desktop offers to install in one click.
  $('mcpInstallClaude').onclick = async () => {
    const r = await api.mcpInstallClaude();
    $('mcpStatus').textContent = r && r.ok
      ? tr('Claude Desktop opens its installation window: click « Install ». Then, in a new chat, ask for example « list my Storyboarder scenes ».',
        'Claude Desktop ouvre sa fenêtre d\'installation : cliquez sur « Installer ». Puis, dans une nouvelle conversation, demandez par exemple « liste mes scènes Storyboarder ».')
      : tr('Claude Desktop does not seem to be installed. The extension file is shown in its folder: drag it into Claude Desktop\'s window.',
        'Claude Desktop ne semble pas installé. Le fichier de l\'extension est montré dans son dossier : glissez-le dans la fenêtre de Claude Desktop.');
  };
  $('mcpCopyGemini').onclick = copier('gemini', $('mcpCopyGemini'));
}
