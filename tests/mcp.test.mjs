/**
 * tests/mcp.test.mjs: the AI connection (docs/en/mcp.md). The argument checking (src/mcp-schema.js), the
 * protocol (src/mcp-protocol.js), the tools on a real Scene (src/mcp-tools.js: Eguisheim laid as an import
 * lays it, tests/fixtures/osm-eguisheim.json, © OpenStreetMap contributors, ODbL), the local endpoint
 * (electron/mcp-server.js, with a stand-in window) and the stdio bridge (electron/mcp-bridge.js, run as a
 * program, the application open then closed).
 */
import './helpers/dom-stub.mjs';
import './helpers/render-stub.mjs';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';

const { schemaErrors } = await import('../src/mcp-schema.js');
const { handleMessage, ToolError, PROTOCOL_VERSIONS } = await import('../src/mcp-protocol.js');
const { makeTools, sceneSummary, sceneListItem } = await import('../src/mcp-tools.js');
const { translateOsm } = await import('../src/osm-scene.js');
const { sceneContentOf } = await import('../src/real-place-import.js');
const { layRealPlace } = await import('../src/real-place-lay.js');
const { createScene } = await import('../src/scenes.js');
const require = createRequire(import.meta.url);
const { createMcpServer } = require('../electron/mcp-server.js');

const call = (tools, name, args, id = 1) => handleMessage({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }, { tools, serverInfo: { name: 'storyboarder', version: 't' } });

describe('MCP, the arguments checked before anything is done', () => {
  const schema = { type: 'object', additionalProperties: false, required: ['scene_id'], properties: {
    scene_id: { type: 'string' }, size_m: { type: 'integer', minimum: 50, maximum: 400 },
    detail: { type: 'string', enum: ['simple', 'detailed'] }, points: { type: 'array', maxItems: 2, items: { type: 'number' } },
  } };
  test('a right call has no mistake', () => {
    assert.deepEqual(schemaErrors(schema, { scene_id: 'sc1', size_m: 200, detail: 'simple', points: [1, 2] }), []);
  });
  test('each mistake is said, where it is, in words an AI can act on', () => {
    assert.deepEqual(schemaErrors(schema, {}), ['scene_id: is required']);
    assert.deepEqual(schemaErrors(schema, { scene_id: 3 }), ['scene_id: must be a string']);
    assert.deepEqual(schemaErrors(schema, { scene_id: 'a', size_m: 500 }), ['size_m: must be at most 400']);
    assert.deepEqual(schemaErrors(schema, { scene_id: 'a', size_m: 120.5 }), ['size_m: must be an integer']);
    assert.deepEqual(schemaErrors(schema, { scene_id: 'a', detail: 'max' }), ['detail: must be one of "simple", "detailed"']);
    assert.deepEqual(schemaErrors(schema, { scene_id: 'a', colour: 'red' }), ['colour: is not a known argument']);
    assert.deepEqual(schemaErrors(schema, { scene_id: 'a', points: [1, 'x', 3] }), ['points: must have at most 2 items', 'points[1]: must be a number']);
    assert.deepEqual(schemaErrors(schema, null), ['arguments: must be an object']);
  });
});

