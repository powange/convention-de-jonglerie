import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'
import { generateSecureToken } from '#server/utils/token-generator'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100),
})

/**
 * Création d'un token d'API publique (réservé aux super-admins).
 */
export default wrapApiHandler(
  async (event) => {
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event)
    const { name } = bodySchema.parse(body)

    const token = await prisma.apiToken.create({
      data: {
        name,
        token: generateSecureToken(16),
        createdById: adminUser.id,
      },
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
  { operationName: 'AdminCreateApiToken' }
)
