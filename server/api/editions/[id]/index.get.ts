import { isHttpError } from '@@/server/types/prisma-helpers'
import { optionalAuth } from '@@/server/utils/auth-utils'
import { checkAdminMode } from '@@/server/utils/collaborator-management'
import { getEmailHash } from '@@/server/utils/email-hash'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const editionId = parseInt(event.context.params?.id as string)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid Edition ID',
    })
  }

  try {
    const edition = await prisma.edition.findUnique({
      where: {
        id: editionId,
      },
      include: {
        creator: {
          select: { id: true, pseudo: true, profilePicture: true, updatedAt: true, email: true },
        },
        attendingUsers: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
            updatedAt: true,
            email: true,
          },
        },
        // Champs bénévolat nécessaires pour la page de gestion
        _count: {
          select: { volunteerApplications: true },
        },
        // Champs bénévolat simples sur le modèle Edition (inclus automatiquement, rien à faire)
        // Champs bénévolat (valeurs)
        volunteerApplications: false,
        // collaboratorPermissions: permet de gérer les droits spécifiques par édition
        // Pour l'instant on n'inclut pas, on utilise juste convention.collaborators
        convention: {
          include: {
            collaborators: {
              include: {
                user: {
                  select: {
                    id: true,
                    pseudo: true,
                    email: true,
                    profilePicture: true,
                    updatedAt: true,
                  },
                },
                perEditionPermissions: true,
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

    // Check if edition is offline and user has permission to view it
    // Only consider it offline when isOnline is explicitly false. If undefined
    // (legacy records / tests), treat it as online.
    if (edition.isOnline === false) {
      // Check if user is authenticated
      const user = optionalAuth(event)
      if (!user) {
        throw createError({
          statusCode: 404,
          message: 'Edition not found',
        })
      }

      // Normalize user id to number to avoid string/number mismatches
      const userId = Number(user.id)
      const isAdminMode = await checkAdminMode(userId, event)
      const isCreator = edition.creatorId === userId
      const isConventionAuthor = edition.convention.authorId === userId
      const isCollaborator = edition.convention.collaborators?.some((c) => c.userId === userId)

      // Les éditions orphelines (sans créateur et sans auteur de convention) sont considérées comme publiques
      const isOrphanEdition = !edition.creatorId && !edition.convention.authorId

      if (
        !isAdminMode &&
        !isCreator &&
        !isConventionAuthor &&
        !isCollaborator &&
        !isOrphanEdition
      ) {
        throw createError({
          statusCode: 404,
          message: 'Edition not found',
        })
      }
    }

    // Transformer les emails en emailHash
    if (edition) {
      // Transformer creator - ajouter emailHash et supprimer email
      if (edition.creator && edition.creator.email) {
        const { email, ...creatorWithoutEmail } = edition.creator
        edition.creator = {
          ...creatorWithoutEmail,
          emailHash: getEmailHash(email),
        }
      }

      // Transformer les collaborateurs de la convention
      if (edition.convention?.collaborators) {
        edition.convention.collaborators = edition.convention.collaborators.map((collab) => {
          const { email, ...userWithoutEmail } = collab.user
          return {
            ...collab,
            // Construire un objet rights cohérent (si les colonnes existent)
            rights: {
              editConvention: collab.canEditConvention ?? false,
              deleteConvention: collab.canDeleteConvention ?? false,
              manageCollaborators: collab.canManageCollaborators ?? false,
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
            user: {
              ...userWithoutEmail,
              emailHash: getEmailHash(email),
            },
          }
        })
      }

      // Transformer les participants (attendingUsers)
      if (edition.attendingUsers) {
        edition.attendingUsers = edition.attendingUsers.map((user) => {
          const { email, ...userWithoutEmail } = user
          return {
            ...userWithoutEmail,
            emailHash: getEmailHash(email),
          }
        })
      }
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
  } catch (error: unknown) {
    // If the handler already threw an HTTP error (createError), rethrow it to preserve status
    if (isHttpError(error)) {
      throw error
    }
    console.error('Erreur API edition:', error)
    throw createError({
      statusCode: 500,
      message: 'Internal Server Error',
    })
  }
})
