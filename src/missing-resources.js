/**
 * @file src/missing-resources.js
 * Les RESSOURCES INTROUVABLES d'un Projet (#443) : modèles 3D, images de Case et polices
 * importées (#423) qu'il cite mais que le dossier des Projets ne contient pas.
 *
 * POURQUOI. Les modèles et les images ne vivent pas à côté du fichier du Projet, mais dans les
 * sous-dossiers `Modeles` et `Images` du DOSSIER DES PROJETS réglé dans la Configuration. Ce dossier
 * change d'une installation à l'autre (celui de `npm start` est dans le dépôt, celui de
 * l'application installée dans Documents, cf. #447). Ouvrir un Projet depuis l'autre côté le montrait
 * criblé de « Image introuvable » et de boîtes de remplacement, sans un mot d'explication.
 * Constaté par l'utilisateur à sa première installation.
 *
 * Après l'ouverture d'un Projet, on compare ce qu'il cite à ce que les dossiers contiennent. S'il
 * manque quelque chose, une modale dit combien, où l'on a cherché, et comment corriger. On compare
 * aux LISTES des dossiers et non à l'état des caches : un fichier présent mais illisible n'est pas
 * un problème de dossier, et la cascade de préchargement n'a pas fini quand la question se pose.
 *
 * Changer de dossier dans la Configuration relance tout (rafraichirApresChangementDeDossier) :
 * les fichiers déclarés introuvables sont redemandés, et la modale se met à jour ou disparaît.
 */
import { S, tr } from './state.js';
import { listModels } from './model-store.js';
import { listImages } from './image-store.js';
import { collectModelFiles, oublierModelesIntrouvables } from './model-cache.js';
import { collectImageFiles, oublierImagesIntrouvables } from './image-cache.js';
import { policeDeBulle } from './constants.js';
import { NOMS_INTEGRES, nomApresRenommages, chargerPolicesUtilisateur } from './polices-utilisateur.js';

/** Combien de noms la modale montre par catégorie, avant « et N autres ». */
export const NOMS_MONTRES = 8;

/** Tous les objets du Projet : chaque Planche de chaque Tome, et chaque page de chaque Scène. */
export function objetsDuProjet({ tomes = [], scenes = [] } = {}){
  const objets = [];
  [...tomes, ...scenes].forEach(t => (t && t.pages || []).forEach(p => objets.push(...(p && p.objects || []))));
  return objets;
}

/** Les polices citées par les Bulles, sans doublon. PURE. */
export function policesCitees(objets){
  return [...new Set((objets || []).filter(o => o && o.type === 'bulle' && typeof o.bulleFont === 'string' && o.bulleFont)
    .map(o => o.bulleFont))];
}

/**
 * Une police citée est-elle disponible ? Ses renommages suivis, puis la remplaçante d'une intégrée
 * retirée : elle doit être intégrée, ou parmi les polices importées (#423). PURE.
 */
export function policeDisponible(nom, { importees = [], renommages = {} } = {}){
  const n = policeDeBulle(nomApresRenommages(nom, renommages));
  return NOMS_INTEGRES.includes(n) || importees.includes(n);
}

/** Ce que le Projet cite et que les dossiers n'ont pas. Fonction pure, résultats triés. */
export function ressourcesManquantes({ objets, modelesPresents, imagesPresentes, policesPresentes = null }){
  const m = new Set(modelesPresents || []);
  const i = new Set(imagesPresentes || []);
  const tri = (a, b) => a.localeCompare(b);
  return {
    modeles: collectModelFiles(objets).filter(n => !m.has(n)).sort(tri),
    images: collectImageFiles(objets).filter(n => !i.has(n)).sort(tri),
    // `policesPresentes` : { importees, renommages } ; absent (hors application), rien n'est signalé.
    polices: policesPresentes ? policesCitees(objets).filter(n => !policeDisponible(n, policesPresentes)).sort(tri) : [],
  };
}

/** Le dossier qui contient un fichier, avec le séparateur du système qui l'a écrit. */
export function dossierDe(chemin){
  if (!chemin) return null;
  const i = Math.max(chemin.lastIndexOf('\\'), chemin.lastIndexOf('/'));
  return i > 0 ? chemin.slice(0, i) : null;
}

/** `dossier` + `nom`, avec le séparateur que le dossier utilise déjà. */
export function joindre(dossier, nom){
  const sep = dossier.includes('\\') ? '\\' : '/';
  return dossier.replace(/[\\/]+$/, '') + sep + nom;
}

/** Deux chemins désignent-ils le même dossier ? Windows ne distingue ni la casse ni le séparateur. */
export function memeDossier(a, b){
  const norme = (c) => String(c || '').replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
  return !!a && !!b && norme(a) === norme(b);
}

/** Une liste de noms, tronquée : `n` noms puis « et N autre(s) ». */
export function listeTronquee(noms, t, n = NOMS_MONTRES){
  const montres = noms.slice(0, n);
  if (noms.length > n) montres.push(t(`and ${noms.length - n} more`, `et ${noms.length - n} autre(s)`));
  return montres;
}

