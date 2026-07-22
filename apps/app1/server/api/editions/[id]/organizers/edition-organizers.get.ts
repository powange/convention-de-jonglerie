import {
  canManageEditionOrganizers,
  canManageTicketing,
} from '#server/utils/permissions/edition-permissions'
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

    // Vérifier les permissions.
    // La liste des organisateurs de l'édition est consommée par DEUX features :
    // la gestion des organisateurs ET la billetterie (page handout-items, section
    // « articles spécifiques par organisateur »). On autorise donc les deux rôles :
    // gestionnaire d'organisateurs OU gestionnaire de billetterie.
    // Un gestionnaire billetterie (sans droit sur les organisateurs) n'accède qu'aux
    // infos non sensibles (voir le masquage email/téléphone plus bas).
    const canManageOrganizers = canManageEditionOrganizers(edition, user)
    if (!canManageOrganizers && !canManageTicketing(edition, user)) {
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
                  phone: true,
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
            pronouns: eo.organizer.user.pronouns,
            emailHash: eo.organizer.user.emailHash,
            profilePicture: eo.organizer.user.profilePicture,
            // Infos sensibles (email, téléphone) réservées aux gestionnaires
            // d'organisateurs. Masquées pour un accès via la billetterie (handout-items).
            ...(canManageOrganizers
              ? { email: eo.organizer.user.email, phone: eo.organizer.user.phone }
              : {}),
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
