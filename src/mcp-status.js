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
 * The tab's texts: { general, claude, antigravity, gemini }, each client { level, text }. `level`: 'off', 'none',
 * 'offered', 'installed', 'connected' or 'missing' (Gemini CLI not on this computer). `tr(en, fr)`.
 */
export function connectionTexts(state, tr){
  const s = state || {};
  const now = s.now || Date.now();
  const clients = s.clients || {};
  let general = tr('Off: no AI can reach Storyboarder.', 'Désactivée : aucune IA ne peut joindre Storyboarder.');
  if (s.enabled && s.listening) general = tr('On: an AI on this computer can read and create your scenes.', 'Activée : une IA de cet ordinateur peut lire et créer vos scènes.');
  else if (s.enabled && s.error === 'port-in-use') general = tr(`Port ${s.port} is used by another program: the connection could not start.`, `Le port ${s.port} est pris par un autre logiciel : la connexion n'a pas pu démarrer.`);
  else if (s.enabled) general = tr('The connection could not start.', 'La connexion n\'a pas pu démarrer.');
  const on = !!(s.enabled && s.listening);

  const seen = (k) => (clients[k] && Number(clients[k].lastSeen)) || 0;
  const claudeSeen = seen('claude');
  let claude;
  if (on && claudeSeen && now - claudeSeen < CONNECTED_MS) claude = { level: 'connected', text: tr('Connected', 'Connecté') };
  else if (claudeSeen) claude = { level: 'installed', text: on
    ? tr(`Installed. Last seen ${ago(now - claudeSeen, tr)}: open Claude Desktop to connect it.`, `Installé. Vu ${ago(now - claudeSeen, tr)} : ouvrez Claude Desktop pour le connecter.`)
    : tr('Installed. Turn the connection on to use it.', 'Installé. Activez la connexion pour vous en servir.') };
  else if (s.claudeOffered) claude = { level: 'offered', text: tr('Installation offered: click « Install » in Claude Desktop, then restart it.', 'Installation proposée : cliquez sur « Installer » dans Claude Desktop, puis relancez-le.') };
  else claude = { level: 'none', text: tr('Not installed yet: click the card.', 'Pas encore installé : cliquez sur la carte.') };

  // The clients written in a file (Gemini CLI, Google Antigravity): connected while used, otherwise added.
  const fileClient = (k, missing) => {
    const g = s[k] || {};
    const at = seen(k);
    if (on && at && now - at < CONNECTED_MS) return { level: 'connected', text: tr('Connected', 'Connecté') };
    if (g.configured || at) return { level: 'installed', text: at
      ? tr(`Added. Last used ${ago(now - at, tr)}.`, `Ajouté. Utilisé ${ago(now - at, tr)}.`)
      : tr('Added: restart it if it was open.', 'Ajouté : relancez-le s\'il était ouvert.') };
    if (g.installed === false) return { level: 'missing', text: missing };
    return { level: 'none', text: tr('Not added yet: click the card.', 'Pas encore ajouté : cliquez sur la carte.') };
  };
  const gemini = fileClient('gemini', tr('Gemini CLI does not seem to be installed on this computer.', 'Gemini CLI ne semble pas installé sur cet ordinateur.'));
  const antigravity = fileClient('antigravity', tr('Antigravity does not seem to be installed on this computer.', 'Antigravity ne semble pas installé sur cet ordinateur.'));

  return { general, claude, gemini, antigravity };
}
