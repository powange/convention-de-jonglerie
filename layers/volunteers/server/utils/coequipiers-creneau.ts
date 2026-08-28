import type { Prisma } from '@prisma/client'

import { userWithProfileAndGravatarSelect } from '#server/utils/prisma-select-helpers'

/**
 * Les autres bénévoles d'un créneau, à joindre à la sélection Prisma d'un `VolunteerTimeSlot`.
 *
 * Savoir avec qui l'on tient un poste vaut bien l'heure et le lieu : c'est ce qui distingue un
 * créneau que l'on subit d'un créneau que l'on partage. L'intéressé est exclu de sa propre
 * liste — il sait déjà qu'il y sera.
 */
export const coequipiersSelect = (userId: number) =>
  ({
    where: { userId: { not: userId } },
    select: { user: { select: userWithProfileAndGravatarSelect } },
    orderBy: { user: { pseudo: 'asc' } },
  }) satisfies Prisma.VolunteerTimeSlot$assignmentsArgs

/** Un créneau tel que le rend Prisma avec `assignments: coequipiersSelect(...)`. */
type CreneauAvecAssignations<T> = T & {
  assignments: Array<{ user: Record<string, unknown> }>
}

/**
 * Remplace la relation brute `assignments` par une liste de bénévoles nommée pour ce qu'elle
 * est. Le front n'a que faire de la table de liaison ; et le nom `assignments`, laissé tel
 * quel, laisserait croire que l'intéressé y figure.
 */
export function avecCoequipiers<T extends object>(creneau: CreneauAvecAssignations<T>) {
  const { assignments, ...reste } = creneau
  return {
    ...reste,
    coVolunteers: assignments.map((assignation) => assignation.user),
  }
}
