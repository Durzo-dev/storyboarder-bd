/**
 * @file plan-modele.js
 * #456g, LE MODÈLE ENTRAÎNÉ qui lit un plan : le seul module qui le connaisse. C'est un GREFFON, et il
 * doit le rester (décision de Valentin, docs/en/plan-modele.md) : Storyboarder n'est pas vendu, mais les
 * poids du modèle sont sous licence NON COMMERCIALE ; on doit pouvoir le retirer en trois gestes :
 *   1. supprimer le dossier assets/modeles/plans/ ;
 *   2. retirer la dépendance onnxruntime-web (package.json, et ses fichiers dans build.files) ;
 *   3. supprimer ce fichier.
 * L'import de plan (plan-import-ui.js) le charge par un import DYNAMIQUE : absent, ou en échec, il rend
 * la main aux règles (plan-murs.js), comme avant. tests/plan-modele.test.mjs garde la sortie : aucun
 * autre fichier n'importe onnxruntime-web ni ne lit assets/modeles/.
 *
 * Le modèle : SegFormer-B0 de Floorplan Studio (code MIT ; poids entraînés sur CubiCasa5K, CC BY-NC 4.0,
 * à partir du SegFormer de NVIDIA, licence non commerciale : assets/modeles/plans/LISEZMOI.md). Il rend,
 * pour chaque pixel, cinq classes : 0 fond, 1 pièce, 2 mur, 3 porte, 4 fenêtre.
 *
 * Préparation (celle de la page d'origine, vérifiée sur le banc, plans-test/banc/modele_classes.py) :
 * l'image réduite dans un carré BLANC de 512 px, centrée, normalisée (moyenne et écart type ImageNet) ;
 * sortie 5 × 128 × 128, ramenée à la taille de travail des règles (côté ≤ 2000, plan-murs.js), pour que
 * la suite de la chaîne (vectorisation, raccords, échelle) soit la même.
 */

const COTE = 512, SORTIE = 128, CLASSES = 5;
const MOYENNE = [0.485, 0.456, 0.406], ECART = [0.229, 0.224, 0.225];
/**
 * Une PORTE dès que le modèle lui donne 30 % (et pas seulement quand elle l'emporte) : sur le plan de
 * test n° 2, les portes perdaient souvent contre le mur où elles sont ; à 30 %, deux fois plus de portes
 * y sont trouvées, et CubiCasa5K n'y perd rien (78 % trouvées, 80 % justes ; à 20 %, la précision
 * tombait à 76 %).
 */
export const SEUIL_PORTE = 0.3;

/**
 * L'ENTRÉE du modèle : l'image RGBA (w × h) réduite par moyenne de surface dans le carré blanc,
 * normalisée, en planar [3, 512, 512]. Rend `{ donnees, boite }`, boite = la place de l'image dans le
 * carré `{ gauche, haut, largeur, hauteur }`.
 */
export function entreeDuModele(rgba, w, h){
  const k = Math.min(COTE / w, COTE / h);
  const nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k));
  const gauche = (COTE - nw) >> 1, haut = (COTE - nh) >> 1;
  const plan = COTE * COTE, donnees = new Float32Array(3 * plan);
  for (let c = 0; c < 3; c++) donnees.fill((1 - MOYENNE[c]) / ECART[c], c * plan, (c + 1) * plan);
  // Moyenne de SURFACE exacte, pixels coupés au prorata (comme INTER_AREA d'OpenCV, celle du banc) :
  // des boîtes entières décalaient l'image d'un demi-pixel, et 5 % des pixels d'entrée s'écartaient
  // nettement de ceux du banc. En deux passes : les lignes, puis les colonnes.
  const poidsX = poidsDeSurface(w, nw), poidsY = poidsDeSurface(h, nh);
  const lignes = new Float32Array(h * nw * 3);
  for (let y = 0; y < h; y++) for (let X = 0; X < nw; X++) {
    let r = 0, g = 0, b = 0;
    for (const [x, p] of poidsX[X]) { const i = (y * w + x) * 4; r += rgba[i] * p; g += rgba[i + 1] * p; b += rgba[i + 2] * p; }
    const o = (y * nw + X) * 3; lignes[o] = r; lignes[o + 1] = g; lignes[o + 2] = b;
  }
  for (let Y = 0; Y < nh; Y++) for (let X = 0; X < nw; X++) {
    let r = 0, g = 0, b = 0;
    for (const [y, p] of poidsY[Y]) { const o = (y * nw + X) * 3; r += lignes[o] * p; g += lignes[o + 1] * p; b += lignes[o + 2] * p; }
    const q = (haut + Y) * COTE + gauche + X;
    donnees[q] = (r / 255 - MOYENNE[0]) / ECART[0];
    donnees[plan + q] = (g / 255 - MOYENNE[1]) / ECART[1];
    donnees[2 * plan + q] = (b / 255 - MOYENNE[2]) / ECART[2];
  }
  return { donnees, boite: { gauche, haut, largeur: nw, hauteur: nh } };
}

/** Pour chaque case d'arrivée (n sur une longueur de L), ses pixels de départ et leur part (somme 1). */
function poidsDeSurface(L, n){
  const s = L / n, res = [];
  for (let k = 0; k < n; k++) {
    const a = k * s, b = Math.min(L, (k + 1) * s), cases = [];
    for (let x = Math.floor(a); x < b; x++) {
      const part = Math.min(b, x + 1) - Math.max(a, x);
      if (part > 1e-9) cases.push([x, part / (b - a)]);
    }
    // Agrandir (s < 1) : la case tombe dans un seul pixel, rendu tel quel.
    res.push(cases.length ? cases : [[Math.min(L - 1, Math.floor(a)), 1]]);
  }
  return res;
}

