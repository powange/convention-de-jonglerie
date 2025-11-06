import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder aux compteurs',
      })
    }

    const counters = await prisma.ticketingCounter.findMany({
      where: {
        editionId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      success: true,
      counters,
    }
  },
  { operationName: 'GET ticketing counters' }
)
