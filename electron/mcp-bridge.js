// THE STDIO BRIDGE (docs/en/mcp.md): an AI's client that starts its MCP servers as programs (Claude Desktop)
// starts this one, with Storyboarder's own executable in Node mode (ELECTRON_RUN_AS_NODE=1: nothing to
// install). It reads JSON-RPC messages on stdin, one per line, passes each to the open application's local
// endpoint (mcp-server.js) and writes the answers on stdout, one per line. Node's built-ins only.
//
// Storyboarder closed, or its « AI connection » off: the bridge answers `initialize`, `ping` and
// `tools/list` itself (the tools from mcp.json, kept by the application), so the client still connects; a
// tool call then says to open Storyboarder. Logs go to stderr: stdout is the protocol's.
//
// Usage: <Storyboarder executable> mcp-bridge.js <path of mcp.json>
const http = require('http');
const fs = require('fs');
const readline = require('readline');

const file = process.argv[2];
const CLOSED = 'Storyboarder is not open, or its AI connection is off. Ask the user to open Storyboarder and turn on the AI connection (Settings > AI), then try again.';

/** The client's name, from its `initialize` (Claude Desktop: « claude-ai »), told to the application. */
let clientName = null;
/** Messages under way: the bridge ends once its client has closed stdin and they are answered. */
let inFlight = 0, closed = false;
// (Exit once stdout is flushed: on Windows a pipe is written asynchronously.)
const endIfDone = () => { if (closed && !inFlight) process.stdout.write('', () => process.exit(0)); };

function settings(){
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return {}; }
}

/** Posts one message to the application; resolves to { status, body } or rejects when it does not answer. */
function post(message, { port, token }){
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(message), 'utf-8');
    const req = http.request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': body.length, Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`, 'X-Mcp-Client': clientName || 'stdio client',
    } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

/** The answer when the application does not: enough for the client to connect, and words for the AI. */
function alone(message, data){
  if (!message || message.id === undefined) return null;
  const reply = (result) => ({ jsonrpc: '2.0', id: message.id, result });
  switch (message.method) {
    case 'initialize': return reply({
      protocolVersion: (message.params && message.params.protocolVersion) || '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'storyboarder', version: 'bridge' },
    });
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: Array.isArray(data.tools) ? data.tools : [] });
    case 'tools/call': return reply({ content: [{ type: 'text', text: CLOSED }], isError: true });
    default: return { jsonrpc: '2.0', id: message.id, error: { code: -32000, message: CLOSED } };
  }
}

const write = (answer) => { if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`); };

async function pass(line){
  inFlight++;
  try { await passOne(line); } finally { inFlight--; endIfDone(); }
}

async function passOne(line){
  let message;
  try { message = JSON.parse(line); } catch {
    write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  if (message && message.method === 'initialize' && message.params && message.params.clientInfo) clientName = String(message.params.clientInfo.name || '');
  const data = settings();
  try {
    if (!data.port || !data.token) throw new Error('no settings');
    const r = await post(message, data);
    if (r.status === 202 || !r.body) return;
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    process.stdout.write(`${r.body.trim()}\n`);
  } catch (e) {
    process.stderr.write(`[storyboarder bridge] ${e && e.message}\n`);
    const messages = Array.isArray(message) ? message : [message];
    messages.map(m => alone(m, data)).forEach(write);
  }
}

if (!file) {
  process.stderr.write('Usage: mcp-bridge.js <path of mcp.json>\n');
  process.exit(2);
}
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => { if (line.trim()) pass(line); });
rl.on('close', () => { closed = true; endIfDone(); });

// THE HEARTBEAT: while its client runs, the bridge pings the application every 30 s, so Settings can say
// « connected » (the first one a moment after start, once the client has said its name). Silent on failure.
const HEARTBEAT_MS = 30000;
const beat = () => {
  const data = settings();
  if (data.port && data.token) post({ jsonrpc: '2.0', id: 'heartbeat', method: 'ping' }, data).catch(() => {});
};
setTimeout(beat, 2000).unref();
globalThis.setInterval(beat, HEARTBEAT_MS).unref();
