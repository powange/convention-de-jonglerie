import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultVolunteerPorts } from '../../../../../server/volunteers/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

// Construit un orderItem mock minimal
const orderItem = (
  id: number,
  over: Partial<{
    lastName: string | null
    firstName: string | null
    email: string | null
    order: {
      payerLastName: string | null
      payerFirstName: string | null
      payerEmail: string | null
    }
  }> = {}
) => ({
  id,
  lastName: over.lastName ?? `Nom${id}`,
  firstName: over.firstName ?? `Prenom${id}`,
  email: over.email ?? `u${id}@x.fr`,
  order: over.order ?? {
    payerLastName: `Payeur${id}`,
    payerFirstName: `P${id}`,
    payerEmail: `payeur${id}@x.fr`,
  },
})

describe('port ticketing (câblage jonglerie par défaut)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMealTicketParticipants', () => {
    it('agrège tarifs + options et déduplique par orderItem', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 1,
          tiers: [{ tier: { orderItems: [orderItem(100), orderItem(101)] } }],
          options: [
            {
              option: {
                orderItemSelections: [
                  { orderItem: orderItem(100) }, // doublon du tarif → ignoré
                  { orderItem: orderItem(102) },
                  { orderItem: null }, // null → ignoré
                ],
              },
            },
          ],
        },
      ])

      const result = await createDefaultVolunteerPorts().ticketing.getMealTicketParticipants([1])

      expect(result[1]).toHaveLength(3)
      expect(result[1].map((p) => p.email)).toEqual(['u100@x.fr', 'u101@x.fr', 'u102@x.fr'])
      expect(prismaMock.volunteerMeal.findMany).toHaveBeenCalledTimes(1)
    })

    it('retombe sur le payeur de la commande si les champs orderItem sont nuls', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 2,
          tiers: [
            {
              tier: {
                orderItems: [
                  {
                    id: 200,
                    lastName: null,
                    firstName: null,
                    email: null,
                    order: {
                      payerLastName: 'Dupont',
                      payerFirstName: 'Marie',
                      payerEmail: 'marie@x.fr',
                    },
                  },
                ],
              },
            },
          ],
          options: [],
        },
      ])

      const result = await createDefaultVolunteerPorts().ticketing.getMealTicketParticipants([2])

      expect(result[2]).toEqual([{ nom: 'Dupont', prenom: 'Marie', email: 'marie@x.fr' }])
    })

    it('court-circuite sans requête pour une liste vide', async () => {
      const result = await createDefaultVolunteerPorts().ticketing.getMealTicketParticipants([])

      expect(result).toEqual({})
      expect(prismaMock.volunteerMeal.findMany).not.toHaveBeenCalled()
    })
  })

  describe('getHandoutItems', () => {
    it('mappe le catalogue par id (id + name)', async () => {
      prismaMock.ticketingHandoutItem.findMany.mockResolvedValue([
        { id: 5, name: 'T-shirt' },
        { id: 6, name: 'Badge' },
      ])

      const result = await createDefaultVolunteerPorts().ticketing.getHandoutItems([5, 6])

      expect(result).toEqual({
        5: { id: 5, name: 'T-shirt' },
        6: { id: 6, name: 'Badge' },
      })
      expect(prismaMock.ticketingHandoutItem.findMany).toHaveBeenCalledWith({
        where: { id: { in: [5, 6] } },
        select: { id: true, name: true },
      })
    })

    it('court-circuite sans requête pour une liste vide', async () => {
      const result = await createDefaultVolunteerPorts().ticketing.getHandoutItems([])

      expect(result).toEqual({})
      expect(prismaMock.ticketingHandoutItem.findMany).not.toHaveBeenCalled()
    })
  })
})
