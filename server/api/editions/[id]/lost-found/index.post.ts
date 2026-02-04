import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { hasEditionEditPermission } from '@@/server/utils/permissions/permissions'
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
            organizers: {
              include: { user: true },
            },
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    // Nouvelle règle : autoriser l'ajout à partir du début de l'édition (inclus) et après.
    const now = new Date()
    const start = new Date(edition.startDate)
    if (now < start) {
      throw createError({
        status: 403,
        message: "Les objets trouvés ne peuvent pas être ajoutés avant le début de l'édition",
      })
    }

    // Vérifier que l'utilisateur est un organisateur
    const hasPermission = await hasEditionEditPermission(userId, editionId)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message: 'Vous devez être organisateur pour ajouter un objet trouvé',
      })
    }

    // Valider les données
    const description = sanitizeString(body.description)
    if (!description) {
      throw createError({
        status: 400,
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
            emailHash: true,
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
                emailHash: true,
              },
            },
          },
        },
      },
    })
    return rawItem
  },
  { operationName: 'CreateLostFoundItem' }
)