/**
 * Le contenu de la modale. Fonction pure : `t(en, fr)` traduit.
 * Rend `{ titre, intro, cherche: [{ libelle, chemin }], manquants: [{ libelle, noms }], correctifs, indice }`.
 */
export function contenuRessources({ manquantes, dossierProjets, cheminProjet, t }){
  const nm = manquantes.modeles.length;
  const ni = manquantes.images.length;
  const np = (manquantes.polices || []).length;
  const parties = [];
  if (nm) parties.push(t(`${nm} 3D model(s)`, `${nm} modèle(s) 3D`));
  if (ni) parties.push(t(`${ni} image(s)`, `${ni} image(s)`));
  if (np) parties.push(t(`${np} font(s)`, `${np} police(s)`));
  const quoi = parties.length > 1
    ? parties.slice(0, -1).join(', ') + t(' and ', ' et ') + parties[parties.length - 1]
    : parties.join('');
  const cherche = [];
  if (nm) cherche.push({ libelle: t('Models', 'Modèles'), chemin: joindre(dossierProjets, 'Modeles') });
  if (ni) cherche.push({ libelle: t('Images', 'Images'), chemin: joindre(dossierProjets, 'Images') });
  if (np) cherche.push({ libelle: t('Fonts', 'Polices'), chemin: joindre(dossierProjets, 'Polices') });
  const manquants = [];
  if (nm) manquants.push({ libelle: t('Missing models', 'Modèles manquants'), noms: listeTronquee(manquantes.modeles, t) });
  if (ni) manquants.push({ libelle: t('Missing images', 'Images manquantes'), noms: listeTronquee(manquantes.images, t) });
  // Une police n'est pas un fichier nommé dans le Projet : c'est un NOM de famille. Les Bulles
  // concernées s'affichent dans une police de secours.
  if (np) manquants.push({ libelle: t('Missing fonts', 'Polices manquantes'), noms: listeTronquee(manquantes.polices, t) });
  const dossierProjet = dossierDe(cheminProjet);
  const indice = dossierProjet && !memeDossier(dossierProjet, dossierProjets)
    ? t(`This Project is saved in ${dossierProjet}, which is not the Projects folder set in Settings. If its Modeles and Images folders sit next to it, that is the folder to choose.`,
      `Ce Projet est enregistré dans ${dossierProjet}, qui n'est pas le dossier des Projets réglé dans la Configuration. Si ses dossiers Modeles et Images sont à côté de lui, c'est ce dossier qu'il faut choisir.`)
    : null;
  return {
    titre: t('Missing resources', 'Ressources introuvables'),
    intro: t(`${quoi} used by this Project cannot be found. The affected panels show a placeholder instead${np ? ', and the bubbles a fallback font' : ''}; nothing has been removed from the Project.`,
      `${quoi} utilisé(s) par ce Projet sont introuvables. Les Cases concernées affichent un remplacement à la place${np ? ', et les Bulles une police de secours' : ''} ; rien n'est retiré du Projet.`),
    cherche,
    manquants,
    correctifs: [
      t('If your models, images and fonts are in another Projects folder, choose it in Settings: "Projects folder", "Choose..." button. They come back right away.',
        'Si vos modèles, images et polices sont dans un autre dossier de Projets, choisissez-le dans la Configuration : « Dossier des projets », bouton « Choisir... ». Ils reviennent aussitôt.'),
      t('Otherwise, copy the missing files into the folders above.',
        'Sinon, copiez les fichiers manquants dans les dossiers ci-dessus.'),
      ...(np ? [t('A missing font can also be added again from "My fonts" (Aa button), from its file.',
        'Une police manquante peut aussi être rajoutée depuis « Mes polices » (bouton Aa), à partir de son fichier.')] : []),
    ],
    indice,
  };
}

/**
 * La SIMULATION, pour voir la modale sans casser un vrai Projet : `npm start` avec la variable
 * STORYBOARD_SIMULER_RESSOURCES, que main.js transmet en paramètre d'adresse (`?simulerRessources=1`,
 * en développement seulement). Trois modèles et onze images manquants, pour voir la liste tronquée,
 * et un Projet rangé ailleurs, pour voir l'indice.
 */
export function simulationRessources(recherche){
  return /[?&]simulerRessources(=|&|$)/.test(String(recherche || ''));
}

export function manquantesSimulees(){
  return {
    modeles: ['banc-de-parc.glb', 'chat-noir.glb', 'lampadaire.glb'],
    images: Array.from({ length: 11 }, (_, i) => `photo-${String(i + 1).padStart(2, '0')}.jpg`),
    polices: ['Komika Axis', 'Wild Words'],
  };
}

// ─── Câblage (DOM et pont Electron) ───────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function element(tag, texte, classe){
  const e = document.createElement(tag);
  if (texte) e.textContent = texte;
  if (classe) e.className = classe;
  return e;
}

