/**
 * @file facade-colour.js
 * THE COLOUR OF A FACADE, TAKEN FROM A STREET PHOTO (#474c, « Realistic » level; study: durzo-docs
 * facades-photos.md). For each building, the street photo (Panoramax) that best sees one of its walls is
 * chosen by geometry alone (no image analysis): close enough, facing the wall, the wall in its field, no other
 * building in between. Points of that wall are projected into the photo, their pixels read by the caller, and
 * the wall's colour is what is left once windows, shadows, sky and greenery are set aside. PURE.
 *
 * Frames: local metres around the zone's centre, x to the east, z to the SOUTH; a photo's `yaw` is the
 * compass bearing of its centre (degrees, 0 north, clockwise); a 360° photo is equirectangular, its centre at
 * `yaw`.
 */

const DEG = Math.PI / 180;
/** A photo sees a wall from this far to this far (metres): closer, the wall overflows it; farther, too small. */
const NEAREST = 4, FARTHEST = 35;
/** The most a wall may be turned away from the camera and still be read (degrees from facing it). */
const MOST_OBLIQUE = 60;
/** The camera's height above the street (metres): a car's roof or a raised hand. */
const CAMERA_HEIGHT = 2.5;

const wrap180 = (a) => ((a + 180) % 360 + 360) % 360 - 180;
/** The compass bearing (degrees) from a to b, x east and z south. */
const bearing = (a, b) => Math.atan2(b.x - a.x, -(b.z - a.z)) / DEG;

function insidePolygon(p, q){
  let d = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) d = !d;
  }
  return d;
}
function segmentsCross(a, b, c, d){
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

/**
 * A building's facades in the zone's frame: its ground-floor walls (3 m or more), each with its middle, its
 * outward normal and its length, and its outline (for the sight lines) and eaves height. `entry`: one of
 * translateOsm's buildings ({ building, x, z }).
 */
export function facadesOf(entry){
  const b = entry.building;
  const ground = b.niveaux.reduce((p, q) => (q.elevation < p.elevation ? q : p));
  const walls = b.murs.filter(m => m.niveauId === ground.id);
  const outline = walls.map(m => ({ x: entry.x + m.a.x, z: entry.z + m.a.z }));
  const eaves = Math.max(...b.niveaux.filter(n => n.elevation > -1e-9).map(n => n.elevation + n.hauteur));
  const facades = [];
  for (const m of walls) {
    const a = { x: entry.x + m.a.x, z: entry.z + m.a.z }, c = { x: entry.x + m.b.x, z: entry.z + m.b.z };
    const length = Math.hypot(c.x - a.x, c.z - a.z);
    if (length < 3) continue;
    const mid = { x: (a.x + c.x) / 2, z: (a.z + c.z) / 2 };
    let n = { x: (c.z - a.z) / length, z: -(c.x - a.x) / length };
    if (insidePolygon({ x: mid.x + n.x * 0.5, z: mid.z + n.z * 0.5 }, outline)) n = { x: -n.x, z: -n.z };
    facades.push({ a, b: c, mid, normal: n, length });
  }
  return { facades, outline, eaves };
}

/**
 * The best (facade, photo) of a building, or null: the photo `photos` ([{ id, x, z, yaw, fov, … }]) that sees
 * one of its facades closest and most squarely, with no other outline (`others`: [[{x, z}…]…]) across the
 * sight line. Returns { facade, photo, distance, angle }.
 */
export function bestView(building, photos, others = []){
  let best = null;
  for (const f of building.facades) {
    for (const p of photos) {
      const dx = f.mid.x - p.x, dz = f.mid.z - p.z, d = Math.hypot(dx, dz);
      if (d < NEAREST || d > FARTHEST) continue;
      // Facing: the camera stands in front of the wall (on its outward side), not too obliquely.
      const facing = -(dx * f.normal.x + dz * f.normal.z) / d;
      const angle = Math.acos(Math.max(-1, Math.min(1, facing))) / DEG;
      if (angle > MOST_OBLIQUE) continue;
      // In the field: a flat photo must look towards the wall's middle; a 360° sees everything.
      const off = Math.abs(wrap180(bearing(p, f.mid) - p.yaw));
      if (p.fov < 360 && off > p.fov / 2 * 0.85) continue;
      // Nothing in between: no other building's outline crosses the sight line.
      const blocked = others.some(o => o.some((q, i) => segmentsCross(p, f.mid, q, o[(i + 1) % o.length])));
      if (blocked) continue;
      const score = d + angle * 0.3 + (p.fov < 360 ? 0 : 3);
      if (!best || score < best.score) best = { facade: f, photo: p, distance: d, angle, score };
    }
  }
  return best;
}

/**
 * Points of the facade to read, as fractions of the photo ([{ u, v }], u from the left, v from the top): a grid
 * on the wall's middle part, between the storeys' bands (above the ground floor when there is one, its shops and
 * parked cars), not too near the eaves. Points out of the photo are left out.
 */
export function samplePoints(view, eaves, { width = 2048, height = 1024 } = {}){
  const { facade: f, photo: p } = view;
  const low = eaves > 4.5 ? 3.3 : 1.3, high = Math.max(low + 0.6, eaves - 0.6);
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const t = 0.15 + 0.7 * i / 6;
    const w = { x: f.a.x + (f.b.x - f.a.x) * t, z: f.a.z + (f.b.z - f.a.z) * t };
    for (let j = 0; j < 5; j++) {
      const y = low + (high - low) * j / 4;
      const d = Math.hypot(w.x - p.x, w.z - p.z), az = wrap180(bearing(p, w) - p.yaw), up = y - CAMERA_HEIGHT;
      let u, v;
      if (p.fov >= 360) {
        u = 0.5 + az / 360;
        v = 0.5 - Math.atan2(up, d) / DEG / 180;
      } else {
        const forward = d * Math.cos(az * DEG), right = d * Math.sin(az * DEG);
        if (forward <= 0.5) continue;
        const th = Math.tan(p.fov / 2 * DEG), tv = th * height / width;
        u = 0.5 + right / forward / (2 * th);
        v = 0.5 - up / forward / (2 * tv);
      }
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) pts.push({ u, v });
    }
  }
  return pts;
}

