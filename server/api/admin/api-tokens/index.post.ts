import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'
import {
  PUBLIC_API_ENDPOINT_KEYS,
  isPublicApiEndpointKey,
} from '#server/utils/public-api-endpoints'
import { generateSecureToken } from '#server/utils/token-generator'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  // Clés d'endpoints autorisés ; par défaut, accès à tous les endpoints connus.
  scopes: z
    .array(z.string())
    .refine((keys) => keys.every(isPublicApiEndpointKey), {
      message: 'Endpoint inconnu',
    })
    .optional(),
})

/**
 * Création d'un token d'API publique (réservé aux super-admins).
 */
export default wrapApiHandler(
  async (event) => {
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event)
    const { name, scopes } = bodySchema.parse(body)

    const token = await prisma.apiToken.create({
      data: {
        name,
        token: generateSecureToken(16),
        // Dédoublonne et conserve l'ordre du registre ; par défaut tous les endpoints.
        scopes: PUBLIC_API_ENDPOINT_KEYS.filter((key) =>
          (scopes ?? PUBLIC_API_ENDPOINT_KEYS).includes(key)
        ),
        createdById: adminUser.id,
      },
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
    })

    return { token }
  },
  { operationName: 'AdminCreateApiToken' }
)
