import { requireAuth } from '@@/server/utils/auth-utils'
import { updateTier } from '@@/server/utils/editions/ticketing/tiers'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1),
  customName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0),
  minAmount: z.number().int().min(0).nullable().optional(),
  maxAmount: z.number().int().min(0).nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  countAsParticipant: z.boolean().default(true),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  quotaIds: z.array(z.number().int()).optional().default([]),
  returnableItemIds: z.array(z.number().int()).optional().default([]),
  mealIds: z.array(z.number().int()).optional().default([]),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const tierId = parseInt(getRouterParam(event, 'tierId') || '0')

  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })
  if (!tierId) throw createError({ statusCode: 400, message: 'Tarif invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  const body = bodySchema.parse(await readBody(event))

  try {
    const tier = await updateTier(tierId, editionId, body)

    return {
      success: true,
      tier,
    }
  } catch (error: unknown) {
    console.error('Update tier error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la modification du tarif',
    })
  }
})
