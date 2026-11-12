/**
 * @file mcp-status.js
 * WHAT THE AI TAB OF SETTINGS SAYS (mcp-link.js), from the connection's state (electron/main.js, etatMcp):
 * the connection on or off, and for each client (Claude Desktop, Google Antigravity, Gemini CLI) whether it was
 * never seen, is installed or connected. PURE.
 *
 * A client is CONNECTED when it spoke within CONNECTED_MS: Claude Desktop's bridge pings every 30 s while
 * Claude Desktop runs; Antigravity and Gemini CLI speak only while used. Seen before: INSTALLED. Claude Desktop
 * never seen but its installation offered: OFFERED (the user may not have clicked « Install »). Antigravity or
 * Gemini CLI never seen but their file holds Storyboarder: INSTALLED.
 */

/** A client spoke this recently (milliseconds): connected. Two of the bridge's heartbeats and a margin. */
export const CONNECTED_MS = 75 * 1000;

/** « 3 min ago », « 2 h ago », « 4 days ago ». */
function ago(ms, tr){
  const min = Math.round(ms / 60000);
  if (min < 60) return tr(`${Math.max(1, min)} min ago`, `il y a ${Math.max(1, min)} min`);
  const h = Math.round(min / 60);
  if (h < 48) return tr(`${h} h ago`, `il y a ${h} h`);
  const d = Math.round(h / 24);
  return tr(`${d} days ago`, `il y a ${d} jours`);
}

/**
 * The tab's texts: { general, claude, antigravity, gemini, lmstudio }, each client { level, text }. `level`:
 * 'none' (never set up), 'offered' (Claude Desktop's installation window opened), 'installed', 'connected',
 * 'outdated' (Claude Desktop's extension made with an older bridge: to install again) or 'missing' (the client
 * is not on this computer: its card opens its download page). `tr(en, fr)`.
 *
 * There is no switch: installing a client connects Storyboarder; « Disconnect » stops it, and clicking a card
 * connects again.
 */
export function connectionTexts(state, tr){
  const s = state || {};
  const now = s.now || Date.now();
  const clients = s.clients || {};
  const on = !!(s.enabled && s.listening);
  let general = tr('Disconnected: click an AI to connect it.', 'Déconnectée : cliquez sur une IA pour la brancher.');
  if (on) general = tr('Connected: the AIs installed here can read and create your scenes.', 'Connectée : les IA installées ici peuvent lire et créer vos scènes.');
  else if (s.enabled && s.error === 'port-in-use') general = tr(`Port ${s.port} is used by another program: the connection could not start.`, `Le port ${s.port} est pris par un autre logiciel : la connexion n'a pas pu démarrer.`);
  else if (s.enabled) general = tr('The connection could not start.', 'La connexion n\'a pas pu démarrer.');

  const seen = (k) => (clients[k] && Number(clients[k].lastSeen)) || 0;
  const connected = { level: 'connected', text: tr('Connected', 'Connecté') };
  const off = { level: 'installed', text: tr('Disconnected: click to connect it again.', 'Déconnecté : cliquez pour le rebrancher.') };
  const missing = { level: 'missing', text: tr('Not on this computer: click to download it.', 'Absent de cet ordinateur : cliquez pour le télécharger.') };

  const claudeSeen = seen('claude');
  const claudeBridge = (clients.claude && Number(clients.claude.bridge)) || 0;
  let claude;
  if (claudeSeen && s.bridgeVersion && claudeBridge < s.bridgeVersion) claude = { level: 'outdated', text: tr('To update: click to install it again.', 'À mettre à jour : cliquez pour le réinstaller.') };
  else if (on && claudeSeen && now - claudeSeen < CONNECTED_MS) claude = connected;
  else if (claudeSeen) claude = on
    ? { level: 'installed', text: tr(`Installed. Last seen ${ago(now - claudeSeen, tr)}: open Claude Desktop.`, `Installé. Vu ${ago(now - claudeSeen, tr)} : ouvrez Claude Desktop.`) }
    : off;
  else if (s.claudeOffered) claude = { level: 'offered', text: tr('Click « Install » in Claude Desktop, then restart it.', 'Cliquez sur « Installer » dans Claude Desktop, puis relancez-le.') };
  else claude = { level: 'none', text: tr('Click to install.', 'Cliquez pour installer.') };

  // The other clients: connected while used, otherwise added (their file holds Storyboarder, or seen before).
  const other = (k) => {
    const g = s[k] || {};
    const at = seen(k);
    if (on && at && now - at < CONNECTED_MS) return connected;
    if (g.configured || at) {
      if (!on) return off;
      return { level: 'installed', text: at
        ? tr(`Added. Last used ${ago(now - at, tr)}.`, `Ajouté. Utilisé ${ago(now - at, tr)}.`)
        : tr('Added: restart it if it was open.', 'Ajouté : relancez-le s\'il était ouvert.') };
    }
    if (g.installed === false) return missing;
    return { level: 'none', text: tr('Click to add.', 'Cliquez pour ajouter.') };
  };
  return { general, claude, antigravity: other('antigravity'), gemini: other('gemini'), lmstudio: other('lmstudio') };
}

/** The clients, in the AI tab's order. */
export const CLIENT_KINDS = Object.freeze(['claude', 'lmstudio', 'antigravity', 'gemini']);

/**
 * IS AN AI READY for an action that needs one (mcp-link.js demanderIA)? Storyboarder connected, and at least
 * one client connected or set up (Claude Desktop counts once it has spoken: its extension may be offered but
 * not installed). Not ready: the AI tab opens, and the action goes on once this turns true.
 */
export function iaPrete(state){
  const t = connectionTexts(state, (en) => en);
  if (!(state && state.enabled && state.listening)) return false;
  return CLIENT_KINDS.some(k => t[k].level === 'connected' || (t[k].level === 'installed'));
}
