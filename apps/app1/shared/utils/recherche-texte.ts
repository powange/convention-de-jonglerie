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

/**
 * Tous les mots cherchés se trouvent-ils, dans un ordre quelconque&nbsp;?
 *
 * La différence avec `contientLaSaisie` est le propos même de cette fonction : « salle location »
 * doit trouver « Location salle », que la saisie d'un bloc manquerait. On tape ce dont on se
 * souvient, pas ce qui est écrit.
 *
 * Les champs sont joints avant la comparaison : un mot dans le titre et un autre dans la
 * description suffisent ensemble. C'est ce qu'attend une recherche qui annonce porter sur les
 * deux.
 *
 * Une saisie vide laisse tout passer : c'est l'état au repos du champ, pas un filtre.
 */
export function contientTousLesMots(
  saisie: string | null | undefined,
  ...champs: (string | null | undefined)[]
): boolean {
  const mots = motsDeLaRequete(saisie)
  if (mots.length === 0) return true

  const valeur = champs.map(normaliserTexte).join(' ')
  return mots.every((mot) => valeur.includes(mot))
}
