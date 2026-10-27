/**
 * @file batiment-squelette.js
 * LE SQUELETTE DROIT PONDÉRÉ d'un contour (#458b) : ce qui donne un toit à n'importe quelle forme, en
 * L, en T, en U. Fonctions PURES, sans three.
 *
 * L'IDÉE (Aichholzer et Aurenhammer, 1995) : chaque côté avance vers l'intérieur, parallèlement à
 * lui-même, à SA vitesse (son poids) ; les sommets glissent le long des bissectrices. Le toit est la
 * trace de ce front : le pan d'un côté est la surface qu'il balaie, à la hauteur k · t (k : la pente).
 * Un côté de poids 0 ne bouge pas : son « pan » est vertical, c'est un PIGNON (ou un côté adossé à
 * un mur). Deux sortes d'événements :
 *   - un côté se réduit à rien (ses deux sommets se rejoignent) : ils fusionnent ;
 *   - un sommet RENTRANT touche un côté d'en face : le front se coupe en deux.
 * Le contour est petit (quelques dizaines de côtés) : chaque pas recalcule tous les événements, ce
 * qui est simple et sûr. Un cas que l'algorithme ne sait pas résoudre rend `null` (le toit reste plat
 * plutôt que d'être faux).
 *
 * Entrée : un contour en sens trigonométrique (aire positive, intérieur à gauche), des poids ≥ 0.
 * Sortie : `{ faces: [{ cote, points: [{ x, z, t }] }] }`, le polygone balayé par chaque côté (son
 * côté de départ d'abord, à t = 0).
 */

const EPS = 1e-7;

/** La vitesse d'un sommet entre deux côtés (ligne : n·p = c + w·t). Null si les côtés sont parallèles. */
function vitesse(gauche, droite){
  const det = gauche.n.x * droite.n.z - gauche.n.z * droite.n.x;
  if (Math.abs(det) < 1e-9) {
    // Deux côtés ALIGNÉS de même poids (deux fronts qui se rejoignent bout à bout) : le sommet suit
    // le front, droit devant. Opposés (un « pic » d'épaisseur nulle) : pas de vitesse, cf. nettoyer.
    const meme = gauche.n.x * droite.n.x + gauche.n.z * droite.n.z > 0;
    return meme && Math.abs(gauche.w - droite.w) < 1e-9 ? { x: gauche.n.x * gauche.w, z: gauche.n.z * gauche.w } : null;
  }
  return { x: (gauche.w * droite.n.z - droite.w * gauche.n.z) / det, z: (gauche.n.x * droite.w - droite.n.x * gauche.w) / det };
}

// Un sommet sans vitesse (entre deux côtés parallèles) n'existe qu'à l'instant où il naît.
const position = (s, t) => (s.v ? { x: s.p.x + s.v.x * (t - s.t0), z: s.p.z + s.v.z * (t - s.t0) } : { x: s.p.x, z: s.p.z });

/**
 * Le squelette droit pondéré de `pts` (sens trigonométrique), `poids[i]` pour le côté i → i+1.
 * `trous` (#458c, les cours) : `[{ pts, poids }]`, chacun en sens INVERSE (l'intérieur du toit reste à
 * gauche) ; leurs côtés suivent ceux du contour dans la numérotation (`cote` des faces). Un trou se
 * soude au front qui l'entoure quand un sommet rentrant de l'un touche un côté de l'autre.
 * PURE ; rend null si le calcul n'aboutit pas.
 */
