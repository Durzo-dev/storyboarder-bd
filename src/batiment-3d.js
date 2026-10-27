/**
 * @file batiment-3d.js
 * LE BÂTIMENT EN 3D (#454a-4), partagé par l'aperçu de l'éditeur et le rendu des Cases et des
 * Scènes : un seul constructeur, pour que le bâtiment placé soit celui qu'on a vu en le construisant.
 *
 * En MÈTRES, dans le repère du bâtiment (x, z au sol, y vers le haut ; la vue de dessus range z vers
 * le bas). Les murs sont extrudés depuis les polygones de la vue de dessus (jonctions comprises),
 * tranchés à leurs ouvertures (allège et linteau) ; chaque pièce a son sol ; chaque ouverture, sa
 * menuiserie. Les matières sont passées par l'appelant : elles se partagent entre plusieurs
 * bâtiments, et ne se libèrent pas avec eux.
 */
import { polygonesDesMurs, morceauxDuMur } from './batiment-geometrie.js';
import { intervalleDe } from './batiment-ouvertures.js';
import { formesDesPieces, dansLaFace, pointDansPolygone } from './batiment-pieces.js';
import { formeDeLEscalier, tremieDeLEscalier } from './batiment-escaliers.js';
import { niveauxTries, hauteurDesMursDuNiveau, epaisseurDuDessus, niveauDessous } from './batiment-niveaux.js';
import { fabriqueDeRevetements, revetementDeLaFace, revetementDeLaPiece, pieceDevantLaFace } from './batiment-revetements.js';
import { meublesDuNiveau, hauteurAuSol, basDuMeuble } from './batiment-mobilier.js';
import { toitsDuNiveau, decaler, ACROTERE, GARDE_CORPS, EPAISSEUR_TOIT } from './batiment-toits.js';

/** Les matières d'un bâtiment, à créer une fois par renderer. */
export function materiauxBatiment3D(T){
  return {
    mur: new T.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.9 }),
    sol: new T.MeshStandardMaterial({ color: 0xa89c86, roughness: 1, side: T.DoubleSide }),
    cadre: new T.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 }),
    bois: new T.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.8 }),
    verre: new T.MeshStandardMaterial({ color: 0x9fc6d8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, side: T.DoubleSide }),
    // Poignées et paumelles d'une porte (demandé : voir de quel côté on la regarde).
    metal: new T.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.35, metalness: 0.8 }),
    // #454d / #446e : les matières des revêtements, fabriquées à la demande et gardées par le renderer.
    revetement: fabriqueDeRevetements(T),
    // #454e : un meuble dont le modèle n'est pas (encore) là, une boîte à sa taille.
    meubleAttente: new T.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.8, transparent: true, opacity: 0.55 }),
    // #454e : `modele(fichier)` rend une COPIE du modèle décodé, ou null. Fournie par l'appelant
    // (l'éditeur, le rendu des Cases), qui tient le cache des modèles ; absente, des boîtes.
    modele: null,
  };
}

/**
 * LE COLLECTEUR DE FACES (#454d) : les faces d'un bâtiment, rangées par matière, puis un maillage par
 * matière. Les murs étaient un prisme chacun, d'une seule matière ; leurs faces ont maintenant chacune
 * la leur (la pièce qu'elles regardent, ou la façade), et des dizaines de murs feraient des centaines
 * de maillages. UV en MÈTRES : la matière règle sa répétition sur la taille de sa tuile.
 */
