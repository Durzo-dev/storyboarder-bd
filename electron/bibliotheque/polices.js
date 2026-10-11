/**
 * @file electron/bibliotheque/polices.js
 * #423 : les POLICES de l'utilisateur, rangées dans <dossier de Projets>/Polices. Les DÉCISIONS
 * seulement (CommonJS, testées sous Node nu) ; les entrées-sorties sont dans electron/main.js.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * LE MODÈLE : UN INDEX, À CÔTÉ DES FICHIERS
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   Polices/polices.json = { familles: [{ nom, fichiers: [nom de fichier…] }], renommages: { ancien: nouveau } }
 *
 * Une FAMILLE est ce qu'on choisit dans une Bulle ; ses fichiers sont ses variantes (Regular, Bold,
 * Italic…). Son `nom` est celui que la police se donne (lu dans le fichier, demandé), sauf si
 * l'utilisateur l'a renommée. C'est ce nom qu'une Bulle enregistre (`bulleFont`).
 *
 * ⚠️ RENOMMER NE RÉÉCRIT AUCUN PROJET (règle n°1 de persisted-data.md). `renommages` garde le
 * chemin de l'ancien nom au nouveau, et une Bulle qui cite l'ancien est dessinée avec le nouveau, à
 * la lecture. Un renommage en chaîne (A → B → C) se résout jusqu'au bout.
 *
 * ⚠️ L'INDEX PEUT ÊTRE ABSENT, VIEUX OU ÉDITÉ À LA MAIN : `indexLu` ne lève jamais, et ne garde que
 * ce qui a la bonne forme.
 *
 * LES USAGES (demandé : « comme les tags du store ») : `usages: [{ id, nom }]` et
 * `usagesDesPolices: { nomDePolice: [id…] }`, intégrées comprises. Tant que l'utilisateur n'y a pas
 * touché, `usages` est ABSENT (null) : l'interface montre alors ceux d'origine, un par police intégrée,
 * et c'est elle qui les AMORCE (dans sa langue) au premier changement. Créer un usage du même nom
 * qu'un existant rend l'existant ; renommer ou supprimer une police déplace ou retire ses usages.
 */

'use strict';

const path = require('path');
const { EXTENSIONS_POLICE } = require('./polices-fichiers');

const INDEX = 'polices.json';

/** Un nom de fichier sûr pour le dossier Polices : nu, sans chemin, avec une extension de police. */
function fichierPoliceAcceptable(nom){
  if (typeof nom !== 'string' || !nom) return false;
  if (nom !== path.basename(nom)) return false;
  if (nom.startsWith('.')) return false;
  return EXTENSIONS_POLICE.includes(path.extname(nom).toLowerCase());
}

/** L'index tel qu'il est sur le disque, ramené à sa forme. */
function indexLu(json){
  let brut = json;
  if (typeof json === 'string') { try { brut = JSON.parse(json); } catch (e) { brut = null; } }
  const familles = [];
  const pris = new Set();
  for (const f of (brut && Array.isArray(brut.familles)) ? brut.familles : []) {
    if (!f || typeof f.nom !== 'string' || !f.nom.trim() || pris.has(f.nom.toLowerCase())) continue;
    const fichiers = (Array.isArray(f.fichiers) ? f.fichiers : []).filter(fichierPoliceAcceptable);
    if (!fichiers.length) continue;
    pris.add(f.nom.toLowerCase());
    familles.push({ nom: f.nom.trim(), fichiers });
  }
  const renommages = {};
  const r = brut && brut.renommages;
  if (r && typeof r === 'object') {
    for (const [a, n] of Object.entries(r)) if (typeof n === 'string' && n && a !== n) renommages[a] = n;
  }
  return { familles, renommages, ...classementLu(brut) };
}

/** Les usages et leurs attributions, ramenés à leur forme ; `usages: null` = jamais amorcés. */
function classementLu(brut){
  if (!brut || !Array.isArray(brut.usages)) return { usages: null, usagesDesPolices: {} };
  const usages = [];
  const ids = new Set();
  for (const u of brut.usages) {
    if (!u || typeof u.id !== 'string' || ids.has(u.id) || typeof u.nom !== 'string' || !u.nom.trim()) continue;
    ids.add(u.id);
    usages.push({ id: u.id, nom: u.nom.trim().slice(0, 40) });
  }
  const usagesDesPolices = {};
  const a = brut.usagesDesPolices;
  if (a && typeof a === 'object') {
    for (const [police, liste] of Object.entries(a)) {
      const propres = [...new Set((Array.isArray(liste) ? liste : []).filter(id => ids.has(id)))];
      if (propres.length) usagesDesPolices[police] = propres;
    }
  }
  return { usages, usagesDesPolices };
}

