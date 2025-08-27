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
    // Essayer d'inclure les collaborateurs, fallback sans si la table n'existe pas
    let includeCollaborators = false
    try {
      await prisma.editionCollaborator.findFirst()
      includeCollaborators = true
    } catch {
      console.log('Table EditionCollaborator pas encore créée, ignorer les collaborateurs')
    }

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
        // Champs bénévolat nécessaires pour la page de gestion
        _count: {
          select: { volunteerApplications: true },
        },
        // Champs bénévolat simples sur le modèle Edition (inclus automatiquement, rien à faire)
        // Champs bénévolat (valeurs)
        volunteerApplications: false,
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
              },
            },
          },
        },
        ...(includeCollaborators && {
          collaborators: {
            include: {
              user: {
                select: {
                  id: true,
                  pseudo: true,
                  profilePicture: true,
                  updatedAt: true,
                  email: true,
                },
              },
              addedBy: {
                select: { id: true, pseudo: true },
              },
            },
          },
        }),
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

      console.log('[DEBUG] Permission check for offline edition:', {
        userId,
        editionCreatorId: edition.creatorId,
        conventionAuthorId: edition.convention.authorId,
        isCreator,
        isConventionAuthor,
        isCollaborator,
        collaborators: edition.convention.collaborators?.map((c) => ({ userId: c.userId })),
      })

      if (!isCreator && !isConventionAuthor && !isCollaborator) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Edition not found',
        })
      }
    }

    // Transformer les emails en emailHash
    if (edition) {
      // Transformer creator
      if (edition.creator && edition.creator.email) {
        edition.creator = {
          ...edition.creator,
          emailHash: getEmailHash(edition.creator.email),
          email: undefined,
        } as unknown
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
            addEdition: (collab as any).canAddEdition ?? false,
            editAllEditions: (collab as any).canEditAllEditions ?? false,
            deleteAllEditions: (collab as any).canDeleteAllEditions ?? false,
          },
          user: {
            ...collab.user,
            emailHash: getEmailHash(collab.user.email),
            email: undefined,
          } as unknown,
        }))
      }

      // Transformer les collaborateurs de l'édition
      if (includeCollaborators && edition.collaborators) {
        edition.collaborators = edition.collaborators.map((collab) => ({
          ...collab,
          user: {
            ...collab.user,
            emailHash: getEmailHash(collab.user.email),
            email: undefined,
          } as unknown,
        }))
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
