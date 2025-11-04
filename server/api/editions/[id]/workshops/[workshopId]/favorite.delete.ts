import { wrapApiHandler, createSuccessResponse } from '@@/server/utils/api-helpers'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
        statusCode: 404,
        message: 'Workshop non trouvé',
      })
    }

    // Supprimer le favori
    await prisma.workshopFavorite.deleteMany({
      where: {
        workshopId,
        userId: user.user.id,
      },
    })

    return createSuccessResponse(null)
  },
  { operationName: 'DeleteWorkshopFavorite' }
)
