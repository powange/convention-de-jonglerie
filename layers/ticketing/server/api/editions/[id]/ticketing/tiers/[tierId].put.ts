import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { dateDeValiditeSchema, updateTier } from '#server/utils/editions/ticketing/tiers'
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
  // Un instant daté, ou l'heure murale nue d'une page ouverte avant le déploiement : les deux
  // formes sont acceptées et ancrées au fuseau de l'ÉDITION dans `instantDeValidite`. Ce qu'il ne
  // faut SURTOUT pas faire, c'est laisser le serveur lire une heure nue lui-même — il tourne en
  // UTC, et `new Date('2026-10-02T18:00')` y vaut 18 h UTC là où l'organisateur voulait 18 h sur
  // place. C'était le défaut d'origine.
  validFrom: dateDeValiditeSchema,
  validUntil: dateDeValiditeSchema,
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
