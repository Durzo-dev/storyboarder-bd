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
| `electron/mcp-bundle.js` | The Claude Desktop extension: a `.mcpb` (zip and `manifest.json`) made for this computer, holding the bridge. |
| `src/mcp-protocol.js` | PURE. JSON-RPC 2.0: `initialize`, `ping`, `tools/list`, `tools/call`. Stateless. |
| `src/mcp-schema.js` | PURE. Checks the arguments against the tool's input schema (a JSON Schema subset), mistakes in words. |
| `src/mcp-tools.js` | The tools: what the AI reads (name, description, schema) and what they do, through injected gestures. |
| `src/mcp-link.js` | The window's side: receives the messages, binds the tools to the application, the AI tab of Settings. |
| `src/mcp-status.js` | PURE. What the AI tab says: the connection, and each client's state. |
| `electron/mcp-clients.js` | Gemini CLI's settings file: Storyboarder's entry added, the rest kept. |
| `tests/mcp.test.mjs` | Schema, protocol, the tools on a real Scene, the endpoint, the bridge. |

## Turning it on

Settings > « AI » tab (`mcp-link.js`): one card per client, two per row; the whole card installs. There is
no switch: installing a client connects Storyboarder (`mcpEnabled` in `settings.json`, off by default);
« Disconnect », left of « Close » and shown on this tab only, turns it off; a click on a card connects again.
A client not on this computer (`installed: false`): its card opens its official download page
(`mcp:openDownload`, the addresses are in `main.js`).

- **LM Studio** (`mcp:installLmStudio`) opens its « Add to LM Studio » link
  (`lmstudio://add_mcp?name=storyboarder&config=<base64>`, `lmStudioLink`), entry `url` and `headers`
  (Cursor's notation): LM Studio shows the server and asks to install it. Installed when
  `~/.lmstudio/mcp.json` holds Storyboarder; on this computer when `~/.lmstudio` exists.

- **Claude Desktop** (`mcp:installClaude`) writes `Storyboarder.mcpb` in the user's data folder and opens
  it: Claude Desktop shows its installation window, one click on « Install ». The manifest starts the
  bridge with Claude Desktop's own Node (`server.type: node`), with the path of this computer's
  `mcp.json` as argument; the tools are listed from `mcp.json`. Without Claude Desktop (no program opens
  `.mcpb`), the file is shown in its folder, to drag into Claude Desktop's window.
- **Google Antigravity** (`mcp:installAntigravity`) and **Gemini CLI** (`mcp:installGemini`),
  `electron/mcp-clients.js`: Storyboarder's entry is written under `mcpServers` in the client's file,
  every other setting kept, the previous file copied next to it (`.storyboarder-backup`). Antigravity (its
  app, CLI and IDE share it): `~/.gemini/config/mcp_config.json`, entry `serverUrl` (it does not read
  `httpUrl`), `headers`, `timeoutSeconds: 600` (its default, 3 minutes, is shorter than a large import).
  Gemini CLI (now for API keys and company accounts; personal accounts moved to Antigravity):
  `~/.gemini/settings.json`, entry `httpUrl`, `headers`, `timeout: 600000`. A file that is not plain JSON
  (comments) is not rewritten: the configuration is copied to the clipboard, to paste.

The cards show the clients' official logos (`assets/logos/`, their sources and rights in its
`LISEZMOI.md`), never recoloured; a client without one keeps a generic illustration (`.ia-illustration`).

No configuration file for the user to edit. `clientConfig('claude')` still gives the hand-written form
(`claude_desktop_config.json`: Storyboarder's executable with `ELECTRON_RUN_AS_NODE=1` running the
bridge), for a client that has no extensions.

### An action that needs an AI

Every action of Storyboarder that needs an AI first calls `demanderIA(reason)` (`mcp-link.js`). An AI ready
(`iaPrete`, `mcp-status.js`: connected, and a client connected or set up; an offered or outdated Claude
Desktop extension does not count): it goes on at once. Otherwise Settings opens on the AI tab, over whatever
was open (the modal stack keeps it), with the reason in a banner (`#mcpRaison`); `demanderIA` looks every
1.5 s, and once an AI is ready closes Settings, puts back the tab it had and resolves to true: the caller
goes on where it was. Settings closed without an AI: false.

### The state under each card

`src/mcp-status.js` (PURE) words it from `mcp:status`, read again every 3 s while the tab is shown:

- the endpoint records each client it hears in `mcp.json` (`clients`: `claude`, `gemini`, `other`, with
  its name and `lastSeen`): the bridge sends its client's name (`clientInfo.name` of its `initialize`) in
  `X-Mcp-Client`, and pings every 30 s while its client runs; a client over HTTP gives its name at
  `initialize` (`clientKind`: « claude », then « antigravity », then « gemini », else `other`);
- **connected**: heard within 75 s; **installed**: heard before, or the client's file holds Storyboarder;
  **outdated**: Claude Desktop heard through a bridge older than `BRIDGE_VERSION` (`X-Mcp-Bridge`, none for
  the first one): its card installs the extension again; **offered**: Claude Desktop's installation window was opened (`mcpClaudeOffered`) but Claude Desktop was
  never heard; **missing**: the client is not on this computer (no `~/.gemini/settings.json` for Gemini
  CLI; no `~/.gemini/antigravity*` folder nor `mcp_config.json` for Antigravity); **none** otherwise.

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
- The extension embeds the absolute path of `mcp.json`: it is made on the computer that uses it, never
  shipped as a file.
- The extension is not signed: Claude Desktop says so in its installation window.
