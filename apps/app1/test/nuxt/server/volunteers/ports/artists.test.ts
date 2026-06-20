import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultVolunteerPorts } from '../../../../../server/volunteers/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('port artists (câblage jonglerie par défaut)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('addEligibleMealSelections', () => {
    it('upsert uniquement les artistes éligibles selon leurs dates', async () => {
      prismaMock.editionArtist.findMany.mockResolvedValue([
        { id: 1, arrivalDateTime: null, departureDateTime: null }, // toujours éligible
        { id: 2, arrivalDateTime: '2099-01-01_morning', departureDateTime: null }, // arrive trop tard
      ])

      await createDefaultVolunteerPorts().artists.addEligibleMealSelections({
        editionId: 10,
        mealId: 42,
        date: new Date('2026-06-16'),
        mealType: 'LUNCH',
      })

      expect(prismaMock.editionArtist.findMany).toHaveBeenCalledWith({
        where: { editionId: 10 },
        select: { id: true, arrivalDateTime: true, departureDateTime: true },
      })
      // Seul l'artiste 1 (éligible) est upserté
      expect(prismaMock.artistMealSelection.upsert).toHaveBeenCalledTimes(1)
      expect(prismaMock.artistMealSelection.upsert).toHaveBeenCalledWith({
        where: { artistId_mealId: { artistId: 1, mealId: 42 } },
        create: { artistId: 1, mealId: 42, selected: true },
        update: { selected: true },
      })
    })
  })

  describe('removeMealSelections', () => {
    it('supprime toutes les sélections artistes du repas', async () => {
      await createDefaultVolunteerPorts().artists.removeMealSelections(42)

      expect(prismaMock.artistMealSelection.deleteMany).toHaveBeenCalledWith({
        where: { mealId: 42 },
      })
    })
  })

  describe('getMealArtistParticipants', () => {
    it('mappe les sélections acceptées en participants par repas', async () => {
      prismaMock.artistMealSelection.findMany.mockResolvedValue([
        {
          mealId: 42,
          afterShow: true,
          artist: {
            dietaryPreference: 'VEGAN',
            allergies: 'arachides',
            allergySeverity: 'HIGH',
            user: { nom: 'Star', prenom: 'Jo', email: 'jo@x.fr', phone: '0600' },
          },
        },
      ])

      const result = await createDefaultVolunteerPorts().artists.getMealArtistParticipants([42])

      expect(result).toEqual({
        42: [
          {
            nom: 'Star',
            prenom: 'Jo',
            email: 'jo@x.fr',
            phone: '0600',
            dietaryPreference: 'VEGAN',
            allergies: 'arachides',
            allergySeverity: 'HIGH',
            afterShow: true,
          },
        ],
      })
      expect(prismaMock.artistMealSelection.findMany).toHaveBeenCalledWith({
        where: { mealId: { in: [42] }, accepted: true },
        select: expect.objectContaining({ mealId: true, afterShow: true }),
      })
    })

    it('court-circuite sans requête pour une liste vide', async () => {
      const result = await createDefaultVolunteerPorts().artists.getMealArtistParticipants([])

      expect(result).toEqual({})
      expect(prismaMock.artistMealSelection.findMany).not.toHaveBeenCalled()
    })
  })
})
