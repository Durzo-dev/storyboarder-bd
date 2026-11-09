# Testing method

*[Version française](../fr/testing-method.md)*

The whole suite runs on every commit (`pre-commit` hook, see [versioning.md](versioning.md)). This
note says how the tests are organised and how to write them.

## Tooling

Node's built-in test runner, no dependency:

```bash
npm test                              # the whole suite
node --test tests/scene3d.test.mjs    # a single file
```

- **One file per module**: `tests/<module>.test.mjs`.
- **`tests/helpers/dom-stub.mjs`** imports the real `three` and stubs the DOM: tests work on real
  Three.js geometry. `render-stub.mjs` replaces rendering, `source.mjs` reads source code (comments
  stripped) for tests that inspect it.
- The **header** of each test file says what it covers and what it excludes; keep it up to date.

## Making code testable: pure functions

Every **decision** (computation, rule, validation) lives in an exported pure function, with no DOM and
no three; the screen only calls it and draws. That is what makes it testable under Node. Logic locked
in an event listener or a render loop cannot be tested: extract it.

## Mutation testing

A passing test proves nothing. After a fix:
1. deliberately break the fixed code, in several ways;
2. check the suite fails **every time**;
3. if a mutation passes, the test is decorative: strengthen it or extract the logic.

Two precautions: check the mutation was applied **in the right place** (a textual substitution can hit
an identical line elsewhere); and when a fix has several layers (a cause and a safety net), write
**one test per layer**, or each one hides the other's removal.

## Thresholds are measured

A threshold is chosen between the measured real value and what plausible regressions would produce,
and the three figures are written in the test:

```js
// Real value 0.0100; plausible regressions 0.0147 and 0.0200: threshold 0.012.
assert.ok(debord <= 0.012, …);
```

## Invariant tests

`tests/scene3d.test.mjs` checks **relations between functions**: that the hole, the rig, the render
box and the camera designate the same place, over the whole parameter range. A unit test never sees
two correct functions that are not talking about the same thing.

## Guard tests

Tests aimed not at a module, but at a rule of the repository:

| Test | What it guards |
|---|---|
| `tests/persisted-format.test.mjs` | Saved names and values (see [persisted-data.md](persisted-data.md)). |
| `tests/dom-ids.test.mjs` | A `getElementById` targets a real id in `index.html`. |
| `tests/html.test.mjs`, `tests/style.test.mjs` | HTML nesting, interacting CSS rules. |
| `tests/design-system.test.mjs` | The interface follows the design system. |
| `tests/modal-stack.test.mjs` | Every modal registers in the stack (Esc, click outside). |
| `tests/code-mort.test.mjs` | An export nobody calls must be justified in the file. |
| `tests/docs.test.mjs` | `docs/`: language parity, index, links, references from the code. |
| `tests/electron-bridge.test.mjs` | The Electron bridge and its type declaration agree. |
| `tests/packaging.test.mjs` | What the application loads is in the installer. |
| `tests/events.test.mjs` | Hot paths go through the scheduler. |

## Static analysis

```bash
npm i -D eslint     # once
npm run lint
```

ESLint covers grammar (variable never read or undeclared, duplicate key, unreachable code). The hook
runs it before the tests, and skips it with a message if it is not installed. What is specific to the
project (HTML, CSS, Markdown, domain rules) stays in `tests/`.

## Out of reach

- **Anything that builds a `THREE.WebGLRenderer`**: fails under Node (everything going through
  `ensurePersonaScene3D()`, `renderPanelScene3D`, `panelDragRayOnPlane`…).
- **Event wiring**: only the extracted logic is tested.
- **What a drawing looks like**: a test checks a path is closed or a geometry is right, not that text
  fits in its bubble. When the output is an image, **produce the image and look at it**.

## Pitfalls

- **A threshold set "by feel"** gives a test that does not bite, or breaks for nothing.
- **An outdated exclusion in a header** suggests coverage that does not exist.
- **`git commit --no-verify`** skips the tests: only for a work-in-progress commit.