describe('MCP, the protocol', () => {
  const tools = [{ name: 'echo', title: 'Echo', description: 'd', inputSchema: { type: 'object', properties: { t: { type: 'string' } }, required: ['t'], additionalProperties: false },
    run: async ({ t }) => { if (t === 'no') throw new ToolError('Not that.'); if (t === 'boom') throw new Error('bug'); return { content: [{ type: 'text', text: t }] }; } }];
  const ask = (m) => handleMessage({ jsonrpc: '2.0', ...m }, { tools, serverInfo: { name: 'storyboarder', version: '1' }, instructions: 'hi' });
  test('initialize: the version asked if known, otherwise the newest; the tools capability', async () => {
    const r = await ask({ id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
    assert.equal(r.result.protocolVersion, '2025-03-26');
    assert.deepEqual(r.result.capabilities, { tools: { listChanged: false } });
    assert.equal(r.result.serverInfo.name, 'storyboarder');
    assert.equal(r.result.instructions, 'hi');
    assert.equal((await ask({ id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).result.protocolVersion, PROTOCOL_VERSIONS[0]);
  });
  test('a notification has no answer; ping; an unknown method is an error', async () => {
    assert.equal(await ask({ method: 'notifications/initialized' }), null);
    assert.deepEqual((await ask({ id: 3, method: 'ping' })).result, {});
    assert.equal((await ask({ id: 4, method: 'resources/list' })).error.code, -32601);
    assert.equal((await handleMessage({ id: 5, method: 'ping' })).error.code, -32600, 'not JSON-RPC 2.0');
  });
  test('tools/list gives the tools without their code', async () => {
    const r = await ask({ id: 6, method: 'tools/list' });
    assert.deepEqual(Object.keys(r.result.tools[0]).sort(), ['description', 'inputSchema', 'name', 'title']);
  });
  test('tools/call: the result; wrong arguments, a ToolError, a bug: a failure in words (isError), never a crash', async () => {
    assert.equal((await ask({ id: 7, method: 'tools/call', params: { name: 'echo', arguments: { t: 'ok' } } })).result.content[0].text, 'ok');
    const bad = (await ask({ id: 8, method: 'tools/call', params: { name: 'echo', arguments: {} } })).result;
    assert.equal(bad.isError, true); assert.match(bad.content[0].text, /t: is required/);
    const no = (await ask({ id: 9, method: 'tools/call', params: { name: 'echo', arguments: { t: 'no' } } })).result;
    assert.deepEqual(no, { content: [{ type: 'text', text: 'Not that.' }], isError: true });
    const boom = (await ask({ id: 10, method: 'tools/call', params: { name: 'echo', arguments: { t: 'boom' } } })).result;
    assert.equal(boom.isError, true); assert.match(boom.content[0].text, /bug/);
    assert.equal((await ask({ id: 11, method: 'tools/call', params: { name: 'nope' } })).error.code, -32602);
  });
});

describe('MCP, the tools on a real Scene', () => {
  const village = JSON.parse(readFileSync(new URL('./fixtures/osm-eguisheim.json', import.meta.url), 'utf8'));
  const centre = { lat: (village.bbox.sud + village.bbox.nord) / 2, lon: (village.bbox.ouest + village.bbox.est) / 2 };
  let n = 0;
  const content = sceneContentOf(translateOsm(village, { centre, halfSize: 100 }), { panelId: 'P', newId: () => `rp${++n}` });
  const scene = createScene();
  scene.name = 'Eguisheim';
  const { panel } = layRealPlace(scene, { ...content, elements: [] }, { halfSize: 100, newObject: () => null });
  panel.lieu = { lat: centre.lat, lon: centre.lon, size_m: 200, detail: 'detailed', country: 'fr' };
  const imported = [], previews = [];
  const tools = makeTools({
    scenes: () => [scene],
    importPlace: async (a) => { imported.push(a); return a.query === 'nowhere' ? { error: 'No place found for « nowhere ».' } : { scene }; },
    preview: async (s) => { previews.push(s.id); return { data: 'AAAA', mimeType: 'image/jpeg' }; },
  });
  test('the four tools, each with a description and a closed schema', () => {
    assert.deepEqual(tools.map(t => t.name), ['list_scenes', 'read_scene', 'create_scene_from_place', 'scene_preview']);
    for (const t of tools) { assert.ok(t.description.length > 40, t.name); assert.equal(t.inputSchema.additionalProperties, false, t.name); }
  });
  test('list_scenes: what each Scene holds, and its place', async () => {
    const r = (await call(tools, 'list_scenes', {})).result;
    const item = r.structuredContent.scenes[0];
    assert.equal(item.id, scene.id);
    assert.equal(item.buildings, content.buildings.length);
    assert.ok(item.buildings > 30, `Eguisheim's buildings (${item.buildings})`);
    assert.equal(item.place.country, 'fr');
    assert.match(r.content[0].text, /Eguisheim/);
  });
  test('read_scene: every building at its place, with its size; an unknown id is said', async () => {
    const r = (await call(tools, 'read_scene', { scene_id: scene.id })).result;
    const s = r.structuredContent;
    assert.equal(s.building_list.length, s.buildings);
    for (const b of s.building_list) {
      assert.ok(Math.abs(b.x) <= 110 && Math.abs(b.z) <= 110, `${b.name} within the zone`);
      assert.ok(b.height_m >= 2 && b.levels >= 1 && b.width_m > 0, b.name);
    }
    assert.ok(s.building_list.some(b => b.name === 'Chapelle Saint-Léon IX'), 'named buildings keep their name');
    assert.ok(s.paths > 0 && s.paths_by_kind.route > 0);
    assert.ok(s.credits.some(c => /OpenStreetMap/.test(c)));
    assert.deepEqual(sceneSummary(scene).building_list, s.building_list, 'one summary');
    const bad = (await call(tools, 'read_scene', { scene_id: 'zz' })).result;
    assert.equal(bad.isError, true); assert.match(bad.content[0].text, /list_scenes/);
  });
  test('create_scene_from_place: by name or coordinates, the defaults, half coordinates refused, a failure said', async () => {
    const r = (await call(tools, 'create_scene_from_place', { place: 'Eguisheim' })).result;
    assert.equal(r.structuredContent.id, scene.id);
    assert.deepEqual(imported[0], { query: 'Eguisheim', lat: undefined, lon: undefined, sideM: 200, detail: 'detailed', name: 'Eguisheim' });
    await call(tools, 'create_scene_from_place', { lat: 48.04, lon: 7.3, size_m: 100, detail: 'realistic' });
    assert.equal(imported[1].query, null); assert.equal(imported[1].sideM, 100);
    assert.equal((await call(tools, 'create_scene_from_place', { lat: 48 })).result.isError, true);
    assert.equal((await call(tools, 'create_scene_from_place', {})).result.isError, true);
    assert.equal(imported.length, 2, 'nothing imported on a wrong call');
    assert.match((await call(tools, 'create_scene_from_place', { size_m: 1000, place: 'x' })).result.content[0].text, /size_m: must be at most 400/);
    assert.match((await call(tools, 'create_scene_from_place', { place: 'nowhere' })).result.content[0].text, /No place found/);
  });
  test('scene_preview: an image of the Scene', async () => {
    const r = (await call(tools, 'scene_preview', { scene_id: scene.id })).result;
    assert.deepEqual(r.content[0], { type: 'image', data: 'AAAA', mimeType: 'image/jpeg' });
    assert.deepEqual(previews, [scene.id]);
  });
  test('a Scene made by hand: no place', () => {
    assert.equal(sceneListItem(createScene()).place, null);
  });
});

// ── The endpoint and the bridge ─────────────────────────────────────────────────────────────────

/** A stand-in for the window: answers every message with the real protocol and an `echo` tool. */
function fakeWindow(server){
  return {
    isDestroyed: () => false,
    webContents: {
      isLoading: () => false,
      send: async (channel, n, message) => {
        const tools = [{ name: 'echo', title: 'Echo', description: 'Echo', inputSchema: { type: 'object' }, run: async () => ({ content: [{ type: 'text', text: 'from the app' }] }) }];
        server.answer(n, await handleMessage(message, { tools, serverInfo: { name: 'storyboarder', version: 't' } }));
      },
    },
  };
}

/** The status of a ping sent with this Host header (fetch does not let one set it). */
function statusWithHost(port, host, token){
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const req = http.request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: { Host: host, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end(body);
  });
}

function post(port, body, headers = {}){
  return fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } });
}

