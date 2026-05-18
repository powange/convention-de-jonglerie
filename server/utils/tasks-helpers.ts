import { canManageTasks, type EditionWithPermissions } from './permissions/edition-permissions'

import type { UserForPermissions } from './permissions/types'

/**
 * Vérifie si un utilisateur peut commenter une tâche :
 * - soit il a le droit `canManageTasks` (organisateurs)
 * - soit il est assigné à la tâche
 */
export function canCommentTask(
  edition: EditionWithPermissions,
  user: UserForPermissions,
  taskAssigneeIds: number[]
): boolean {
  if (canManageTasks(edition, user)) return true
  return taskAssigneeIds.includes(user.id)
}

/**
 * Vérifie que tous les `assigneeIds` correspondent à des utilisateurs
 * réellement assignables sur l'édition donnée :
 * - auteur de la convention
 * - créateur de l'édition
 * - organisateurs de la convention (peu importe les droits)
 * - bénévoles dont la candidature est ACCEPTED sur cette édition
 *
 * Lève createError(400) si des IDs sont invalides.
 */
export async function assertAssigneesAreAssignable(
  editionId: number,
  assigneeIds: number[]
): Promise<void> {
  if (assigneeIds.length === 0) return

  const uniqueIds = [...new Set(assigneeIds)]

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: {
      creatorId: true,
      conventionId: true,
      convention: { select: { authorId: true } },
    },
  })
  if (!edition) {
    throw createError({ status: 404, message: 'Édition non trouvée' })
  }

  const allowed = new Set<number>()
  if (edition.creatorId) allowed.add(edition.creatorId)
  if (edition.convention.authorId) allowed.add(edition.convention.authorId)

  const organizers = await prisma.conventionOrganizer.findMany({
    where: { conventionId: edition.conventionId, userId: { in: uniqueIds } },
    select: { userId: true },
  })
  for (const o of organizers) allowed.add(o.userId)

  const acceptedVolunteers = await prisma.editionVolunteerApplication.findMany({
    where: { editionId, status: 'ACCEPTED', userId: { in: uniqueIds } },
    select: { userId: true },
  })
  for (const v of acceptedVolunteers) allowed.add(v.userId)

  const invalid = uniqueIds.filter((id) => !allowed.has(id))
  if (invalid.length > 0) {
    throw createError({
      status: 400,
      message: `Certains utilisateurs ne peuvent pas être assignés à cette tâche (ids invalides: ${invalid.join(', ')})`,
    })
  }
}
