import { canManageEditionOrganizers } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    const session = await requireUserSession(event)
    const user = session.user
    const editionId = validateEditionId(event)
    const editionOrganizerId = parseInt(getRouterParam(event, 'editionOrganizerId') || '0')

    if (!editionOrganizerId || isNaN(editionOrganizerId)) {
      throw createError({
        statusCode: 400,
        message: "ID d'EditionOrganizer invalide",
      })
    }

    // Récupérer l'édition avec permissions
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            organizers: {
              where: {
                userId: user.id,
              },
            },
          },
        },
        organizerPermissions: {
          where: {
            organizer: {
              userId: user.id,
            },
          },
          include: {
            organizer: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Edition not found',
      })
    }

    // Vérifier les permissions
    if (!canManageEditionOrganizers(edition, user)) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour gérer les organisateurs",
      })
    }

    try {
      // Vérifier que l'EditionOrganizer existe et appartient à cette édition
      const editionOrganizer = await prisma.editionOrganizer.findFirst({
        where: {
          id: editionOrganizerId,
          editionId: editionId,
        },
      })

      if (!editionOrganizer) {
        throw createError({
          statusCode: 404,
          message: 'EditionOrganizer introuvable',
        })
      }

      // Supprimer l'EditionOrganizer
      await prisma.editionOrganizer.delete({
        where: {
          id: editionOrganizerId,
        },
      })

      return {
        success: true,
        message: "Organisateur retiré de l'édition avec succès",
      }
    } catch (error: unknown) {
      // Si c'est déjà une erreur HTTP, la relancer
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }

      console.error('Database error removing organizer from edition:', error)
      throw createError({
        statusCode: 500,
        message: "Erreur lors de la suppression de l'organisateur de l'édition",
      })
    }
  },
  { operationName: 'DELETE remove organizer from edition' }
)