describe('MCP, the local endpoint', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sb-mcp-'));
  const port = 47000 + Math.floor(Math.random() * 900);
  writeFileSync(join(dir, 'mcp.json'), JSON.stringify({ port }));
  let server, token;
  before(async () => {
    server = createMcpServer({ userData: dir, window: () => fakeWindow(server), log: { info() {}, warn() {} } });
    const st = await server.start();
    assert.equal(st.listening, true);
    token = JSON.parse(readFileSync(join(dir, 'mcp.json'), 'utf8')).token;
  });
  after(() => server.stop());
  test('a token is made once, long enough, and kept', () => {
    assert.match(token, /^[0-9a-f]{48}$/);
  });
  test('a call with the token is answered by the window', async () => {
    const r = await post(port, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo' } }, { Authorization: `Bearer ${token}` });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).result.content[0].text, 'from the app');
  });
  test('a notification: 202, no body', async () => {
    const r = await post(port, { jsonrpc: '2.0', method: 'notifications/initialized' }, { Authorization: `Bearer ${token}` });
    assert.equal(r.status, 202);
  });
  test('refused: no token, a wrong token, a browser (Origin), another host, GET, broken JSON', async () => {
    const m = { jsonrpc: '2.0', id: 1, method: 'ping' };
    assert.equal((await post(port, m)).status, 401);
    assert.equal((await post(port, m, { Authorization: 'Bearer nope' })).status, 401);
    assert.equal((await post(port, m, { Authorization: `Bearer ${token}`, Origin: 'https://evil.example' })).status, 403);
    assert.equal(await statusWithHost(port, `evil.example:${port}`, token), 403, 'a DNS trick');
    assert.equal(await statusWithHost(port, `localhost:${port}`, token), 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/mcp`, { headers: { Authorization: `Bearer ${token}` } })).status, 405);
    assert.equal((await fetch(`http://127.0.0.1:${port}/other`)).status, 404);
    const broken = await post(port, '{', { Authorization: `Bearer ${token}` });
    assert.equal(broken.status, 400); assert.equal((await broken.json()).error.code, -32700);
  });
  test('the clients\' configurations: Claude Desktop through the bridge, Gemini CLI over HTTP with the token', () => {
    const c = server.clientConfig('claude', { execPath: 'C:/App/Storyboarder.exe', bridgePath: 'C:/App/mcp-bridge.js' }).mcpServers.storyboarder;
    assert.deepEqual(c, { command: 'C:/App/Storyboarder.exe', args: ['C:/App/mcp-bridge.js', join(dir, 'mcp.json')], env: { ELECTRON_RUN_AS_NODE: '1' } });
    const g = server.clientConfig('gemini', {}).mcpServers.storyboarder;
    assert.equal(g.httpUrl, `http://127.0.0.1:${port}/mcp`);
    assert.equal(g.headers.Authorization, `Bearer ${token}`);
  });
  test('the bridge passes messages to the open application', async () => {
    const lines = await runBridge(join(dir, 'mcp.json'), [
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo' } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'ping' },
    ]);
    assert.equal(lines.length, 2, 'no answer to the notification');
    assert.equal(lines.find(l => l.id === 1).result.content[0].text, 'from the app');
  });
  test('the clients seen: the bridge says its client\'s name (Claude Desktop), an HTTP client at initialize', async () => {
    await runBridge(join(dir, 'mcp.json'), [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'claude-ai', version: '1' } } },
      { jsonrpc: '2.0', id: 2, method: 'ping' },
    ]);
    const c = server.status().clients.claude;
    assert.equal(c.name, 'claude-ai');
    assert.ok(Date.now() - c.lastSeen < 5000);
    await post(port, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'gemini-cli-mcp-client' } } }, { Authorization: `Bearer ${token}` });
    await post(port, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { Authorization: `Bearer ${token}` });
    assert.equal(server.status().clients.gemini.name, 'gemini-cli-mcp-client', 'later messages keep the HTTP client\'s name');
    assert.ok(JSON.parse(readFileSync(join(dir, 'mcp.json'), 'utf8')).clients.claude, 'kept in mcp.json');
  });
  test('a refused message is not a client seen', async () => {
    const avant = JSON.stringify(server.status().clients);
    await post(port, { jsonrpc: '2.0', id: 1, method: 'ping' }, { Authorization: 'Bearer nope', 'X-Mcp-Client': 'other-ai' });
    assert.equal(JSON.stringify(server.status().clients), avant);
  });
});

