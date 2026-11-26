// Câblage jonglerie des ports du module billetterie. Lit/écrit les champs `ticketing*` portés par
// Edition et l'existence de l'Edition. Reste côté app ; le layer ne consomme que les interfaces
// (types.ts). Une 2ᵉ app fournit sa propre implémentation via setTicketingPorts().
import type { TicketingPorts, TicketingSettings } from '#ticketing/server/ports/types'

import { buildUpdateData } from '#server/utils/prisma-helpers'

// Sélection Prisma des champs `ticketing*` de configuration portés par l'Edition (jonglerie).
const SETTINGS_SELECT = {
  ticketingAllowOnsiteRegistration: true,
  ticketingAllowAnonymousOrders: true,
  ticketingPaymentCash: true,
  ticketingPaymentCard: true,
  ticketingPaymentCheck: true,
  ticketingSumupEnabled: true,
  ticketingHandoutItemsEnabled: true,
} as const

// Mapping réglage domaine → champ Edition (jonglerie).
const SETTINGS_FIELD_MAP: Record<keyof TicketingSettings, keyof typeof SETTINGS_SELECT> = {
  allowOnsiteRegistration: 'ticketingAllowOnsiteRegistration',
  allowAnonymousOrders: 'ticketingAllowAnonymousOrders',
  paymentCash: 'ticketingPaymentCash',
  paymentCard: 'ticketingPaymentCard',
  paymentCheck: 'ticketingPaymentCheck',
  sumupEnabled: 'ticketingSumupEnabled',
  handoutItemsEnabled: 'ticketingHandoutItemsEnabled',
}

/** Traduit la projection Edition (`ticketing*`) vers les réglages domaine. */
function mapEditionToSettings(
  edition: Record<keyof typeof SETTINGS_SELECT, boolean | null>
): TicketingSettings {
  return {
    allowOnsiteRegistration: edition.ticketingAllowOnsiteRegistration ?? null,
    allowAnonymousOrders: edition.ticketingAllowAnonymousOrders ?? null,
    paymentCash: edition.ticketingPaymentCash ?? null,
    paymentCard: edition.ticketingPaymentCard ?? null,
    paymentCheck: edition.ticketingPaymentCheck ?? null,
    sumupEnabled: edition.ticketingSumupEnabled ?? null,
    handoutItemsEnabled: edition.ticketingHandoutItemsEnabled ?? null,
  }
}

export function createDefaultTicketingPorts(): TicketingPorts {
  return {
    event: {
      // Jonglerie : les réglages sont portés par les champs `ticketing*` de l'Edition.
      async getSettings(editionId) {
        const edition = await prisma.edition.findUnique({
          where: { id: editionId },
          select: SETTINGS_SELECT,
        })
        if (!edition) return null
        return mapEditionToSettings(edition)
      },
      async updateSettings(editionId, settings) {
        // Traduire les réglages domaine vers les champs Edition (les valeurs non définies sont
        // ignorées par buildUpdateData).
        const mapped: Record<string, boolean | undefined> = {}
        for (const key of Object.keys(SETTINGS_FIELD_MAP) as (keyof TicketingSettings)[]) {
          mapped[SETTINGS_FIELD_MAP[key]] = settings[key] ?? undefined
        }
        const data = buildUpdateData(mapped)
        const updated = await prisma.edition.update({
          where: { id: editionId },
          data,
          select: SETTINGS_SELECT,
        })
        return mapEditionToSettings(updated)
      },
      // Jonglerie : l'événement est une Edition.
      async eventExists(editionId) {
        const edition = await prisma.edition.findUnique({
          where: { id: editionId },
          select: { id: true },
        })
        return !!edition
      },
      async lireEdition(editionId) {
        const e = await prisma.edition.findUnique({
          where: { id: editionId },
          select: {
            id: true,
            name: true,
            status: true,
            timezone: true,
            startDate: true,
            endDate: true,
            ticketingHandoutItemsEnabled: true,
            convention: { select: { name: true } },
          },
        })
        if (!e) return null
        return {
          id: e.id,
          name: e.name,
          nomAffiche: e.name || e.convention?.name || '',
          status: e.status,
          timezone: e.timezone,
          startDate: e.startDate,
          endDate: e.endDate,
          handoutItemsEnabled: e.ticketingHandoutItemsEnabled ?? true,
        }
      },
      async editionsComparables(editionId) {
        const e = await prisma.edition.findUnique({
          where: { id: editionId },
          select: { conventionId: true },
        })
        if (!e) return []
        return prisma.edition.findMany({
          where: { conventionId: e.conventionId, id: { not: editionId } },
          select: { id: true, name: true, startDate: true, endDate: true },
          // La plus récente d'abord : on compare presque toujours à l'année précédente.
          orderBy: { startDate: 'desc' },
        })
      },
    },
  }
}
