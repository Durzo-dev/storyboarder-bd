# La connexion d'une IA (MCP)

*[English version](../en/mcp.md)*

Storyboarder ne fournit pas d'IA. L'utilisateur branche la sienne (Claude Desktop, Gemini CLI…) par le
Model Context Protocol : l'application ouverte est un serveur MCP, et l'IA appelle ses outils pour lire
les Scènes, importer un lieu réel et voir une Scène en image.

## Ce qui vit où

| Fichier | Rôle |
|---|---|
| `electron/mcp-server.js` | Le transport : un point d'accès HTTP local, `http://127.0.0.1:PORT/mcp`, et `mcp.json` (port, jeton, dernière liste d'outils) dans le dossier de données de l'utilisateur. Passe chaque message à la fenêtre et renvoie sa réponse. |
| `electron/mcp-bridge.js` | Le pont stdio pour les clients qui lancent leurs serveurs comme des programmes (Claude Desktop). Modules intégrés de Node seulement. |
| `electron/mcp-bundle.js` | L'extension Claude Desktop : un `.mcpb` (zip et `manifest.json`) fait pour cet ordinateur, qui contient le pont. |
| `src/mcp-protocol.js` | PUR. JSON-RPC 2.0 : `initialize`, `ping`, `tools/list`, `tools/call`. Sans état. |
| `src/mcp-schema.js` | PUR. Vérifie les arguments selon le schéma d'entrée de l'outil (un sous-ensemble de JSON Schema), erreurs en phrases. |
| `src/mcp-tools.js` | Les outils : ce que l'IA lit (nom, description, schéma) et ce qu'ils font, par des gestes injectés. |
| `src/mcp-link.js` | Le côté fenêtre : reçoit les messages, relie les outils à l'application, la ligne de la Configuration. |
| `tests/mcp.test.mjs` | Schéma, protocole, les outils sur une vraie Scène, le point d'accès, le pont. |

## L'activer

Configuration > Général > « Connexion d'une IA » : éteinte par défaut (`mcpEnabled` dans
`settings.json`). Allumée, l'application écoute, et :

- **« Installer dans Claude Desktop »** (`mcp:installClaude`) écrit `Storyboarder.mcpb` dans le dossier
  de données de l'utilisateur et l'ouvre : Claude Desktop montre sa fenêtre d'installation, un clic sur
  « Installer ». Le manifeste lance le pont avec le Node de Claude Desktop (`server.type: node`), avec en
  argument le chemin du `mcp.json` de cet ordinateur ; les outils sont listés depuis `mcp.json`. Sans
  Claude Desktop (aucun logiciel n'ouvre les `.mcpb`), le fichier est montré dans son dossier, à glisser
  dans la fenêtre de Claude Desktop. Aucun fichier de configuration à modifier.
- **« Copier la config Gemini CLI »** : à coller dans `settings.json` (`mcpServers`) : `httpUrl` et
  l'en-tête `Authorization`.

`clientConfig('claude')` donne encore la forme écrite à la main (`claude_desktop_config.json` :
l'exécutable de Storyboarder avec `ELECTRON_RUN_AS_NODE=1` qui lance le pont), pour un client sans
extensions.

ChatGPT ne joint que des serveurs distants en HTTPS : non pris en charge.

## Déroulé

1. Le client envoie un message JSON-RPC (POST au point d'accès, ou une ligne sur l'entrée du pont).
2. `mcp-server.js` le vérifie (ci-dessous) et l'envoie à la fenêtre sur `mcp:request` avec un numéro.
3. `mcp-link.js` répond par `handleMessage` et rend la réponse sur `mcp:response`.
4. Le point d'accès la renvoie (200 avec du JSON, 202 pour une notification).

Au démarrage, la fenêtre donne la liste des outils (`mcp:tools`), gardée dans `mcp.json` : Storyboarder
fermé, le pont répond lui-même à `initialize`, `ping` et `tools/list`, donc le client se connecte ; un
appel d'outil dit alors d'ouvrir Storyboarder. Le protocole ne garde pas de session : un client initialisé
par le pont seul fonctionne dès que l'application s'ouvre.

## Sécurité

- Lié à `127.0.0.1` seulement.
- L'en-tête `Host` doit être `127.0.0.1:PORT` ou `localhost:PORT` (pas de détournement DNS), et toute
  `Origin` est refusée (un navigateur en envoie toujours une).
- Un jeton secret (48 caractères hexadécimaux), créé une fois et gardé dans `mcp.json`, exigé en
  `Authorization: Bearer`. Le pont le lit dans le fichier ; la configuration de Gemini le porte.
- Messages de 1 Mo au plus ; une réponse attend 10 minutes au plus (un gros import).

## Les outils

| Outil | Fait |
|---|---|
| `list_scenes` | Les Scènes du Projet : id, nom, nombres, le lieu réel. |
| `read_scene` | Le lieu d'une Scène, son sol, son relief, ses crédits, tracés et zones par sorte, chaque bâtiment (position, taille, niveaux, toit, couleur de façade). |
| `create_scene_from_place` | Importe un lieu (nom ou `lat`/`lon`, `size_m`, `detail`) par la fenêtre « Nouvelle scène », que l'utilisateur voit et peut annuler (`importerPourIA`). |
| `scene_preview` | Ouvre la Scène, attend qu'elle soit construite, rend un JPEG de sa vue (`mcp:capture`, 1280 px de large au plus). |

Une Scène importée d'un lieu garde d'où elle vient sur sa Case, `panel.lieu` = `{ lat, lon, size_m,
detail, country }`.

Les arguments de chaque outil sont vérifiés avant `run` ; une erreur, un id inconnu ou un import échoué
revient comme résultat de l'outil avec `isError: true` et une phrase sur laquelle l'IA peut agir, jamais
comme un plantage.

## Étendre

Ajouter un outil dans `makeTools` (`src/mcp-tools.js`) : un nom en snake_case, une description qui dit ce
qu'il rend et quand s'en servir, un `inputSchema` fermé (`additionalProperties: false`), et un `run` qui
lève `ToolError` pour ce que l'IA doit corriger. Ce qui a besoin de la fenêtre passe par `deps`, fourni
par `mcp-link.js`. Le tester dans `tests/mcp.test.mjs` avec des `deps` de remplacement.

## Pièges

- Dans le pont, la sortie standard appartient au protocole : les journaux vont sur la sortie d'erreur.
- Empaqueté, le pont doit être hors de `app.asar` (`asarUnpack` dans `package.json`) ; le chemin donné au
  client est celui de `app.asar.unpacked`.
- L'extension contient le chemin absolu de `mcp.json` : elle est faite sur l'ordinateur qui s'en sert,
  jamais distribuée comme fichier.
- L'extension n'est pas signée : Claude Desktop le dit dans sa fenêtre d'installation.