describe('MCP, Gemini CLI\'s settings', () => {
  const { withStoryboarder, hasStoryboarder, geminiSettingsPath } = require('../electron/mcp-clients.js');
  const entry = { httpUrl: 'http://127.0.0.1:47615/mcp', headers: { Authorization: 'Bearer t' } };
  test('no file yet: the settings with Storyboarder alone', () => {
    assert.deepEqual(JSON.parse(withStoryboarder(null, entry).text), { mcpServers: { storyboarder: entry } });
    assert.deepEqual(JSON.parse(withStoryboarder('', entry).text), { mcpServers: { storyboarder: entry } });
  });
  test('the other settings and servers are kept; ours is replaced', () => {
    const before = JSON.stringify({ theme: 'Dracula', mcpServers: { other: { command: 'x' }, storyboarder: { httpUrl: 'old' } } });
    const after = JSON.parse(withStoryboarder(before, entry).text);
    assert.equal(after.theme, 'Dracula');
    assert.deepEqual(after.mcpServers.other, { command: 'x' });
    assert.deepEqual(after.mcpServers.storyboarder, entry);
  });
  test('a file with comments or broken is not rewritten', () => {
    assert.deepEqual(withStoryboarder('{ // mine\n "theme": "x" }', entry), { error: 'unreadable' });
    assert.deepEqual(withStoryboarder('[1]', entry), { error: 'unreadable' });
  });
  test('is Storyboarder there? plain JSON, or its key in a file with comments', () => {
    assert.equal(hasStoryboarder(withStoryboarder(null, entry).text), true);
    assert.equal(hasStoryboarder('{"mcpServers":{"other":{}}}'), false);
    assert.equal(hasStoryboarder(null), false);
    assert.equal(hasStoryboarder('{ // c\n "mcpServers": { "storyboarder": {} } }'), true);
    assert.equal(geminiSettingsPath('/home/u'), join('/home/u', '.gemini', 'settings.json'));
  });
});

