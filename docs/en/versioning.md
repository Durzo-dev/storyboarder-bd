# Versioning and publishing

*[Version française](../fr/versioning.md)*

Format `major.minor.patch`, shown next to the application name, top left.

## The three levels

| Level | When | How |
|---|---|---|
| **major** | On explicit request | `npm run bump major` |
| **minor** | When a feature is validated | `npm run bump minor` |
| **patch** | On every commit | Automatic (`pre-commit` hook) |

A minor bump resets the patch to 0; a major bump resets both.

## The four files carrying the version

`package.json` is the reference (electron-builder stamps the installer with it).
`tools/bump-version.mjs` derives from it:
- `src/version.js`, imported by the renderer for display (see [architecture.md](architecture.md));
- the `**Version x.y.z**` line of `README.md` and `README.fr.md`.

`tests/version.test.mjs` forbids these four files from diverging.

## What happens on every commit

```
git commit
   │
   ├─ merge / rebase / cherry-pick?  →  nothing is touched
   ├─ node missing from PATH?  →  commit aborted, explicit message
   ├─ ESLint (skipped with a message if not installed)
   │     └─ errors  →  commit aborted, no file changed
   ├─ regeneration of docs/design-system.html (design system)
   ├─ test suite
   │     └─ failure  →  commit aborted, no file changed
   ├─ patch bump, the 4 files together
   │     ├─ version already changed by hand  →  no second bump
   │     └─ an invalid file  →  no write at all
   ├─ the 4 files join the commit
   └─ post-commit: minor or major?  →  tag `vX.Y.Z` + `--follow-tags` reminder
```

Three orderings matter:
- **tests before the bump**: a failure leaves no bumped version without a commit;
- **in the script, every check before any write**: an invalid README does not leave `package.json`
  bumped on its own;
- **the tag in `post-commit`**: at `pre-commit`, the commit carrying the version does not exist yet.

## Commands

```bash
npm i -D eslint          # enables the hook's lint step
npm run setup-hooks      # after a clone: installs the hooks (git does not version .git/hooks)
npm run bump sync        # regenerates the derived files from package.json
npm run bump minor       # or major; never patch, the hook does it
git push --follow-tags   # git push alone does not send tags
```

`git commit --no-verify` skips tests and bump, for a work-in-progress commit. `post-commit` still
runs: a tag is set if the version changed.

## Known limits

- **`git commit --amend` bumps again**: a `pre-commit` hook cannot reliably tell an amend apart on
  Windows. Amend with `git commit --amend --no-verify`.
- **Tags do not leave on their own**: `git push --follow-tags`, which `post-commit` reminds on screen
  whenever it sets a tag.

## Continuous integration

`.github/workflows/ci.yml` runs lint and tests on Linux, on every push and pull request, on Node's two
LTS lines. It covers what the local hook does not see: a clone without hooks, another system,
`npm ci` (which fails if `package-lock.json` diverges from `package.json`, hence on an undeclared
dependency), and commits made with `--no-verify`.

Deliberately absent: type checking (see [architecture.md](architecture.md)) and building the
installer.

`tests/ci-setup.test.mjs` checks that CI runs both checks, uses `npm ci`, and that the Node versions
tested match `engines` in `package.json` and the READMEs.

## Release notes

On any `v*` tag, `.github/workflows/release.yml` publishes the GitHub release with, in order of
preference:
1. the `CHANGELOG.md` section titled exactly `## <tag>` (a test enforces the format), which separates
   "what changes for you" from "under the hood";
2. failing that, the list of commit subjects since the previous tag.

With a written section, the subject list follows in a collapsed `<details>` block. Both forms carry a
compare link. Only minor and major versions are tagged, hence published.

The formatting lives in `tools/release-notes.mjs`, a pure function tested on every commit, not in the
YAML. Commit bodies are never published.

## The installer ships an allow-list

`build.files`, in `package.json`, is **exclusive**: a file not listed there never reaches the
installed application, while everything works in development. **Adding a file loaded at run time
means adding it here too.** `tests/packaging.test.mjs` checks that every local asset referenced by
`index.html` is covered, and that every pattern targets an existing file.

## Pitfalls

- **`fetch-depth: 0` on `release.yml`'s checkout**: without it, `git describe` sees no earlier tag and
  every release announces itself as the first (a test guards it).
- **Do not leave an "Unreleased" section in `CHANGELOG.md` when tagging**: it is not picked up; only
  `## vX.Y.Z` is.
