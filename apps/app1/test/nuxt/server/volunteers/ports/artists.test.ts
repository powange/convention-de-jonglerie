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
            // Régime et allergies vivent sur le PROFIL depuis la suppression des colonnes
            // dupliquées : c'est le `user` de la fiche que le code lit.
            user: {
              nom: 'Star',
              prenom: 'Jo',
              email: 'jo@x.fr',
              phone: '0600',
              dietaryPreference: 'VEGAN',
              allergies: 'arachides',
              allergySeverity: 'HIGH',
            },
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
  describe('getShowSchedule', () => {
    it('ne remonte que les spectacles ayant au moins une représentation', async () => {
      prismaMock.show.findMany.mockResolvedValue([])

      await createDefaultVolunteerPorts().artists.getShowSchedule(7)

      // Un spectacle sans représentation n'offre rien à manquer : l'écarter en base évite de
      // le transporter jusqu'au front pour l'ignorer là-bas.
      expect(prismaMock.show.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { editionId: 7, performances: { some: {} } } })
      )
    })

    it('rend la durée du spectacle et les instants de ses représentations', async () => {
      prismaMock.show.findMany.mockResolvedValue([
        {
          id: 3,
          title: 'Cabaret',
          duration: 90,
          performances: [
            { startDateTime: new Date('2026-08-01T20:00:00.000Z') },
            { startDateTime: new Date('2026-08-02T20:00:00.000Z') },
          ],
        },
      ])

      const programme = await createDefaultVolunteerPorts().artists.getShowSchedule(7)

      expect(programme).toEqual([
        {
          id: 3,
          title: 'Cabaret',
          durationMinutes: 90,
          performances: [
            { startDateTime: '2026-08-01T20:00:00.000Z' },
            { startDateTime: '2026-08-02T20:00:00.000Z' },
          ],
        },
      ])
    })

    it('transmet une durée absente telle quelle, sans en inventer une', async () => {
      prismaMock.show.findMany.mockResolvedValue([
        {
          id: 4,
          title: 'Scène ouverte',
          duration: null,
          performances: [{ startDateTime: new Date('2026-08-01T20:00:00.000Z') }],
        },
      ])

      const programme = await createDefaultVolunteerPorts().artists.getShowSchedule(7)

      expect(programme[0]?.durationMinutes).toBeNull()
    })
  })
})
