import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'
import { PUBLIC_API_ENDPOINTS } from '#server/utils/public-api-endpoints'

/**
 * Liste des tokens d'API publique (réservé aux super-admins).
 *
 * Renvoie aussi le registre des endpoints publics disponibles afin que
 * l'administration puisse proposer les droits attribuables à chaque token.
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
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
        createdBy: { select: userBasicSelect },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { tokens, endpoints: PUBLIC_API_ENDPOINTS }
  },
  { operationName: 'AdminListApiTokens' }
)