export function squeletteDroit(pts, poids, trous = []){
  if (pts.length < 3) return null;
  const boucles = [{ pts, poids }, ...trous];
  const cotes = [], debuts = [];
  for (const bcl of boucles) {
    const m = bcl.pts.length;
    if (m < 3) return null;
    debuts.push(cotes.length);
    bcl.pts.forEach((a, i) => {
      const b = bcl.pts[(i + 1) % m];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      const d = { x: (b.x - a.x) / L, z: (b.z - a.z) / L };
      const nrm = { x: -d.z, z: d.x };
      cotes.push({ a, b, d, n: nrm, c: nrm.x * a.x + nrm.z * a.z, w: Math.max(0, (bcl.poids || [])[i] ?? 1) });
    });
  }
  const n = cotes.length;
  const segments = cotes.map(() => []);   // par face : [[p1, p2]] avec p = { x, z, t }
  let ids = 0;
  const sommet = (p, t, gauche, droite) => {
    const v = vitesse(cotes[gauche], cotes[droite]);
    return { id: ids++, p, t0: t, v, gauche, droite };
  };
  // Les fronts : des listes cycliques de sommets.
  let fronts = boucles.map((bcl, k) => {
    const m = bcl.pts.length, o = debuts[k];
    return bcl.pts.map((p, i) => sommet({ x: p.x, z: p.z }, 0, o + (i + m - 1) % m, o + i));
  });
  if (fronts.some(f => f.some(s => !s.v))) return null;
  // Un sommet s'arrête à t, au point `q` (le point de l'événement, le même pour tous ceux qu'il
  // réunit : sans cela, deux arrondis différents casseraient le chaînage des faces).
  const finir = (s, t, q = position(s, t)) => {
    const a = { x: s.p.x, z: s.p.z, t: s.t0 }, b = { x: q.x, z: q.z, t };
    if (Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.t - b.t) > EPS) {
      segments[s.gauche].push([a, b]);
      segments[s.droite].push([a, b]);
    }
    return q;
  };
  // Un front qui n'a plus d'aire (ses côtés se sont rejoints) : ses côtés restants ferment leur face.
  const clore = (front, t) => {
    const qs = front.map(s => finir(s, t));
    front.forEach((s, i) => {
      const a = qs[i], b = qs[(i + 1) % front.length];
      if (Math.hypot(a.x - b.x, a.z - b.z) > EPS) segments[s.droite].push([{ ...a, t }, { ...b, t }]);
    });
  };
  /**
   * Retire les PICS d'un front : un sommet entre deux côtés opposés qui se recouvrent (une aile qui
   * vient de se refermer). Le plus court des deux côtés disparaît avec lui ; le bout de l'autre repart
   * du point où ils se quittent. Les côtés retirés ferment leur face là. Rend le front nettoyé.
   */
  const nettoyer = (front, t) => {
    let f = front, garde = 0;
    for (;;) {
      if (f.length < 3 || garde++ > 200) return f;
      const k = f.findIndex(x => !x.v);
      if (k < 0) return f;
      const x = f[k], m = f.length;
      const p = f[(k + m - 1) % m], q = f[(k + 1) % m];
      const X = position(x, t), P = position(p, t), Q = position(q, t);
      const dp = Math.hypot(P.x - X.x, P.z - X.z), dq = Math.hypot(Q.x - X.x, Q.z - X.z);
      const seg = (face, A, B) => { if (Math.hypot(A.x - B.x, A.z - B.z) > EPS) segments[face].push([{ ...A, t }, { ...B, t }]); };
      const reste = f.filter(v => v !== x && v !== p && v !== q);
      let nouveaux;
      if (Math.abs(dp - dq) < 1e-6) {
        // Les deux côtés finissent ensemble : p et q se rejoignent en un sommet.
        seg(x.gauche, X, P); seg(x.droite, X, Q);
        finir(p, t, P); finir(q, t, P);
        nouveaux = [sommet(P, t, p.gauche, q.droite)];
      } else if (dp < dq) {
        // Le côté de gauche finit en p ; celui de droite repart de là vers q.
        seg(x.gauche, X, P); seg(x.droite, X, P);
        finir(p, t, P);
        nouveaux = [sommet(P, t, p.gauche, x.droite), q];
      } else {
        seg(x.gauche, X, Q); seg(x.droite, X, Q);
        finir(q, t, Q);
        nouveaux = [p, sommet(Q, t, x.gauche, q.droite)];
      }
      // Reposer les nouveaux à la place de p, x, q (dans l'ordre du front).
      const debut = f.indexOf(p);
      const avant = [];
      for (let i = 1; i < m; i++) { const v = f[(debut + m - i) % m]; if (v === q || v === x || v === p) continue; avant.unshift(v); if (avant.length === reste.length) break; }
      f = [...avant, ...nouveaux];
    }
  };
  const aire = (front, t) => {
    let s = 0;
    front.forEach((v, i) => { const p = position(v, t), q = position(front[(i + 1) % front.length], t); s += p.x * q.z - q.x * p.z; });
    return s / 2;
  };
  let t = 0, garde = 0;
  while (fronts.length && garde++ < 2000) {
    let meilleur = null;
    for (const f of fronts) {
      const m = f.length;
      for (let i = 0; i < m; i++) {
        const u = f[i], v = f[(i + 1) % m];
        // Le côté u → v se réduit à rien.
        const c = cotes[u.droite];
        const L0 = (position(v, t).x - position(u, t).x) * c.d.x + (position(v, t).z - position(u, t).z) * c.d.z;
        const dv = (v.v.x - u.v.x) * c.d.x + (v.v.z - u.v.z) * c.d.z;
        if (dv < -1e-12) {
          const te = t - L0 / dv;
          if (te >= t - 1e-9 && (!meilleur || te < meilleur.t - 1e-9)) meilleur = { t: te, sorte: 'cote', f, i };
        }
      }
      // Un sommet rentrant contre un côté non voisin.
      for (let i = 0; i < m; i++) {
        const r = f[i];
        const g = cotes[r.gauche], dr = cotes[r.droite];
        const croix = g.d.x * dr.d.z - g.d.z * dr.d.x;
        if (croix > -1e-9) continue;   // pas rentrant
        for (const g2 of fronts) for (let j = 0; j < g2.length; j++) {
          const a = g2[j], b = g2[(j + 1) % g2.length];
          if (a === r || b === r) continue;
          const autre = g2 !== f;
          const e = cotes[a.droite];
          const r0 = position(r, t);
          const den = e.n.x * r.v.x + e.n.z * r.v.z - e.w;
          if (Math.abs(den) < 1e-12) continue;
          const te = t + (e.c + e.w * t - (e.n.x * r0.x + e.n.z * r0.z)) / den;
          if (te < t - 1e-9 || (meilleur && te >= meilleur.t - 1e-9)) continue;
          // Le point touché doit être sur le côté, entre ses deux sommets à ce moment-là.
          const P = position(r, te), A = position(a, te), B = position(b, te);
          const L = (B.x - A.x) * e.d.x + (B.z - A.z) * e.d.z;
          const s = (P.x - A.x) * e.d.x + (P.z - A.z) * e.d.z;
          if (L > EPS && s > EPS && s < L - EPS) meilleur = { t: te, sorte: autre ? 'soudure' : 'coupe', f, g: g2, i, j };
          // Pile sur un bout du côté : deux sommets rentrants qui se rencontrent (un « événement de
          // sommet », fréquent sur les plans orthogonaux). Le front se coupe EN CE SOMMET.
          else if (L > EPS && Math.abs(s) <= 1e-6 && a !== f[(i + m - 1) % m] && a !== f[(i + 1) % m]) meilleur = { t: te, sorte: autre ? 'soudureSommet' : 'sommet', f, g: g2, i, k: j };
          else if (L > EPS && Math.abs(s - L) <= 1e-6 && b !== f[(i + m - 1) % m] && b !== f[(i + 1) % m]) meilleur = { t: te, sorte: autre ? 'soudureSommet' : 'sommet', f, g: g2, i, k: (j + 1) % g2.length };
        }
      }
    }
    if (!meilleur) {
      // Plus d'événement : chaque front restant se referme là où il en est.
      fronts.forEach(f => clore(f, t));
      fronts = [];
      break;
    }
    t = Math.max(t, meilleur.t);
    const f = meilleur.f, m = f.length;
    fronts = fronts.filter(x => x !== f && x !== meilleur.g);
    // Faire le tour d'un front à partir de l'indice `de`, jusqu'à `jusqua` exclu.
    const tour = (fr, de, jusqua) => { const l = []; for (let k = de % fr.length; k !== jusqua; k = (k + 1) % fr.length) l.push(fr[k]); return l; };
    const garder = (g0) => {
      const g = nettoyer(g0, t);
      if (g.length < 3 || g.some(z => !z.v) || Math.abs(aire(g, t)) < 1e-9) clore(g, t); else fronts.push(g);
    };
    if (meilleur.sorte === 'soudure') {
      // Un sommet rentrant de f touche le côté a → b d'un AUTRE front (une cour) : les deux se soudent.
      const g = meilleur.g, mg = g.length, ir = meilleur.i, j = meilleur.j;
      const r = f[ir], a = g[j];
      const q = finir(r, t);
      const x1 = sommet(q, t, r.gauche, a.droite), x2 = sommet({ ...q }, t, a.droite, r.droite);
      // x1 → b … (tout le tour de g) … a → x2 → après r … avant r.
      garder([x1, ...tour(g, (j + 1) % mg, j), a, x2, ...tour(f, (ir + 1) % m, ir)]);
      continue;
    }
    if (meilleur.sorte === 'soudureSommet') {
      const g = meilleur.g, mg = g.length, ir = meilleur.i, iv = meilleur.k;
      const r = f[ir], v = g[iv];
      const q = finir(r, t); finir(v, t, q);
      const x1 = sommet(q, t, r.gauche, v.droite), x2 = sommet({ ...q }, t, v.gauche, r.droite);
      garder([x1, ...tour(g, (iv + 1) % mg, iv), x2, ...tour(f, (ir + 1) % m, ir)]);
      continue;
    }
    if (meilleur.sorte === 'cote') {
      const u = f[meilleur.i], v = f[(meilleur.i + 1) % m];
      const q = finir(u, t); finir(v, t, q);
      const x = sommet(q, t, u.gauche, v.droite);
      const reste = f.filter(s => s !== u && s !== v);
      const k = meilleur.i + 1 === m ? 0 : meilleur.i;   // où reposer x dans l'ordre
      reste.splice(Math.min(k, reste.length), 0, x);
      const net = nettoyer(reste, t);
      if (net.length < 3 || net.some(v => !v.v) || Math.abs(aire(net, t)) < 1e-9) { clore(net, t); continue; }
      fronts.push(net);
    } else if (meilleur.sorte === 'sommet') {
      const ir = meilleur.i, iv = meilleur.k, r = f[ir], v = f[iv];
      const q = finir(r, t); finir(v, t, q);
      const x1 = sommet(q, t, r.gauche, v.droite);
      const x2 = sommet({ ...q }, t, v.gauche, r.droite);
      const chaine = (de, jusqua) => { const l = []; for (let k = de; k !== jusqua; k = (k + 1) % m) l.push(f[k]); return l; };
      const f1 = [x1, ...chaine((iv + 1) % m, ir)];
      const f2 = [x2, ...chaine((ir + 1) % m, iv)];
      for (const g0 of [f1, f2]) {
        const g = nettoyer(g0, t);
        if (g.length < 3 || g.some(z => !z.v) || Math.abs(aire(g, t)) < 1e-9) clore(g, t); else fronts.push(g);
      }
    } else {
      const r = f[meilleur.i], a = f[meilleur.j], b = f[(meilleur.j + 1) % m];
      const q = finir(r, t);
      const x1 = sommet(q, t, r.gauche, a.droite);   // vers b
      const x2 = sommet({ ...q }, t, a.droite, r.droite);   // depuis a
      // Front 1 : x1, b, …, avant r. Front 2 : x2, après r, …, a.
      const suite = (de, jusqua) => { const l = []; let k = de; while (f[k] !== jusqua) { l.push(f[k]); k = (k + 1) % m; } l.push(jusqua); return l; };
      const ir = meilleur.i;
      const f1 = [x1, ...(f[(meilleur.j + 1) % m] === f[(ir + m - 1) % m] ? [b] : suite((meilleur.j + 1) % m, f[(ir + m - 1) % m]))];
      const f2 = [x2, ...(f[(ir + 1) % m] === a ? [a] : suite((ir + 1) % m, a))];
      for (const g0 of [f1, f2]) {
        const g = nettoyer(g0, t);
        if (g.length < 3 || g.some(s => !s.v) || Math.abs(aire(g, t)) < 1e-9) clore(g, t); else fronts.push(g);
      }
    }
  }
  if (fronts.length) return null;
  // Les faces : le côté de départ, puis la chaîne de segments qui le referme.
  const cle = (p) => `${Math.round(p.x * 1e5)},${Math.round(p.z * 1e5)},${Math.round(p.t * 1e5)}`;
  const faces = [];
  for (let i = 0; i < n; i++) {
    const c = cotes[i];
    const voisins = new Map();
    const lier = (p, q) => { const kp = cle(p); if (!voisins.has(kp)) voisins.set(kp, []); voisins.get(kp).push(q); };
    for (const [p, q] of segments[i]) { lier(p, q); lier(q, p); }
    const depart = { x: c.b.x, z: c.b.z, t: 0 }, arrivee = cle({ x: c.a.x, z: c.a.z, t: 0 });
    const points = [{ x: c.a.x, z: c.a.z, t: 0 }, depart];
    const vus = new Set([cle(points[0]), cle(depart)]);
    let cur = depart, ok = false;
    for (let g = 0; g < 500; g++) {
      const suivants = (voisins.get(cle(cur)) || []).filter(q => !vus.has(cle(q)) || (cle(q) === arrivee && points.length > 2));
      if (!suivants.length) break;
      const q = suivants.find(x => cle(x) === arrivee && points.length > 2) || suivants[0];
      if (cle(q) === arrivee) { ok = true; break; }
      points.push(q); vus.add(cle(q)); cur = q;
    }
    if (!ok) return null;
    faces.push({ cote: i, points });
  }
  return { faces };
}

