import { prisma } from '../prisma'

/**
 * Vérifie si un utilisateur a les permissions de modification sur une édition
 * (créateur de l'édition, auteur de la convention, organisateur, ou admin global)
 */
export async function hasEditionEditPermission(
  userId: number,
  editionId: number
): Promise<boolean> {
  // Vérifier si l'utilisateur est admin global
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGlobalAdmin: true },
  })

  if (user?.isGlobalAdmin) {
    return true
  }

  // Récupérer l'édition avec la convention et les organisateurs
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          organizers: true,
        },
      },
    },
  })

  if (!edition) {
    return false
  }

  // Vérifier si l'utilisateur est le créateur de l'édition
  if (edition.creatorId === userId) {
    return true
  }

  // Vérifier si l'utilisateur est l'auteur de la convention
  if (edition.convention.authorId === userId) {
    return true
  }

  // Vérifier si l'utilisateur est un organisateur de la convention
  const isOrganizer = edition.convention.organizers.some((collab) => collab.userId === userId)

  return isOrganizer
}

/**
 * Vérifie si un utilisateur a les permissions de suppression sur une édition
 * (mêmes permissions que pour la modification)
 */
export async function hasEditionDeletePermission(
  userId: number,
  editionId: number
): Promise<boolean> {
  return hasEditionEditPermission(userId, editionId)
}