/**
 * Les CLASSES, à la taille de travail W × H, d'après la sortie du modèle (`logits`, [5, 128, 128]) :
 * chaque pixel de travail est ramené dans le carré (par la boîte), la sortie y est lue en bilinéaire,
 * et la classe est la plus probable, sauf la porte, retenue dès `seuilPorte` (cf. SEUIL_PORTE).
 */
export function classesDuModele(logits, boite, W, H, seuilPorte = SEUIL_PORTE){
  const classes = new Uint8Array(W * H), plan = SORTIE * SORTIE, v = new Float64Array(CLASSES);
  for (let Y = 0; Y < H; Y++) {
    const gy = Math.min(SORTIE - 1, Math.max(0, (boite.haut + (Y + 0.5) * boite.hauteur / H) / (COTE / SORTIE) - 0.5));
    const j0 = Math.floor(gy), j1 = Math.min(SORTIE - 1, j0 + 1), fy = gy - j0;
    for (let X = 0; X < W; X++) {
      const gx = Math.min(SORTIE - 1, Math.max(0, (boite.gauche + (X + 0.5) * boite.largeur / W) / (COTE / SORTIE) - 0.5));
      const i0 = Math.floor(gx), i1 = Math.min(SORTIE - 1, i0 + 1), fx = gx - i0;
      let max = -Infinity, meilleure = 0;
      for (let c = 0; c < CLASSES; c++) {
        const o = c * plan;
        const haut = logits[o + j0 * SORTIE + i0] * (1 - fx) + logits[o + j0 * SORTIE + i1] * fx;
        const bas = logits[o + j1 * SORTIE + i0] * (1 - fx) + logits[o + j1 * SORTIE + i1] * fx;
        v[c] = haut * (1 - fy) + bas * fy;
        if (v[c] > max) { max = v[c]; meilleure = c; }
      }
      if (meilleure !== 3 && meilleure !== 0) {
        let somme = 0;
        for (let c = 0; c < CLASSES; c++) somme += Math.exp(v[c] - max);
        if (Math.exp(v[3] - max) / somme >= seuilPorte) meilleure = 3;
      }
      classes[Y * W + X] = meilleure;
    }
  }
  return classes;
}

/**
 * Les MASQUES de la chaîne : les murs pris sur « mur, porte ou fenêtre » réunis (les baies sont DANS
 * le mur : il reste continu, les pièces se ferment), puis les portes et les fenêtres seules.
 */
export function masquesDesClasses(classes){
  const n = classes.length, murs = new Uint8Array(n), portes = new Uint8Array(n), fenetres = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const c = classes[p];
    murs[p] = c >= 2 ? 1 : 0; portes[p] = c === 3 ? 1 : 0; fenetres[p] = c === 4 ? 1 : 0;
  }
  return { murs, portes, fenetres };
}

// ─── Le chargement, dans l'application seulement ─────────────────────────────────────────────────

const DOSSIER_ORT = new URL('../node_modules/onnxruntime-web/dist/', import.meta.url).href;
const FICHIER_MODELE = new URL('../assets/modeles/plans/floorplan-segformer.onnx', import.meta.url).href;

/** Des octets locaux (file://, archive asar comprise) : XMLHttpRequest, que l'on sait sûr ici. */
function octets(url){
  return new Promise((resoudre, rejeter) => {
    const x = new globalThis.XMLHttpRequest();
    x.open('GET', url);
    x.responseType = 'arraybuffer';
    x.onload = () => (x.response && x.response.byteLength ? resoudre(x.response) : rejeter(new Error('vide : ' + url)));
    x.onerror = () => rejeter(new Error('illisible : ' + url));
    x.send();
  });
}

/** La session, chargée une fois (la promesse est gardée) ; null si le modèle ou le moteur manque. */
let _session = null;
function session(){
  if (!_session) _session = (async () => {
    const ort = await import(DOSSIER_ORT + 'ort.wasm.min.mjs');
    // Un seul fil : plusieurs demanderaient l'isolation d'origine (SharedArrayBuffer), que la fenêtre
    // n'a pas ; un plan se lit en une demi-seconde environ.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = DOSSIER_ORT;
    ort.env.wasm.wasmBinary = await octets(DOSSIER_ORT + 'ort-wasm-simd-threaded.wasm');
    const modele = await octets(FICHIER_MODELE);
    return { ort, s: await ort.InferenceSession.create(new Uint8Array(modele), { executionProviders: ['wasm'] }) };
  })().catch((err) => { console.warn('[plan-modele] modèle indisponible, les règles prennent le relais :', err); return null; });
  return _session;
}

/**
 * LIT LE PLAN : l'image RGBA (w × h, déjà redressée) → les masques `{ murs, portes, fenetres }` à la
 * taille de travail W × H ; ou null (modèle absent, moteur absent, échec) : l'appelant applique alors
 * les règles.
 */
export async function lireLePlan(rgba, w, h, W, H){
  const prete = await session();
  if (!prete) return null;
  try {
    const { donnees, boite } = entreeDuModele(rgba, w, h);
    const entree = new prete.ort.Tensor('float32', donnees, [1, 3, COTE, COTE]);
    const sortie = await prete.s.run({ pixel_values: entree });
    const logits = (sortie.logits || Object.values(sortie)[0]).data;
    return masquesDesClasses(classesDuModele(logits, boite, W, H));
  } catch (err) {
    console.warn('[plan-modele] lecture impossible, les règles prennent le relais :', err);
    return null;
  }
}
