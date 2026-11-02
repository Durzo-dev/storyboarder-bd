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
          zones.push({ type: 'zone', id: o.id, pts: w.corners.map(c => ({ x: c.x, z: c.z })), couleur: o.color || null });
        }
      } else if (Array.isArray(w.pts) && w.pts.length >= 2 && w.pts.every(pointFini)) {
        traces.push({ type: 'trace', id: o.id, sorte: o.tracéType, pts: w.pts.map(c => ({ x: c.x, z: c.z })),
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