/**
 * La TRIANGULATION d'un polygone (oreilles), en indices : `[[i, j, k]]`. Les points en `{ x, z }` ;
 * le sens importe peu. `trous` (#458c, des cours) : des contours dedans, en sens inverse ; leurs
 * indices suivent ceux du contour (comme `[...pts, ...trou1, ...trou2]`). Chaque trou est relié au
 * contour par un pont (deux arêtes confondues), ce qui rend un seul polygone à trianguler. PURE.
 */
export function trianguler(pts, trous = []){
  if (!trous.length) return triangulerSimple(pts);
  const tous = [...pts, ...trous.flat()];
  let anneau = pts.map((_, i) => i);
  let o = pts.length;
  const segs = () => { const l = []; anneau.forEach((v, k) => l.push([v, anneau[(k + 1) % anneau.length]])); return l; };
  const croise = (a, b, c, d) => {
    const or = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
    return or(a, b, c) * or(a, b, d) < -1e-12 && or(c, d, a) * or(c, d, b) < -1e-12;
  };
  const indicesTrous = trous.map(t => { const r = t.map((_, i) => o + i); o += t.length; return r; });
  // Les trous les plus à droite d'abord (leur pont ne coupe pas ceux qu'on posera ensuite).
  indicesTrous.sort((u, v) => Math.max(...v.map(i => tous[i].x)) - Math.max(...u.map(i => tous[i].x)));
  for (const t of indicesTrous) {
    const h = t.reduce((m, i) => (tous[i].x > tous[m].x ? i : m), t[0]);
    const autres = indicesTrous.filter(x => x !== t).flatMap(x => x.map((i, k) => [i, x[(k + 1) % x.length]]));
    let meilleur = null;
    for (const v of anneau) {
      const d = Math.hypot(tous[v].x - tous[h].x, tous[v].z - tous[h].z);
      if (meilleur && d >= meilleur.d) continue;
      const libre = [...segs(), ...t.map((i, k) => [i, t[(k + 1) % t.length]]), ...autres]
        .every(([p, q]) => p === v || q === v || p === h || q === h || !croise(tous[h], tous[v], tous[p], tous[q]));
      if (libre) meilleur = { v, d };
    }
    if (!meilleur) return triangulerSimple(pts);
    const k = anneau.indexOf(meilleur.v), kh = t.indexOf(h);
    const tourTrou = [...t.slice(kh), ...t.slice(0, kh), h];
    anneau = [...anneau.slice(0, k + 1), ...tourTrou, ...anneau.slice(k)];
  }
  return triangulerSimple(anneau.map(i => tous[i])).map(tri => tri.map(i => anneau[i]));
}