describe('MCP, what the AI tab says', async () => {
  const { connectionTexts, CONNECTED_MS } = await import('../src/mcp-status.js');
  const tr = (en) => en;
  const now = 1e12;
  const base = { enabled: true, listening: true, port: 47615, now, clients: {}, gemini: { installed: true, configured: false } };
  test('off, on, port taken', () => {
    assert.match(connectionTexts({ ...base, enabled: false, listening: false }, tr).general, /^Off/);
    assert.match(connectionTexts(base, tr).general, /^On/);
    assert.match(connectionTexts({ ...base, listening: false, error: 'port-in-use' }, tr).general, /Port 47615/);
  });
  test('Claude Desktop: never seen, offered, connected (heartbeat), installed but closed', () => {
    const lvl = (s) => connectionTexts({ ...base, ...s }, tr).claude.level;
    assert.equal(lvl({}), 'none');
    assert.equal(lvl({ claudeOffered: now - 1000 }), 'offered');
    assert.equal(lvl({ clients: { claude: { lastSeen: now - 30000 } } }), 'connected');
    assert.equal(lvl({ clients: { claude: { lastSeen: now - CONNECTED_MS - 1 } } }), 'installed');
    assert.equal(lvl({ enabled: false, listening: false, clients: { claude: { lastSeen: now - 1000 } } }), 'installed', 'connection off: not connected');
    assert.match(connectionTexts({ ...base, clients: { claude: { lastSeen: now - 3 * 3600e3 } } }, tr).claude.text, /3 h ago/);
  });
  test('Gemini CLI: missing, not added, added, connected', () => {
    const lvl = (g, clients = {}) => connectionTexts({ ...base, gemini: g, clients }, tr).gemini.level;
    assert.equal(lvl({ installed: false, configured: false }), 'missing');
    assert.equal(lvl({ installed: true, configured: false }), 'none');
    assert.equal(lvl({ installed: true, configured: true }), 'installed');
    assert.equal(lvl({ installed: true, configured: true }, { gemini: { lastSeen: now - 1000 } }), 'connected');
  });
});

