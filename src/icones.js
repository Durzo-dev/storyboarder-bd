/**
 * @file icones.js
 * LA FAMILLE D'ICÔNES de l'application (#460k, #460l) : une seule, au trait, comme les boutons ronds
 * du bandeau. Grille de 24, trait de 2, bouts arrondis, en `currentColor` (le style est porté par
 * `.icone` et `.ctx-icon svg` dans style.css) : l'icône prend la couleur du texte qu'elle précède.
 *
 * Les menus contextuels d'index.html portent les mêmes dessins en dur (le HTML est statique) ; un
 * test vérifie que chacun d'eux est bien l'un de ceux-ci. Une icône nouvelle s'ajoute donc ICI.
 * Les pictogrammes de l'éditeur de bâtiment (batiment-icones.js) sont une variante : trait de 1,6,
 * plus grands, dessinés dans la vue où la différence se lit.
 */

/** Le corps SVG de chaque icône, par nom. */
export const ICONES = {
  polices: '<path d="M3 19 8 5l5 14M4.8 14h6.4"/><circle cx="17.5" cy="16" r="3"/><path d="M20.5 13v6"/>',
  annuler: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  aide: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  coche: '<path d="m5 12 5 5 9-10"/>',
  ajouter: '<path d="M12 5v14M5 12h14"/>',
  scene: '<path d="M3 10h18v10H3z"/><path d="m3 10 2-6 15 0-1 6"/><path d="m9 4-2 6M15 4l-2 6"/>',
  batiment: '<path d="M3 11 12 4l9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  modele: '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  deplacer: '<path d="M12 3v18M3 12h18"/><path d="m9 6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  tracer: '<path d="M5 21 9 3M19 21 15 3"/><path d="M12 6v2M12 12v2M12 18v2"/>',
  zone: '<path d="m4 7 8-4 8 5-2 11-12 1z" stroke-dasharray="3 3"/>',
  mesure: '<path d="M3 16 16 3l5 5L8 21z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>',
  camera: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="m15 11 6-3v8l-6-3"/>',
  avancer: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  reculer: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  supprimer: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="m6 7 1 13h10l1-13M9 7V4h6v3"/>',
  renommer: '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M12 4v16M10 4h4M10 20h4"/>',
  modifier: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  squelette: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  personnage: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7.5v7M12 9.5 7 12.5M12 9.5l5 3M12 14.5 8.5 21M12 14.5l3.5 6.5"/>',
  lumiere: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  case: '<rect x="4" y="5" width="16" height="14" rx="1"/>',
  bulle: '<path d="M4 5h16v11H10l-5 4v-4H4z"/>',
  importer: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  lire: '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2zM22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>',
  exporter: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  dupliquer: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/>',
  retirer: '<path d="M3 6h7l2 2h9v11H3z"/><path d="M9 13h6"/>',
  pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
  vehicules: '<path d="M5 17H3v-5l2-5h11l4 5h1v5h-2M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  chaise: '<path d="M7 3v18M7 13h10v8"/><path d="M7 3h3v10"/>',
  parois: '<rect x="3" y="4" width="18" height="17"/><path d="M9 21v-8h6v8"/>',
  murs: '<path d="M3 5h18v15H3zM3 10h18M3 15h18M9 5v5M15 10v5M9 15v5"/>',
  plantes: '<path d="M5 19C5 10 11 5 20 4c0 9-5 15-14 15z"/><path d="m5 19 8-8"/>',
  animaux: '<circle cx="8" cy="7" r="1.6"/><circle cx="16" cy="7" r="1.6"/><circle cx="4.5" cy="12" r="1.6"/><circle cx="19.5" cy="12" r="1.6"/><path d="M8 18a4 4 0 0 1 8 0c0 2.5-8 2.5-8 0z"/>',
  jardin: '<circle cx="12" cy="9" r="6"/><path d="M12 15v6"/>',
  ville: '<path d="M3 21V9h6v12M9 21V4h8v17M17 21v-9h4v9M2 21h20"/>',
  cimetiere: '<path d="M3 21v-8a3 3 0 0 1 6 0v8M11 21V9a4 4 0 0 1 8 0v12M2 21h20"/>',
  eglise: '<path d="M12 2v4M10 4h4"/><path d="m12 6-6 5v10h12V11z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
  velo: '<circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16 9 8h7l2.5 8M9 8l3 8h6.5M7.5 5h3M16 8l-1-3h2"/>',
  table: '<path d="M3 8h18M6 8v12M18 8v12M6 13h12"/>',
  etagere: '<path d="M5 3v18M19 3v18M5 8h14M5 14h14M5 20h14M8 5v3M11 5.5V8M14 11v3M9 17v3"/>',
  armoire: '<path d="M5 3h14v18H5zM12 3v18M10 11v2M14 11v2"/>',
  canape: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 18v2M19 18v2"/>',
  bureau: '<path d="M3 8h18M5 8v12M19 8v12M13 8v7h6M15 11.5h2"/>',
  lit: '<path d="M3 6v14M3 14h18v6M21 14v-3a2 2 0 0 0-2-2h-9v5"/><circle cx="6.5" cy="11" r="1.5"/>',
  fenetre: '<path d="M5 3h14v18H5zM12 3v18M5 12h14"/>',
  porte: '<path d="M6 21V3h12v18M3 21h18M15 12v1"/>',
  escalier: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  baie: '<path d="M3 4h18v17H3zM12 4v17M6 12h3M15 12h3"/>',
  mur: '<path d="M3 9h18v8H3zM3 13h18M9 9v4M15 13v4"/>',
  mur_coin: '<path d="M4 4v16h16v-6H10V4z"/>',
  buisson: '<path d="M5 19a3.5 3.5 0 0 1-.5-7A5 5 0 0 1 14 9a4 4 0 0 1 5.5 5A3 3 0 0 1 19 19z"/>',
  arbre: '<path d="M12 3 6 11h3l-4 6h14l-4-6h3zM12 17v4"/>',
  arbuste: '<path d="M12 21v-7M12 14c-4 0-6-3-6-7 4 0 6 3 6 7zM12 14c4 0 6-3 6-7-4 0-6 3-6 7z"/>',
  fleur: '<circle cx="12" cy="8" r="2"/><circle cx="12" cy="4.5" r="2"/><circle cx="15.5" cy="8" r="2"/><circle cx="12" cy="11.5" r="2"/><circle cx="8.5" cy="8" r="2"/><path d="M12 13.5V21M12 18c-2 0-4-1-4-3 2 0 4 1 4 3z"/>',
  pot: '<path d="M6 13h12l-1.5 8h-9zM12 13V8M12 8c-3 0-5-2-5-5 3 0 5 2 5 5zM12 10c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4z"/>',
  piece: '<path d="M10 20H4V4h16v16h-4"/><path d="M10 20a6 6 0 0 1 6-6" stroke-dasharray="2 2"/>',
  oiseau: '<path d="M2 8c4-1 7 1 10 5 3-4 6-6 10-5"/>',
  lezard: '<path d="M20 5c-2-1-4 0-5 2l-3 9c-1 3-4 5-8 4"/><path d="m14 9 3 1M13 12l-3-1M12 15l3 1M11 18l-3-1"/>',
  loup: '<path d="m5 3 3 5h8l3-5v8l-3 5-4 4-4-4-3-5z"/><path d="M9.5 12h.01M14.5 12h.01M11 16h2"/>',
  griffon: '<path d="M3 20c3-3 4-8 4-14 3 3 4 6 5 10 2-4 5-6 9-7-1 5-4 9-9 11z"/>',
  singe: '<circle cx="12" cy="12" r="6"/><circle cx="4.5" cy="11" r="2"/><circle cx="19.5" cy="11" r="2"/><path d="M9.5 15a3 2 0 0 0 5 0M10 10.5h.01M14 10.5h.01"/>',
  piscine: '<path d="M5 3v10M10 3v10M5 6h5M5 10h5"/><path d="M2 17c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 21c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/>',
  barbecue: '<path d="M4 9h16a8 8 0 0 1-16 0zM8 16l-2 5M16 16l2 5M12 17v4M9 3c1 1 1 2 0 3M13 3c1 1 1 2 0 3M17 3c1 1 1 2 0 3"/>',
  lampadaire: '<path d="M7 21h6M10 21V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/><path d="M15 6h6l-1 3h-4z"/>',
  panneau: '<path d="M12 3 20 15H4z"/><path d="M12 15v6M12 8v3"/>',
  tombe: '<path d="M7 3h10v18H7z"/><path d="M12 7v6M10 9h4"/>',
  pierre_tombale: '<path d="M6 21V9a6 6 0 0 1 12 0v12z"/><path d="M4 21h16M12 10v6M10 12h4"/>',
  caveau: '<path d="m12 3-9 5h18z"/><path d="M4 10h16M3 21h18M6 10v9M10 10v9M14 10v9M18 10v9"/>',
  banc: '<path d="M3 11h18M5 11v8M19 11v8M3 6h18v5"/>',
  autel: '<path d="M12 2v8M9 5h6M4 13h16M6 13v8M18 13v8"/>',
  chemin_terre: '<path d="M7 21c0-5 10-6 10-11S13 4 12 3" stroke-dasharray="2 3"/>',
  muret: '<path d="M3 13h18v6H3zM3 16h18M8 13v3M14 16v3M18 13v3"/>',
  cloture: '<path d="M5 21V6l2-2 2 2v15M15 21V6l2-2 2 2v15M2 10h20M2 16h20"/>',
  haie: '<path d="M3 18v-5a3 3 0 0 1 4-3 3 3 0 0 1 5-1 3 3 0 0 1 5 1 3 3 0 0 1 4 3v5z"/><path d="M2 21h20"/>',
  barriere: '<path d="M3 9h18v5H3zM7 9l-3 5M12 9l-3 5M17 9l-3 5M21 9l-3 5M6 14v7M18 14v7"/>',
  visage_neutre: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/><path d="M9 15h6"/>',
  visage_content: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/><path d="M8.5 14a4 4 0 0 0 7 0"/>',
  visage_triste: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/><path d="M8.5 16.5a4 4 0 0 1 7 0"/>',
  visage_colere: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/><path d="m7.5 7.5 3 1.5M16.5 7.5l-3 1.5M8.5 16.5a4 4 0 0 1 7 0"/>',
  visage_surpris: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/><circle cx="12" cy="15.5" r="1.8"/>',
  visage_rire: '<circle cx="12" cy="12" r="9"/><path d="m8 10.5 1.5-1 1.5 1M13 10.5l1.5-1 1.5 1M8 13h8a4 4 0 0 1-8 0z"/>',
  visage_degout: '<circle cx="12" cy="12" r="9"/><path d="M8 10h2.5M13.5 10H16M8 15.5c1-1 2 1 3 0s2 1 3 0 1-.5 2 0"/>',
  visage_fier: '<circle cx="12" cy="12" r="9"/><path d="M8 10h2.5M13.5 10H16M9 15c2 1 4.5.5 6-1.5"/>',
  visage_peur: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/><path d="M9 16.5c1-1 2-1 3 0s2 1 3 0"/>',
  visage_confus: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/><path d="m9 16 6-1.5"/>',
  visage_fatigue: '<circle cx="12" cy="12" r="9"/><path d="M8 10.5h2.5M13.5 10.5H16M10 15.5h4"/>',
};

