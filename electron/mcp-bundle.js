// THE CLAUDE DESKTOP EXTENSION (docs/en/mcp.md): an MCP Bundle (.mcpb, a zip with a manifest.json) made on
// this computer, that Claude Desktop installs in one click. It holds the stdio bridge (mcp-bridge.js) and
// says to start it with Claude Desktop's own Node, pointing at this computer's mcp.json: no configuration
// file for the user to edit. Node's built-ins only (zlib for the zip).
const fs = require('fs');
const zlib = require('zlib');

/** A zip archive of `files` ([{ name, data: Buffer }]), deflated. */
function zip(files){
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf-8');
    const packed = zlib.deflateRawSync(f.data);
    const crc = zlib.crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, packed);
    centrals.push(central, name);
    offset += local.length + name.length + packed.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

/** The bundle's manifest: the bridge started by Claude Desktop's Node with the path of mcp.json. */
function manifestOf({ version, mcpJsonPath, tools = [] }){
  return {
    manifest_version: '0.3',
    name: 'storyboarder',
    display_name: 'Storyboarder',
    version: /^\d+\.\d+\.\d+/.test(version || '') ? version : '1.0.0',
    description: 'Lets Claude read and create the Scenes of Storyboarder, open on this computer.',
    long_description: 'Storyboarder must be open, with Settings > General > AI connection turned on. Claude can then list and read the Scenes, import a real place as a new Scene, and see a Scene as an image.',
    author: { name: 'Durzo' },
    icon: 'icon.png',
    server: {
      type: 'node',
      entry_point: 'server/index.js',
      mcp_config: { command: 'node', args: ['${__dirname}/server/index.js', mcpJsonPath], env: {} },
    },
    tools: tools.map(t => ({ name: t.name, description: t.description })),
    tools_generated: true,
    compatibility: { platforms: ['win32', 'darwin'], runtimes: { node: '>=16.0.0' } },
  };
}

/** The .mcpb archive. `bridgePath`, `iconPath`: files to put in it; the rest goes in the manifest. */
function buildBundle({ version, mcpJsonPath, bridgePath, iconPath, tools }){
  const files = [
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifestOf({ version, mcpJsonPath, tools }), null, 2), 'utf-8') },
    { name: 'server/index.js', data: fs.readFileSync(bridgePath) },
  ];
  if (iconPath && fs.existsSync(iconPath)) files.push({ name: 'icon.png', data: fs.readFileSync(iconPath) });
  return zip(files);
}

module.exports = { buildBundle, manifestOf, zip };
