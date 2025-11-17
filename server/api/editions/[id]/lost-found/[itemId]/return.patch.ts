import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { hasEditionEditPermission } from '@@/server/utils/permissions/permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'objet')

    const user = requireAuth(event)
    const userId = user.id

    // Vérifier que l'objet trouvé existe et appartient à l'édition
    const lostFoundItem = await prisma.lostFoundItem.findFirst({
      where: {
        id: itemId,
        editionId: editionId,
      },
    })

    if (!lostFoundItem) {
      throw createError({
        statusCode: 404,
        message: 'Objet trouvé non trouvé',
      })
    }

    // Vérifier que l'utilisateur est un organisateur
    const hasPermission = await hasEditionEditPermission(userId, editionId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message: "Vous devez être organisateur pour modifier le statut d'un objet trouvé",
      })
    }

    // Mettre à jour le statut
    const rawItem = await prisma.lostFoundItem.update({
      where: { id: itemId },
      data: {
        status: lostFoundItem.status === 'RETURNED' ? 'LOST' : 'RETURNED',
        updatedAt: new Date(),
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
                updatedAt: true,
                emailHash: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return rawItem
  },
  { operationName: 'ToggleLostFoundItemStatus' }
)
