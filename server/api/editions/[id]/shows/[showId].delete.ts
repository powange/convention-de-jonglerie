import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const showId = parseInt(getRouterParam(event, 'showId') || '0')

  if (!editionId || !showId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  // Vérifier les permissions
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          collaborators: true,
        },
      },
      collaboratorPermissions: {
        include: {
          collaborator: true,
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      message: 'Édition non trouvée',
    })
  }

  const hasPermission = canEditEdition(edition, user)
  if (!hasPermission) {
    throw createError({
      statusCode: 403,
      message: "Vous n'êtes pas autorisé à gérer les spectacles de cette édition",
    })
  }

  try {
    // Vérifier que le spectacle existe et appartient à cette édition
    const existingShow = await prisma.show.findFirst({
      where: {
        id: showId,
        editionId,
      },
    })

    if (!existingShow) {
      throw createError({
        statusCode: 404,
        message: 'Spectacle non trouvé',
      })
    }

    // Supprimer le spectacle (les associations avec les artistes seront supprimées en cascade)
    await prisma.show.delete({
      where: { id: showId },
    })

    return {
      success: true,
      message: 'Spectacle supprimé avec succès',
    }
  } catch (error: unknown) {
    if ((error as any).statusCode) {
      throw error
    }

    console.error('Erreur lors de la suppression du spectacle:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la suppression du spectacle',
    })
  }
})
