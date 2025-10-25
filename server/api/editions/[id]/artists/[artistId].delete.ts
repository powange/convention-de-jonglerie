import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const artistId = parseInt(getRouterParam(event, 'artistId') || '0')

  if (!editionId || !artistId) {
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
      message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
    })
  }

  try {
    // Vérifier que l'artiste existe et appartient à cette édition
    const existingArtist = await prisma.editionArtist.findFirst({
      where: {
        id: artistId,
        editionId,
      },
    })

    if (!existingArtist) {
      throw createError({
        statusCode: 404,
        message: 'Artiste non trouvé',
      })
    }

    // Supprimer l'artiste (les associations avec les spectacles seront supprimées en cascade)
    await prisma.editionArtist.delete({
      where: { id: artistId },
    })

    return {
      success: true,
      message: 'Artiste supprimé avec succès',
    }
  } catch (error: unknown) {
    if ((error as any).statusCode) {
      throw error
    }

    console.error("Erreur lors de la suppression de l'artiste:", error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la suppression de l'artiste",
    })
  }
})
