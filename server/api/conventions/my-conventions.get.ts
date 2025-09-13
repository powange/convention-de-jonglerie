import { requireAuth } from '../../utils/auth-utils'
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
    // Récupérer les conventions où l'utilisateur est auteur OU collaborateur
    const conventions = await prisma.convention.findMany({
      where: {
        isArchived: false,
        OR: [{ authorId: user.id }, { collaborators: { some: { userId: user.id } } }],
      },
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
      author: (() => {
        const { email, ...authorWithoutEmail } = convention.author
        return {
          ...authorWithoutEmail,
          emailHash: getEmailHash(email),
        }
      })(),
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
          addEdition: collab.canAddEdition,
          editAllEditions: collab.canEditAllEditions,
          deleteAllEditions: collab.canDeleteAllEditions,
        },
        perEdition: (collab.perEditionPermissions || []).map((p: any) => ({
          editionId: p.editionId,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
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
