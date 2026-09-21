import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { updateTier } from '#server/utils/editions/ticketing/tiers'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

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
  // Un INSTANT, pas une heure murale : le serveur tourne en UTC, et `new Date('2026-10-02T18:00')`
  // y lirait 18 h UTC là où l'organisateur avait saisi 18 h sur place. La contrainte de zod est ce
  // qui refuse une chaîne sans fuseau — c'est elle qui a protégé les autres modules du dépôt.
  validFrom: z.string().datetime({ offset: true }).nullable().optional(),
  validUntil: z.string().datetime({ offset: true }).nullable().optional(),
  // `handoutItemIds` est optionnel SANS default : si la clé n'est pas
  // envoyée, `updateTier` ne touche pas aux associations existantes
  // (gérées désormais via /tiers/[id]/handout-items).
  handoutItemIds: z.array(z.number().int()).optional(),
  mealIds: z.array(z.number().int()).optional().default([]),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const tierId = validateResourceId(event, 'tierId', 'tier')

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const body = bodySchema.parse(await readBody(event))
    const tier = await updateTier(tierId, editionId, body)

    return createSuccessResponse({ tier })
  },
  { operationName: 'PUT ticketing tier' }
)
