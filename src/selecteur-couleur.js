/**
 * @file src/selecteur-couleur.js
 * LE SÉLECTEUR DE COULEUR DE L'APPLICATION (demandé), à la place de celui du système.
 *
 * Celui de Chromium ne se place pas (il s'ouvrait SOUS le champ, par-dessus la texture qu'on était en
 * train de teindre), ne suit pas les thèmes, et n'a pas de boutons. Celui-ci :
 *   - s'ouvre À CÔTÉ du menu ou de la fenêtre qui porte le champ, jamais dessus : ce qu'on teint
 *     reste visible ;
 *   - est fait des jetons de l'application (style.css, `.selecteur-couleur`), dans les quatre rendus ;
 *   - une zone saturation × luminosité, une barre de teinte, le code hexadécimal, la pipette quand
 *     le système l'offre ; en bas, Annuler, Couleur d'origine (si le champ en a une), Valider.
 *
 * ⚠️ IL NE REMPLACE PAS LES CHAMPS, IL LES PILOTE. Chaque `<input type="color">` reste en place et
 * garde sa valeur ; un clic dessus ouvre ce sélecteur au lieu de celui du système, et chaque
 * changement écrit la valeur dans le champ puis émet `input` (pendant le glissé) et `change` (à la
 * validation), comme le faisait le système. Les dix champs de l'application et le code qui les
 * écoute n'ont donc rien à savoir de lui.
 *
 * « Couleur d'origine » : un champ en a une si son propriétaire lui donne `champ.couleurOrigine`, une
 * fonction qui la rend (la couleur naturelle d'une texture, par exemple). Sinon le bouton se cache.
 *
 * Fermer : Valider ou un clic à côté gardent la couleur ; Annuler ou Échap rendent celle d'avant
 * l'ouverture (et l'émettent, pour que l'aperçu en direct revienne aussi).
 */
import { placerMenuFlottant3D } from './ui-scale.js';
import { tr } from './state.js';
import { icone } from './icones.js';
import { avalerLaSuiteDuGeste } from './avaler-geste.js';

// ── Les conversions, PURES ──────────────────────────────────────────────────────────────────────

/** `#rrggbb` (ou `#rgb`, avec ou sans dièse) normalisé en minuscules, ou null. */
export function hexNormalise(v){
  const s = String(v == null ? '' : v).trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(s)) return '#' + s;
  if (/^[0-9a-f]{3}$/.test(s)) return '#' + s.split('').map(c => c + c).join('');
  return null;
}

