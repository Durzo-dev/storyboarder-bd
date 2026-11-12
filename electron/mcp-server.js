// THE LOCAL MCP ENDPOINT (docs/en/mcp.md): while the user has turned on « AI connection » in Settings, the
// open application listens on http://127.0.0.1:PORT/mcp for an AI's client (Gemini CLI directly; Claude
// Desktop through the stdio bridge, mcp-bridge.js). Only the transport is here: each JSON-RPC message is
// handed to the window (src/mcp-link.js, src/mcp-protocol.js), whose answer is sent back.
//
// Guarded three ways: bound to 127.0.0.1 only; the Host must be this machine (a web page cannot reach it by
// a DNS trick) and any Origin is refused (a browser always sends one); a secret token, made once and kept in
// mcp.json in the user's data folder, which the bridge reads and the client config carries.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 47615;
const ENDPOINT = '/mcp';
/** The largest message accepted (bytes): a tool's arguments, never a file. */
const MAX_BODY = 1024 * 1024;
/** How long the window may take to answer (an import of a large place takes minutes). */
const ANSWER_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The endpoint. `userData`: the user's data folder (mcp.json goes there); `window()`: the application's
 * window or null; `log`: console-like.
 */
function createMcpServer({ userData, window, log = console }){
  const file = path.join(userData, 'mcp.json');
  let server = null, state = { listening: false, port: null, error: null };
  let next = 1;
  const pending = new Map();

  /** mcp.json: { port, token, tools } (`tools`: the last list the window gave, for the bridge alone). */
  function readFile(){
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return {}; }
  }
  function writeFile(patch){
    const data = { ...readFile(), ...patch };
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }
  function config(){
    let data = readFile();
    if (typeof data.token !== 'string' || data.token.length < 32) data = writeFile({ token: crypto.randomBytes(24).toString('hex') });
    if (!Number.isInteger(data.port)) data = writeFile({ port: DEFAULT_PORT });
    return data;
  }

  /** Hands a message to the window; resolves to its answer (null for a notification). */
  function ask(message){
    const w = window();
    if (!w || w.isDestroyed() || w.webContents.isLoading()) {
      return Promise.resolve(message && message.id !== undefined
        ? { jsonrpc: '2.0', id: message.id, error: { code: -32000, message: 'Storyboarder is still opening: try again in a few seconds.' } } : null);
    }
    const n = next++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(n);
        resolve({ jsonrpc: '2.0', id: message.id, error: { code: -32001, message: 'Storyboarder took too long to answer.' } });
      }, ANSWER_TIMEOUT_MS);
      pending.set(n, (answer) => { clearTimeout(timer); resolve(answer); });
      w.webContents.send('mcp:request', n, message);
    });
  }
  /** The window's answer to request `n` (ipcMain 'mcp:response'). */
  function answer(n, response){
    const done = pending.get(n);
    if (done) { pending.delete(n); done(response || null); }
  }

  function refuse(res, code, text){
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
  }

  function handle(req, res, { port, token }){
    const url = (req.url || '').split('?')[0];
    if (url !== ENDPOINT) return refuse(res, 404, 'Not found');
    const host = String(req.headers.host || '');
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return refuse(res, 403, 'Forbidden host');
    if (req.headers.origin !== undefined) return refuse(res, 403, 'Browsers are not allowed');
    if (req.headers.authorization !== `Bearer ${token}`) return refuse(res, 401, 'Missing or wrong token');
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); return res.end(); }
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { refuse(res, 413, 'Too large'); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', async () => {
      if (size > MAX_BODY) return;
      let message;
      try { message = JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      }
      const list = Array.isArray(message) ? message : [message];
      const answers = (await Promise.all(list.map(ask))).filter(Boolean);
      if (!answers.length) { res.writeHead(202); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(Array.isArray(message) ? answers : answers[0]));
    });
  }

  /** Starts listening (no-op when already); resolves to the state. */
  function start(){
    if (server) return Promise.resolve(status());
    const c = config();
    return new Promise((resolve) => {
      const s = http.createServer((req, res) => handle(req, res, c));
      s.on('error', (e) => {
        log.warn('[mcp] server', e && e.code);
        state = { listening: false, port: c.port, error: e && e.code === 'EADDRINUSE' ? 'port-in-use' : 'error' };
        server = null;
        resolve(status());
      });
      s.listen(c.port, '127.0.0.1', () => {
        server = s;
        state = { listening: true, port: c.port, error: null };
        log.info(`[mcp] listening on 127.0.0.1:${c.port}`);
        resolve(status());
      });
    });
  }
  function stop(){
    if (!server) return Promise.resolve(status());
    return new Promise((resolve) => {
      server.close(() => resolve(status()));
      server = null;
      state = { listening: false, port: state.port, error: null };
      for (const done of pending.values()) done(null);
      pending.clear();
    });
  }
  function status(){ return { ...state, file }; }
  /** The window's tool list, kept for the bridge (it answers tools/list while Storyboarder is closed). */
  function rememberTools(tools){ try { writeFile({ tools: Array.isArray(tools) ? tools : [] }); } catch (e) { log.warn('[mcp] tools', e); } }
  /** The configuration of a client: Claude Desktop (through the bridge) or Gemini CLI (HTTP). */
  function clientConfig(kind, { execPath, bridgePath }){
    const c = config();
    if (kind === 'gemini') {
      return { mcpServers: { storyboarder: { httpUrl: `http://127.0.0.1:${c.port}${ENDPOINT}`, headers: { Authorization: `Bearer ${c.token}` } } } };
    }
    return { mcpServers: { storyboarder: { command: execPath, args: [bridgePath, file], env: { ELECTRON_RUN_AS_NODE: '1' } } } };
  }

  return { start, stop, status, answer, rememberTools, clientConfig };
}

module.exports = { createMcpServer, DEFAULT_PORT, ENDPOINT };
