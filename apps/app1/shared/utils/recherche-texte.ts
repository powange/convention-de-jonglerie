/**
 * Comparer deux textes comme un humain les lit.
 *
 * Une recherche qui distingue « reserver » de « Réserver » ne trouve rien sur un clavier de
 * téléphone, où les accents demandent un appui long : c'est le cas courant, pas l'exception.
 *
 * ⚠️ Ici plutôt que dans un layer, et c'est le point de ce fichier. La règle vivait dans
 * `layers/stock`, dont le commentaire avertissait déjà que « deux copies finissent toujours par
 * diverger sur un caractère ». Le module Tâches, qui ne peut pas dépendre du module Stock, en
 * aurait écrit une seconde — et les deux écrans se seraient mis à ne pas trouver les mêmes choses.
 * `shared/` est le seul endroit que tous les layers atteignent.
 */

/** Réduit un texte à sa forme comparable : sans accent, sans casse, sans espaces superflus. */
export function normaliserTexte(valeur: string | null | undefined): string {
  return (valeur ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Les mots d'une saisie, normalisés, les vides écartés. */
export function motsDeLaRequete(requete: string | null | undefined): string[] {
  return normaliserTexte(requete)
    .split(/\s+/)
    .filter((mot) => mot.length > 0)
}

/**
 * L'un des champs contient-il la saisie&nbsp;?
 *
 * La saisie est cherchée d'un bloc, accents et casse ignorés — et non découpée en mots comme le
 * fait l'inventaire du matériel. La différence est voulue : on tape ici le début d'un titre qu'on
 * a sous les yeux, pas deux qualités qu'on croise pour retrouver un objet rangé quelque part.
 *
 * Une saisie vide laisse tout passer : c'est l'état au repos du champ de recherche, pas un filtre.
 */
export function contientLaSaisie(
  saisie: string | null | undefined,
  ...champs: (string | null | undefined)[]
): boolean {
  const terme = normaliserTexte(saisie)
  if (!terme) return true

  return champs.some((champ) => normaliserTexte(champ).includes(terme))
}
