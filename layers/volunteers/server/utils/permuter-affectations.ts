/**
 * Permutation effective de deux affectations de bénévoles.
 *
 * Les deux lignes échangent leur `userId`. En transaction, parce qu'une permutation à moitié
 * appliquée laisserait deux créneaux faux — l'un sans personne, l'autre avec deux fois la même.
 *
 * Le compteur `assignedVolunteers` du créneau ne bouge pas : un entrant pour un sortant de chaque
 * côté.
 */
export interface AffectationAPermuter {
  id: string
  userId: number
  timeSlotId: string
}

/**
 * Vérifie qu'aucune des deux personnes ne tient DÉJÀ le créneau qu'elle recevrait.
 *
 * Cas réel sur un créneau à plusieurs places : la cible peut occuper à la fois le créneau qu'elle
 * cède et celui qu'on lui offre. La permutation lui en donnerait deux fois le même, ce que la
 * contrainte `@@unique([timeSlotId, userId])` refuserait — avec une erreur de base illisible
 * plutôt qu'un message.
 */
export async function permutationPossible(
  a: AffectationAPermuter,
  b: AffectationAPermuter
): Promise<boolean> {
  const collisions = await prisma.volunteerAssignment.count({
    where: {
      OR: [
        { timeSlotId: b.timeSlotId, userId: a.userId },
        { timeSlotId: a.timeSlotId, userId: b.userId },
      ],
      // Les deux lignes en cours de permutation ne sont pas des collisions avec elles-mêmes.
      id: { notIn: [a.id, b.id] },
    },
  })
  return collisions === 0
}

/**
 * Échange les titulaires des deux affectations.
 *
 * Deux écritures successives suffisent, sans valeur intermédiaire : la contrainte porte sur
 * `(timeSlotId, userId)` et les deux lignes ont des créneaux DIFFÉRENTS. Poser le titulaire de b
 * sur le créneau de a ne peut donc heurter que d'autres lignes — précisément celles que
 * `permutationPossible` vient d'écarter.
 *
 * À appeler après cette vérification, et dans la foulée : entre les deux, une affectation
 * concurrente pourrait apparaître. La transaction protège de l'écriture à moitié faite, pas de
 * cette course-là — le prix d'une vraie garantie serait un verrou sur la table, disproportionné
 * pour un geste aussi rare.
 */
export async function permuterAffectations(
  a: AffectationAPermuter,
  b: AffectationAPermuter
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.volunteerAssignment.update({ where: { id: a.id }, data: { userId: b.userId } })
    await tx.volunteerAssignment.update({ where: { id: b.id }, data: { userId: a.userId } })
  })
}