const nomPropreUsage = (nom) => String(nom || '').replace(/\s+/g, ' ').trim().slice(0, 40);

/** L'index amorcé : les usages d'origine (fournis par l'interface) si l'utilisateur n'y a jamais touché. */
function amorce(index, depart){
  if (Array.isArray(index.usages)) return index;
  const c = classementLu(depart || { usages: [] });
  return { ...index, usages: c.usages || [], usagesDesPolices: c.usagesDesPolices };
}

/**
 * Une opération sur les usages, comme celles des tags du store. `depart` : les usages d'origine, à
 * amorcer si besoin. Rend `{ index, id?, erreur? }` ; l'index reçu n'est pas modifié.
 *   creer { nom } · renommer { id, nom } · supprimer { id } · poser { police, id, actif }
 */
function operationUsage(index0, op, args = {}, depart = null){
  const index = amorce(index0, depart);
  const usages = index.usages.map(u => ({ ...u }));
  const attr = Object.fromEntries(Object.entries(index.usagesDesPolices).map(([k, v]) => [k, [...v]]));
  const fin = (extra = {}) => ({ index: { ...index, usages, usagesDesPolices: attr }, ...extra });
  const nomme = (nom) => usages.find(u => u.nom.toLowerCase() === nom.toLowerCase());
  switch (op) {
    case 'creer': {
      const nom = nomPropreUsage(args.nom);
      if (!nom) return fin({ erreur: 'vide' });
      const existant = nomme(nom);
      if (existant) return fin({ id: existant.id });
      const n = usages.reduce((m, u) => Math.max(m, Number(String(u.id).slice(1)) || 0), 0) + 1;
      usages.push({ id: `u${n}`, nom });
      return fin({ id: `u${n}` });
    }
    case 'renommer': {
      const u = usages.find(x => x.id === args.id);
      const nom = nomPropreUsage(args.nom);
      if (!u) return fin({ erreur: 'inconnu' });
      if (!nom) return fin({ erreur: 'vide' });
      const autre = nomme(nom);
      if (autre && autre.id !== u.id) return fin({ erreur: 'pris' });
      u.nom = nom;
      return fin();
    }
    case 'supprimer': {
      const i = usages.findIndex(x => x.id === args.id);
      if (i >= 0) usages.splice(i, 1);
      for (const k of Object.keys(attr)) {
        attr[k] = attr[k].filter(id => id !== args.id);
        if (!attr[k].length) delete attr[k];
      }
      return fin();
    }
    case 'poser': {
      if (!usages.some(u => u.id === args.id) || typeof args.police !== 'string') return fin();
      const s = new Set(attr[args.police] || []);
      if (args.actif) s.add(args.id); else s.delete(args.id);
      if (s.size) attr[args.police] = [...s]; else delete attr[args.police];
      return fin();
    }
    default: return fin({ erreur: 'operation' });
  }
}

/** Le nom à dessiner pour un nom lu dans une Bulle : les renommages suivis jusqu'au bout. */
function nomCourant(index, nom){
  let n = nom;
  const vus = new Set();
  while (index.renommages[n] && !vus.has(n)) { vus.add(n); n = index.renommages[n]; }
  return n;
}

/** « Nom », ou « Nom (2) », « Nom (3) »… le premier qui n'est pas pris (sans la casse). */
function nomLibre(nom, pris){
  const p = new Set([...pris].map(x => String(x).toLowerCase()));
  if (!p.has(nom.toLowerCase())) return nom;
  for (let i = 2; ; i++) {
    const essai = `${nom} (${i})`;
    if (!p.has(essai.toLowerCase())) return essai;
  }
}

/** Un nom de fichier pour une police importée : celui d'origine, rendu sûr et unique dans le dossier. */
function nomDeFichierPolice(origine, existants){
  const ext = path.extname(String(origine || '')).toLowerCase();
  const base = path.basename(String(origine || ''), path.extname(String(origine || '')))
    .replace(/[^A-Za-z0-9 _.()-]/g, '_').replace(/^\.+/, '').trim() || 'police';
  const pris = new Set([...existants].map(x => String(x).toLowerCase()));
  let nom = `${base}${ext}`;
  for (let i = 2; pris.has(nom.toLowerCase()); i++) nom = `${base}-${i}${ext}`;
  return nom;
}

