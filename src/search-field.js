/**
 * @file search-field.js
 * THE SEARCH FIELD of the design system (docs/en/interface.md, « Search field »): a text field with, inside
 * it on the right, a button that clears it (shown only when there is text) and the search button.
 *
 *   <div class="champ-recherche">
 *     <input type="search">
 *     <button type="button" class="champ-recherche-effacer" hidden>…</button>
 *     <button type="submit" class="champ-recherche-lancer">…</button>
 *   </div>
 *
 * The search itself belongs to the screen (the form's submit); here only the clear button's behaviour.
 */

/**
 * Wires a search field: the clear button shows while there is text; clicking it empties the field, gives it
 * the focus back and lets the screen know (`onClear`, and an `input` event, as typing would). Returns
 * `refresh()`, to call after the screen writes the field itself.
 */
export function wireSearchField(root, { onClear = () => {} } = {}){
  const input = root && root.querySelector('input');
  const clear = root && root.querySelector('.champ-recherche-effacer');
  if (!input || !clear) return () => {};
  const refresh = () => { clear.hidden = !input.value; };
  input.addEventListener('input', refresh);
  clear.addEventListener('click', () => {
    input.value = '';
    refresh();
    input.focus();
    input.dispatchEvent(new globalThis.Event('input'));
    onClear();
  });
  refresh();
  return refresh;
}