function triangulerSimple(pts){
  const n = pts.length;
  if (n < 3) return [];
  let a = 0;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p.x * q.z - q.x * p.z; }
  const sens = a >= 0 ? 1 : -1;
  const reste = pts.map((_, i) => i);
  const tris = [];
  const croix = (o, p, q) => (p.x - o.x) * (q.z - o.z) - (p.z - o.z) * (q.x - o.x);
  const dedans = (p, a2, b, c) => {
    const d1 = croix(a2, b, p) * sens, d2 = croix(b, c, p) * sens, d3 = croix(c, a2, p) * sens;
    return d1 > 1e-12 && d2 > 1e-12 && d3 > 1e-12;
  };
  let garde = 0;
  while (reste.length > 3 && garde++ < 10000) {
    let coupe = false;
    for (let k = 0; k < reste.length; k++) {
      const i0 = reste[(k + reste.length - 1) % reste.length], i1 = reste[k], i2 = reste[(k + 1) % reste.length];
      const A = pts[i0], B = pts[i1], C = pts[i2];
      if (croix(A, B, C) * sens <= 1e-12) continue;
      if (reste.some(j => j !== i0 && j !== i1 && j !== i2 && dedans(pts[j], A, B, C))) continue;
      tris.push([i0, i1, i2]);
      reste.splice(k, 1);
      coupe = true;
      break;
    }
    if (!coupe) {   // dégénéré (points alignés) : on retire un sommet plat
      const k = reste.findIndex((i1, kk) => Math.abs(croix(pts[reste[(kk + reste.length - 1) % reste.length]], pts[i1], pts[reste[(kk + 1) % reste.length]])) <= 1e-12);
      if (k < 0) break;
      reste.splice(k, 1);
    }
  }
  if (reste.length === 3) tris.push([reste[0], reste[1], reste[2]]);
  return tris;
}