function collecteur(T){
  const parMatiere = new Map();
  const tampon = (mat) => {
    if (!parMatiere.has(mat)) parMatiere.set(mat, { pos: [], nor: [], uv: [], idx: [] });
    return parMatiere.get(mat);
  };
  return {
    /** Un quadrilatère vertical de a à b, de y0 à y1, tourné vers `n` ({x, z}). */
    mur(mat, a, b, y0, y1, n){
      const t = tampon(mat), base = t.pos.length / 3;
      const lg = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const d = { x: (b.x - a.x) / lg, z: (b.z - a.z) / lg };
      // u : l'abscisse le long de la face, en mètres et dans le repère du bâtiment, pour que deux
      // morceaux d'un même mur (de part et d'autre d'une fenêtre) se raccordent.
      const u = (p) => p.x * d.x + p.z * d.z;
      t.pos.push(a.x, y0, a.z, b.x, y0, b.z, b.x, y1, b.z, a.x, y1, a.z);
      for (let i = 0; i < 4; i++) t.nor.push(n.x, 0, n.z);
      t.uv.push(u(a), y0, u(b), y0, u(b), y1, u(a), y1);
      // L'ordre des sommets fait face à n : (b − a) × y vaut (−d.z, 0, d.x).
      if (-d.z * n.x + d.x * n.z >= 0) t.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      else t.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    },
    /** Un polygone horizontal à la hauteur y, tourné vers le haut (dessus) ou le bas. */
    plan(mat, pts, y, versLeHaut){
      const tri = T.ShapeUtils.triangulateShape(pts.map(p => new T.Vector2(p.x, p.z)), []);
      if (!tri.length) return;
      const t = tampon(mat), base = t.pos.length / 3;
      pts.forEach(p => { t.pos.push(p.x, y, p.z); t.nor.push(0, versLeHaut ? 1 : -1, 0); t.uv.push(p.x, p.z); });
      // Le sens des triangles rendus par triangulateShape dépend de celui du contour : on l'oriente
      // d'après la normale voulue (y vers le haut : sens horaire vu du dessus dans x, z).
      const cote = (i, j, k) => (pts[j].x - pts[i].x) * (pts[k].z - pts[i].z) - (pts[j].z - pts[i].z) * (pts[k].x - pts[i].x);
      tri.forEach(([i, j, k]) => {
        const haut = cote(i, j, k) < 0;
        if (haut === versLeHaut) t.idx.push(base + i, base + j, base + k);
        else t.idx.push(base + i, base + k, base + j);
      });
    },
    /** Les maillages, un par matière. */
    maillages(){
      const sortie = [];
      for (const [mat, t] of parMatiere) {
        if (!t.idx.length) continue;
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(t.pos, 3));
        g.setAttribute('normal', new T.Float32BufferAttribute(t.nor, 3));
        g.setAttribute('uv', new T.Float32BufferAttribute(t.uv, 2));
        g.setIndex(t.idx);
        sortie.push(new T.Mesh(g, mat));
      }
      return sortie;
    },
  };
}

/** L'aire signée d'un polygone (x, z) : positive dans le sens trigonométrique. */
const aireSignee = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.z - q.x * p.z; }, 0) / 2;

/**
 * La menuiserie d'une ouverture (#454a-3c), simple en attendant les modèles du store : un cadre, du
 * verre pour ce qui est vitré, un battant de bois pour une porte pleine, deux vantaux décalés pour ce
 * qui coulisse, un meneau entre deux battants. Rien pour un passage. Les portes sont dessinées
 * fermées. Construite dans le repère du mur (x le long, y vers le haut, z à travers), puis posée.
 */
function construireMenuiserie(T, mur, o, mats){
  const g = new T.Group();
  const L = Math.hypot(mur.b.x - mur.a.x, mur.b.z - mur.a.z) || 1;
  const u = { x: (mur.b.x - mur.a.x) / L, z: (mur.b.z - mur.a.z) / L };
  const c = o.le * L, w = o.largeur, h = o.hauteur, prof = mur.epaisseur * 0.6, ep = 0.05;
  g.position.set(mur.a.x + u.x * c, o.y, mur.a.z + u.z * c);
  g.rotation.y = -Math.atan2(u.z, u.x);
  if (o.type === 'passage') return g;
  const boite = (lx, ly, lz, x, y, z, mat) => {
    const b = new T.Mesh(new T.BoxGeometry(lx, ly, lz), mat);
    b.position.set(x, y, z);
    g.add(b);
  };
  // Le cadre : deux montants, la traverse haute, et l'appui d'une fenêtre.
  boite(ep, h, prof, -w / 2 + ep / 2, h / 2, 0, mats.cadre);
  boite(ep, h, prof, w / 2 - ep / 2, h / 2, 0, mats.cadre);
  boite(w, ep, prof, 0, h - ep / 2, 0, mats.cadre);
  if (o.type !== 'porte') boite(w, ep, prof, 0, ep / 2, 0, mats.cadre);
  const interieur = w - 2 * ep, hi = h - (o.type === 'porte' ? ep : 2 * ep), y0 = o.type === 'porte' ? hi / 2 : ep + hi / 2;
  const remplissage = (o.vitre || o.type !== 'porte') ? mats.verre : mats.bois;
  const epPanneau = remplissage === mats.verre ? 0.01 : 0.04;
  if (o.coulissant) {
    // Deux vantaux qui se recouvrent un peu, l'un devant l'autre.
    const lv = interieur / 2 + 0.03;
    boite(lv, hi, epPanneau, -interieur / 4, y0, prof * 0.18, remplissage);
    boite(lv, hi, epPanneau, interieur / 4, y0, -prof * 0.18, remplissage);
  } else {
    boite(interieur, hi, epPanneau, 0, y0, 0, remplissage);
    if (o.battants === 2) boite(ep, hi, prof * 0.8, 0, y0, 0, mats.cadre);
    if (o.type === 'porte') quincaillerie(boite, o, interieur, hi, epPanneau, mats);
  }
  return g;
}