/** Runs the bridge with `messages` on stdin; resolves to the JSON lines it wrote on stdout. */
function runBridge(file, messages){
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [new URL('../electron/mcp-bridge.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), file]);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.on('error', reject);
    p.on('close', () => resolve(out.split('\n').filter(Boolean).map(l => JSON.parse(l))));
    for (const m of messages) p.stdin.write(`${typeof m === 'string' ? m : JSON.stringify(m)}\n`);
    setTimeout(() => p.stdin.end(), 400);
  });
}

describe('MCP, the bridge with Storyboarder closed', () => {
  test('the client still connects (initialize, tools/list from mcp.json); a tool call says to open Storyboarder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sb-mcp-'));
    const file = join(dir, 'mcp.json');
    // A port nobody listens on.
    writeFileSync(file, JSON.stringify({ port: 9, token: 'x'.repeat(48), tools: [{ name: 'list_scenes' }] }));
    const lines = await runBridge(file, [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_scenes' } },
      'not json',
    ]);
    const by = (id) => lines.find(l => l.id === id);
    assert.equal(by(1).result.protocolVersion, '2025-06-18');
    assert.deepEqual(by(2).result.tools, [{ name: 'list_scenes' }]);
    assert.equal(by(3).result.isError, true);
    assert.match(by(3).result.content[0].text, /open Storyboarder/);
    assert.equal(lines.find(l => l.id === null).error.code, -32700);
  });
});

describe('MCP, the Claude Desktop extension (.mcpb)', () => {
  const { buildBundle, manifestOf } = require('../electron/mcp-bundle.js');
  const { fichiersDuZip } = require('../electron/bibliotheque/zip-lecture.js');
  const bridgePath = new URL('../electron/mcp-bridge.js', import.meta.url);
  const iconPath = new URL('../assets/icone/storyboarder-bd-512.png', import.meta.url);
  const archive = buildBundle({ version: '1.17.39', mcpJsonPath: 'C:\\Users\\u\\AppData\\Roaming\\Storyboarder BD\\mcp.json',
    bridgePath, iconPath, tools: [{ name: 'list_scenes', description: 'The Scenes', inputSchema: {} }] });
  const files = fichiersDuZip(archive);
  const byName = (n) => files.get(n);
  test('a zip a reader opens: the manifest, the bridge as is, the icon', () => {
    assert.deepEqual([...files.keys()].sort(), ['icon.png', 'manifest.json', 'server/index.js']);
    assert.ok(byName('server/index.js').equals(readFileSync(bridgePath)));
    assert.ok(byName('icon.png').equals(readFileSync(iconPath)));
  });
  test('the manifest: the bridge started by Claude Desktop\'s Node, with this computer\'s mcp.json', () => {
    const m = JSON.parse(byName('manifest.json').toString('utf8'));
    assert.equal(m.manifest_version, '0.3');
    assert.equal(m.name, 'storyboarder');
    assert.equal(m.version, '1.17.39');
    assert.equal(m.server.type, 'node');
    assert.equal(m.server.entry_point, 'server/index.js');
    assert.deepEqual(m.server.mcp_config.args, ['${__dirname}/server/index.js', 'C:\\Users\\u\\AppData\\Roaming\\Storyboarder BD\\mcp.json']);
    assert.deepEqual(m.tools, [{ name: 'list_scenes', description: 'The Scenes' }]);
    assert.ok(m.author.name && m.description);
  });
  test('a version that is not semver falls back (the manifest requires one)', () => {
    assert.equal(manifestOf({ version: 'dev', mcpJsonPath: 'x' }).version, '1.0.0');
  });
});
