import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { hasEditionEditPermission } from '@@/server/utils/permissions/permissions'
import { prisma } from '@@/server/utils/prisma'
import { sanitizeString, validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const body = await readBody(event)

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
    const description = sanitizeString(body.description)
    if (!description) {
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
        description,
        imageUrl: body.imageUrl || null,
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
  },
  { operationName: 'CreateLostFoundItem' }
)