/**
 * La quincaillerie d'une porte battante (demandé : « voir la poignée pour distinguer quel côté on
 * voit »). Une poignée sur CHAQUE face, côté opposé à la charnière (au milieu pour deux battants) ;
 * les PAUMELLES, elles, ne se voient que du côté où la porte s'ouvre, comme en vrai : c'est ce qui
 * dit de quel côté on la regarde. Repère du mur : x le long, z vers le côté `sens` +1.
 */
function quincaillerie(boite, o, interieur, hi, epPanneau, mats){
  const demi = interieur / 2, yPoignee = 1.0, cote = o.sens === -1 ? -1 : 1;
  const bords = o.battants === 2 ? [-1, 1] : [o.charniere === 'fin' ? 1 : -1];   // les bords des charnières
  for (const bord of bords) {
    // La poignée : à 7 cm du bord libre, une rosace et un bec tourné vers la charnière, des deux côtés.
    const libre = o.battants === 2 ? -bord * 0.07 : -bord * (demi - 0.07);
    for (const face of [-1, 1]) {
      const z = face * (epPanneau / 2 + 0.012);
      boite(0.05, 0.07, 0.012, libre, yPoignee, z, mats.metal);
      boite(0.12, 0.02, 0.02, libre + bord * 0.05, yPoignee, face * (epPanneau / 2 + 0.035), mats.metal);
    }
    // Les paumelles : trois, sur le bord de la charnière, du côté où la porte s'ouvre.
    for (const y of [0.2, hi / 2, hi - 0.2]) boite(0.02, 0.1, 0.02, bord * (demi - 0.01), y, cote * (epPanneau / 2 + 0.01), mats.metal);
  }
}

/**
 * Le dessus en ARCHE d'un passage (demandé) : les deux écoinçons entre le haut rectangulaire de la
 * percée et un demi-cercle (aplati si le passage est plus large que haut), dans la matière du mur.
 */
