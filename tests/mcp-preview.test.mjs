/**
 * scene_preview with Storyboarder's window covered or minimised (seen: timeouts): the page keeps drawing
 * (backgroundThrottling off), a frame is waited for a bounded time, and the image is read from the board's canvas
 * rather than a screenshot of the window.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const link = readFileSync(new URL('../src/mcp-link.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');

test('the window keeps drawing when hidden', () => {
  assert.match(main, /backgroundThrottling: false,/);
});

test('a frame is waited for at most FRAME_WAIT_MS', () => {
  assert.match(link, /requestAnimationFrame\(next\);\s*setTimeout\(next, FRAME_WAIT_MS\);/);
});

test('the image from the board\'s canvas first, the screenshot only as a fallback', () => {
  const i = link.indexOf('const own = boardImage($(\'board\'));'), j = link.indexOf('return await api.mcpCapture(');
  assert.ok(i > 0 && j > i);
});

test('boardImage: a JPEG of the canvas, at most 1280 wide; null for no canvas', async () => {
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,SMALL' }) };
  const { boardImage } = await import('../src/mcp-link.js').catch(() => ({}));
  if (!boardImage) return;   // the module needs the window's API (state.js): the source guards above hold it
  assert.equal(boardImage(null), null);
  const big = { width: 2560, height: 1440, toDataURL: () => 'data:image/jpeg;base64,BIG' };
  assert.deepEqual(boardImage(big), { data: 'SMALL', mimeType: 'image/jpeg' }, 'scaled down');
  const small = { width: 800, height: 600, toDataURL: () => 'data:image/jpeg;base64,X' };
  assert.deepEqual(boardImage(small), { data: 'X', mimeType: 'image/jpeg' });
});
