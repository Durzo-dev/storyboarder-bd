/**
 * @file terrain-plan.js
 * #462a, L'ÉDITEUR DE TERRAIN : ce que montre sa VUE DE DESSUS, et son cadrage. Fonctions PURES, en
 * mètres, dans le repère du monde de la Scène (x vers la droite, z vers le bas du plan).
 *
 * La vue de dessus ne rend pas la 3D : elle DESSINE le plan de la Scène, comme l'éditeur de bâtiment,
 * d'après les données (les Zones par leurs coins, les Tracés par leurs points, les bâtiments par leurs
 * pièces, les autres Éléments par leur place). Ce qui sait placer un Élément dans le monde (scene3d.js)
 * est PASSÉ en paramètre (`outils`) : ce fichier ne dépend pas de THREE et se teste seul.
 *
 * Décidé avec Valentin (2 novembre 2026) : l'éditeur ne s'ouvre que sur une Scène ; les Éléments y
 * sont visibles, ni modifiables ni déplaçables ; les Zones et Tracés ne se feront plus que là (#462b).
 */

/** Les Tracés qui sont des MURETS (une hauteur) ; les autres sont des lignes (une largeur). */
export const TRACES_MURETS = Object.freeze(['muret', 'cloture', 'haie', 'barriere']);

const fini = (v) => typeof v === 'number' && Number.isFinite(v);
const pointFini = (p) => p && fini(p.x) && fini(p.z);

/**
 * Le contenu du plan d'une Scène : une liste de formes, du fond vers le dessus (zones, tracés,
 * bâtiments, éléments). `page` est la page de la Scène, `panel` son canevas.
 * `outils` : { placeDe(o) → {x, z} | null, empreinteDuBatiment(o) → [[{x, z}…]…] }.
 * Chaque forme : { type: 'zone' | 'trace' | 'batiment' | 'element', id, nom?, couleur?, … }.
 */
export function contenuDuPlan(page, panel, outils = {}){
  const objets = (page && page.objects) || [];
  const zones = [], traces = [], batiments = [], elements = [];
  for (const o of objets) {
    if (!o || o.type === 'panel') continue;
    if (o.type === 'tracé') {
      if (panel && o.panelId && o.panelId !== panel.id) continue;
      const w = o.world || {};
      if (o.tracéType === 'terrain') {
        if (Array.isArray(w.corners) && w.corners.length >= 3 && w.corners.every(pointFini)) {
          zones.push({ type: 'zone', id: o.id, nom: o.name || '', pts: w.corners.map(c => ({ x: c.x, z: c.z })), couleur: o.color || null });
        }
      } else if (Array.isArray(w.pts) && w.pts.length >= 2 && w.pts.every(pointFini)) {
        traces.push({ type: 'trace', id: o.id, nom: o.name || '', sorte: o.tracéType, pts: w.pts.map(c => ({ x: c.x, z: c.z })),
          largeur: fini(w.width) ? w.width : 0.2, muret: TRACES_MURETS.includes(o.tracéType), couleur: o.color || null });
      }
      continue;
    }
    if (o.type !== 'perso' && o.type !== 'objet3d') continue;
    if (o.objType === 'batiment' && outils.empreinteDuBatiment) {
      const polys = (outils.empreinteDuBatiment(o) || []).filter(p => p.length >= 3 && p.every(pointFini));
      if (polys.length) { batiments.push({ type: 'batiment', id: o.id, nom: o.name || '', polys }); continue; }
    }
    const p = outils.placeDe ? outils.placeDe(o) : null;
    if (pointFini(p)) elements.push({ type: 'element', id: o.id, nom: o.name || '', perso: o.type === 'perso', x: p.x, z: p.z });
  }
  return [...zones, ...traces, ...batiments, ...elements];
}

/** Tous les points d'un contenu (pour le cadrer). */
export function pointsDuContenu(formes){
  const pts = [];
  for (const f of formes || []) {
    if (f.type === 'zone' || f.type === 'trace') pts.push(...f.pts);
    else if (f.type === 'batiment') f.polys.forEach(q => pts.push(...q));
    else if (f.type === 'element') pts.push({ x: f.x, z: f.z });
  }
  return pts;
}

/** Le cadrage minimal : 20 m de côté au moins, autour de l'origine si la Scène est vide. */
export const COTE_MIN_DU_PLAN = 20;

/**
 * Le cadrage qui montre tout le contenu dans un plan de `l` × `h` pixels, avec une marge :
 * { cx, cz, ppm } (le centre en mètres, des pixels par mètre).
 */
export function cadrageDuPlan(formes, l, h, marge = 0.12){
  const pts = pointsDuContenu(formes);
  let x0 = -COTE_MIN_DU_PLAN / 2, x1 = COTE_MIN_DU_PLAN / 2, z0 = -COTE_MIN_DU_PLAN / 2, z1 = COTE_MIN_DU_PLAN / 2;
  if (pts.length) {
    x0 = Math.min(...pts.map(p => p.x)); x1 = Math.max(...pts.map(p => p.x));
    z0 = Math.min(...pts.map(p => p.z)); z1 = Math.max(...pts.map(p => p.z));
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const dx = Math.max(x1 - x0, COTE_MIN_DU_PLAN), dz = Math.max(z1 - z0, COTE_MIN_DU_PLAN);
    x0 = cx - dx / 2; x1 = cx + dx / 2; z0 = cz - dz / 2; z1 = cz + dz / 2;
  }
  const L = Math.max(1, l) * (1 - 2 * marge), H = Math.max(1, h) * (1 - 2 * marge);
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, ppm: Math.min(L / (x1 - x0), H / (z1 - z0)) };
}

