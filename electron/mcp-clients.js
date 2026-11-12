// THE AI CLIENTS' OWN SETTINGS (docs/en/mcp.md): Gemini CLI reads its MCP servers from ~/.gemini/settings.json;
// « Add to Gemini CLI » writes Storyboarder's entry there, leaving everything else as it was. The file is
// read as JSON: one with comments (which Gemini CLI tolerates) is not rewritten, since its comments would be
// lost; the user gets the configuration to paste instead. PURE but for the paths.
const path = require('path');

/** Where Gemini CLI keeps its user settings. */
const geminiSettingsPath = (home) => path.join(home, '.gemini', 'settings.json');

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

module.exports = { geminiSettingsPath, withStoryboarder, hasStoryboarder };
