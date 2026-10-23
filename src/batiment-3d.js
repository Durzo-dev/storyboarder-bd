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
import { formesDesPieces, dansLaFace } from './batiment-pieces.js';
import { formeDeLEscalier, tremieDeLEscalier } from './batiment-escaliers.js';
import { niveauxTries, hauteurDesMursDuNiveau, epaisseurDuDessus, niveauDessous } from './batiment-niveaux.js';

/** Les matières d'un bâtiment, à créer une fois par renderer. */
export function materiauxBatiment3D(T){
  return {
    mur: new T.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.9 }),
    sol: new T.MeshStandardMaterial({ color: 0xa89c86, roughness: 1, side: T.DoubleSide }),
    cadre: new T.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 }),
    bois: new T.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.8 }),
    verre: new T.MeshStandardMaterial({ color: 0x9fc6d8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, side: T.DoubleSide }),
  };
}

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
  }
  return g;
}

/**
 * `jusquA` (#454b) : l'id du DERNIER niveau à montrer ; ceux du dessus sont omis (la « coupe » de
 * l'aperçu de l'éditeur, pour voir dans l'étage qu'on retouche). Absent : tout le bâtiment.
 */
export function construireBatiment3D(T, b, mats, { jusquA = null } = {}){
  const groupe = new T.Group();
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
  visibles.forEach(n => {
    const dessous = niveauDessous(b, n.id);
    const tremiesPlancher = dessous ? tremiesDe(dessous.id) : [];
    const tremiesPlafond = tremiesDe(n.id);
    const forme2D = (f, tremies = []) => {
      const forme = new T.Shape(f.points.map(p => new T.Vector2(p.x, -p.z)));
      [...(f.trous || []), ...percees(f, tremies)].forEach(t => forme.holes.push(new T.Path(t.map(p => new T.Vector2(p.x, -p.z)))));
      return forme;
    };
    for (const f of formesDesPieces(b, n.id).values()) {
      // Le sol de chaque pièce (#454a-3b), un peu au-dessus de la grille pour ne pas scintiller avec elle.
      const geo = new T.ShapeGeometry(forme2D(f, tremiesPlancher));
      geo.rotateX(-Math.PI / 2);
      const sol = new T.Mesh(geo, mats.sol);
      sol.position.y = n.elevation + 0.005;
      groupe.add(sol);
      // #454b : la dalle, SOUS le sol d'un étage (le plus bas des niveaux est posé sur le Sol).
      if (n.id !== lePlusBas && n.dalle > 0) dalle(f, n.elevation - n.dalle, n.dalle, tremiesPlancher);
      // ET LE DESSUS DE CHAQUE PIÈCE (signalé : une pièce qui dépassait de l'étage du dessus restait à
      // ciel ouvert). Chaque pièce est couverte d'une dalle à sa hauteur sous plafond, de l'épaisseur
      // du plancher du dessus : sous une pièce de l'étage, elle se confond avec son plancher ;
      // ailleurs, c'est un toit plat (en attendant les toits de #458). Le dernier niveau montré par
      // une coupe reste ouvert, pour voir dedans.
      if (!(coupe && n.id === dernier)) dalle(f, n.elevation + n.hauteur, epaisseurDuDessus(b, n.id), tremiesPlafond);
    }
    const murs = b.murs.filter(m => m.niveauId === n.id);
    const formes = polygonesDesMurs(murs);
    // La forme est tracée dans (x, −z) puis extrudée vers le haut : la rotation de −90° autour de x
    // envoie (x, y, profondeur) sur (x, profondeur, −y).
    const extruder = (pts, y0, y1) => {
      if (y1 - y0 < 1e-3) return;
      const geo = new T.ExtrudeGeometry(new T.Shape(pts.map(p => new T.Vector2(p.x, -p.z))), { depth: y1 - y0, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const maillage = new T.Mesh(geo, mats.mur);
      maillage.position.y = n.elevation + y0;
      groupe.add(maillage);
    };
    murs.forEach(m => {
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
        const menuiserie = construireMenuiserie(T, m, o, mats);
        menuiserie.position.y += n.elevation;
        groupe.add(menuiserie);
      });
    });
    // #454c : les escaliers du niveau.
    (b.escaliers || []).filter(x => x.niveauId === n.id).forEach(x => construireEscalier(T, b, x, mats, n.elevation, groupe));
  });
  return groupe;
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

