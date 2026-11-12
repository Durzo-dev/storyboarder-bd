/**
 * tests/search-field.test.mjs: the design system's search field (src/search-field.js): the clear button shows
 * with text, and clearing empties the field, gives it the focus back and lets the screen know.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wireSearchField } from '../src/search-field.js';

class Element {
  constructor(){ this.listeners = {}; this.hidden = false; this.value = ''; this.focused = false; }
  addEventListener(t, f){ (this.listeners[t] = this.listeners[t] || []).push(f); }
  dispatchEvent(e){ (this.listeners[e.type] || []).forEach(f => f(e)); }
  click(){ this.dispatchEvent({ type: 'click' }); }
  focus(){ this.focused = true; }
}
globalThis.Event = globalThis.Event || class { constructor(type){ this.type = type; } };

test('the clear button shows with text; clearing empties, focuses and tells', () => {
  const input = new Element(), clear = new Element();
  const root = { querySelector: (s) => (s === 'input' ? input : s === '.champ-recherche-effacer' ? clear : null) };
  let cleared = 0, typed = 0;
  input.addEventListener('input', () => { typed++; });
  const refresh = wireSearchField(root, { onClear: () => { cleared++; } });
  assert.equal(clear.hidden, true, 'empty: no cross');
  input.value = 'Mont'; input.dispatchEvent(new globalThis.Event('input'));
  assert.equal(clear.hidden, false);
  clear.click();
  assert.equal(input.value, '');
  assert.equal(clear.hidden, true);
  assert.equal(input.focused, true);
  assert.equal(cleared, 1);
  assert.equal(typed, 2, 'the screen hears it as typing');
  input.value = 'Paris'; refresh();
  assert.equal(clear.hidden, false, 'a value written by the screen shows the cross after refresh');
});

test('the field\'s parts and its place in the design system', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.champ-recherche\{ display:flex;/);
  assert.match(css, /\.champ-recherche-effacer\[hidden\]\{ display:none; \}/);
  assert.match(readFileSync(new URL('../tools/design-system.mjs', import.meta.url), 'utf8'), /class="champ-recherche"/);
  assert.match(readFileSync(new URL('../docs/en/interface.md', import.meta.url), 'utf8'), /### Search field/);
});