export function fermerModaleRessources(){
  const m = $('ressourcesModal');
  if (m) m.classList.add('hidden');
}

function afficher(c, simule = false){
  $('ressourcesTitre').textContent = c.titre;
  const corps = $('ressourcesCorps');
  const blocs = [element('p', c.intro)];
  // Une simulation se DIT, comme celle des mises à jour : sinon elle passe pour un vrai problème.
  if (simule) {
    blocs.unshift(element('p', tr('Simulation (STORYBOARD_SIMULER_RESSOURCES): fake data. To go back to normal, close this terminal or type Remove-Item Env:STORYBOARD_SIMULER_RESSOURCES.',
      'Simulation (STORYBOARD_SIMULER_RESSOURCES) : données factices. Pour revenir à la normale, fermez ce terminal ou tapez Remove-Item Env:STORYBOARD_SIMULER_RESSOURCES.'), 'maj-simulation'));
  }
  blocs.push(element('h4', tr('Where the application looked', 'Où l\'application a cherché')));
  const ul = element('ul');
  c.cherche.forEach(({ libelle, chemin }) => {
    const li = element('li', libelle + ' : ');
    li.appendChild(element('code', chemin));
    ul.appendChild(li);
  });
  blocs.push(ul);
  c.manquants.forEach(({ libelle, noms }) => {
    blocs.push(element('h4', libelle));
    const l = element('ul', null, 'ressources-noms');
    noms.forEach(n => l.appendChild(element('li', n)));
    blocs.push(l);
  });
  blocs.push(element('h4', tr('How to fix it', 'Comment corriger')));
  const ol = element('ol');
  c.correctifs.forEach(x => ol.appendChild(element('li', x)));
  blocs.push(ol);
  if (c.indice) blocs.push(element('p', c.indice, 'ressources-indice'));
  corps.replaceChildren(...blocs);
  $('ressourcesConfiguration').textContent = tr('Open Settings', 'Ouvrir la Configuration');
  $('ressourcesFermer').textContent = tr('Close', 'Fermer');
  $('ressourcesModal').classList.remove('hidden');
}

/**
 * Compare le Projet ouvert aux dossiers et ouvre la modale s'il manque quelque chose ; la ferme
 * sinon. Rend le nombre de fichiers manquants. Hors de l'application de bureau, ne fait rien.
 */
export async function verifierRessources(){
  const pont = typeof window !== 'undefined' && window.storyboarderAPI;
  if (!pont || !pont.getProjectsDir) return 0;
  const [modelesPresents, imagesPresentes, dossierProjets, polices] = await Promise.all([
    listModels(), listImages(), pont.getProjectsDir().catch(() => ''),
    pont.listFonts ? pont.listFonts().catch(() => null) : Promise.resolve(null),
  ]);
  // Les polices sont lues sur le disque, comme les modèles et les images : pas dans l'état chargé,
  // qui peut ne pas avoir fini au moment de la question.
  const policesPresentes = polices
    ? { importees: (polices.familles || []).filter(f => !f.introuvable).map(f => f.nom), renommages: polices.renommages || {} }
    : null;
  const manquantes = ressourcesManquantes({
    objets: objetsDuProjet({ tomes: S.tomes, scenes: S.scenes }), modelesPresents, imagesPresentes, policesPresentes,
  });
  const simule = simulationRessources(typeof location !== 'undefined' && location.search);
  const vraies = simule ? manquantesSimulees() : manquantes;
  const total = vraies.modeles.length + vraies.images.length + vraies.polices.length;
  if (!total || !dossierProjets) { fermerModaleRessources(); return total; }
  const cheminProjet = simule ? 'D:\\Ailleurs\\Mes BD\\Projet simulé.json' : S.projectFilePath;
  afficher(contenuRessources({ manquantes: vraies, dossierProjets, cheminProjet, t: tr }), simule);
  return total;
}

/**
 * Après un changement de dossier des Projets : ce qui était introuvable est redemandé (relancer
 * le préchargement est l'affaire de l'appelant, qui le connaît), puis la vérification refaite.
 */
export async function rafraichirApresChangementDeDossier(relancerPrechargement){
  oublierModelesIntrouvables();
  oublierImagesIntrouvables();
  if (relancerPrechargement) relancerPrechargement();
  // Les polices du nouveau dossier : chargées avant la vérification (#423).
  try { await chargerPolicesUtilisateur(); } catch (e) { /* elles seront signalées manquantes */ }
  return verifierRessources();
}

/** Les deux boutons et le clic en dehors. Appelé une fois, au chargement. */
export function cablerModaleRessources(){
  const ressourcesModal = document.getElementById('ressourcesModal');
  if (!ressourcesModal) return;
  $('ressourcesFermer').onclick = fermerModaleRessources;
  $('ressourcesConfiguration').onclick = () => {
    fermerModaleRessources();
    $('settingsBtn').click();
  };
  ressourcesModal.addEventListener('mousedown', (e) => { if (e.target === ressourcesModal) fermerModaleRessources(); });
}
