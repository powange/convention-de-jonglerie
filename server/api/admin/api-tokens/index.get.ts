import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'

/**
 * Liste des tokens d'API publique (réservé aux super-admins).
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const tokens = await prisma.apiToken.findMany({
      select: {
        id: true,
        name: true,
        token: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        createdBy: { select: userBasicSelect },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { tokens }
  },
  { operationName: 'AdminListApiTokens' }
)
