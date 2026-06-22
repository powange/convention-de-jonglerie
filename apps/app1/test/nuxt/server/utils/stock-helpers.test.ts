import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  isAnyTeamLeaderOnEdition,
  canAccessStock,
  getReservedQuantityOnPeriod,
} from '../../../../server/utils/stock-helpers'

import type { EditionWithPermissions } from '../../../../server/utils/permissions/edition-permissions'
import type { UserForPermissions } from '../../../../server/utils/permissions/types'

const prismaMock = (globalThis as any).prisma

const createMockEdition = (
  overrides: Partial<EditionWithPermissions> = {}
): EditionWithPermissions =>
  ({
    id: 1,
    conventionId: 10,
    creatorId: 100,
    name: 'Test',
    convention: {
      id: 10,
      authorId: 200,
      name: 'Convention',
      organizers: [],
    },
    organizerPermissions: [],
    ...overrides,
  }) as unknown as EditionWithPermissions

const createMockUser = (overrides: Partial<UserForPermissions> = {}): UserForPermissions => ({
  id: 999,
  email: 'user@test.com',
  pseudo: 'testuser',
  isGlobalAdmin: false,
  ...overrides,
})

describe('stock-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.editionVolunteerApplication.findFirst.mockReset()
    prismaMock.stockReservation.findMany.mockReset()
  })

  describe('isAnyTeamLeaderOnEdition', () => {
    it('retourne true si la candidature avec un team leader est trouvée', async () => {
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 1 })
      const result = await isAnyTeamLeaderOnEdition(50, 1)
      expect(result).toBe(true)
      expect(prismaMock.editionVolunteerApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 50,
            eventId: 1,
            teamAssignments: { some: { isLeader: true } },
          }),
        })
      )
    })

    it("retourne false si aucune candidature team-leader n'est trouvée", async () => {
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)
      const result = await isAnyTeamLeaderOnEdition(50, 1)
      expect(result).toBe(false)
    })
  })

  describe('canAccessStock', () => {
    it('autorise un organisateur avec canManageStock sans appel DB', async () => {
      const edition = createMockEdition({
        convention: {
          id: 10,
          authorId: 200,
          name: 'X',
          organizers: [{ userId: 999, canManageStock: true } as any],
        } as any,
      })
      const user = createMockUser({ id: 999 })
      const result = await canAccessStock(edition, user)
      expect(result).toBe(true)
      // Pas besoin de vérifier les team leaders si déjà autorisé
      expect(prismaMock.editionVolunteerApplication.findFirst).not.toHaveBeenCalled()
    })

    it('autorise un team leader sans canManageStock', async () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 999 })
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ id: 5 })
      const result = await canAccessStock(edition, user)
      expect(result).toBe(true)
    })

    it('refuse si ni canManageStock ni team leader', async () => {
      const edition = createMockEdition()
      const user = createMockUser({ id: 999 })
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)
      const result = await canAccessStock(edition, user)
      expect(result).toBe(false)
    })
  })

  describe('getReservedQuantityOnPeriod', () => {
    it('somme les quantityReserved des réservations actives sur la période', async () => {
      prismaMock.stockReservation.findMany.mockResolvedValue([
        { quantityReserved: 2 },
        { quantityReserved: 3 },
      ])
      const start = new Date('2026-06-10T10:00:00Z')
      const end = new Date('2026-06-10T18:00:00Z')
      const total = await getReservedQuantityOnPeriod(5, start, end)
      expect(total).toBe(5)
      expect(prismaMock.stockReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stockItemId: 5,
            status: { in: ['RESERVED', 'PICKED_UP'] },
            startsAt: { lt: end },
            endsAt: { gt: start },
          }),
        })
      )
    })

    it('exclut la réservation spécifiée via excludeReservationId', async () => {
      prismaMock.stockReservation.findMany.mockResolvedValue([])
      await getReservedQuantityOnPeriod(
        5,
        new Date('2026-06-10T10:00:00Z'),
        new Date('2026-06-10T18:00:00Z'),
        42
      )
      expect(prismaMock.stockReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 42 },
          }),
        })
      )
    })

    it('retourne 0 si aucune réservation active', async () => {
      prismaMock.stockReservation.findMany.mockResolvedValue([])
      const total = await getReservedQuantityOnPeriod(
        5,
        new Date('2026-06-10T10:00:00Z'),
        new Date('2026-06-10T18:00:00Z')
      )
      expect(total).toBe(0)
    })
  })
})
