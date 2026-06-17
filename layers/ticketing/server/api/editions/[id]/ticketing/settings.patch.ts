import { z } from 'zod'

import { useTicketingPorts } from '#server/ticketing/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTicketing,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  allowOnsiteRegistration: z.boolean().optional(),
  allowAnonymousOrders: z.boolean().optional(),
  paymentCash: z.boolean().optional(),
  paymentCard: z.boolean().optional(),
  paymentCheck: z.boolean().optional(),
  sumupEnabled: z.boolean().optional(),
  handoutItemsEnabled: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event).catch(() => ({}))

    // Validation avec gestion d'erreur appropriée
    let parsed
    try {
      parsed = bodySchema.parse(body || {})
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error)
      }
      throw error
    }

    // Récupérer l'édition avec les relations de permissions (lecture Edition côté core via #server)
    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Edition introuvable' })
    }

    // Vérifier les permissions
    if (!canManageTicketing(edition, user)) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer la billetterie',
      })
    }

    // Si aucun réglage n'est fourni, rien à mettre à jour (comportement inchangé).
    const hasUpdate = Object.values(parsed).some((v) => v !== undefined)
    if (!hasUpdate) return createSuccessResponse({ unchanged: true })

    // Écriture des réglages via le port (jonglerie : champs `ticketing*` portés par Edition).
    const updated = await useTicketingPorts().event.updateSettings(editionId, parsed)

    return createSuccessResponse({
      settings: {
        allowOnsiteRegistration: updated.allowOnsiteRegistration ?? true,
        allowAnonymousOrders: updated.allowAnonymousOrders ?? false,
        paymentCash: updated.paymentCash ?? true,
        paymentCard: updated.paymentCard ?? true,
        paymentCheck: updated.paymentCheck ?? true,
        sumupEnabled: updated.sumupEnabled ?? false,
        handoutItemsEnabled: updated.handoutItemsEnabled ?? true,
      },
    })
  },
  { operationName: 'UpdateTicketingSettings' }
)
