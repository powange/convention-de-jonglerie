import { isHttpError } from '@@/server/types/prisma-helpers'
import { getEmailHash } from '@@/server/utils/email-hash'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Cette route est publique pour permettre la consultation des conventions
  // L'authentification et les droits d'édition sont vérifiés côté client

  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string)

    if (isNaN(conventionId)) {
      throw createError({
        statusCode: 400,
        message: 'ID de convention invalide',
      })
    }

    // Récupérer la convention
    const convention = await prisma.convention.findUnique({
      where: {
        id: conventionId,
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
              },
            },
          },
        },
      },
    })

    if (!convention) {
      throw createError({
        statusCode: 404,
        message: 'Convention introuvable',
      })
    }

    // Transformer auteur (emailHash) et collaborateurs avec nouveaux droits
    const transformed = {
      ...convention,
      author: convention.author
        ? (() => {
            const { email, ...authorWithoutEmail } = convention.author
            return {
              ...authorWithoutEmail,
              emailHash: email ? getEmailHash(email) : undefined,
            }
          })()
        : null,
      collaborators: convention.collaborators.map((c) => ({
        id: c.id,
        addedAt: c.addedAt,
        title: c.title ?? null,
        rights: {
          editConvention: c.canEditConvention,
          deleteConvention: c.canDeleteConvention,
          manageCollaborators: c.canManageCollaborators,
          addEdition: c.canAddEdition,
          editAllEditions: c.canEditAllEditions,
          deleteAllEditions: c.canDeleteAllEditions,
        },
        user: c.user,
      })),
    }

    return transformed
  } catch (error: unknown) {
    // Si c'est déjà une erreur HTTP, la relancer
    if (isHttpError(error)) {
      throw error
    }

    console.error('Erreur lors de la récupération de la convention:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur',
    })
  }
})
