import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

/**
 * Suppression définitive d'un token d'API publique (réservé aux super-admins).
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)
    const tokenId = validateResourceId(event, 'id', 'token')

    await fetchResourceOrFail(prisma.apiToken, tokenId, {
      errorMessage: 'Token introuvable',
    })

    await prisma.apiToken.delete({ where: { id: tokenId } })

    return { success: true }
  },
  { operationName: 'AdminDeleteApiToken' }
)
