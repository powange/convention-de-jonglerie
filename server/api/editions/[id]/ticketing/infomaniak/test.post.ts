import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { testInfomaniakConnection } from '#server/utils/editions/ticketing/infomaniak'
import { decrypt } from '#server/utils/encryption'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  apiKey: z.string().optional(),
  currency: z.string().default('2'),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageEditionVolunteers(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour tester la configuration billetterie',
      })
    }

    const body = bodySchema.parse(await readBody(event))

    // Si pas de clé API fournie, utiliser celle en DB
    let apiKey = body.apiKey
    if (!apiKey) {
      const config = await prisma.externalTicketing.findUnique({
        where: { editionId },
        include: { infomaniakConfig: true },
      })
      if (!config?.infomaniakConfig?.apiKey) {
        throw createError({
          statusCode: 400,
          message: 'Aucune clé API fournie et aucune configuration existante',
        })
      }
      apiKey = decrypt(config.infomaniakConfig.apiKey)
    }

    const result = await testInfomaniakConnection(apiKey, body.currency)

    if (!result.success) {
      throw createError({
        statusCode: 400,
        message: result.error || 'Échec de la connexion',
      })
    }

    return createSuccessResponse(
      {
        success: true,
        events: result.events.map((e) => ({
          event_id: e.event_id,
          name: e.name,
          date: e.date,
          status: e.status,
          city: e.address?.city,
        })),
      },
      'Connexion réussie'
    )
  },
  { operationName: 'POST ticketing infomaniak test' }
)