/**
 * Ce qu'un import propose, famille par famille, AVANT d'écrire : `conflit` si le nom est déjà pris,
 * par une police importée ou intégrée (`intégrées` : leurs noms). L'utilisateur choisit alors de
 * remplacer (importées seulement), de garder les deux, ou de passer.
 */
function propositionsDImport(index, familles, integrees = []){
  const importees = new Set(index.familles.map(f => f.nom.toLowerCase()));
  const integ = new Set(integrees.map(n => n.toLowerCase()));
  return familles.map(f => {
    const cle = f.famille.toLowerCase();
    const conflit = integ.has(cle) ? 'integree' : importees.has(cle) ? 'importee' : null;
    return { famille: f.famille, conflit };
  });
}

/**
 * L'index après un import. `familles` : les familles lues ({ famille, fichiers: [{ fichier }] }, le
 * `fichier` étant déjà le nom ÉCRIT dans le dossier) ; `choix` : famille → 'remplacer' | 'garder' |
 * 'passer' (absent : ajout simple). Rend `{ index, retires }` : les fichiers remplacés à effacer.
 */
function appliquerImport(index, familles, choix = {}, integrees = []){
  const out = { ...index, familles: index.familles.map(f => ({ ...f, fichiers: [...f.fichiers] })), renommages: { ...index.renommages } };
  const retires = [];
  for (const f of familles) {
    const decision = choix[f.famille];
    if (decision === 'passer') continue;
    const fichiers = f.fichiers.map(x => x.fichier);
    const i = out.familles.findIndex(x => x.nom.toLowerCase() === f.famille.toLowerCase());
    if (i >= 0 && decision === 'remplacer') {
      retires.push(...out.familles[i].fichiers);
      out.familles[i] = { nom: out.familles[i].nom, fichiers };
      continue;
    }
    const pris = [...out.familles.map(x => x.nom), ...integrees];
    out.familles.push({ nom: nomLibre(f.famille, pris), fichiers });
  }
  return { index: out, retires };
}

/** Renommer une famille. Rend `{ index }` ou `{ erreur }` (nom vide, inconnu ou déjà pris). */
function renommer(index, ancien, nouveau, integrees = []){
  const n = String(nouveau || '').trim();
  if (!n) return { erreur: 'vide' };
  const i = index.familles.findIndex(f => f.nom === ancien);
  if (i < 0) return { erreur: 'inconnue' };
  if (n === ancien) return { index };
  const pris = [...index.familles.filter((f, k) => k !== i).map(f => f.nom), ...integrees].map(x => x.toLowerCase());
  if (pris.includes(n.toLowerCase())) return { erreur: 'pris' };
  const familles = index.familles.map((f, k) => (k === i ? { ...f, nom: n } : f));
  const renommages = { ...index.renommages, [ancien]: n };
  // Les anciens noms qui menaient à `ancien` mènent désormais au nouveau, et un retour à un nom
  // précédent ne laisse pas de boucle.
  for (const [a, cible] of Object.entries(renommages)) if (cible === ancien) renommages[a] = n;
  delete renommages[n];
  // Ses usages suivent la police.
  const usagesDesPolices = { ...(index.usagesDesPolices || {}) };
  if (usagesDesPolices[ancien]) { usagesDesPolices[n] = usagesDesPolices[ancien]; delete usagesDesPolices[ancien]; }
  return { index: { ...index, familles, renommages, usagesDesPolices } };
}

/** Supprimer une famille : l'index sans elle, et ses fichiers à effacer. */
function supprimer(index, nom){
  const f = index.familles.find(x => x.nom === nom);
  if (!f) return { index, retires: [] };
  const usagesDesPolices = { ...(index.usagesDesPolices || {}) };
  delete usagesDesPolices[nom];
  return { index: { ...index, familles: index.familles.filter(x => x !== f), usagesDesPolices }, retires: [...f.fichiers] };
}

module.exports = {
  INDEX, fichierPoliceAcceptable, indexLu, nomCourant, nomLibre, nomDeFichierPolice,
  propositionsDImport, appliquerImport, renommer, supprimer, operationUsage,
};
