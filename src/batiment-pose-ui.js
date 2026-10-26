/**
 * @file batiment-pose-ui.js
 * « DANS UN BÂTIMENT » (#454e) : depuis la fiche d'un Personnage ou d'un Objet, choisir un bâtiment
 * placé dans la même Case (ou Scène), puis un étage, puis une pièce, et y poser l'Élément.
 *
 * Le bouton REMPLIT les champs de la section Position (X, Y, Z) et décoche « Aimanté au Sol » (le
 * Sol de la Case est sous le rez-de-chaussée, pas sous un étage) : c'est Enregistrer qui applique,
 * comme pour toute la fiche. Annuler n'a donc rien bougé.
 *
 * Le bloc est construit ici, une fois par fiche, et glissé à la fin du corps de sa section Position.
 * Il disparaît quand la Case n'a aucun bâtiment où poser quoi que ce soit.
 */
import { estUnBatimentPlace, etagesEtPieces, pointDeLaPiece } from './batiment-element.js';
import { findOwningPanel, pointDuBatimentPlace3D, positionPoseeSur3D } from './scene3d.js';

/** Les bâtiments placés où l'on peut poser `obj` : ceux de sa Case, qui ont au moins une pièce. */
export function batimentsOuPoser(obj, page, panel = findOwningPanel(obj, page)){
  return ((page && page.objects) || []).filter(o => estUnBatimentPlace(o) && o !== obj
    && findOwningPanel(o, page) === panel && etagesEtPieces(o.batiment).length);
}

function remplir(select, items, garder){
  const avant = garder ? select.value : null;
  select.textContent = '';
  items.forEach(({ id, nom }) => {
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = nom;
    select.appendChild(opt);
  });
  if (avant && items.some(i => i.id === avant)) select.value = avant;
}

/**
 * Installe (au premier appel) et prépare le bloc d'une fiche. `prefixe` : 'persona' ou 'object'
 * (les ids des champs de la section Position en découlent). `hauteur()` : la hauteur réelle de
 * l'Élément au moment du clic (le champ Hauteur a pu changer depuis l'ouverture).
 */
export function preparerPoseDansUnBatiment({ prefixe, obj, page, traduire, hauteur, apres }){
  const champX = document.getElementById(prefixe + 'PosXInput');
  if (!champX) return;
  const corps = champX.closest('.modal-section-body');
  let bloc = document.getElementById(prefixe + 'BatimentPose');
  if (!bloc) {
    bloc = document.createElement('div');
    bloc.id = prefixe + 'BatimentPose';
    bloc.className = 'batiment-pose';
    bloc.innerHTML = `
      <label class="modal-field-label"></label>
      <div class="batiment-pose-listes">
        <select data-role="batiment"></select>
        <select data-role="etage"></select>
        <select data-role="piece"></select>
      </div>
      <button type="button" class="project-modal-btn nav-btn batiment-pose-btn"></button>`;
    corps.appendChild(bloc);
  }
  const [selB, selE, selP] = ['batiment', 'etage', 'piece'].map(r => bloc.querySelector(`[data-role="${r}"]`));
  const bouton = bloc.querySelector('button');
  bloc.querySelector('label').textContent = traduire('In a building', 'Dans un bâtiment');
  bouton.textContent = traduire('Place in this room', 'Poser dans cette pièce');
  selB.title = traduire('Building', 'Bâtiment');
  selE.title = traduire('Floor', 'Étage');
  selP.title = traduire('Room', 'Pièce');
  const panel = obj && page ? findOwningPanel(obj, page) : null;
  const batiments = panel ? batimentsOuPoser(obj, page, panel) : [];
  bloc.style.display = batiments.length ? '' : 'none';
  if (!batiments.length) return;
  const leBatiment = () => batiments.find(b => b.id === selB.value) || batiments[0];
  const etages = () => etagesEtPieces(leBatiment().batiment);
  const majPieces = (garder) => {
    const e = etages().find(x => x.id === selE.value) || etages()[0];
    remplir(selP, e ? e.pieces : [], garder);
  };
  const majEtages = (garder) => { remplir(selE, etages(), garder); majPieces(garder); };
  remplir(selB, batiments.map(b => ({ id: b.id, nom: b.name || traduire('Building', 'Bâtiment') })), true);
  majEtages(true);
  selB.onchange = () => majEtages(false);
  selE.onchange = () => majPieces(false);
  bouton.onclick = () => {
    const b = leBatiment();
    const local = pointDeLaPiece(b.batiment, selP.value);
    if (!local) return;
    const sol = pointDuBatimentPlace3D(b, panel, local);
    const v = positionPoseeSur3D(sol, hauteur());
    const arrondi = (n) => Math.round(n * 100) / 100;
    champX.value = arrondi(v.x);
    document.getElementById(prefixe + 'PosYInput').value = arrondi(v.y);
    document.getElementById(prefixe + 'DepthInput').value = arrondi(v.z);
    const aimant = document.getElementById(prefixe + 'GroundMagnetCheckbox');
    if (aimant && aimant.checked) {
      aimant.checked = false;
      aimant.dispatchEvent(new window.Event('change', { bubbles: true }));
    }
    if (apres) apres();
  };
}
