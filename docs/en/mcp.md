# The AI connection (MCP)

*[Version française](../fr/mcp.md)*

Storyboarder does not ship an AI. The user connects their own (Claude Desktop, Gemini CLI…) through the
Model Context Protocol: the open application is an MCP server, and the AI calls its tools to read the
Scenes, import a real place, and see a Scene as an image.

## What lives where

| File | Role |
|---|---|
| `electron/mcp-server.js` | The transport: a local HTTP endpoint, `http://127.0.0.1:PORT/mcp`, and `mcp.json` (port, token, last tool list) in the user's data folder. Hands each message to the window and sends back its answer. |
| `electron/mcp-bridge.js` | The stdio bridge for clients that start their servers as programs (Claude Desktop). Node built-ins only. |
| `src/mcp-protocol.js` | PURE. JSON-RPC 2.0: `initialize`, `ping`, `tools/list`, `tools/call`. Stateless. |
| `src/mcp-schema.js` | PURE. Checks the arguments against the tool's input schema (a JSON Schema subset), mistakes in words. |
| `src/mcp-tools.js` | The tools: what the AI reads (name, description, schema) and what they do, through injected gestures. |
| `src/mcp-link.js` | The window's side: receives the messages, binds the tools to the application, the Settings row. |
| `tests/mcp.test.mjs` | Schema, protocol, the tools on a real Scene, the endpoint, the bridge. |

## Turning it on

Settings > General > « AI connection »: off by default (`mcpEnabled` in `settings.json`). On, the
application listens and two buttons copy a client's configuration:

- **Claude Desktop**: to paste into `claude_desktop_config.json` (`mcpServers`). The command is
  Storyboarder's own executable with `ELECTRON_RUN_AS_NODE=1`, running `mcp-bridge.js` with the path of
  `mcp.json`: nothing to install.
- **Gemini CLI**: to paste into `settings.json` (`mcpServers`): `httpUrl` and the `Authorization` header.

ChatGPT only reaches remote servers over HTTPS: not supported.

## Flow

1. The client sends a JSON-RPC message (POST to the endpoint, or a line on the bridge's stdin).
2. `mcp-server.js` checks it (below) and sends it to the window on `mcp:request` with a number.
3. `mcp-link.js` answers through `handleMessage` and returns the answer on `mcp:response`.
4. The endpoint sends it back (200 with JSON, 202 for a notification).

At start-up the window gives the tool list (`mcp:tools`), kept in `mcp.json`: with Storyboarder closed the
bridge answers `initialize`, `ping` and `tools/list` itself, so the client connects; a tool call then says
to open Storyboarder. The protocol keeps no session, so a client initialized by the bridge alone works once
the application opens.

## Security

- Bound to `127.0.0.1` only.
- The `Host` header must be `127.0.0.1:PORT` or `localhost:PORT` (no DNS rebinding), and any `Origin` is
  refused (a browser always sends one).
- A secret token (48 hex characters), made once and kept in `mcp.json`, required as `Authorization:
  Bearer`. The bridge reads it from the file; Gemini's configuration carries it.
- Messages of 1 MB at most; an answer waits 10 minutes at most (a large import).

## The tools

| Tool | Does |
|---|---|
| `list_scenes` | The Project's Scenes: id, name, counts, the real place. |
| `read_scene` | A Scene's place, ground, relief, credits, paths and zones by kind, every building (position, size, levels, roof, facade colour). |
| `create_scene_from_place` | Imports a place (name or `lat`/`lon`, `size_m`, `detail`) through the « New scene » window, which the user sees and may cancel (`importerPourIA`). |
| `scene_preview` | Opens the Scene, waits until it is built, returns a JPEG of its view (`mcp:capture`, at most 1280 px wide). |

A Scene imported from a place keeps where it comes from on its Panel, `panel.lieu` = `{ lat, lon, size_m,
detail, country }`.

Every tool's arguments are checked before `run`; a mistake, an unknown id or a failed import comes back
as the tool's result with `isError: true` and a sentence the AI can act on, never as a crash.

## Extending

Add a tool in `makeTools` (`src/mcp-tools.js`): a name in snake_case, a description that says what it
returns and when to use it, a closed `inputSchema` (`additionalProperties: false`), and a `run` that
throws `ToolError` for what the AI must correct. Anything that needs the window goes through `deps`, given
by `mcp-link.js`. Test it in `tests/mcp.test.mjs` with stand-in `deps`.

## Pitfalls

- stdout is the protocol's in the bridge: logs go to stderr.
- Packaged, the bridge must be outside `app.asar` (`asarUnpack` in `package.json`); the path given to the
  client is the `app.asar.unpacked` one.
- The Windows Store build of Claude Desktop may read its configuration from a virtualised folder: the user
  pastes it through Claude Desktop's own « Edit config ».
