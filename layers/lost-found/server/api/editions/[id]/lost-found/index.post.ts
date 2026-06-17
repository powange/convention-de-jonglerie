import { useLostFoundPorts } from '#server/lost-found/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import {
  sanitizeString,
  sanitizeUserContent,
  validateEditionId,
} from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const body = await readBody(event)

    const user = requireAuth(event)
    const userId = user.id

    // Existence + date de début via le port (le layer ne lit pas Edition directement)
    const { found, startDate } = await useLostFoundPorts().event.getEventTiming(editionId)
    if (!found) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    // Nouvelle règle : autoriser l'ajout à partir du début de l'édition (inclus) et après.
    const now = new Date()
    if (startDate && now < new Date(startDate)) {
      throw createError({
        status: 403,
        message: "Les objets trouvés ne peuvent pas être ajoutés avant le début de l'édition",
      })
    }

    // Vérifier que l'utilisateur est un organisateur
    const hasPermission = await canAccessEditionData(editionId, userId, event)
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
        description: sanitizeUserContent(description),
        imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
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
    return createSuccessResponse(rawItem)
  },
  { operationName: 'CreateLostFoundItem' }
)
