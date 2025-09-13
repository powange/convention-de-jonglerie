import { getEmailHash } from '../../utils/email-hash'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const editionId = parseInt(event.context.params?.id as string)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Edition ID',
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
        favoritedBy: {
          select: { id: true },
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
        statusMessage: 'Edition not found',
      })
    }

    // Check if edition is offline and user has permission to view it
    // Only consider it offline when isOnline is explicitly false. If undefined
    // (legacy records / tests), treat it as online.
    if (edition.isOnline === false) {
      // Check if user is authenticated
      if (!event.context.user) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Edition not found',
        })
      }

      // Normalize user id to number to avoid string/number mismatches
      const userId = Number(event.context.user.id)
      const isCreator = edition.creatorId === userId
      const isConventionAuthor = edition.convention.authorId === userId
      const isCollaborator = edition.convention.collaborators?.some((c) => c.userId === userId)

      if (!isCreator && !isConventionAuthor && !isCollaborator) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Edition not found',
        })
      }
    }

    // Transformer les emails en emailHash
    if (edition) {
      // Transformer creator - ajouter emailHash et supprimer email
      if (edition.creator && edition.creator.email) {
        edition.creator = {
          ...edition.creator,
          emailHash: getEmailHash(edition.creator.email),
        } as any
        delete (edition.creator as any).email
      }

      // Transformer les collaborateurs de la convention
      if (edition.convention?.collaborators) {
        edition.convention.collaborators = edition.convention.collaborators.map((collab) => ({
          ...collab,
          // Construire un objet rights cohérent (si les colonnes existent)
          rights: {
            editConvention: (collab as any).canEditConvention ?? false,
            deleteConvention: (collab as any).canDeleteConvention ?? false,
            manageCollaborators: (collab as any).canManageCollaborators ?? false,
            manageVolunteers: (collab as any).canManageVolunteers ?? false,
            addEdition: (collab as any).canAddEdition ?? false,
            editAllEditions: (collab as any).canEditAllEditions ?? false,
            deleteAllEditions: (collab as any).canDeleteAllEditions ?? false,
          },
          // Transformer les droits par édition
          perEditionRights: ((collab as any).perEditionPermissions || []).map((per: any) => ({
            editionId: per.editionId,
            canEdit: per.canEdit ?? false,
            canDelete: per.canDelete ?? false,
            canManageVolunteers: per.canManageVolunteers ?? false,
          })),
          user: (() => {
            const { email, ...userWithoutEmail } = collab.user
            return {
              ...userWithoutEmail,
              emailHash: getEmailHash(email),
            }
          })(),
        })) as any
      }

      // Transformer les participants (attendingUsers)
      if (edition.attendingUsers) {
        edition.attendingUsers = edition.attendingUsers.map((user) => {
          const { email, ...userWithoutEmail } = user as any
          return {
            ...userWithoutEmail,
            emailHash: getEmailHash(email),
          }
        }) as any
      }
    }

    // Ajouter explicitement les champs bénévolat (déjà présents sur edition)
    // Juste pour clarté, on renvoie l'objet tel quel; pas de transformation supplémentaire nécessaire ici.
    return {
      ...edition,
      volunteersOpen: (edition as any).volunteersOpen,
      volunteersDescription: (edition as any).volunteersDescription,
      volunteersMode: (edition as any).volunteersMode,
      volunteersExternalUrl: (edition as any).volunteersExternalUrl,
      volunteersAskDiet: (edition as any).volunteersAskDiet,
      volunteersAskAllergies: (edition as any).volunteersAskAllergies,
      volunteersUpdatedAt: (edition as any).volunteersUpdatedAt,
    }
  } catch (error: any) {
    // If the handler already threw an HTTP error (createError), rethrow it to preserve status
    if (error && (error.statusCode || error.status)) {
      throw error
    }
    console.error('Erreur API edition:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    })
  }
})