/**
 * The wall's colour from the pixels read at the sample points ([[r, g, b]…]), or null when too few are left:
 * windows and shadows (dark), sky (blue and bright), greenery (green), glare (white) are set aside, and the
 * median of each channel of the rest is taken. Returns { colour: '#rrggbb', kept } (`kept`: the share used).
 */
export function wallColour(pixels){
  const kept = pixels.filter(([r, g, b]) => {
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (l < 45 || l > 245) return false;
    if (b > r + 25 && b > g + 5 && l > 110) return false;   // sky
    if (g > r + 12 && g > b + 8) return false;              // greenery
    return true;
  });
  if (kept.length < 10 || kept.length < pixels.length * 0.3) return null;
  const median = (k) => { const s = kept.map(p => p[k]).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const [r, g, b] = [median(0), median(1), median(2)];
  // ⚠️ NOT A WALL'S COLOUR, NOT TAKEN (seen in Montpellier: a purple, a facade near black): a shop's sign, an
  // awning, a wall in deep shade or the wrong part of the photo. A facade is muted (saturation under 0.45) and
  // not dark (lightness 80 or more); otherwise the facade keeps the style's colour.
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if ((max - min) / Math.max(1, max) > 0.45 || 0.299 * r + 0.587 * g + 0.114 * b < 80) return null;
  const hex = (x) => Math.round(x).toString(16).padStart(2, '0');
  return { colour: `#${hex(r)}${hex(g)}${hex(b)}`, kept: kept.length / pixels.length };
}
