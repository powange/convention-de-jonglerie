/**
 * Un créneau est-il encore à pourvoir ?
 *
 * Sert à signaler d'un coup d'œil, sur le planning, les créneaux dont la jauge n'est pas remplie —
 * ceux sur lesquels il reste du monde à placer.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Ce qu'il faut connaître d'un créneau pour juger de son remplissage. */
export interface CreneauPourRemplissage {
  maxVolunteers?: number | null
  /** Bénévoles affectés. */
  assignedVolunteers?: number | null
  /** Organisateurs affectés : ils occupent une place eux aussi. */
  assignedOrganizersList?: readonly unknown[] | null
}

/**
 * Combien de personnes tiennent ce créneau, tous titres confondus.
 *
 * Bénévoles ET organisateurs : un organisateur occupe une place, et l'oublier ferait paraître
 * libre un créneau déjà complet. La même addition vit côté serveur dans `places-creneau.ts`, qui
 * en répond pour les refus d'affectation ; celle-ci ne sert qu'à l'affichage.
 */
export function placesOccupees(creneau: CreneauPourRemplissage): number {
  return (creneau.assignedVolunteers ?? 0) + (creneau.assignedOrganizersList?.length ?? 0)
}

/**
 * Le créneau réclame-t-il encore du monde ?
 *
 * Faux quand aucun maximum n'est fixé : sans jauge, il n'y a pas d'objectif à atteindre, et tout
 * marquer serait du bruit. Faux aussi au-delà du maximum — un créneau en dépassement n'est pas
 * incomplet.
 *
 * @param creneau     le créneau, avec ses affectations
 * @param horsCharge  vrai pour un créneau d'équipe volante ou autonome. Ces créneaux sont
 *                    délibérément hors des « heures à pourvoir » de l'édition : personne d'autre
 *                    ne viendra les couvrir, et les signaler comme incomplets ferait paraître
 *                    l'édition sous-dotée alors qu'il ne manque rien — le même raisonnement que
 *                    pour les statistiques, où il est déjà appliqué.
 */
export function creneauAPourvoir(creneau: CreneauPourRemplissage, horsCharge = false): boolean {
  if (horsCharge) return false

  const maximum = creneau.maxVolunteers
  if (!maximum || maximum <= 0) return false

  return placesOccupees(creneau) < maximum
}
