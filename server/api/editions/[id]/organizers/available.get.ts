import { getEmailHash } from '@@/server/utils/email-hash'
import { canManageEditionOrganizers } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    const session = await requireUserSession(event)
    const user = session.user
    const editionId = validateEditionId(event)

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
      // Récupérer tous les organisateurs de la convention
      const conventionOrganizers = await prisma.conventionOrganizer.findMany({
        where: {
          conventionId: edition.conventionId,
        },
        select: {
          id: true,
          title: true,
          user: {
            select: {
              id: true,
              pseudo: true,
              prenom: true,
              nom: true,
              email: true,
              profilePicture: true,
            },
          },
          editionOrganizers: {
            where: {
              editionId: editionId,
            },
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          user: {
            nom: 'asc',
          },
        },
      })

      // Filtrer pour ne garder que ceux qui n'ont pas d'EditionOrganizer pour cette édition
      const availableOrganizers = conventionOrganizers.filter(
        (organizer) => organizer.editionOrganizers.length === 0
      )

      return {
        success: true,
        organizers: availableOrganizers.map((organizer) => ({
          id: organizer.id,
          title: organizer.title,
          user: {
            id: organizer.user.id,
            pseudo: organizer.user.pseudo,
            prenom: organizer.user.prenom,
            nom: organizer.user.nom,
            email: organizer.user.email,
            emailHash: getEmailHash(organizer.user.email),
            profilePicture: organizer.user.profilePicture,
          },
        })),
        total: availableOrganizers.length,
      }
    } catch (error: unknown) {
      console.error('Database error fetching available organizers:', error)
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des organisateurs disponibles',
      })
    }
  },
  { operationName: 'GET available organizers' }
)
