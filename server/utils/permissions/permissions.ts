import { prisma } from '../prisma'

/**
 * Vérifie si un utilisateur a les permissions de modification sur une édition
 * (créateur de l'édition, auteur de la convention, collaborateur, ou admin global)
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

  // Récupérer l'édition avec la convention et les collaborateurs
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          collaborators: true,
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

  // Vérifier si l'utilisateur est un collaborateur de la convention
  const isCollaborator = edition.convention.collaborators.some((collab) => collab.userId === userId)

  return isCollaborator
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
