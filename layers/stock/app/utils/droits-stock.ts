/**
 * Qui peut gérer le stock, vu de l'écran.
 *
 * Cette règle vivait recopiée à l'identique dans trois pages du module — la liste des groupes, la
 * page d'un groupe, la fiche d'un objet. Elle allait l'être une quatrième fois pour la page des
 * manquants : c'est ainsi qu'une règle finit écrite partout et corrigée à un endroit.
 *
 * ⚠️ Ce n'est PAS une garde de sécurité. Le serveur décide seul, dans `edition-permissions` ; ce
 * calcul ne sert qu'à ne pas montrer des boutons qui rendraient une erreur 403. Un écran qui
 * affiche un champ de saisie à quelqu'un qui n'a pas le droit d'enregistrer ne ment pas sur les
 * droits — il fait juste perdre son temps, et donne à croire à un défaut.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Un collaborateur de la convention, réduit à ce que la règle lit. */
export interface CollaborateurDuStock {
  user?: { id?: number | null } | null
  rights?: { manageStock?: boolean | null; editConvention?: boolean | null } | null
  perEditionRights?: Array<{
    editionId: number
    canManageStock?: boolean | null
    canEdit?: boolean | null
  }> | null
}

/** L'édition, réduite à ce que la règle lit. */
export interface EditionPourDroitsStock {
  id: number
  creatorId?: number | null
  convention?: {
    authorId?: number | null
    organizers?: CollaborateurDuStock[] | null
  } | null
}

/**
 * Cette personne peut-elle gérer le stock de cette édition&nbsp;?
 *
 * Quatre portes, de la plus large à la plus étroite : le mode administrateur, la création de
 * l'édition, la propriété de la convention, puis les droits d'un collaborateur — généraux
 * (`manageStock` ou `editConvention`, car qui peut tout modifier peut modifier le stock) ou
 * accordés pour cette édition-là seulement.
 *
 * Sans édition ou sans utilisateur, la réponse est NON : une donnée manquante ne doit pas ouvrir
 * ce qu'un droit fermerait. C'est le même principe que le réglage des réservations par groupe.
 */
export function peutGererLeStock(
  edition: EditionPourDroitsStock | null | undefined,
  userId: number | null | undefined,
  modeAdminActif = false
): boolean {
  if (!edition || !userId) return false
  if (modeAdminActif) return true
  if (edition.creatorId === userId) return true
  if (edition.convention?.authorId === userId) return true

  const collaborateurs = edition.convention?.organizers ?? []
  return collaborateurs.some((collaborateur) => {
    if (collaborateur.user?.id !== userId) return false
    if (collaborateur.rights?.manageStock || collaborateur.rights?.editConvention) return true

    const pourCetteEdition = collaborateur.perEditionRights?.find(
      (droit) => droit.editionId === edition.id
    )
    return !!(pourCetteEdition?.canManageStock || pourCetteEdition?.canEdit)
  })
}
