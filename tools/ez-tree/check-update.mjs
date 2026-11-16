/**
 * tools/ez-tree/check-update.mjs: IS THERE A NEWER EZ-TREE? (#480g, asked by Durzo: « se tenir au courant de ses
 * mises à jour pour les proposer »). `node tools/ez-tree/check-update.mjs` from the project's root (Internet
 * needed): compares the copy in src/vendor/ez-tree/ (EZ_TREE_VERSION) with the latest on npm or GitHub and, if newer, says
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

// The latest on npm AND among GitHub's tags (seen on 16 Nov. 2026: v2.0.0 tagged on GitHub in July 2026, npm still at
// 1.1.0): the newer of the two.
const fromNpm = fetch('https://registry.npmjs.org/@dgreenheck/ez-tree/latest')
  .then(r => (r.ok ? r.json() : null)).then(j => (j && j.version) || null).catch(() => null);
const fromGitHub = fetch('https://api.github.com/repos/dgreenheck/ez-tree/tags?per_page=100')
  .then(r => (r.ok ? r.json() : null))
  .then(tags => (Array.isArray(tags) ? tags.map(t => String(t.name).replace(/^v/, '')).filter(v => /^\d+\.\d+\.\d+$/.test(v)) : []))
  .then(vs => vs.reduce((m, v) => (!m || newer(v, m) ? v : m), null)).catch(() => null);
const [npm, github] = await Promise.all([fromNpm, fromGitHub]);
if (!npm && !github) { console.error('npm and GitHub unreachable'); process.exit(2); }
const latest = [npm, github].filter(Boolean).reduce((m, v) => (newer(v, m) ? v : m));

if (newer(latest, ours)) {
  console.log(`EZ-Tree ${latest} is out (ours: ${ours}; npm: ${npm || '?'}, GitHub: ${github || '?'}).`);
  console.log(`Changes: https://github.com/dgreenheck/ez-tree/compare/v${ours}...v${latest} (and its CHANGELOG.md)`);
  console.log('To take it: see docs/en/tree-species.md, « EZ-Tree updates ».');
  process.exit(1);
}
console.log(`EZ-Tree ${ours}: up to date (npm: ${npm || '?'}, GitHub: ${github || '?'}).`);
