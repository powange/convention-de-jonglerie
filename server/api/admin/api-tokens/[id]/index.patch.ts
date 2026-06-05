import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  isActive: z.boolean(),
})

/**
 * Activation / révocation d'un token d'API publique (réservé aux super-admins).
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)
    const tokenId = validateResourceId(event, 'id', 'token')

    const body = await readBody(event)
    const { isActive } = bodySchema.parse(body)

    await fetchResourceOrFail(prisma.apiToken, tokenId, {
      errorMessage: 'Token introuvable',
    })

    const token = await prisma.apiToken.update({
      where: { id: tokenId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        token: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        createdBy: { select: userBasicSelect },
      },
    })

    return { token }
  },
  { operationName: 'AdminUpdateApiToken' }
)
