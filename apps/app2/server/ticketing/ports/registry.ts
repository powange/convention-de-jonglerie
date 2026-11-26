/**
 * Câblage du layer billetterie pour FLOWVENT (contrat d'hôte, cf. layers/ticketing/server/ports/types.ts ;
 * app1 a le sien, sur ses éditions). Les réglages de billetterie sont des colonnes de l'événement,
 * sous les mêmes noms qu'app1 (`ticketing*`).
 */
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

const ports: TicketingPorts = {
  event: {
    // Les réglages sont portés par les champs `ticketing*` de l'événement (mêmes noms qu'app1).
    async getSettings(editionId) {
      const edition = await prisma.event.findUnique({
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
      const updated = await prisma.event.update({
        where: { id: editionId },
        data,
        select: SETTINGS_SELECT,
      })
      return mapEditionToSettings(updated)
    },
    // Jonglerie : l'événement est une Edition.
    async eventExists(editionId) {
      const edition = await prisma.event.findUnique({
        where: { id: editionId },
        select: { id: true },
      })
      return !!edition
    },
    async lireEdition(editionId) {
      const e = await prisma.event.findUnique({
        where: { id: editionId },
        select: {
          id: true,
          name: true,
          status: true,
          timezone: true,
          startDate: true,
          endDate: true,
          ticketingHandoutItemsEnabled: true,
        },
      })
      if (!e) return null
      // Un événement sans date de début n'a rien à vendre : on prend le jour même, sans fin il
      // dure sa journée de début (même règle que l'édition de /api/events/:id/edition).
      const debut = e.startDate ?? new Date()
      return {
        id: e.id,
        name: e.name,
        nomAffiche: e.name,
        status: e.status,
        timezone: e.timezone ?? 'Europe/Paris',
        startDate: debut,
        endDate: e.endDate ?? debut,
        handoutItemsEnabled: e.ticketingHandoutItemsEnabled,
      }
    },
    // Pas de convention dans Flowvent : on compare aux autres événements du même propriétaire.
    async editionsComparables(editionId) {
      const e = await prisma.event.findUnique({
        where: { id: editionId },
        select: { ownerId: true },
      })
      if (!e) return []
      return prisma.event.findMany({
        where: { ownerId: e.ownerId, id: { not: editionId } },
        select: { id: true, name: true, startDate: true, endDate: true },
        orderBy: { startDate: 'desc' },
      })
    },
  },
}

export function useTicketingPorts(): TicketingPorts {
  return ports
}
