/**
 * tools/ez-tree/check-update.mjs: IS THERE A NEWER EZ-TREE? (#480g, asked by Durzo: « se tenir au courant de ses
 * mises à jour pour les proposer »). `node tools/ez-tree/check-update.mjs` from the project's root (Internet
 * needed): compares the copy in src/vendor/ez-tree/ (EZ_TREE_VERSION) with the latest on npm and, if newer, says
 * what to do. It changes nothing: a new version is proposed to Durzo, then copied by hand (see
 * docs/en/tree-species.md, « EZ-Tree updates »).
 */
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/vendor/ez-tree/ez-tree.js', import.meta.url), 'utf8');
const ours = (source.match(/EZ_TREE_VERSION = '([\d.]+)'/) || [])[1];

const newer = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

const res = await fetch('https://registry.npmjs.org/@dgreenheck/ez-tree/latest')
  .catch((e) => { console.error(`npm unreachable: ${e.cause ? e.cause.code : e.message}`); process.exit(2); });
if (!res.ok) { console.error(`npm: HTTP ${res.status}`); process.exit(2); }
const latest = (await res.json()).version;

if (newer(latest, ours)) {
  console.log(`EZ-Tree ${latest} is out (ours: ${ours}).`);
  console.log(`Changes: https://github.com/dgreenheck/ez-tree/compare/v${ours}...v${latest}`);
  console.log('To take it: see docs/en/tree-species.md, « EZ-Tree updates ».');
  process.exit(1);
}
console.log(`EZ-Tree ${ours}: up to date (npm: ${latest}).`);
