import { requireAuth } from '../../utils/auth-utils'
import { checkAdminMode } from '../../utils/collaborator-management'
import { getEmailHash } from '../../utils/email-hash'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  try {
    // Editions must include isOnline (non-nullable boolean with default false)
    const editionsSelect: any = {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      city: true,
      country: true,
      imageUrl: true,
      isOnline: true,
    }
    // Vérifier si l'utilisateur est en mode admin actif
    const isInAdminMode = await checkAdminMode(user.id, event)

    // Récupérer les conventions selon les permissions utilisateur
    const whereClause = isInAdminMode
      ? {
          // Mode admin actif : toutes les conventions non archivées
          isArchived: false,
        }
      : {
          // Utilisateur normal ou admin pas en mode admin : conventions où il est auteur OU collaborateur
          isArchived: false,
          OR: [{ authorId: user.id }, { collaborators: { some: { userId: user.id } } }],
        }

    const conventions = await prisma.convention.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                email: true,
              },
            },
            perEditionPermissions: true,
          },
          orderBy: {
            addedAt: 'asc',
          },
        },
        editions: {
          select: editionsSelect,
          orderBy: {
            startDate: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transformer les emails en emailHash pour les auteurs et collaborateurs
    const transformedConventions = conventions.map((convention) => ({
      ...convention,
      author: convention.author
        ? (() => {
            const { email, ...authorWithoutEmail } = convention.author
            return {
              ...authorWithoutEmail,
              emailHash: getEmailHash(email),
            }
          })()
        : null,
      collaborators: convention.collaborators.map((collab: any) => ({
        id: collab.id,
        title: collab.title,
        addedAt: collab.addedAt,
        user: (() => {
          const { email, ...userWithoutEmail } = collab.user
          return {
            ...userWithoutEmail,
            emailHash: getEmailHash(email),
          }
        })(),
        rights: {
          editConvention: collab.canEditConvention,
          deleteConvention: collab.canDeleteConvention,
          manageCollaborators: collab.canManageCollaborators,
          manageVolunteers: collab.canManageVolunteers,
          addEdition: collab.canAddEdition,
          editAllEditions: collab.canEditAllEditions,
          deleteAllEditions: collab.canDeleteAllEditions,
        },
        perEdition: (collab.perEditionPermissions || []).map((p: any) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
          canManageVolunteers: p.canManageVolunteers,
        })),
      })),
    }))

    return transformedConventions
  } catch (error) {
    console.error('Erreur lors de la récupération des conventions:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    })
  }
})
