/**
 * @file orientation-champs.js
 * #463a, L'ORIENTATION DANS LES FENÊTRES D'ÉLÉMENT (Personnage, Objet, Pièce, Bâtiment placé) :
 * chaque curseur a, à côté, un CHAMP EN DEGRÉS qui le suit et le commande (demandé, comme le mobilier
 * de l'éditeur de bâtiment), et « Remettre droit » remet l'Inclinaison et la Bascule à zéro (la
 * Rotation reste : on redresse, on ne retourne pas).
 *
 * ⚠️ LES FENÊTRES ÉCRIVENT LEURS CURSEURS PAR `curseur.value = …` (à l'ouverture, au changement de
 * mur hôte…), sans événement. Plutôt que d'ajouter une ligne à chacun de ces endroits (et d'en oublier
 * un), le champ suit la PROPRIÉTÉ `value` du curseur : son écriture met le champ à jour. De même,
 * le champ prend l'état `disabled` de son curseur (une orientation gouvernée par un mur).
 */

const ChampHTML = globalThis.HTMLInputElement;
const DESCRIPTEUR = ChampHTML ? Object.getOwnPropertyDescriptor(ChampHTML.prototype, 'value') : null;
/** Un événement « input », comme un glissé de l'utilisateur. */
const saisie = () => new globalThis.Event('input', { bubbles: true });

/** Relie un curseur `id` à son champ `id + 'Deg'`, dans les deux sens. */
function relier(id){
  const curseur = document.getElementById(id), champ = document.getElementById(id + 'Deg');
  if (!curseur || !champ || curseur._champDeg) return;
  curseur._champDeg = champ;
  if (DESCRIPTEUR) {
    Object.defineProperty(curseur, 'value', {
      configurable: true,
      get(){ return DESCRIPTEUR.get.call(this); },
      set(v){ DESCRIPTEUR.set.call(this, v); champ.value = DESCRIPTEUR.get.call(this); },
    });
  }
  champ.value = curseur.value;
  champ.disabled = curseur.disabled;
  curseur.addEventListener('input', () => { champ.value = curseur.value; });
  // Le champ commande le curseur, borné à ±180°, et prévient comme un glissé (aperçu, enregistrement).
  champ.addEventListener('input', () => {
    const v = Math.round(Number(String(champ.value).replace(',', '.')));
    if (!Number.isFinite(v)) return;
    curseur.value = String(Math.max(-180, Math.min(180, v)));
    curseur.dispatchEvent(saisie());
  });
  const Observateur = globalThis.MutationObserver;
  if (Observateur) new Observateur(() => { champ.disabled = curseur.disabled; }).observe(curseur, { attributes: true, attributeFilter: ['disabled'] });
}

/** « Remettre droit » : l'Inclinaison (X) et la Bascule (Z) à zéro, la Rotation gardée. */
function redresser(boutonId, idX, idZ){
  const b = document.getElementById(boutonId);
  if (!b) return;
  b.addEventListener('click', () => {
    for (const id of [idX, idZ]) {
      const c = document.getElementById(id);
      if (!c || c.disabled) continue;
      c.value = '0';
      c.dispatchEvent(saisie());
    }
  });
}

/** Le câblage, une fois (events.js). */
export function cablerChampsDOrientation(){
  if (typeof document === 'undefined') return;
  for (const p of ['persona', 'object', 'room']) for (const a of ['X', 'Y', 'Z']) relier(`${p}Rot${a}Input`);
  ['buildingRotYInput', 'buildingRotXFixe', 'buildingRotZFixe'].forEach(relier);
  redresser('personaRedresserBtn', 'personaRotXInput', 'personaRotZInput');
  redresser('objectRedresserBtn', 'objectRotXInput', 'objectRotZInput');
  redresser('roomRedresserBtn', 'roomRotXInput', 'roomRotZInput');
}