function construireArche(T, mur, o, mats){
  const L = Math.hypot(mur.b.x - mur.a.x, mur.b.z - mur.a.z) || 1;
  const u = { x: (mur.b.x - mur.a.x) / L, z: (mur.b.z - mur.a.z) / L };
  const c = o.le * L, rx = o.largeur / 2, haut = o.y + o.hauteur;
  const ry = Math.max(0.05, Math.min(rx, o.hauteur - 0.05) - 0.01), naissance = haut - 0.01 - ry;
  const forme = new T.Shape();
  forme.moveTo(-rx, haut); forme.lineTo(-rx, naissance);
  forme.absellipse(0, naissance, rx, ry, Math.PI, 0, true);   // de gauche à droite, par le haut
  forme.lineTo(rx, haut); forme.lineTo(-rx, haut);
  const geo = new T.ExtrudeGeometry(forme, { depth: mur.epaisseur, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, -mur.epaisseur / 2);
  const m = new T.Mesh(geo, mats.mur);
  m.position.set(mur.a.x + u.x * c, 0, mur.a.z + u.z * c);
  m.rotation.y = -Math.atan2(u.z, u.x);
  return m;
}

/**
 * `jusquA` (#454b) : l'id du DERNIER niveau à montrer ; ceux du dessus sont omis (la « coupe » de
 * l'aperçu de l'éditeur, pour voir dans l'étage qu'on retouche). Absent : tout le bâtiment.
 */
/*
 * `masques` (#464) : ce que la Case d'un bâtiment placé ne montre pas, `{ murs, plafonds, sols }`
 * (des ids de murs, de pièces). Un mur masqué disparaît avec ses ouvertures, et ses voisins se
 * referment sans lui (leurs jonctions sont recalculées) ; un plafond masqué emporte la dalle du
 * dessus de SA pièce ; un sol masqué, la dalle de dessous. Le bâtiment n'est pas touché.
 */
export function construireBatiment3D(T, b, mats, { jusquA = null, rouge = null, masques = null } = {}){
  const groupe = new T.Group();
  const cache = {
    murs: new Set((masques && masques.murs) || []),
    plafonds: new Set((masques && masques.plafonds) || []),
    sols: new Set((masques && masques.sols) || []),
  };
  const tries = niveauxTries(b);
  const limite = jusquA ? tries.findIndex(n => n.id === jusquA) : -1;
  const visibles = limite >= 0 ? tries.slice(0, limite + 1) : tries;
  const lePlusBas = tries[0] && tries[0].id;
  const coupe = limite >= 0;
  const dernier = visibles.length ? visibles[visibles.length - 1].id : null;
  // #454c : les trémies des escaliers, par niveau : celles qu'un escalier perce dans le plafond de SON
  // niveau, qui sont aussi celles du plancher du niveau du dessus.
  const tremiesDe = (id) => (b.escaliers || []).filter(x => x.niveauId === id).map(x => tremieDeLEscalier(b, x)).filter(Boolean);
  // Une trémie n'est retenue que dans la pièce qui la contient tout entière (un trou qui déborderait
  // de sa forme casserait la triangulation).
  const percees = (f, tremies) => tremies.filter(t => t.every(p => dansLaFace(p, f)));
  const dalle = (f, y, epaisseur, tremies = []) => {
    if (!(epaisseur > 0)) return;
    const forme = new T.Shape(f.points.map(p => new T.Vector2(p.x, -p.z)));
    [...(f.trous || []), ...percees(f, tremies)].forEach(t => forme.holes.push(new T.Path(t.map(p => new T.Vector2(p.x, -p.z)))));
    const geo = new T.ExtrudeGeometry(forme, { depth: epaisseur, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const m = new T.Mesh(geo, mats.mur);
    m.position.y = y;
    groupe.add(m);
  };
  const col = collecteur(T);
  visibles.forEach(n => {
    const dessous = niveauDessous(b, n.id);
    const formesDuNiveau = formesDesPieces(b, n.id);
    const tremiesPlancher = dessous ? tremiesDe(dessous.id) : [];
    const tremiesPlafond = tremiesDe(n.id);
    const forme2D = (f, tremies = []) => {
      const forme = new T.Shape(f.points.map(p => new T.Vector2(p.x, -p.z)));
      [...(f.trous || []), ...percees(f, tremies)].forEach(t => forme.holes.push(new T.Path(t.map(p => new T.Vector2(p.x, -p.z)))));
      return forme;
    };
    for (const [pieceId, f] of formesDuNiveau) {
      // Le sol de chaque pièce (#454a-3b), un peu au-dessus de la grille pour ne pas scintiller avec elle.
      // #454d : son revêtement (uni par défaut, la couleur d'avant).
      if (!cache.sols.has(pieceId)) {
        const geo = new T.ShapeGeometry(forme2D(f, tremiesPlancher));
        geo.rotateX(-Math.PI / 2);
        const sol = new T.Mesh(geo, mats.revetement ? mats.revetement(revetementDeLaPiece(b, pieceId, 'sol'), 'sol-int') : mats.sol);
        sol.position.y = n.elevation + 0.005;
        groupe.add(sol);
      }
      // #454d : le PLAFOND, sous la dalle du dessus, tourné vers le bas (dessiné dans x, z puis basculé
      // de +90° : la normale descend et z garde son sens). Pas sous un dernier niveau ouvert par la coupe.
      if (mats.revetement && !(coupe && n.id === dernier) && !cache.plafonds.has(pieceId) && epaisseurDuDessus(b, n.id) > 0) {
        const fp = new T.Shape(f.points.map(p => new T.Vector2(p.x, p.z)));
        [...(f.trous || []), ...percees(f, tremiesPlafond)].forEach(t => fp.holes.push(new T.Path(t.map(p => new T.Vector2(p.x, p.z)))));
        const gp = new T.ShapeGeometry(fp);
        gp.rotateX(Math.PI / 2);
        const plafond = new T.Mesh(gp, mats.revetement(revetementDeLaPiece(b, pieceId, 'plafond'), 'plafond'));
        plafond.position.y = n.elevation + n.hauteur - 0.003;
        groupe.add(plafond);
      }
      // #454b : la dalle, SOUS le sol d'un étage (le plus bas des niveaux est posé sur le Sol).
      if (n.id !== lePlusBas && n.dalle > 0 && !cache.sols.has(pieceId)) dalle(f, n.elevation - n.dalle, n.dalle, tremiesPlancher);
      // ET LE DESSUS DE CHAQUE PIÈCE (signalé : une pièce qui dépassait de l'étage du dessus restait à
      // ciel ouvert). Chaque pièce est couverte d'une dalle à sa hauteur sous plafond, de l'épaisseur
      // du plancher du dessus : sous une pièce de l'étage, elle se confond avec son plancher ;
      // ailleurs, c'est un toit plat (en attendant les toits de #458). Le dernier niveau montré par
      // une coupe reste ouvert, pour voir dedans.
      if (!(coupe && n.id === dernier) && !cache.plafonds.has(pieceId)) dalle(f, n.elevation + n.hauteur, epaisseurDuDessus(b, n.id), tremiesPlafond);
    }
    const murs = b.murs.filter(m => m.niveauId === n.id && !cache.murs.has(m.id));
    const formes = polygonesDesMurs(murs);
    // #454d : un morceau de mur, FACE PAR FACE. Chaque face regarde une pièce (ses murs) ou l'extérieur
    // (la façade du niveau, ou celle du mur) ; le dessus et le dessous gardent la matière du mur.
    let murCourant = null;
    const extruder = (pts, y0, y1) => {
      if (y1 - y0 < 1e-3) return;
      const sens = aireSignee(pts) > 0 ? 1 : -1;
      const ya = n.elevation + y0, yb = n.elevation + y1;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], c = pts[(i + 1) % pts.length];
        const lg = Math.hypot(c.x - a.x, c.z - a.z);
        if (lg < 1e-4) continue;
        const d = { x: (c.x - a.x) / lg, z: (c.z - a.z) / lg };
        const normale = sens > 0 ? { x: d.z, z: -d.x } : { x: -d.z, z: d.x };   // vers l'extérieur du polygone
        const milieu = { x: (a.x + c.x) / 2, z: (a.z + c.z) / 2 };
        // Une face COLLÉE à un autre mur (la jonction de deux murs, dans un angle ou un T) ne se voit
        // pas : on ne la construit pas (elle scintillerait avec sa voisine, et coûterait pour rien).
        const devant = { x: milieu.x + normale.x * 0.02, z: milieu.z + normale.z * 0.02 };
        if (murCourant && [...formes].some(([id, q]) => id !== murCourant.id && pointDansPolygone(devant, q))) continue;
        const pieceId = pieceDevantLaFace(formesDuNiveau, milieu, normale);
        const mat = mats.revetement
          ? mats.revetement(revetementDeLaFace(b, n.id, murCourant, pieceId), pieceId ? 'mur-int' : 'mur-ext')
          : mats.mur;
        col.mur(mat, a, c, ya, yb, normale);
      }
      col.plan(mats.mur, pts, yb, true);
      if (y0 > 0) col.plan(mats.mur, pts, ya, false);   // le dessous d'un linteau, vu par l'ouverture
    };
    murs.forEach(m => {
      murCourant = m;
      const f = formes.get(m.id); if (!f) return;
      // #454b : les murs montent jusqu'au plancher du dessus, à travers sa dalle (façade continue).
      const hauteur = m.hauteurPropre || hauteurDesMursDuNiveau(b, n.id);
      // #454a-3c : le mur tranché à ses ouvertures ; sous et au-dessus de chacune, l'allège et le linteau.
      const siennes = (b.ouvertures || []).filter(o => o.murId === m.id);
      const { pleins, percees } = morceauxDuMur(f, m, siennes.map(o => intervalleDe(o, m)));
      pleins.forEach(q => extruder(q, 0, hauteur));
      siennes.forEach((o, i) => {
        if (!percees[i]) return;
        extruder(percees[i], 0, o.y);
        extruder(percees[i], Math.min(hauteur, o.y + o.hauteur), hauteur);
        if (o.type === 'passage' && o.dessus === 'arche') {
          const arche = construireArche(T, m, o, mats);
          arche.position.y += n.elevation;
          groupe.add(arche);
        }
        const menuiserie = construireMenuiserie(T, m, o, mats);
        menuiserie.position.y += n.elevation;
        groupe.add(menuiserie);
      });
    });
    // #454c : les escaliers du niveau.
    (b.escaliers || []).filter(x => x.niveauId === n.id).forEach(x => construireEscalier(T, b, x, mats, n.elevation, groupe));
    // #454e : le mobilier du niveau, posé au sol.
    meublesDuNiveau(b, n.id).forEach(m => groupe.add(construireMeuble(T, m, mats, n.elevation, m.id === rouge)));
    // #458 : le toit du niveau, sur ses pièces découvertes ; pas sur un dernier niveau ouvert par la coupe.
    if (!(coupe && n.id === dernier)) construireToits(T, b, n, mats, groupe);
  });
  col.maillages().forEach(m => groupe.add(m));
  return groupe;
}


/**
 * Un polygone 3D en triangles : positions (et UV) dans les tableaux, les deux faces si `deux`.
 * `triangles` : sa triangulation (#458b, une face non convexe) ; absente, un éventail (convexe).
 */
function eventail(pts, uv, pos, uvs, deux = false, triangles = null){
  const tris = triangles || pts.slice(2).map((_, i) => [0, i + 1, i + 2]);
  for (const [a, b, c] of tris) {
    for (const j of [a, b, c]) { pos.push(pts[j].x, pts[j].y, pts[j].z); uvs.push(...(uv ? uv[j] : [0, 0])); }
    if (deux) for (const j of [a, c, b]) { pos.push(pts[j].x, pts[j].y, pts[j].z); uvs.push(...(uv ? uv[j] : [0, 0])); }
  }
}
function maillage(T, pos, uvs, mat){
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return new T.Mesh(g, mat);
}

/**
 * Les toits d'un niveau (#458) : les pans (épaissis : dessous et rive), les pignons qui ferment les
 * murs sous eux (de la matière de la façade), ou, sur un toit plat, son acrotère ou son garde-corps.
 * Un toit plat sans bordure ne dessine rien de plus : la dalle du dessus de chaque pièce le fait déjà.
 */
function construireToits(T, b, n, mats, groupe){
  for (const t of toitsDuNiveau(b, n.id)) {
    const facade = mats.revetement ? mats.revetement(revetementDeLaFace(b, n.id, null, null), 'mur-ext') : mats.mur;
    if (t.geometrie) {
      const g = t.geometrie;
      const matToit = mats.revetement ? mats.revetement(t.reglages.revetement, 'toit') : mats.mur;
      const pos = [], uvs = [];
      g.pans.forEach(p => {
        eventail(p.points, p.uv, pos, uvs, false, p.triangles);
        // Le dessous, à l'épaisseur du toit, tourné vers le bas (les triangles retournés).
        const tris = p.triangles ? p.triangles.map(([a, b, c]) => [a, c, b]) : null;
        eventail(p.points.map(q => ({ ...q, y: q.y - EPAISSEUR_TOIT })), p.uv, pos, uvs, false, tris || p.points.slice(2).map((_, i) => [0, i + 2, i + 1]));
      });
      // La rive : le pourtour débordant, de l'épaisseur du toit, en SUIVANT le toit (montée et descente
      // d'un pignon) ; pas contre un mur de l'étage (elle le traverserait, ou passerait au travers de son
      // toit : la ligne sombre signalée).
      g.rives.forEach(r => {
        if (r.adosse) return;
        for (let i = 0; i + 1 < r.points.length; i++) {
          const a = r.points[i], c = r.points[i + 1];
          const L = Math.hypot(c.x - a.x, c.z - a.z);
          eventail([{ x: a.x, y: a.y - EPAISSEUR_TOIT, z: a.z }, { x: c.x, y: c.y - EPAISSEUR_TOIT, z: c.z }, c, a],
            [[0, 0], [L, 0], [L, EPAISSEUR_TOIT], [0, EPAISSEUR_TOIT]], pos, uvs, true);
        }
      });
      groupe.add(maillage(T, pos, uvs, matToit));
      const pp = [], pu = [];
      g.pignons.forEach(p => {
        const a = p.points[0], c = p.points[1];
        const L = Math.hypot(c.x - a.x, c.z - a.z) || 1, d = { x: (c.x - a.x) / L, z: (c.z - a.z) / L };
        eventail(p.points, p.points.map(q => [q.x * d.x + q.z * d.z, q.y]), pp, pu, true, p.triangles || null);
      });
      if (pp.length) groupe.add(maillage(T, pp, pu, facade));
    } else if (t.reglages.bordure === 'acrotere') {
      // Un anneau entre la face extérieure des murs et son retrait, sur le toit plat.
      const forme = new T.Shape(t.ext.map(p => new T.Vector2(p.x, -p.z)));
      forme.holes.push(new T.Path(decaler(t.ext, -ACROTERE.epaisseur).map(p => new T.Vector2(p.x, -p.z))));
      const geo = new T.ExtrudeGeometry(forme, { depth: ACROTERE.hauteur, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const m = new T.Mesh(geo, facade);
      m.position.y = t.base;
      groupe.add(m);
    } else if (t.reglages.bordure === 'garde-corps') {
      // Une lisse et des poteaux, un peu en retrait de la façade : le toit-terrasse.
      const tour = decaler(t.ext, -GARDE_CORPS.retrait);
      tour.forEach((a, i) => {
        if (t.adosses[i]) return;   // pas de garde-corps contre le mur de l'étage
        const c = tour[(i + 1) % tour.length];
        const L = Math.hypot(c.x - a.x, c.z - a.z);
        if (L < 1e-3) return;
        const angle = Math.atan2(-(c.z - a.z), c.x - a.x);
        const lisse = new T.Mesh(new T.BoxGeometry(L, 0.05, 0.05), mats.metal);
        lisse.position.set((a.x + c.x) / 2, t.base + GARDE_CORPS.hauteur, (a.z + c.z) / 2);
        lisse.rotation.y = angle;
        groupe.add(lisse);
        const nb = Math.max(1, Math.round(L / 1.5));
        for (let k = 0; k < nb; k++) {
          const s = k / nb;
          const poteau = new T.Mesh(new T.BoxGeometry(0.04, GARDE_CORPS.hauteur, 0.04), mats.metal);
          poteau.position.set(a.x + (c.x - a.x) * s, t.base + GARDE_CORPS.hauteur / 2, a.z + (c.z - a.z) * s);
          groupe.add(poteau);
        }
      });
    }
  }
}

/**
 * Un meuble en 3D (#454e) : son modèle, ramené à ses dimensions (`base`, puis l'`echelle` de la
 * molette), centré sur son empreinte et posé au sol de son niveau, tourné de `rotY`. Sans modèle
 * (pas encore décodé, ou introuvable) : une boîte translucide à sa taille.
 */
function construireMeuble(T, m, mats, elevation, enCollision = false){
  const g = new T.Group();
  // Au sol (ou décollé, « Collé au sol » décoché), POSÉ SUR SON POINT LE PLUS BAS : incliné ou
  // basculé, il ne s'enfonce pas dans le plancher (demandé : « en fonction des contraintes »).
  g.position.set(m.x, elevation + hauteurAuSol(m) - basDuMeuble(m), m.z);
  g.rotation.set(m.rotX || 0, m.rotY || 0, m.rotZ || 0, 'YXZ');
  g.userData.meubleId = m.id;
  const k = m.echelle || 1;
  const copie = typeof mats.modele === 'function' ? mats.modele(m.modelFile) : null;
  if (copie) {
    copie.scale.multiplyScalar((m.base || 1) * k);
    copie.updateMatrixWorld(true);
    const boite = new T.Box3().setFromObject(copie);
    const centre = boite.getCenter(new T.Vector3());
    copie.position.x -= centre.x;
    copie.position.z -= centre.z;
    copie.position.y -= boite.min.y;
    g.add(copie);
  } else {
    const [l, p, h] = (m.dims || [1, 1, 1]).map(v => v * k);
    const boite = new T.Mesh(new T.BoxGeometry(l, h, p), mats.meubleAttente);
    boite.position.y = h / 2;
    g.add(boite);
  }
  // Forcé dans un mur (demandé) : en rouge, le temps du geste.
  if (enCollision) {
    if (!mats.meubleRouge) mats.meubleRouge = new T.MeshStandardMaterial({ color: 0xe0453a, roughness: 0.7, transparent: true, opacity: 0.75 });
    g.traverse(o => { if (o.isMesh) o.material = mats.meubleRouge; });
  }
  return g;
}

/**
 * Un escalier en 3D : ses marches (pleines jusqu'au sol avec contremarches, sinon des planches), ses
 * paliers, et sa rampe (une main courante inclinée et deux poteaux, par volée et par côté).
 */
function construireEscalier(T, b, esc, mats, elevation, groupe){
  const f = formeDeLEscalier(b, esc);
  if (!f) return;
  const bloc = (pts, y0, y1, mat) => {
    if (y1 - y0 < 1e-3) return;
    const geo = new T.ExtrudeGeometry(new T.Shape(pts.map(p => new T.Vector2(p.x, -p.z))), { depth: y1 - y0, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const m = new T.Mesh(geo, mat);
    m.position.y = elevation + y0;
    groupe.add(m);
  };
  f.morceaux.forEach(m => {
    if (f.e.contremarches) bloc(m.points, 0, m.dessus, m.palier ? mats.mur : mats.bois);
    else bloc(m.points, m.dessus - (m.palier ? 0.12 : 0.05), m.dessus, mats.bois);
  });
  if (f.e.rampe === 'aucune') return;
  const cotes = f.e.rampe === 'deux' ? [1, -1] : [f.e.rampe === 'gauche' ? 1 : -1];
  const w = f.e.largeur / 2 - 0.04, HAUT = 0.9;
  f.volees.forEach(v => {
    const L = Math.hypot(v.vers.x - v.de.x, v.vers.z - v.de.z) || 1;
    const d = { x: (v.vers.x - v.de.x) / L, z: (v.vers.z - v.de.z) / L };
    for (const c of cotes) {
      // La gauche en montant : (d.z, −d.x) dans ce repère, z vers le bas en vue de dessus.
      const o = { x: d.z * c * w, z: -d.x * c * w };
      const a = new T.Vector3(v.de.x + o.x, elevation + v.y0 + HAUT, v.de.z + o.z);
      const z = new T.Vector3(v.vers.x + o.x, elevation + v.y1 + HAUT, v.vers.z + o.z);
      const dir = z.clone().sub(a), long = dir.length();
      const main = new T.Mesh(new T.BoxGeometry(long, 0.05, 0.05), mats.bois);
      main.position.copy(a).add(z).multiplyScalar(0.5);
      main.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), dir.normalize());
      groupe.add(main);
      for (const [p, y] of [[v.de, v.y0], [v.vers, v.y1]]) {
        const poteau = new T.Mesh(new T.BoxGeometry(0.05, HAUT, 0.05), mats.bois);
        poteau.position.set(p.x + o.x, elevation + y + HAUT / 2, p.z + o.z);
        groupe.add(poteau);
      }
    }
  });
}

