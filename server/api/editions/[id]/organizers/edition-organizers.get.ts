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
      // Récupérer tous les EditionOrganizer pour cette édition
      const editionOrganizers = await prisma.editionOrganizer.findMany({
        where: {
          editionId: editionId,
        },
        select: {
          id: true,
          organizerId: true,
          entryValidated: true,
          entryValidatedAt: true,
          createdAt: true,
          organizer: {
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
            },
          },
        },
        orderBy: {
          organizer: {
            user: {
              nom: 'asc',
            },
          },
        },
      })

      return {
        success: true,
        organizers: editionOrganizers.map((eo) => ({
          id: eo.id,
          organizerId: eo.organizerId,
          entryValidated: eo.entryValidated,
          entryValidatedAt: eo.entryValidatedAt,
          createdAt: eo.createdAt,
          title: eo.organizer.title,
          user: {
            id: eo.organizer.user.id,
            pseudo: eo.organizer.user.pseudo,
            prenom: eo.organizer.user.prenom,
            nom: eo.organizer.user.nom,
            email: eo.organizer.user.email,
            profilePicture: eo.organizer.user.profilePicture,
          },
        })),
        total: editionOrganizers.length,
      }
    } catch (error: unknown) {
      console.error('Database error fetching edition organizers:', error)
      throw createError({
        statusCode: 500,
        message: "Erreur lors de la récupération des organisateurs de l'édition",
      })
    }
  },
  { operationName: 'GET edition organizers' }
)
