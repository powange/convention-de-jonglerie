import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultTicketingPorts } from '../../../../../server/ticketing/ports/default-binding'

const prismaMock = (globalThis as any).prisma

const EDITION_SETTINGS = {
  ticketingAllowOnsiteRegistration: true,
  ticketingAllowAnonymousOrders: false,
  ticketingPaymentCash: true,
  ticketingPaymentCard: false,
  ticketingPaymentCheck: null,
  ticketingSumupEnabled: true,
  ticketingHandoutItemsEnabled: false,
}

const DOMAIN_SETTINGS = {
  allowOnsiteRegistration: true,
  allowAnonymousOrders: false,
  paymentCash: true,
  paymentCard: false,
  paymentCheck: null,
  sumupEnabled: true,
  handoutItemsEnabled: false,
}

describe('ports du module billetterie (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('event.getSettings', () => {
    it('lit les champs ticketing* de Edition et les traduit en réglages domaine', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(EDITION_SETTINGS)

      const res = await createDefaultTicketingPorts().event.getSettings(10)

      expect(res).toEqual(DOMAIN_SETTINGS)
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: {
          ticketingAllowOnsiteRegistration: true,
          ticketingAllowAnonymousOrders: true,
          ticketingPaymentCash: true,
          ticketingPaymentCard: true,
          ticketingPaymentCheck: true,
          ticketingSumupEnabled: true,
          ticketingHandoutItemsEnabled: true,
        },
      })
    })

    it("renvoie null si l'édition est introuvable", async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      const res = await createDefaultTicketingPorts().event.getSettings(404)
      expect(res).toBeNull()
    })
  })

  describe('event.updateSettings', () => {
    it('traduit les réglages domaine fournis en champs Edition (ignore les non définis) et renvoie l’état complet', async () => {
      prismaMock.edition.update.mockResolvedValue(EDITION_SETTINGS)

      const res = await createDefaultTicketingPorts().event.updateSettings(10, {
        paymentCard: false,
        sumupEnabled: true,
      })

      expect(res).toEqual(DOMAIN_SETTINGS)
      expect(prismaMock.edition.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { ticketingPaymentCard: false, ticketingSumupEnabled: true },
        select: {
          ticketingAllowOnsiteRegistration: true,
          ticketingAllowAnonymousOrders: true,
          ticketingPaymentCash: true,
          ticketingPaymentCard: true,
          ticketingPaymentCheck: true,
          ticketingSumupEnabled: true,
          ticketingHandoutItemsEnabled: true,
        },
      })
    })
  })

  describe('event.eventExists', () => {
    it('renvoie true si l’édition existe', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({ id: 10 })
      const res = await createDefaultTicketingPorts().event.eventExists(10)
      expect(res).toBe(true)
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { id: true },
      })
    })

    it('renvoie false sinon', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      const res = await createDefaultTicketingPorts().event.eventExists(404)
      expect(res).toBe(false)
    })
  })
})
