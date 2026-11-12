/**
 * @file mcp-protocol.js
 * THE MODEL CONTEXT PROTOCOL, the part an AI's client speaks to Storyboarder (docs/en/mcp.md): JSON-RPC 2.0
 * messages, `initialize`, `ping`, `tools/list`, `tools/call`. The transport (a local HTTP endpoint and its
 * stdio bridge) is the main process's; the tools are mcp-tools.js's. STATELESS: every message is answered
 * on its own, so a client that initialized against the bridge alone (Storyboarder closed) can call tools
 * once Storyboarder is opened. PURE.
 */

import { schemaErrors } from './mcp-schema.js';

/** The protocol versions understood, newest first: a client asking for another gets the newest. */
export const PROTOCOL_VERSIONS = Object.freeze(['2025-06-18', '2025-03-26', '2024-11-05']);

/** JSON-RPC error codes. */
export const ERRORS = Object.freeze({ parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, internal: -32603 });

/** A tool's failure the AI can act on: its message is sent back as the tool's result (isError). */
export class ToolError extends Error {}

const reply = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

/** What `tools/list` says of a tool: its name, title, description and input schema (not its `run`). */
export const describeTool = (t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema });

/**
 * The answer to one JSON-RPC message, or null for a notification (no `id`). `tools`: [{ name, title,
 * description, inputSchema, run(args) }] (`run` returns { content, structuredContent? } or throws a
 * ToolError); `serverInfo`: { name, version }; `instructions`: what the AI is told of the server.
 */
export async function handleMessage(message, { tools = [], serverInfo, instructions = '' } = {}){
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return fail(message && message.id !== undefined ? message.id : null, ERRORS.invalidRequest, 'Invalid request: a JSON-RPC 2.0 message with a method is expected');
  }
  const { id, method } = message;
  const params = message.params || {};
  if (id === undefined) return null;   // a notification (initialized, cancelled…): nothing to answer
  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion;
      return reply(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo,
        instructions,
      });
    }
    case 'ping': return reply(id, {});
    case 'tools/list': return reply(id, { tools: tools.map(describeTool) });
    case 'tools/call': {
      const tool = tools.find(t => t.name === params.name);
      if (!tool) return fail(id, ERRORS.invalidParams, `Unknown tool: ${params.name}. Known tools: ${tools.map(t => t.name).join(', ')}`);
      const args = params.arguments === undefined ? {} : params.arguments;
      const errors = schemaErrors(tool.inputSchema, args);
      if (errors.length) return reply(id, toolFailure(`Invalid arguments for ${tool.name}:\n- ${errors.join('\n- ')}`));
      try {
        return reply(id, await tool.run(args));
      } catch (e) {
        if (e instanceof ToolError) return reply(id, toolFailure(e.message));
        return reply(id, toolFailure(`${tool.name} failed inside Storyboarder: ${e && e.message ? e.message : e}`));
      }
    }
    default: return fail(id, ERRORS.methodNotFound, `Method not found: ${method}`);
  }
}

/** A tool's result that is a failure, said in words. */
export const toolFailure = (text) => ({ content: [{ type: 'text', text }], isError: true });
/** A tool's result in words, with its data (structuredContent) when given. */
export const toolText = (text, data) => (data === undefined ? { content: [{ type: 'text', text }] }
  : { content: [{ type: 'text', text }], structuredContent: data });
