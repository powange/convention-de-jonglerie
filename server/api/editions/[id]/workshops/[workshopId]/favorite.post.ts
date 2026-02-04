import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = await requireUserSession(event)
    const editionId = validateEditionId(event)
    const workshopId = validateResourceId(event, 'workshopId', 'atelier')

    // Vérifier que le workshop existe et appartient à l'édition
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: workshopId,
        editionId,
      },
      select: { id: true },
    })

    if (!workshop) {
      throw createError({
        status: 404,
        message: 'Workshop non trouvé',
      })
    }

    // Créer le favori (ou ne rien faire si déjà existant)
    const favorite = await prisma.workshopFavorite.upsert({
      where: {
        workshopId_userId: {
          workshopId,
          userId: user.user.id,
        },
      },
      create: {
        workshopId,
        userId: user.user.id,
      },
      update: {},
    })

    return {
      success: true,
      favorite,
    }
  },
  { operationName: 'AddWorkshopFavorite' }
)
