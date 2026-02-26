import { canManageEditionOrganizers } from '#server/utils/permissions/edition-permissions'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'

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
        status: 404,
        message: 'Edition not found',
      })
    }

    // Vérifier les permissions
    if (!canManageEditionOrganizers(edition, user)) {
      throw createError({
        status: 403,
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
                  ...userWithNameSelect,
                  email: true,
                  emailHash: true,
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

      return createSuccessResponse({
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
            emailHash: eo.organizer.user.emailHash,
            profilePicture: eo.organizer.user.profilePicture,
          },
        })),
        total: editionOrganizers.length,
      })
    } catch (error: unknown) {
      console.error('Database error fetching edition organizers:', error)
      throw createError({
        status: 500,
        message: "Erreur lors de la récupération des organisateurs de l'édition",
      })
    }
  },
  { operationName: 'GET edition organizers' }
)
