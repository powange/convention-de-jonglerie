import { useTicketingPorts } from '#server/ticketing/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Réglages de billetterie via le port (jonglerie : champs `ticketing*` portés par Edition).
    const settings = await useTicketingPorts().event.getSettings(editionId)
    if (!settings) {
      throw createError({ status: 404, message: 'Edition introuvable' })
    }

    return {
      allowOnsiteRegistration: settings.allowOnsiteRegistration ?? true,
      allowAnonymousOrders: settings.allowAnonymousOrders ?? false,
      paymentCash: settings.paymentCash ?? true,
      paymentCard: settings.paymentCard ?? true,
      paymentCheck: settings.paymentCheck ?? true,
      sumupEnabled: settings.sumupEnabled ?? false,
      handoutItemsEnabled: settings.handoutItemsEnabled ?? true,
    }
  },
  { operationName: 'GetTicketingSettings' }
)
