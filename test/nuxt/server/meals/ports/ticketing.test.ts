import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultMealsPorts } from '../../../../../server/meals/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

const oi = (id: number, over: Record<string, any> = {}) => ({
  id,
  firstName: `Prenom${id}`,
  lastName: `Nom${id}`,
  email: `u${id}@x.fr`,
  ...over,
})

describe('port ticketing du module repas (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMealTicketParticipants', () => {
    it('dédupliquе tarifs/options et extrait régime/allergies des customFields', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 42,
          tiers: [
            {
              tier: {
                orderItems: [
                  oi(100, {
                    customFields: {
                      dietaryPreference: 'VEGAN',
                      allergies: 'arachides',
                      allergySeverity: 'HIGH',
                    },
                  }),
                ],
              },
            },
          ],
          options: [
            {
              option: {
                orderItemSelections: [
                  { orderItem: oi(100, { customFields: {} }) }, // doublon du tarif → ignoré
                  { orderItem: oi(101, { customFields: null }) },
                ],
              },
            },
          ],
        },
      ])

      const result = await createDefaultMealsPorts().ticketing.getMealTicketParticipants([42])

      expect(result[42]).toEqual([
        {
          orderItemId: 100,
          lastName: 'Nom100',
          firstName: 'Prenom100',
          email: 'u100@x.fr',
          dietaryPreference: 'VEGAN',
          allergies: 'arachides',
          allergySeverity: 'HIGH',
        },
        {
          orderItemId: 101,
          lastName: 'Nom101',
          firstName: 'Prenom101',
          email: 'u101@x.fr',
          dietaryPreference: null,
          allergies: null,
          allergySeverity: null,
        },
      ])
    })

    it('court-circuite sans requête pour une liste vide', async () => {
      const result = await createDefaultMealsPorts().ticketing.getMealTicketParticipants([])
      expect(result).toEqual({})
      expect(prismaMock.volunteerMeal.findMany).not.toHaveBeenCalled()
    })
  })

  describe('listMealTicketParticipants', () => {
    it('dédupliquе et calcule consumedAt depuis mealAccess', async () => {
      const consumed = new Date('2026-06-16T12:00:00Z')
      prismaMock.volunteerMeal.findUnique.mockResolvedValue({
        tiers: [{ tier: { orderItems: [oi(100, { mealAccess: [{ consumedAt: null }] })] } }],
        options: [
          {
            option: {
              orderItemSelections: [
                { orderItem: oi(100, { mealAccess: [{ consumedAt: null }] }) }, // doublon
                { orderItem: oi(101, { mealAccess: [{ consumedAt: consumed }] }) },
              ],
            },
          },
        ],
      })

      const rows = await createDefaultMealsPorts().ticketing.listMealTicketParticipants(42)

      expect(rows).toEqual([
        {
          orderItemId: 100,
          firstName: 'Prenom100',
          lastName: 'Nom100',
          email: 'u100@x.fr',
          consumedAt: null,
        },
        {
          orderItemId: 101,
          firstName: 'Prenom101',
          lastName: 'Nom101',
          email: 'u101@x.fr',
          consumedAt: consumed,
        },
      ])
    })

    it('renvoie [] si le repas est introuvable', async () => {
      prismaMock.volunteerMeal.findUnique.mockResolvedValue(null)
      expect(await createDefaultMealsPorts().ticketing.listMealTicketParticipants(42)).toEqual([])
    })
  })

  describe('validateConsumption', () => {
    const setupOrderItem = (over: Record<string, any> = {}) =>
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue({
        state: 'Processed',
        tierId: 7,
        selectedOptions: [],
        order: { editionId: 10, status: 'Paid' },
        ...over,
      })

    it('ok via accès tarif puis updateMany', async () => {
      setupOrderItem()
      prismaMock.volunteerMeal.findFirst.mockResolvedValue({ tiers: [{ tierId: 7 }], options: [] })
      prismaMock.ticketingOrderItemMeal.updateMany.mockResolvedValue({ count: 1 })

      const res = await createDefaultMealsPorts().ticketing.validateConsumption(
        10,
        42,
        100,
        new Date()
      )
      expect(res).toEqual({ ok: true })
    })

    it('not_found si commande d’une autre édition', async () => {
      setupOrderItem({ order: { editionId: 99, status: 'Paid' } })
      const res = await createDefaultMealsPorts().ticketing.validateConsumption(
        10,
        42,
        100,
        new Date()
      )
      expect(res).toEqual({ ok: false, reason: 'not_found' })
    })

    it('refunded si billet ou commande remboursé', async () => {
      setupOrderItem({ state: 'Refunded' })
      const res = await createDefaultMealsPorts().ticketing.validateConsumption(
        10,
        42,
        100,
        new Date()
      )
      expect(res).toEqual({ ok: false, reason: 'refunded' })
    })

    it('no_access si ni tarif ni option ne donnent accès', async () => {
      setupOrderItem({ tierId: 999, selectedOptions: [] })
      prismaMock.volunteerMeal.findFirst.mockResolvedValue({ tiers: [{ tierId: 7 }], options: [] })
      const res = await createDefaultMealsPorts().ticketing.validateConsumption(
        10,
        42,
        100,
        new Date()
      )
      expect(res).toEqual({ ok: false, reason: 'no_access' })
    })

    it('already si déjà consommé (updateMany 0 + create P2002)', async () => {
      setupOrderItem()
      prismaMock.volunteerMeal.findFirst.mockResolvedValue({ tiers: [{ tierId: 7 }], options: [] })
      prismaMock.ticketingOrderItemMeal.updateMany.mockResolvedValue({ count: 0 })
      prismaMock.ticketingOrderItemMeal.create.mockRejectedValue({ code: 'P2002' })

      const res = await createDefaultMealsPorts().ticketing.validateConsumption(
        10,
        42,
        100,
        new Date()
      )
      expect(res).toEqual({ ok: false, reason: 'already' })
    })
  })

  describe('cancelConsumption', () => {
    it('ok et supprime la validation', async () => {
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue({ order: { editionId: 10 } })

      const res = await createDefaultMealsPorts().ticketing.cancelConsumption(10, 42, 100)

      expect(res).toEqual({ ok: true })
      expect(prismaMock.ticketingOrderItemMeal.deleteMany).toHaveBeenCalledWith({
        where: { orderItemId: 100, mealId: 42 },
      })
    })

    it('not_found si commande d’une autre édition', async () => {
      prismaMock.ticketingOrderItem.findUnique.mockResolvedValue({ order: { editionId: 99 } })
      const res = await createDefaultMealsPorts().ticketing.cancelConsumption(10, 42, 100)
      expect(res).toEqual({ ok: false, reason: 'not_found' })
    })
  })
})
