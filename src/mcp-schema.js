/**
 * @file mcp-schema.js
 * CHECKING AN AI'S ARGUMENTS against a tool's input schema, before anything is done (mcp-tools.js). The
 * schemas are JSON Schema, the subset our tools use: `type` (object, string, number, integer, boolean,
 * array), `properties`, `required`, `additionalProperties: false`, `enum`, `minimum`, `maximum`,
 * `minLength`, `maxLength`, `items`, `minItems`, `maxItems`. Each mistake comes back as a sentence the AI
 * can act on (« size_m: must be at most 400 »). PURE.
 */

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

function fits(type, v){
  if (type === 'integer') return Number.isInteger(v);
  if (type === 'number') return typeof v === 'number' && Number.isFinite(v);
  return typeOf(v) === type;
}

/**
 * The mistakes of `value` against `schema` ([] when it fits). `at`: where the value sits, for the
 * messages (a property's name, `points[2]`).
 */
export function schemaErrors(schema, value, at = 'arguments'){
  if (!schema) return [];
  if (schema.type && !fits(schema.type, value)) return [`${at}: must be ${schema.type === 'integer' ? 'an integer' : `a${/^[aeiou]/.test(schema.type) ? 'n' : ''} ${schema.type}`}`];
  const errors = [];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: must be one of ${schema.enum.map(e => JSON.stringify(e)).join(', ')}`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at}: must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at}: must be at most ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: must have at least ${schema.minLength} characters`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${at}: must have at most ${schema.maxLength} characters`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at}: must have at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at}: must have at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => errors.push(...schemaErrors(schema.items, v, `${at}[${i}]`)));
  }
  if (typeOf(value) === 'object') {
    const props = schema.properties || {};
    for (const k of schema.required || []) if (value[k] === undefined) errors.push(`${at === 'arguments' ? '' : `${at}.`}${k}: is required`);
    for (const [k, v] of Object.entries(value)) {
      const name = at === 'arguments' ? k : `${at}.${k}`;
      if (props[k]) errors.push(...schemaErrors(props[k], v, name));
      else if (schema.additionalProperties === false) errors.push(`${name}: is not a known argument`);
    }
  }
  return errors;
}