/** `#rrggbb` → `{ h: 0–360, s: 0–1, v: 0–1 }`. */
export function hexVersTsv(hex){
  const n = hexNormalise(hex) || '#000000';
  const r = parseInt(n.slice(1, 3), 16) / 255, g = parseInt(n.slice(3, 5), 16) / 255, b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

/** `{ h, s, v }` → `#rrggbb`. */
export function tsvVersHex({ h, s, v }){
  const hh = ((Number(h) % 360) + 360) % 360, ss = Math.min(1, Math.max(0, s)), vv = Math.min(1, Math.max(0, v));
  const c = vv * ss, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = vv - c;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  const o = (u) => Math.round((u + m) * 255).toString(16).padStart(2, '0');
  return `#${o(r)}${o(g)}${o(b)}`;
}

/**
 * Où ouvrir le sélecteur, en pixels d'ÉCRAN : à GAUCHE du conteneur du champ (menu de droite,
 * fenêtre), sinon à sa droite, sinon sous le champ ; aligné sur le champ en hauteur. Le recadrage
 * dans la fenêtre est fait ensuite par placerMenuFlottant3D. PURE.
 */
export function ancreDuSelecteur({ champ, conteneur, taille, fenetre, ecart = 10 }){
  const y = champ.top + champ.height / 2 - taille.h / 2;
  if (conteneur.left - ecart - taille.w >= 0) return { x: conteneur.left - ecart - taille.w, y };
  if (conteneur.right + ecart + taille.w <= fenetre.w) return { x: conteneur.right + ecart, y };
  return { x: champ.left, y: champ.bottom + ecart };
}

// ── Le composant ────────────────────────────────────────────────────────────────────────────────

let ouvert = null;   // { champ, initiale, panneau, fermer }

const echelleUI = () => {
  const v = parseFloat(getComputedStyle(document.body).getPropertyValue('--echelle-ui'));
  return v > 0 ? v : 1;
};

function el(tag, classe, attrs = {}){
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

const PIPETTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';

/** Ouvre le sélecteur pour ce champ (un `<input type="color">`). */
export function ouvrirSelecteurCouleur(champ){
  if (ouvert) ouvert.fermer(true);
  const initiale = hexNormalise(champ.value) || '#000000';
  let tsv = hexVersTsv(initiale);
  const origine = typeof champ.couleurOrigine === 'function' ? hexNormalise(champ.couleurOrigine()) : null;

  const panneau = el('div', 'selecteur-couleur', { role: 'dialog', 'aria-label': tr('Colour', 'Couleur') });
  const zone = el('div', 'selecteur-couleur-zone');
  const curseur = el('div', 'selecteur-couleur-curseur');
  zone.appendChild(curseur);
  const teinte = el('div', 'selecteur-couleur-teinte');
  const poignee = el('div', 'selecteur-couleur-poignee');
  teinte.appendChild(poignee);
  const apercu = el('span', 'selecteur-couleur-apercu');
  const avant = el('span', 'selecteur-couleur-avant', { title: tr('Colour before opening', 'Couleur à l\'ouverture') });
  avant.style.background = initiale;
  const hex = el('input', 'selecteur-couleur-hex', { type: 'text', spellcheck: 'false', maxlength: '7', 'aria-label': tr('Hexadecimal code', 'Code hexadécimal') });
  const ligne = el('div', 'selecteur-couleur-ligne');
  ligne.append(el('span', 'selecteur-couleur-temoins'), hex);
  ligne.firstChild.append(avant, apercu);
  if (globalThis.EyeDropper) {
    const pipette = el('button', 'selecteur-couleur-pipette', { type: 'button', title: tr('Pick a colour on screen', 'Prendre une couleur à l\'écran') });
    pipette.innerHTML = PIPETTE;
    pipette.onclick = async () => {
      try { const r = await new globalThis.EyeDropper().open(); poser(hexVersTsv(r.sRGBHex)); } catch (e) { /* abandonnée */ }
    };
    ligne.appendChild(pipette);
  }
  // Revenir à la couleur d'origine : une icône à droite de la pipette (demandé), comme elle.
  const reinit = el('button', 'selecteur-couleur-pipette', { type: 'button', title: tr('Back to the original colour', 'Revenir à la couleur d\'origine'), 'aria-label': tr('Original colour', 'Couleur d\'origine') });
  reinit.innerHTML = icone('reinitialiser');
  if (origine) ligne.appendChild(reinit);
  const annuler = el('button', 'nav-btn', { type: 'button' });
  annuler.textContent = tr('Cancel', 'Annuler');
  const valider = el('button', 'full-btn', { type: 'button' });
  valider.textContent = tr('Confirm', 'Valider');
  const actions = el('div', 'selecteur-couleur-actions');
  actions.append(annuler, valider);
  panneau.append(zone, teinte, ligne, actions);
  // Les clics DANS le sélecteur ne regardent que lui : ils ne remontent pas aux gestes de
  // l'application (désélection, fermeture des menus), qui écoutent la fenêtre.
  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu']) {
    panneau.addEventListener(type, (e) => e.stopPropagation());
  }

  // Écrire dans le champ, et l'annoncer comme le faisait le sélecteur du système.
  const emettre = (type) => champ.dispatchEvent(new window.Event(type, { bubbles: true }));
  const peindre = () => {
    const h = tsvVersHex(tsv);
    zone.style.setProperty('--teinte-pure', tsvVersHex({ h: tsv.h, s: 1, v: 1 }));
    curseur.style.left = `${tsv.s * 100}%`;
    curseur.style.top = `${(1 - tsv.v) * 100}%`;
    poignee.style.left = `${(tsv.h / 360) * 100}%`;
    apercu.style.background = h;
    if (document.activeElement !== hex) hex.value = h;
    reinit.disabled = !origine || h === origine;
    return h;
  };
  let touche = false;   // la couleur a-t-elle bougé depuis l'ouverture ? (sinon, fermer n'émet rien)
  const poser = (nouveau) => {
    tsv = nouveau;
    const h = peindre();
    if (champ.value.toLowerCase() !== h) { champ.value = h; touche = true; emettre('input'); }
  };

  // Les glissés : la zone (saturation, luminosité) et la barre (teinte).
  const glisser = (cible, lire) => cible.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cible.setPointerCapture(e.pointerId);
    const suivre = (ev) => { const r = cible.getBoundingClientRect(); lire((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height); };
    suivre(e);
    cible.onpointermove = suivre;
    cible.onpointerup = () => { cible.onpointermove = null; cible.onpointerup = null; };
  });
  const borne = (u) => Math.min(1, Math.max(0, u));
  glisser(zone, (x, y) => poser({ h: tsv.h, s: borne(x), v: 1 - borne(y) }));
  glisser(teinte, (x) => poser({ h: borne(x) * 359.9, s: tsv.s, v: tsv.v }));
  hex.addEventListener('input', () => { const n = hexNormalise(hex.value); if (n) poser(hexVersTsv(n)); });
  hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fermer(false); } });

  // Un clic à côté valide et ferme, SANS aller plus loin (signalé : il fermait le menu de la Case).
  const surClicAilleurs = (e) => {
    if (panneau.contains(e.target) || e.target === champ) return;
    e.stopPropagation();
    e.preventDefault();
    avalerLaSuiteDuGeste();
    fermer(false);
  };
  const surTouche = (e) => {
    if (e.key !== 'Escape') return;
    // Échap ferme le sélecteur, pas la fenêtre en dessous (modal-stack l'écouterait aussi).
    e.preventDefault(); e.stopImmediatePropagation();
    fermer(true);
  };
  function fermer(retour){
    if (!ouvert || ouvert.panneau !== panneau) return;
    ouvert = null;
    window.removeEventListener('pointerdown', surClicAilleurs, true);
    document.removeEventListener('keydown', surTouche, true);
    // ⚠️ RETIRÉ APRÈS le clic qui le ferme, pas pendant (signalé : « Annuler » fermait le menu). Retiré
    // tout de suite, le bouton cliqué n'était plus dans la page quand le clic remontait : les gestes de
    // l'application le prenaient pour un clic dans le vide, et désélectionnaient la Case.
    panneau.style.visibility = 'hidden';
    setTimeout(() => panneau.remove(), 0);
    champ.classList.remove('selecteur-couleur-actif');
    if (!touche) return;
    if (retour && champ.value.toLowerCase() !== initiale) { champ.value = initiale; emettre('input'); }
    emettre('change');
  }
  annuler.onclick = () => fermer(true);
  valider.onclick = () => fermer(false);
  reinit.onclick = () => { if (origine) poser(hexVersTsv(origine)); };

  document.body.appendChild(panneau);
  peindre();
  champ.classList.add('selecteur-couleur-actif');
  // À côté du conteneur du champ, jamais dessus : ce qu'on teint reste visible.
  const conteneur = champ.closest('.right-panel, .modal-box, .sidebar') || champ;
  const p = panneau.getBoundingClientRect();
  const ancre = ancreDuSelecteur({ champ: champ.getBoundingClientRect(), conteneur: conteneur.getBoundingClientRect(),
    taille: { w: p.width, h: p.height }, fenetre: { w: window.innerWidth, h: window.innerHeight } });
  const { left, top } = placerMenuFlottant3D({ ancre, taille: { w: p.width, h: p.height },
    fenetre: { w: window.innerWidth, h: window.innerHeight }, echelle: echelleUI() });
  panneau.style.left = `${left}px`;
  panneau.style.top = `${top}px`;
  window.addEventListener('pointerdown', surClicAilleurs, true);
  document.addEventListener('keydown', surTouche, true);
  ouvert = { champ, initiale, panneau, fermer };
  hex.focus();
  hex.select();
}

/**
 * Branche le sélecteur sur TOUS les champs couleur, présents et à venir : un clic sur un
 * `<input type="color">` ouvre celui-ci au lieu de celui du système. Une fois, au démarrage.
 */
export function installerSelecteurCouleur(){
  document.addEventListener('click', (e) => {
    const champ = e.target;
    if (!champ || champ.tagName !== 'INPUT' || champ.type !== 'color' || champ.disabled) return;
    e.preventDefault();
    if (ouvert && ouvert.champ === champ) { ouvert.fermer(false); return; }
    ouvrirSelecteurCouleur(champ);
  }, true);
}