/** Un point du monde (mètres) vers le plan (pixels), pour une vue { cx, cz, ppm } de `l` × `h`. */
export function versLePlan(vue, p, l, h){
  return { x: l / 2 + (p.x - vue.cx) * vue.ppm, y: h / 2 + (p.z - vue.cz) * vue.ppm };
}

/** L'inverse : un pixel du plan vers le monde. */
export function versLeMonde(vue, s, l, h){
  return { x: vue.cx + (s.x - l / 2) / vue.ppm, z: vue.cz + (s.y - h / 2) / vue.ppm };
}

/** Le zoom à la molette autour du point visé (il reste sous la souris). Bornes : 2 à 400 px/m. */
export function zoomerLePlan(vue, s, l, h, facteur){
  const ppm = Math.min(400, Math.max(2, vue.ppm * facteur));
  const m = versLeMonde(vue, s, l, h);
  return { cx: m.x - (s.x - l / 2) / ppm, cz: m.z - (s.y - h / 2) / ppm, ppm };
}

/** Le pas de la grille (mètres) : le plus petit de 1, 5, 10, 50, 100 qui laisse 24 px entre deux lignes. */
export function pasDeLaGrille(ppm){
  for (const pas of [1, 5, 10, 50, 100]) if (pas * ppm >= 24) return pas;
  return 500;
}

// ── #462b-1 : tracer et retoucher les Zones et les Tracés ────────────────────────────────────

/** La largeur 3D d'une route ou d'un chemin posé dans l'éditeur, en mètres (réglable ensuite). */
export const LARGEUR_PAR_DEFAUT_M = Object.freeze({ route: 5, chemin: 1.5 });
/** En deçà, un rectangle de Zone est un glissement de souris, pas une intention (mètres). */
export const COTE_MIN_DE_ZONE = 0.5;

/** Le `world` d'une Zone rectangulaire entre deux coins (dans l'ordre tl, tr, br, bl), ou null. */
export function zoneEntre(a, b){
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
  if (x1 - x0 < COTE_MIN_DE_ZONE || z1 - z0 < COTE_MIN_DE_ZONE) return null;
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, h: z1 - z0, rotY: 0,
    corners: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }] };
}

/** Le `world` d'un Tracé (route, chemin, muret…) par ses points, ou null s'il en a moins de deux. */
export function traceDePoints(sorte, pts){
  const p = (pts || []).filter(pointFini);
  if (p.length < 2) return null;
  return { pts: p.map(q => ({ x: q.x, z: q.z })), width: LARGEUR_PAR_DEFAUT_M[sorte] || 0.2 };
}

/** Le `world` d'une Zone ou d'un Tracé déplacé de (dx, dz) mètres. PURE : rend une copie. */
export function deplacerLeMonde(w, dx, dz){
  const bouge = (p) => ({ ...p, x: p.x + dx, z: p.z + dz });
  const n = { ...w };
  if (Array.isArray(w.corners)) n.corners = w.corners.map(bouge);
  if (Array.isArray(w.pts)) n.pts = w.pts.map(bouge);
  if (fini(w.cx)) n.cx = w.cx + dx;
  if (fini(w.cz)) n.cz = w.cz + dz;
  return n;
}

/** La distance (mètres) d'un point à une ligne brisée. */
export function distanceALaLigne(p, pts){
  let d = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    d = Math.min(d, Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz)));
  }
  return d;
}

/** Un point dans un polygone ({x, z}). */
export function dansLePolygone(p, q){
  let dedans = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if ((q[i].z > p.z) !== (q[j].z > p.z) && p.x < (q[j].x - q[i].x) * (p.z - q[i].z) / (q[j].z - q[i].z) + q[i].x) dedans = !dedans;
  }
  return dedans;
}

/**
 * Ce qui est sous le point `m` (mètres) du plan : un Élément (à `tol` mètres près), sinon un Tracé (sa
 * largeur, ou `tol`), sinon une Zone, sinon un bâtiment. Le plus haut dessiné l'emporte. La forme, ou null.
 */
export function sousLePoint(formes, m, tol){
  let el = null, d0 = tol;
  for (const f of formes) if (f.type === 'element') { const d = Math.hypot(f.x - m.x, f.z - m.z); if (d < d0) { d0 = d; el = f; } }
  if (el) return el;
  const traces = formes.filter(f => f.type === 'trace');
  for (let i = traces.length - 1; i >= 0; i--) {
    if (distanceALaLigne(m, traces[i].pts) <= Math.max(tol, traces[i].largeur / 2)) return traces[i];
  }
  const zones = formes.filter(f => f.type === 'zone');
  for (let i = zones.length - 1; i >= 0; i--) if (dansLePolygone(m, zones[i].pts)) return zones[i];
  return formes.find(f => f.type === 'batiment' && f.polys.some(q => dansLePolygone(m, q))) || null;
}
