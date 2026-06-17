import { useLostFoundPorts } from '#server/lost-found/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Vérifier que l'événement existe (via le port : le layer ne lit pas Edition directement)
    const { found } = await useLostFoundPorts().event.getEventTiming(editionId)
    if (!found) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    // Récupérer tous les objets trouvés de l'édition
    const rawItems = await prisma.lostFoundItem.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
            emailHash: true,
            updatedAt: true,
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
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return rawItems
  },
  { operationName: 'GetLostFoundItems' }
)
