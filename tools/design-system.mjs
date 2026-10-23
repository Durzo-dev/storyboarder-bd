/**
 * tools/design-system.mjs — le SYSTÈME DE DESIGN de l'application, généré depuis le code.
 *
 *   node tools/design-system.mjs            → docs/design-system.html
 *
 * Une page autonome (police et icônes embarquées) qui montre les jetons des quatre rendus, la
 * typographie, les écarts, les rayons et les composants du menu de droite, pour s'en servir hors de
 * l'application : maquettes, site de présentation, visuels.
 *
 * ⚠️ ELLE EST LUE DANS `src/style.css` ET `src/batiment-icones.js`, JAMAIS RECOPIÉE. Une page de
 * référence écrite à la main aurait divergé au premier écart retouché, exactement le défaut que les
 * règles du dépôt évitent ailleurs. Les règles elles-mêmes sont dans docs/en/interface.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ICONES from '../src/batiment-icones.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (c) => readFileSync(join(RACINE, c), 'utf8');

/** Les jetons `--nom: valeur` d'un bloc de style.css, dans l'ordre. */
export function jetonsDuBloc(css, selecteur){
  const i = css.indexOf(`\n${selecteur}{`);
  if (i < 0) throw new Error(`bloc ${selecteur} introuvable dans style.css`);
  const corps = css.slice(i, css.indexOf('\n}', i)).replace(/\/\*[\s\S]*?\*\//g, '');
  return Object.fromEntries([...corps.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}

/** Les quatre rendus, résolus comme la cascade les résout. */
export function themes(css){
  const sombre = jetonsDuBloc(css, ':root');
  const clair = { ...sombre, ...jetonsDuBloc(css, 'body.theme-light') };
  const contraste = { ...sombre, ...jetonsDuBloc(css, 'body.theme-contraste') };
  const clairContraste = { ...clair, ...jetonsDuBloc(css, 'body.theme-contraste'), ...jetonsDuBloc(css, 'body.theme-light.theme-contraste') };
  return [
    ['Sombre', 'défaut', sombre], ['Clair', 'theme-light', clair],
    ['Sombre contrasté', 'theme-contraste', contraste], ['Clair contrasté', 'theme-light theme-contraste', clairContraste],
  ];
}

/** Les jetons de couleur montrés, par rôle (les autres, comme --echelle-ui, ne sont pas des couleurs). */
const ROLES = [
  ['Surfaces', [['paper', 'Papier : le fond des sections'], ['paper-dark', 'Papier foncé : fond des panneaux'], ['creux', 'Creux : fond des sous-sections'], ['white', 'Champs de saisie, boutons de choix'], ['nav-bg', 'Bouton gris'], ['nav-bg-hover', 'Bouton gris survolé']]],
  ['Encres', [['ink', 'Texte'], ['ink-mid', 'Titres de sous-section'], ['ink-soft', 'Libellés, titres de section'], ['sepia', 'Texte secondaire']]],
  ['Rôles', [['accent', 'Orange : créer, valider, choix actif'], ['accent-soft', 'Fond d\'un choix actif'], ['danger', 'Rouge : supprimer'], ['warn', 'Jaune : renommer, éditer'], ['focus', 'Bague de focus']]],
  ['Sur les rôles', [['sur-accent', 'Texte sur orange'], ['sur-danger', 'Texte sur rouge'], ['sur-warn', 'Texte sur jaune']]],
  ['Filets', [['line', 'Filet qui encadre (décoratif)'], ['line-strong', 'Délimiteur, bord des boutons'], ['bord-actif', 'Bord de ce qui se clique ou se saisit']]],
];

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const vars = (j) => Object.entries(j).map(([k, v]) => `--${k}:${v}`).join(';');

function nuancier(nom, classe, j){
  const lignes = ROLES.map(([titre, liste]) => `<h4>${titre}</h4><div class="nuances">${liste.map(([k, usage]) => `
      <div class="nuance"><span class="pastille" style="background:${j[k]}"></span><code>--${k}</code><span class="valeur">${esc(j[k])}</span><span class="usage">${usage}</span></div>`).join('')}</div>`).join('');
  return `<div class="theme"><h3>${nom} <small>${classe}</small></h3>${lignes}</div>`;
}

const I = (groupe, cle) => ICONES[groupe][cle];
const choix = (liste, actif = 0, desactive = -1) => `<div class="choix">${liste.map(([icone, titre], i) =>
  `<button class="${i === actif ? 'actif' : ''}" ${i === desactive ? 'disabled' : ''} title="${esc(titre)}">${icone}</button>`).join('')}</div>`;

/** Le menu de droite de l'éditeur de bâtiment, reconstitué avec les vrais jetons d'un thème. */
function specimen(nom, j){
  return `<div class="specimen" style="${vars(j)}">
  <p class="specimen-nom">${nom}</p>
  <section class="sec"><h2>Bâtiment</h2><input class="champ-nom" value="Maison de Léa"></section>
  <section class="sec"><h2>Niveaux</h2>
    <div class="ligne actif"><b>RDC</b><span>Rez-de-chaussée</span></div>
    <div class="ligne"><b>1</b><span>Étage 1</span></div>
    <div class="pile"><button class="full">Ajouter un étage</button><button class="full">Dupliquer l'étage</button></div>
  </section>
  <section class="sec"><h2>Escalier sélectionné</h2>
    <div class="sous"><h3>Type</h3>${choix([[I('ICONES_TYPE_ESCALIER', 'droit'), 'Escalier droit'], [I('ICONES_TYPE_ESCALIER', 'L'), 'Escalier en L'], [I('ICONES_TYPE_ESCALIER', 'U'), 'Escalier en U']], 1, 2)}
      ${choix([[I('ICONES_SENS_ESCALIER', 1), 'Tourne à gauche'], [I('ICONES_SENS_ESCALIER', -1), 'Tourne à droite']])}</div>
    <div class="sous"><h3>Marches</h3>${choix([[I('ICONES_RAMPE', 'aucune'), 'Sans rampe'], [I('ICONES_RAMPE', 'gauche'), 'Rampe à gauche'], [I('ICONES_RAMPE', 'droite'), 'Rampe à droite'], [I('ICONES_RAMPE', 'deux'), 'Rampe des deux côtés']], 2)}
      ${choix([[I('ICONES_MARCHES', true), 'Marches pleines'], [I('ICONES_MARCHES', false), 'Marches ouvertes']])}</div>
    <label class="champ"><span>Largeur</span><input value="90"><em>cm</em></label>
    <div class="rangee"><button class="nav">Tourner de 90° (R)</button></div>
    <button class="full danger">Supprimer l'escalier</button>
  </section>
  <section class="sec"><h2>Ouverture à poser</h2>
    <div class="sous"><h3>Type</h3>${choix(['porte', 'fenetre', 'baie', 'passage'].map(t => [I('ICONES_OUVERTURE', t), t]))}
      ${choix([[I('ICONES_MANOEUVRE', 1), 'Un battant'], [I('ICONES_MANOEUVRE', 2), 'Deux battants'], [I('ICONES_MANOEUVRE', 'coulissant'), 'Coulissante']])}
      ${choix([[I('ICONES_REMPLISSAGE', 'pleine'), 'Porte pleine'], [I('ICONES_REMPLISSAGE', 'vitree'), 'Porte vitrée']])}
      ${choix([[I('ICONES_INVERSER', 'cote'), 'Ouvrir de l\'autre côté du mur'], [I('ICONES_INVERSER', 'charniere'), 'Passer la charnière de l\'autre bord']], -1)}</div>
    <div class="sous"><h3>Dimensions</h3><label class="champ"><span>Largeur</span><input value="90"><em>cm</em></label>
      <label class="champ"><span>Hauteur</span><input value="210"><em>cm</em></label><label class="champ"><span>Élévation</span><input value="0"><em>cm</em></label></div>
  </section>
  <section class="sec"><h2>Commandes</h2><p class="aide">Clic : la poser et la choisir.
Clic droit : changer le sens d'une porte.
Molette : changer de type.
Échap : quitter l'outil.</p></section>
  <div class="bas"><button class="full">Enregistrer dans la bibliothèque</button><button class="nav">Recadrer</button><button class="nav">Quitter</button></div>
</div>`;
}

export function page(){
  const css = lire('src/style.css');
  const inter = readFileSync(join(RACINE, 'assets/fonts/Inter-latin.woff2')).toString('base64');
  const liste = themes(css);
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Storyboarder BD — système de design</title>
<style>
@font-face{ font-family:'Inter'; font-weight:100 900; src:url(data:font/woff2;base64,${inter}) format('woff2'); }
:root{ color-scheme: light; }
body{ margin:0; font-family:'Inter',sans-serif; background:#F6F5F2; color:#222; font-size:14px; line-height:1.5; }
main{ max-width:1180px; margin:0 auto; padding:32px 28px 64px; }
h1{ font-size:26px; margin:0 0 4px; } h1 + p{ color:#666; margin:0 0 28px; }
h2.titre{ font-size:18px; margin:40px 0 6px; padding-bottom:6px; border-bottom:1px solid #DDD8CE; }
p.chapo{ color:#555; margin:0 0 16px; max-width:780px; }
code{ font-family:ui-monospace,Consolas,monospace; font-size:12px; }
.themes{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; }
.theme{ background:#fff; border:1px solid #E3DED3; border-radius:12px; padding:14px 16px; }
.theme h3{ margin:0 0 6px; font-size:15px; } .theme h3 small{ color:#999; font-weight:400; font-size:11px; }
.theme h4{ margin:12px 0 4px; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#888; }
.nuance{ display:grid; grid-template-columns:22px 1fr auto; column-gap:8px; align-items:center; padding:3px 0; }
.pastille{ width:22px; height:22px; border-radius:6px; border:1px solid rgba(0,0,0,.15); grid-row:span 2; }
.nuance .valeur{ font-size:11px; color:#777; font-family:ui-monospace,Consolas,monospace; }
.nuance .usage{ grid-column:2 / 4; font-size:11.5px; color:#666; }
.specimens{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; align-items:start; }
table{ border-collapse:collapse; background:#fff; border:1px solid #E3DED3; border-radius:12px; overflow:hidden; }
td,th{ padding:8px 14px; border-bottom:1px solid #EEE9DF; text-align:left; font-size:13px; vertical-align:middle; }
th{ font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#888; }
.barre{ display:inline-block; height:12px; background:#FF7A45; border-radius:2px; vertical-align:middle; }
.rayon{ display:inline-block; width:44px; height:28px; border:2px solid #FF7A45; background:#FFF1EA; }
ul.regles{ max-width:820px; padding-left:20px; } ul.regles li{ margin:4px 0; }
/* ── Le spécimen : les règles de style.css, recopiées sur les mêmes jetons ── */
.specimen{ width:300px; background:var(--paper-dark); color:var(--ink); padding:14px 16px; border-radius:12px; font-size:12px; box-shadow:0 1px 3px rgba(0,0,0,.12); }
.specimen-nom{ margin:0 0 10px; font-size:11px; color:var(--ink-soft); text-align:center; }
.specimen button{ font-family:'Inter',sans-serif; cursor:pointer; }
.sec{ background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:14px; margin-bottom:14px; }
.sec h2{ font-size:11px; font-weight:600; color:var(--ink-soft); margin:0 0 12px; text-transform:uppercase; letter-spacing:.05em;
  padding-bottom:8px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:6px; }
.sec h2::before{ content:''; width:5px; height:5px; border-radius:50%; background:var(--accent); }
.champ-nom{ width:100%; box-sizing:border-box; font:600 15px 'Inter',sans-serif; padding:7px 10px; border:1px solid var(--bord-actif); border-radius:7px; background:var(--white); color:var(--ink); }
.ligne{ display:flex; gap:12px; align-items:center; padding:8px 10px; border:1px solid var(--bord-actif); border-radius:7px; margin-bottom:6px; }
.ligne b{ color:var(--accent); font-size:12px; } .ligne.actif{ border-color:var(--accent); background:var(--accent-soft); }
.pile{ display:flex; flex-direction:column; gap:6px; margin-top:10px; }
.full{ width:100%; padding:8px; border:1px solid var(--accent); background:var(--accent); color:var(--sur-accent); font-weight:600; font-size:12.5px; border-radius:7px; }
.full.danger{ background:var(--danger); border-color:var(--danger); color:var(--sur-danger); margin-top:6px; }
.nav{ width:100%; padding:8px 12px; border:1px solid var(--line-strong); background:var(--nav-bg); color:var(--ink); border-radius:7px; font-size:12.5px; }
.nav:hover{ background:var(--nav-bg-hover); }
.rangee{ display:flex; gap:6px; margin-top:6px; } .rangee .nav{ font-size:11.5px; }
.sous{ background:var(--creux); border-radius:5px; padding:7px 9px 9px; margin:0 0 10px; display:flex; flex-direction:column; gap:8px; }
.sous h3{ margin:0; font-size:13px; font-weight:600; color:var(--ink-mid); }
.choix{ display:flex; gap:4px; }
.choix button{ flex:1 1 0; display:flex; align-items:center; justify-content:center; padding:6px 4px; border-radius:6px; border:1px solid var(--line-strong); background:var(--white); color:var(--ink); }
.choix button.actif{ border-color:var(--accent); color:var(--accent); background:var(--accent-soft); }
.choix button:disabled{ opacity:.4; cursor:not-allowed; }
.champ{ display:flex; align-items:center; gap:8px; font-size:12px; color:var(--ink); }
.champ span{ flex:1; } .champ em{ font-style:normal; color:var(--ink-soft); }
.champ input{ width:64px; font:12.5px 'Inter',sans-serif; padding:5px 6px; border:1px solid var(--bord-actif); border-radius:6px; background:var(--white); color:var(--ink); }
.sec > .champ{ margin:0 0 10px; }
.aide{ margin:0; white-space:pre-line; color:var(--ink-soft); font-size:12px; line-height:1.6; }
.bas{ display:flex; flex-direction:column; gap:8px; }
</style></head><body><main>
<h1>Storyboarder BD — système de design</h1>
<p>Généré depuis <code>src/style.css</code> et <code>src/batiment-icones.js</code> par <code>node tools/design-system.mjs</code> ; un test vérifie qu'elle est à jour. Les règles d'usage : <code>docs/en/interface.md</code> (et sa version française).</p>

<h2 class="titre">Couleurs</h2>
<p class="chapo">Toute couleur d'interface est un jeton. Quatre rendus redéfinissent les mêmes jetons : Sombre (par défaut), Clair, et le contraste renforcé de chacun. L'orange <code>--accent</code> est la couleur de marque : il ne sert qu'à ce qui crée, valide ou est choisi.</p>
<div class="themes">${liste.map(([n, c, j]) => nuancier(n, c, j)).join('')}</div>

<h2 class="titre">Boutons : la couleur dit ce que fait le bouton</h2>
<table><tr><th>Couleur</th><th>Classe</th><th>Rôle</th><th>Exemples</th></tr>
<tr><td><span class="pastille" style="display:inline-block;background:#FF7A45"></span> Orange</td><td><code>.full-btn</code></td><td>valider, créer</td><td>Enregistrer, Appliquer, Ajouter un étage</td></tr>
<tr><td><span class="pastille" style="display:inline-block;background:#4A4B52"></span> Gris</td><td><code>.nav-btn</code></td><td>naviguer, agir sans créer</td><td>Annuler, Quitter, Recadrer</td></tr>
<tr><td><span class="pastille" style="display:inline-block;background:#D9534F"></span> Rouge</td><td><code>.delete-btn</code></td><td>supprimer</td><td>Supprimer l'escalier</td></tr>
<tr><td><span class="pastille" style="display:inline-block;background:#E8B84B"></span> Jaune</td><td><code>.edit-btn</code></td><td>renommer, éditer</td><td>Renommer</td></tr></table>
<p class="chapo" style="margin-top:10px">Désactivé : gris foncé quelle que soit la classe. Le survol d'un bouton gris n'est jamais orange.</p>

<h2 class="titre">Typographie</h2>
<p class="chapo">Une seule famille pour l'interface : <b>Inter</b>, embarquée dans l'application (les polices de lettrage des Bulles sont un autre sujet).</p>
<table><tr><th>Usage</th><th>Taille</th><th>Graisse</th><th>Encre</th><th>Aperçu</th></tr>
<tr><td>Titre de menu</td><td>16 px</td><td>700</td><td><code>--ink</code></td><td style="font-size:16px;font-weight:700">Éditeur de bâtiment</td></tr>
<tr><td>Titre de section</td><td>11 px, capitales, +0,05 em</td><td>600</td><td><code>--ink-soft</code></td><td style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#888">Escalier sélectionné</td></tr>
<tr><td>Titre de sous-section</td><td>13 px</td><td>600</td><td><code>--ink-mid</code></td><td style="font-size:13px;font-weight:600;color:#555">Dimensions</td></tr>
<tr><td>Bouton</td><td>12,5 px (11,5 dans une rangée)</td><td>600 orange, 400 gris</td><td></td><td style="font-size:12.5px;font-weight:600">Enregistrer dans la bibliothèque</td></tr>
<tr><td>Libellé, texte</td><td>12 px</td><td>400</td><td><code>--ink</code></td><td style="font-size:12px">Largeur</td></tr>
<tr><td>Commandes</td><td>12 px, une action par ligne</td><td>400</td><td><code>--ink-soft</code></td><td style="font-size:12px;color:#888">Molette : changer de type.</td></tr></table>

<h2 class="titre">Espacements et rayons</h2>
<table><tr><th>Écart</th><th></th><th>Entre</th></tr>
<tr><td>14 px</td><td><span class="barre" style="width:56px"></span></td><td>deux sections ; dernière section et boutons du bas</td></tr>
<tr><td>10 px</td><td><span class="barre" style="width:40px"></span></td><td>deux sous-sections ; sous-section et champ qui suit</td></tr>
<tr><td>8 px</td><td><span class="barre" style="width:32px"></span></td><td>rangées d'une sous-section (son gap seul)</td></tr>
<tr><td>6 px</td><td><span class="barre" style="width:24px"></span></td><td>deux boutons voisins ou empilés</td></tr></table>
<p></p>
<table><tr><th>Rayon</th><th></th><th>Pour</th></tr>
<tr><td>10 px</td><td><span class="rayon" style="border-radius:10px"></span></td><td>section</td></tr>
<tr><td>7 px</td><td><span class="rayon" style="border-radius:7px"></span></td><td>bouton, ligne de liste, grand champ</td></tr>
<tr><td>6 px</td><td><span class="rayon" style="border-radius:6px"></span></td><td>bouton de choix, petit champ</td></tr>
<tr><td>5 px</td><td><span class="rayon" style="border-radius:5px"></span></td><td>sous-section</td></tr></table>

<h2 class="titre">Composants du menu de droite</h2>
<p class="chapo">Un seul menu : sections permanentes, une section contextuelle ajoutée au besoin, Commandes selon l'outil et la sélection, boutons de sortie toujours en bas. Les choix sont des icônes au trait sans libellé (nom en infobulle) ; l'actif est orange, l'impossible grisé avec sa raison en infobulle.</p>
<div class="specimens">${liste.map(([n, , j]) => specimen(n, j)).join('')}</div>

<h2 class="titre">Icônes</h2>
<p class="chapo">Au trait, 1,6 px, en <code>currentColor</code>. Dessinées dans la vue où la différence se lit : de dessus pour le plan, de face pour les ouvertures, de profil pour les marches.</p>
<div class="specimen" style="${vars(liste[0][2])};width:auto">${Object.entries(ICONES).map(([g, o]) => `<p class="specimen-nom" style="text-align:left;margin:8px 0 4px">${g}</p>${choix(Object.entries(o).map(([k, v]) => [v, k]), -1)}`).join('')}</div>

<h2 class="titre">Règles d'usage, en bref</h2>
<ul class="regles">
<li>Aucun message d'état dans un menu : un refus se voit en rouge dans l'aperçu, une réussite dans l'état du bouton, un échec grave en modale.</li>
<li>Une infobulle nomme, elle n'est pas contextuelle ; seule exception, la raison d'un choix impossible. Un raccourci s'écrit entre parenthèses à la fin.</li>
<li>Mêmes gestes d'un outil à l'autre : clic pose et sélectionne, clic droit tourne, molette change le type, Ctrl + molette zoome, Alt sans aimant, Échap recule d'un cran.</li>
<li>Jamais deux modales d'affilée ; une modale qui bloque liste les causes et propose de les résoudre ; ses boutons sont courts.</li>
<li>Libellés courts ; un terme peu clair est remplacé et expliqué en infobulle.</li>
</ul>
</main></body></html>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(RACINE, 'docs/design-system.html'), page());
  console.log('docs/design-system.html écrit.');
}
