import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { optionalAuth } from '@@/server/utils/auth-utils'
import { checkAdminMode } from '@@/server/utils/organizer-management'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      include: {
        creator: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
            updatedAt: true,
            emailHash: true,
          },
        },
        attendingUsers: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
            updatedAt: true,
            emailHash: true,
          },
        },
        // Champs bénévolat nécessaires pour la page de gestion
        _count: {
          select: {
            volunteerApplications: true,
            showCalls: true,
          },
        },
        // Champs bénévolat simples sur le modèle Edition (inclus automatiquement, rien à faire)
        // Champs bénévolat (valeurs)
        volunteerApplications: false,
        // organizerPermissions: permet de gérer les droits spécifiques par édition
        // Pour l'instant on n'inclut pas, on utilise juste convention.organizers
        convention: {
          include: {
            organizers: {
              include: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                    emailHash: true,
                    profilePicture: true,
                    updatedAt: true,
                  },
                },
                perEditionPermissions: true,
              },
            },
          },
        },
        editionOrganizers: {
          include: {
            organizer: {
              include: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                    emailHash: true,
                    profilePicture: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
      },
      errorMessage: 'Edition not found',
    })

    // Check access based on edition status
    // PUBLISHED, PLANNED, and CANCELLED are publicly accessible
    // OFFLINE editions are only accessible to organizers/creators/admins
    if (edition.status === 'OFFLINE') {
      // Check if user is authenticated
      const user = optionalAuth(event)
      if (!user) {
        throw createError({
          status: 404,
          message: 'Edition not found',
        })
      }

      // Normalize user id to number to avoid string/number mismatches
      const userId = Number(user.id)
      const isAdminMode = await checkAdminMode(userId, event)
      const isCreator = edition.creatorId === userId
      const isConventionAuthor = edition.convention.authorId === userId
      const isOrganizer = edition.convention.organizers?.some((c) => c.userId === userId)

      // Les éditions orphelines (sans créateur et sans auteur de convention) sont considérées comme publiques
      const isOrphanEdition = !edition.creatorId && !edition.convention.authorId

      if (!isAdminMode && !isCreator && !isConventionAuthor && !isOrganizer && !isOrphanEdition) {
        throw createError({
          status: 404,
          message: 'Edition not found',
        })
      }
    }

    // Transformer les organisateurs de la convention pour construire l'objet rights
    if (edition?.convention?.organizers) {
      edition.convention.organizers = edition.convention.organizers.map((collab) => ({
        ...collab,
        // Construire un objet rights cohérent (si les colonnes existent)
        rights: {
          editConvention: collab.canEditConvention ?? false,
          deleteConvention: collab.canDeleteConvention ?? false,
          manageOrganizers: collab.canManageOrganizers ?? false,
          manageVolunteers: collab.canManageVolunteers ?? false,
          addEdition: collab.canAddEdition ?? false,
          editAllEditions: collab.canEditAllEditions ?? false,
          deleteAllEditions: collab.canDeleteAllEditions ?? false,
        },
        // Transformer les droits par édition
        perEditionRights: (collab.perEditionPermissions || []).map((per) => ({
          editionId: per.editionId,
          canEdit: per.canEdit ?? false,
          canDelete: per.canDelete ?? false,
          canManageVolunteers: per.canManageVolunteers ?? false,
        })),
        user: collab.user,
      }))
    }

    // Retourner l'édition en excluant les champs volunteersAsk* qui sont maintenant gérés par l'API /volunteers/settings
    const {
      volunteersAskDiet: _volunteersAskDiet,
      volunteersAskAllergies: _volunteersAskAllergies,
      volunteersAskTimePreferences: _volunteersAskTimePreferences,
      volunteersAskTeamPreferences: _volunteersAskTeamPreferences,
      volunteersAskPets: _volunteersAskPets,
      volunteersAskMinors: _volunteersAskMinors,
      volunteersAskVehicle: _volunteersAskVehicle,
      volunteersAskCompanion: _volunteersAskCompanion,
      volunteersAskAvoidList: _volunteersAskAvoidList,
      volunteersAskSkills: _volunteersAskSkills,
      volunteersAskExperience: _volunteersAskExperience,
      volunteersAskSetup: _volunteersAskSetup,
      volunteersAskTeardown: _volunteersAskTeardown,
      volunteersAskEmergencyContact: _volunteersAskEmergencyContact,
      ...editionWithoutVolunteersAskFields
    } = edition

    return {
      ...editionWithoutVolunteersAskFields,
      // Garder seulement les champs volunteers encore utilisés côté client
      volunteersOpen: edition.volunteersOpen,
      volunteersDescription: edition.volunteersDescription,
      volunteersMode: edition.volunteersMode,
      volunteersExternalUrl: edition.volunteersExternalUrl,
      volunteersUpdatedAt: edition.volunteersUpdatedAt,
      volunteersSetupStartDate: edition.volunteersSetupStartDate,
      volunteersTeardownEndDate: edition.volunteersTeardownEndDate,
    }
  },
  { operationName: 'GetEdition' }
)
