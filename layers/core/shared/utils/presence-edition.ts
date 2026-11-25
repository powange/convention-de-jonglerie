/**
 * Ce que l'on doit à quelqu'un qui se trouve physiquement sur une édition.
 *
 * Deux questions distinctes de la géolocalisation, qui répond au « où » :
 *  — **quand** : une édition ne se limite pas à ses dates publiques. Le montage la précède et le
 *    démontage la suit, parfois de plusieurs jours, et il s'y trouve du monde.
 *  — **qui** : sur le terrain, un organisateur, un bénévole et un visiteur ne viennent pas
 *    chercher la même chose.
 *
 * La règle est tranchée une seule fois, sur le serveur : il ne renvoie que les éditions qui
 * concernent réellement la personne, et la destination avec. Le client se contente de l'appliquer.
 * Répartie entre les deux, elle divergerait — et le serveur annoncerait une édition vers laquelle
 * le client ne saurait pas rediriger.
 *
 * Le fichier vit dans `shared/` parce que la règle est une règle de domaine, pure et sans accès
 * aux données : elle s'éprouve unitairement, sans harnais serveur.
 */

export type PeriodeEdition = 'montage' | 'evenement' | 'demontage'

export interface BornesEditionPresence {
  startDate: Date | string
  endDate: Date | string
  /** Début du montage, facultatif. Absent, le montage n'existe pas pour cette édition. */
  setupStartDate?: Date | string | null
  /** Fin du démontage, facultatif. Absent, le démontage n'existe pas pour cette édition. */
  teardownEndDate?: Date | string | null
}

const versDate = (valeur: Date | string | null | undefined): Date | null => {
  if (!valeur) return null
  const date = valeur instanceof Date ? valeur : new Date(valeur)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Dans quelle période de l'édition se situe l'instant donné — `null` en dehors de toutes.
 *
 * Les bornes de montage et de démontage sont facultatives : sans elles, seules les dates
 * publiques comptent, ce qui revient au comportement d'avant. C'est le même repli que
 * `meals-service` applique déjà pour les repas.
 */
export function periodeEdition(
  maintenant: Date,
  bornes: BornesEditionPresence
): PeriodeEdition | null {
  const debut = versDate(bornes.startDate)
  const fin = versDate(bornes.endDate)
  if (!debut || !fin) return null

  if (maintenant >= debut && maintenant <= fin) return 'evenement'

  const montage = versDate(bornes.setupStartDate)
  if (montage && maintenant >= montage && maintenant < debut) return 'montage'

  const demontage = versDate(bornes.teardownEndDate)
  if (demontage && maintenant > fin && maintenant <= demontage) return 'demontage'

  return null
}

export interface RolesSurPlace {
  estOrganisateur: boolean
  estBenevole: boolean
}

/**
 * Où emmener quelqu'un présent sur le site — `null` s'il n'y a rien à lui proposer.
 *
 * L'ordre n'est pas indifférent :
 *
 * — **Organisateur d'abord**, quelle que soit la période. Sur place, il travaille ; la page de
 *   gestion est son point d'entrée, et elle mène au reste, module bénévoles compris. Un
 *   organisateur qui est aussi bénévole y perd un clic vers son planning, contre bien davantage
 *   s'il fallait ressortir de la page publique pour administrer quoi que ce soit.
 * — **Bénévole ensuite** : sur place, c'est son planning qu'il vient chercher, pas la
 *   présentation de l'édition.
 * — **Le public en dernier, et seulement pendant l'événement.** Pendant le montage ou le
 *   démontage, la convention n'est pas ouverte : y envoyer un visiteur géolocalisé sur le
 *   terrain n'aurait aucun sens. Il ne se voit donc rien proposer.
 */
export function destinationSurPlace(
  editionId: number,
  periode: PeriodeEdition,
  roles: RolesSurPlace
): string | null {
  if (roles.estOrganisateur) return `/editions/${editionId}/gestion`
  if (roles.estBenevole) return `/editions/${editionId}/volunteers`
  if (periode === 'evenement') return `/editions/${editionId}`
  return null
}
