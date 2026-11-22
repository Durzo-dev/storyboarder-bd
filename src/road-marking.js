/**
 * @file src/road-marking.js
 * PURE. The layout of a road's dashed centre line along one Path.
 *
 * A dash pattern started at each Path's first point and cut at its last one: where a road is several Paths end to
 * end (OpenStreetMap splits a street at every crossing and wherever a tag changes), the pattern broke at each joint, a
 * stub of a dash, then a gap of any length (seen: the centre line looked interrupted). So the pattern is FITTED to the
 * Path: a whole number of periods, stretched or shrunk to its length, each end in half a gap. Two Paths end to end
 * then meet in one whole gap, and a crossing's middle is left clear (as the lines stop at a real crossing).
 */

/**
 * A Path shorter than this share of a period has no dash: fitted, its single dash would be shrunk to under three
 * quarters of the asked one, and its half gaps with it (they keep a crossing's middle clear).
 */
export const LEAST_PERIOD = 0.75;

/**
 * The fitted pattern for a Path `length` long, from the asked `dash` and `gap` lengths: `{ count, dash, gap, start }`
 * (`start`: the gap before the first dash, half a gap), or `{ count: 0 }` when the Path is shorter than LEAST_PERIOD of a period. The scale stays within 0.75 to 1.5.
 */
export function dashLayout(length, dash, gap){
  const period = dash + gap;
  if (!(length > 0) || !(dash > 0) || !(gap > 0)) return { count: 0 };
  if (length < LEAST_PERIOD * period) return { count: 0 };
  const count = Math.max(1, Math.round(length / period));
  const scale = length / (count * period);
  return { count, dash: dash * scale, gap: gap * scale, start: gap * scale / 2 };
}

/** The dashes of a fitted pattern as `[from, to]` distances along the Path. */
export function dashSpans(length, dash, gap){
  const l = dashLayout(length, dash, gap);
  const spans = [];
  for (let k = 0; k < l.count; k++) {
    const from = l.start + k * (l.dash + l.gap);
    spans.push([from, from + l.dash]);
  }
  return spans;
}
