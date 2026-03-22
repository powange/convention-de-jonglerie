import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { testInfomaniakConnection } from '#server/utils/editions/ticketing/infomaniak'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  apiKey: z.string().min(1),
  currency: z.string().default('2'),
})

export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
    validateEditionId(event)

    const body = bodySchema.parse(await readBody(event))

    const result = await testInfomaniakConnection(body.apiKey, body.currency)

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
