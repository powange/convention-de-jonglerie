import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

const createQuotaSchema = z.object({
  title: z.string().min(1, 'Le titre est obligatoire'),
  description: z.string().optional().nullable(),
  quantity: z.number().int().positive('La quantité doit être un nombre positif'),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    const body = await readBody(event)
    const validation = createQuotaSchema.safeParse(body)

    if (!validation.success) {
      throw createError({
        status: 400,
        message: validation.error.errors[0].message,
      })
    }

    try {
      const quota = await prisma.ticketingQuota.create({
        data: {
          editionId,
          title: validation.data.title,
          description: validation.data.description || null,
          quantity: validation.data.quantity,
        },
      })

      return createSuccessResponse(quota)
    } catch (error: unknown) {
      console.error('Failed to create quota:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la création du quota',
      })
    }
  },
  { operationName: 'POST ticketing quotas index' }
)
