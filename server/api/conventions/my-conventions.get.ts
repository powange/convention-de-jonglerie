import { getEmailHash } from '../../utils/email-hash'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }

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
        OR: [
          { authorId: event.context.user.id },
          { collaborators: { some: { userId: event.context.user.id } } },
        ],
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
      author: {
        ...convention.author,
        emailHash: getEmailHash(convention.author.email),
        email: undefined,
      } as any,
      collaborators: convention.collaborators.map((collab: any) => ({
        id: collab.id,
        title: collab.title,
        addedAt: collab.addedAt,
        user: {
          ...collab.user,
          emailHash: getEmailHash(collab.user.email),
          email: undefined,
        } as any,
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
