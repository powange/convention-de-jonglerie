import { isHttpError } from '@@/server/types/prisma-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { hasEditionEditPermission } from '@@/server/utils/permissions/permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string)
    const body = await readBody(event)

    if (!editionId || isNaN(editionId)) {
      throw createError({
        statusCode: 400,
        message: "ID d'édition invalide",
      })
    }

    const user = requireAuth(event)
    const userId = user.id

    // Récupérer l'édition et ses dates
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            collaborators: {
              include: { user: true },
            },
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    // Nouvelle règle : autoriser l'ajout à partir du début de l'édition (inclus) et après.
    const now = new Date()
    const start = new Date(edition.startDate)
    if (now < start) {
      throw createError({
        statusCode: 403,
        message: "Les objets trouvés ne peuvent pas être ajoutés avant le début de l'édition",
      })
    }

    // Vérifier que l'utilisateur est un collaborateur
    const hasPermission = await hasEditionEditPermission(userId, editionId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message: 'Vous devez être collaborateur pour ajouter un objet trouvé',
      })
    }

    // Valider les données
    const { description, imageUrl } = body

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: 'La description est requise',
      })
    }

    // Créer l'objet trouvé
    const rawItem = await prisma.lostFoundItem.create({
      data: {
        editionId,
        userId,
        description: description.trim(),
        imageUrl: imageUrl || null,
        status: 'LOST',
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
            updatedAt: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    })
    const { email, ...userWithoutEmail } = rawItem.user
    const itemUser = {
      ...userWithoutEmail,
      emailHash: getEmailHash(email),
    }
    return { ...rawItem, user: itemUser }
  } catch (error: unknown) {
    console.error("Erreur lors de la création de l'objet trouvé:", error)
    if (isHttpError(error)) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
