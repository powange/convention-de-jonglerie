import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'
import {
  PUBLIC_API_ENDPOINT_KEYS,
  isPublicApiEndpointKey,
} from '#server/utils/public-api-endpoints'
import { validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z
  .object({
    isActive: z.boolean().optional(),
    // Clés d'endpoints autorisés ; un tableau vide retire tous les droits.
    scopes: z
      .array(z.string())
      .refine((keys) => keys.every(isPublicApiEndpointKey), {
        message: 'Endpoint inconnu',
      })
      .optional(),
  })
  .refine((body) => body.isActive !== undefined || body.scopes !== undefined, {
    message: 'Aucun champ à mettre à jour',
  })

/**
 * Mise à jour d'un token d'API publique (réservé aux super-admins) :
 * activation / révocation et/ou modification des endpoints autorisés.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)
    const tokenId = validateResourceId(event, 'id', 'token')

    const body = await readBody(event)
    const { isActive, scopes } = bodySchema.parse(body)

    await fetchResourceOrFail(prisma.apiToken, tokenId, {
      errorMessage: 'Token introuvable',
    })

    const token = await prisma.apiToken.update({
      where: { id: tokenId },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        // Dédoublonne et conserve l'ordre du registre.
        ...(scopes !== undefined
          ? { scopes: PUBLIC_API_ENDPOINT_KEYS.filter((key) => scopes.includes(key)) }
          : {}),
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
  { operationName: 'AdminUpdateApiToken' }
)
