import { describe, it, expect, vi, beforeEach } from 'vitest'

// setArtistInfo invalide le cache d'édition (effet de bord côté core).
vi.mock('#server/utils/cache-helpers', () => ({ invalidateEditionCache: vi.fn() }))

import { invalidateEditionCache } from '#server/utils/cache-helpers'

import { createDefaultArtistsPorts } from '../../../../../server/artists/ports/default-binding'

const prismaMock = (globalThis as any).prisma

describe('ports du module artistes (câblage jonglerie)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('event.setArtistInfo', () => {
    it('écrit Edition.artistInfo, invalide le cache et renvoie {id, artistInfo}', async () => {
      prismaMock.edition.update.mockResolvedValue({ id: 10, artistInfo: 'Infos artistes' })

      const res = await createDefaultArtistsPorts().event.setArtistInfo(10, 'Infos artistes')

      expect(res).toEqual({ id: 10, artistInfo: 'Infos artistes' })
      expect(prismaMock.edition.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { artistInfo: 'Infos artistes' },
        select: { id: true, artistInfo: true },
      })
      expect(invalidateEditionCache).toHaveBeenCalledWith(10)
    })

    it('accepte une valeur null', async () => {
      prismaMock.edition.update.mockResolvedValue({ id: 10, artistInfo: null })
      const res = await createDefaultArtistsPorts().event.setArtistInfo(10, null)
      expect(res.artistInfo).toBeNull()
    })
  })

  describe('meals.getEnabledMeals', () => {
    it('renvoie le catalogue des repas activés trié (date, type)', async () => {
      const meals = [{ id: 1, date: new Date('2026-07-01'), mealType: 'LUNCH', enabled: true }]
      prismaMock.volunteerMeal.findMany.mockResolvedValue(meals)

      const res = await createDefaultArtistsPorts().meals.getEnabledMeals(10)

      expect(res).toEqual(meals)
      expect(prismaMock.volunteerMeal.findMany).toHaveBeenCalledWith({
        where: { editionId: 10, enabled: true },
        orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      })
    })
  })
})
