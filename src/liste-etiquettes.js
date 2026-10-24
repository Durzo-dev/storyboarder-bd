/**
 * @file liste-etiquettes.js
 * La LISTE D'ÉTIQUETTES d'un menu flottant : une ligne par étiquette (case à cocher, ✏️ renommer,
 * corbeille), puis un champ « Nouvelle… ». Écrite pour les tags de « Mes modèles » (store-ui.js),
 * reprise pour les USAGES des polices (polices-ui.js, demandé : « comme les tags du store ») : une
 * seule liste, pour que les deux se manient pareil.
 *
 * Ce que COCHER veut dire dépend de l'appelant (poser l'étiquette sur un objet, ou la mettre dans
 * le filtre), comme ce que créer, renommer et supprimer touchent : tout passe par les rappels.
 *
 *   etiquettes()                la liste à montrer, [{ id, nom }], déjà triée
 *   estCoche(e), cocher(e, actif)
 *   creer(nom) → { id?, erreur? }, renommer(e, nom) → { erreur? }, supprimer(e) (confirmation comprise)
 *   apresCreation(id)           facultatif : par exemple, poser aussitôt l'étiquette créée
 *   refaire()                   reconstruire après un changement
 *   textes                      { nouvelle, aucune, renommer, supprimer, erreurs: { vide, pris, inconnu } }
 */
import { noeudIcone } from './icones.js';

function el(tag, { texte, classe, attrs } = {}, enfants = []){
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  if (texte != null) n.textContent = texte;
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  enfants.filter(Boolean).forEach(c => n.appendChild(c));
  return n;
}


export function remplirListeEtiquettes(menu, { etiquettes, estCoche, cocher, creer, renommer, supprimer, apresCreation, refaire, textes }){
  const t = textes;
  const erreur = el('p', { classe: 'store-menu-erreur' });
  const ligneEtiquette = (e) => {
    const coche = el('input', { attrs: { type: 'checkbox' } });
    coche.checked = estCoche(e);
    coche.onchange = async () => { await cocher(e, coche.checked); refaire(); };
    const libelle = el('label', { classe: 'store-tag-coche' }, [coche, el('span', { texte: e.nom, classe: 'store-tag-nom' })]);
    const crayon = el('button', { classe: 'store-tag-outil', attrs: { type: 'button', title: t.renommer, 'aria-label': t.renommer } }, [noeudIcone('renommer')]);
    const corbeille = el('button', { classe: 'store-tag-outil store-tag-corbeille', attrs: { type: 'button', title: t.supprimer, 'aria-label': t.supprimer } }, [noeudIcone('supprimer')]);
    const ligne = el('div', { classe: 'store-tag-ligne' }, [libelle, crayon, corbeille]);
    crayon.onclick = () => {
      const champ = el('input', { classe: 'store-tag-champ', attrs: { type: 'text', maxlength: '40' } });
      champ.value = e.nom;
      ligne.replaceChildren(champ);
      champ.focus();
      champ.select();
      champ.onkeydown = async (ev) => {
        if (ev.key === 'Escape') { ev.stopPropagation(); refaire(); return; }
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        const r = await renommer(e, champ.value);
        if (r && r.erreur) { erreur.textContent = t.erreurs[r.erreur] || t.erreurs.vide; return; }
        refaire();
      };
    };
    corbeille.onclick = async () => {
      if (await supprimer(e) === false) return;
      refaire();
    };
    return ligne;
  };
  const nouvelle = el('input', { classe: 'store-tag-champ', attrs: { type: 'text', placeholder: t.nouvelle, maxlength: '40' } });
  nouvelle.onkeydown = async (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const r = await creer(nouvelle.value);
    if (!r || !r.id) { erreur.textContent = t.erreurs.vide; return; }
    if (apresCreation) await apresCreation(r.id);
    refaire();
  };
  const liste = etiquettes();
  menu.replaceChildren(
    ...(liste.length ? liste.map(ligneEtiquette) : [el('p', { texte: t.aucune, classe: 'store-menu-vide' })]),
    nouvelle,
    erreur,
  );
  setTimeout(() => nouvelle.focus(), 0);
}
