import { useTicketingPorts } from '#server/ticketing/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Même garde que les lectures voisines qu'appellent les deux mêmes écrans (`tiers/index.get`,
    // `options/index.get`) : gestionnaires OU bénévoles en créneau actif de contrôle d'accès.
    // Poser `canManageTicketing` ici priverait le scanner de ces réglages — c'est lui qui décide
    // s'il propose l'inscription sur place et quels moyens de paiement il affiche.
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

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
