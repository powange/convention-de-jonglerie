/**
 * Comment nommer quelqu'un à l'écran.
 *
 * ⚠️ CETTE RÈGLE EST ÉCRITE DIX-SEPT FOIS DANS LE DÉPÔT, sous au moins trois formes : certaines
 * retombent sur le seul prénom, d'autres sur l'adresse e-mail, d'autres encore s'arrêtent au
 * pseudo. Deux écrans voisins peuvent donc nommer la même personne différemment.
 *
 * 📍 Ce module ne reprend PAS les dix-sept : il donne un endroit où les ramener, et sert les
 * écrans qu'on touche. Réécrire les quinze autres d'un coup serait un lot en soi, et un lot
 * risqué — chaque appelant a sa forme d'objet.
 */

/** Ce qu'il faut d'un compte pour le nommer. Tout est facultatif : les listes en donnent peu. */
export interface PersonneAAfficher {
  pseudo?: string | null
  prenom?: string | null
  nom?: string | null
  email?: string | null
}

/**
 * Le nom à afficher, du plus parlant au plus technique.
 *
 * ⚠️ LE PSEUDO D'ABORD, parce que c'est sous ce nom qu'on se reconnaît dans cette application —
 * les bénévoles s'appellent entre eux par leur pseudo, pas par leur état civil. L'e-mail ne vient
 * qu'en dernier recours : c'est une donnée de contact, pas une identité, et l'afficher dans une
 * liste de tâches expose une adresse à qui n'en a pas besoin.
 *
 * Rend une chaîne VIDE plutôt que `null` : l'appelant l'insère dans un gabarit, et « null »
 * s'afficherait tel quel.
 */
export function nomAffichableDUnCompte(personne: PersonneAAfficher | null | undefined): string {
  if (!personne) return ''

  const pseudo = personne.pseudo?.trim()
  if (pseudo) return pseudo

  const etatCivil = [personne.prenom, personne.nom]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
  if (etatCivil) return etatCivil

  return personne.email?.trim() ?? ''
}

/**
 * Le nom COMPLET : pseudo et état civil, quand les deux existent.
 *
 * Pour les écrans où l'on choisit quelqu'un — un sélecteur d'assignation — et où le pseudo seul ne
 * suffit pas à trancher entre deux homonymes. Ailleurs, `nomAffichableDUnCompte` est plus sobre.
 */
export function nomCompletDUnCompte(personne: PersonneAAfficher | null | undefined): string {
  if (!personne) return ''

  const pseudo = personne.pseudo?.trim()
  const etatCivil = [personne.prenom, personne.nom]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')

  if (pseudo && etatCivil) return `${pseudo} · ${etatCivil}`
  return pseudo || etatCivil || personne.email?.trim() || ''
}