/** Une icône prête à poser (innerHTML), décorative : le libellé voisin ou le `title` la nomme. */
export function icone(nom){
  const corps = ICONES[nom] || ICONES.modele;
  return `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true">${corps}</svg>`;
}

/** La même, en nœud DOM (pour les écrans construits élément par élément). */
export function noeudIcone(nom){
  const boite = document.createElement('span');
  boite.innerHTML = icone(nom);
  return boite.firstChild;
}

/** L'icône de chaque type d'Élément : la même que dans le menu « Ajouter ». */
export const ICONE_TYPE_OBJET = {
  lumiere: 'lumiere', voiture: 'vehicules', velo: 'velo',
  table: 'table', chaise: 'chaise', etagere: 'etagere', armoire: 'armoire', canape: 'canape', bureau: 'bureau', lit: 'lit',
  fenetre_ouverte: 'fenetre', porte_ouverte: 'porte', escalier: 'escalier', baie_vitree: 'baie', mur: 'mur', mur_coin: 'mur_coin',
  buisson: 'buisson', arbre: 'arbre', arbuste: 'arbuste', fleur: 'fleur', pot_fleur: 'pot',
  oiseau: 'oiseau', lezard: 'lezard', loup: 'loup', griffon: 'griffon', singe: 'singe',
  piscine: 'piscine', barbecue: 'barbecue', lampadaire: 'lampadaire', panneau_signalisation: 'panneau',
  tombe: 'tombe', pierre_tombale: 'pierre_tombale', caveau: 'caveau', banc_eglise: 'banc', autel: 'autel',
  modele: 'modele', batiment: 'batiment',
};

/** L'icône de chaque type de Tracé. */
export const ICONE_TRACÉ = {
  route: 'tracer', chemin: 'chemin_terre', terrain: 'zone',
  muret: 'muret', cloture: 'cloture', haie: 'haie', barriere: 'barriere',
};

/** Le visage de chaque émotion d'un Personnage (sa ligne dans la liste des Éléments). */
export const ICONE_EMOTION = {
  neutre: 'visage_neutre', content: 'visage_content', triste: 'visage_triste', colere: 'visage_colere',
  surpris: 'visage_surpris', rire: 'visage_rire', degout: 'visage_degout', fier: 'visage_fier',
  peur: 'visage_peur', confus: 'visage_confus', fatigue: 'visage_fatigue',
};
