// THE AI CLIENTS' OWN SETTINGS (docs/en/mcp.md). Two clients read their MCP servers from a JSON file under
// `mcpServers`: Gemini CLI from ~/.gemini/settings.json, Google Antigravity (its app, CLI and IDE share it)
// from ~/.gemini/config/mcp_config.json. Their card writes Storyboarder's entry there, leaving everything
// else as it was. The file is read as JSON: one with comments is not rewritten, since its comments would be
// lost; the user gets the configuration to paste instead. PURE but for the paths.
const path = require('path');

/** Where Gemini CLI keeps its user settings. */
const geminiSettingsPath = (home) => path.join(home, '.gemini', 'settings.json');
/** Where Google Antigravity keeps its global MCP servers. */
const antigravityConfigPath = (home) => path.join(home, '.gemini', 'config', 'mcp_config.json');
/** Where LM Studio keeps its MCP servers (Cursor's notation), and its folder: it is on this computer. */
const lmStudioConfigPath = (home) => path.join(home, '.lmstudio', 'mcp.json');
const lmStudioFolder = (home) => path.join(home, '.lmstudio');

/**
 * LM Studio's « Add to LM Studio » link: LM Studio opens, shows the server and asks to install it (its own
 * consent). `entry`: httpEntry('lmstudio', …).
 */
function lmStudioLink(entry){
  return `lmstudio://add_mcp?name=storyboarder&config=${encodeURIComponent(Buffer.from(JSON.stringify(entry), 'utf-8').toString('base64'))}`;
}

/** Folders that only Google Antigravity makes (its app, its CLI): it is on this computer. */
const antigravityFolders = (home) => [path.join(home, '.gemini', 'antigravity'), path.join(home, '.gemini', 'antigravity-cli')];

/**
 * Storyboarder's entry for a client that reaches the endpoint over HTTP. Both wait 10 minutes for a tool (an
 * import takes minutes; Antigravity's default is 3).
 */
function httpEntry(kind, { url, token }){
  const headers = { Authorization: `Bearer ${token}` };
  if (kind === 'antigravity') return { serverUrl: url, headers, timeoutSeconds: 600 };
  if (kind === 'lmstudio') return { url, headers };   // Cursor's notation
  return { httpUrl: url, headers, timeout: 600000 };
}

/** The settings `text` (null: no file yet) parsed, or null when it is not plain JSON. */
function parse(text){
  if (text === null || text === undefined || !String(text).trim()) return {};
  try {
    const v = JSON.parse(String(text).replace(/^﻿/, ''));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}

/**
 * The settings with Storyboarder's server `entry` under `mcpServers.storyboarder` (added or replaced, the
 * other servers and settings kept): { text } or { error: 'unreadable' }.
 */
function withStoryboarder(text, entry){
  const settings = parse(text);
  if (!settings) return { error: 'unreadable' };
  const servers = settings.mcpServers && typeof settings.mcpServers === 'object' && !Array.isArray(settings.mcpServers) ? settings.mcpServers : {};
  settings.mcpServers = { ...servers, storyboarder: entry };
  return { text: `${JSON.stringify(settings, null, 2)}\n` };
}

/** Do the settings already hold Storyboarder's server? */
function hasStoryboarder(text){
  const settings = parse(text);
  if (settings) return !!(settings.mcpServers && settings.mcpServers.storyboarder);
  return /"storyboarder"\s*:/.test(String(text || ''));   // a file with comments: its key, at least
}

module.exports = { geminiSettingsPath, antigravityConfigPath, antigravityFolders, lmStudioConfigPath, lmStudioFolder, lmStudioLink, httpEntry,
  withStoryboarder, hasStoryboarder };
