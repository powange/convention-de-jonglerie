import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createDefaultVolunteerPorts } from '../../../../../server/volunteers/ports/default-binding'

// Mock global de Prisma défini dans test/setup-common.ts
const prismaMock = (globalThis as any).prisma

describe('port meals (câblage jonglerie → module repas cœur)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createVolunteerMealSelections', () => {
    it('crée les sélections des repas éligibles non encore existantes', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        id: 5,
        setupAvailability: true,
        teardownAvailability: true,
        eventAvailability: true,
        arrivalDateTime: null,
        departureDateTime: null,
      })
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          enabled: true,
        },
        {
          id: 2,
          date: new Date('2026-06-16'),
          mealType: 'DINNER',
          phases: ['EVENT'],
          enabled: true,
        },
      ])
      prismaMock.volunteerMealSelection.findMany.mockResolvedValue([{ mealId: 1 }]) // 1 existe déjà

      await createDefaultVolunteerPorts().meals.createVolunteerMealSelections(5, 10)

      expect(prismaMock.volunteerMealSelection.createMany).toHaveBeenCalledWith({
        data: [{ volunteerId: 5, mealId: 2, accepted: true }],
      })
    })

    it('lève si le bénévole est introuvable', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue(null)

      await expect(
        createDefaultVolunteerPorts().meals.createVolunteerMealSelections(999, 10)
      ).rejects.toThrow()
    })
  })

  describe('deleteVolunteerMealSelections', () => {
    it('supprime toutes les sélections du bénévole', async () => {
      await createDefaultVolunteerPorts().meals.deleteVolunteerMealSelections(5)

      expect(prismaMock.volunteerMealSelection.deleteMany).toHaveBeenCalledWith({
        where: { volunteerId: 5 },
      })
    })
  })

  describe('getCateringMealsForDate', () => {
    it('mappe les repas avec leurs participants bénévoles acceptés', async () => {
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 1,
          mealType: 'LUNCH',
          phases: ['EVENT'],
          mealSelections: [
            {
              volunteer: {
                dietaryPreference: 'VEGAN',
                allergies: 'arachides',
                allergySeverity: 'HIGH',
                emergencyContactName: 'Maman',
                emergencyContactPhone: '0600',
                user: { nom: 'Doe', prenom: 'John', email: 'j@x.fr', phone: '0700' },
              },
            },
          ],
        },
      ])

      const result = await createDefaultVolunteerPorts().meals.getCateringMealsForDate(
        10,
        '2026-06-16'
      )

      expect(result).toEqual([
        {
          id: 1,
          mealType: 'LUNCH',
          phases: ['EVENT'],
          volunteers: [
            {
              nom: 'Doe',
              prenom: 'John',
              email: 'j@x.fr',
              phone: '0700',
              dietaryPreference: 'VEGAN',
              allergies: 'arachides',
              allergySeverity: 'HIGH',
              emergencyContactName: 'Maman',
              emergencyContactPhone: '0600',
            },
          ],
        },
      ])
    })
  })

  describe('getVolunteerMeals', () => {
    it('renvoie les repas avec sélection et éligibilité calculée', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        eventId: 10,
        setupAvailability: false,
        eventAvailability: true,
        teardownAvailability: false,
        arrivalDateTime: null,
        departureDateTime: null,
      })
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          mealSelections: [{ id: 99, accepted: true }],
        },
      ])

      const result = await createDefaultVolunteerPorts().meals.getVolunteerMeals(10, 5)

      expect(result).toEqual([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          selectionId: 99,
          accepted: true,
          eligible: true,
        },
      ])
    })

    it('lève 404 si le bénévole n’appartient pas à l’édition', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({ eventId: 999 })

      await expect(createDefaultVolunteerPorts().meals.getVolunteerMeals(10, 5)).rejects.toThrow()
    })
  })

  describe('getEditionMealSchedule', () => {
    it('crée les repas manquants (3 par jour de la période)', async () => {
      prismaMock.event.findUnique.mockResolvedValue({
        startDate: new Date('2026-06-16'),
        endDate: new Date('2026-06-16'),
        volunteerSettings: null,
      })
      prismaMock.volunteerMeal.findMany
        .mockResolvedValueOnce([]) // repas existants
        .mockResolvedValueOnce([{ id: 1, handoutItems: [] }]) // re-lecture finale

      await createDefaultVolunteerPorts().meals.getEditionMealSchedule(10)

      expect(prismaMock.volunteerMeal.createMany).toHaveBeenCalledTimes(1)
      const created = prismaMock.volunteerMeal.createMany.mock.calls[0][0].data
      expect(created).toHaveLength(3)
      expect(created.map((m: any) => m.mealType)).toEqual(['BREAKFAST', 'LUNCH', 'DINNER'])
      expect(created.every((m: any) => m.editionId === 10 && m.phases[0] === 'EVENT')).toBe(true)
    })

    it('ne crée ni ne supprime rien si le planning est déjà à jour', async () => {
      prismaMock.event.findUnique.mockResolvedValue({
        startDate: new Date('2026-06-16'),
        endDate: new Date('2026-06-16'),
        volunteerSettings: null,
      })
      const existing = [{ id: 1, date: new Date('2026-06-16'), handoutItems: [] }]
      prismaMock.volunteerMeal.findMany.mockResolvedValue(existing)

      const result = await createDefaultVolunteerPorts().meals.getEditionMealSchedule(10)

      expect(prismaMock.volunteerMeal.createMany).not.toHaveBeenCalled()
      expect(prismaMock.volunteerMeal.deleteMany).not.toHaveBeenCalled()
      expect(result).toBe(existing)
    })

    it('lève 404 si l’événement est introuvable', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null)

      await expect(
        createDefaultVolunteerPorts().meals.getEditionMealSchedule(999)
      ).rejects.toThrow()
    })
  })

  describe('updateEditionMealsConfig', () => {
    it('à l’activation d’un repas, upsert les bénévoles éligibles et renvoie la bascule', async () => {
      prismaMock.volunteerMeal.findMany
        .mockResolvedValueOnce([{ id: 1, enabled: false }]) // état avant (currentMeals)
        .mockResolvedValueOnce([{ id: 1, handoutItems: [] }]) // re-lecture finale
      prismaMock.volunteerMeal.findUnique.mockResolvedValue({
        date: new Date('2026-06-16'),
        mealType: 'LUNCH',
        phases: ['EVENT'],
      })
      prismaMock.editionVolunteerApplication.findMany.mockResolvedValue([
        {
          id: 1,
          setupAvailability: true,
          teardownAvailability: true,
          eventAvailability: true,
          arrivalDateTime: null,
          departureDateTime: null,
        },
      ])

      const { toggles } = await createDefaultVolunteerPorts().meals.updateEditionMealsConfig(10, [
        { id: 1, enabled: true },
      ])

      expect(prismaMock.volunteerMeal.update).toHaveBeenCalled()
      expect(prismaMock.volunteerMealSelection.upsert).toHaveBeenCalledWith({
        where: { volunteerId_mealId: { volunteerId: 1, mealId: 1 } },
        create: { volunteerId: 1, mealId: 1, selected: true },
        update: { selected: true },
      })
      expect(toggles).toEqual([
        { mealId: 1, date: new Date('2026-06-16'), mealType: 'LUNCH', enabled: true },
      ])
    })

    it('à la désactivation, supprime les sélections et renvoie une bascule off', async () => {
      prismaMock.volunteerMeal.findMany
        .mockResolvedValueOnce([{ id: 2, enabled: true }]) // état avant
        .mockResolvedValueOnce([{ id: 2, handoutItems: [] }]) // re-lecture finale

      const { toggles } = await createDefaultVolunteerPorts().meals.updateEditionMealsConfig(10, [
        { id: 2, enabled: false },
      ])

      expect(prismaMock.volunteerMealSelection.deleteMany).toHaveBeenCalledWith({
        where: { mealId: 2 },
      })
      expect(toggles).toEqual([{ mealId: 2, date: new Date(0), mealType: '', enabled: false }])
    })
  })

  describe('getVolunteerSelfMeals', () => {
    it('auto-crée les sélections manquantes et renvoie les repas', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        id: 7,
        status: 'ACCEPTED',
        setupAvailability: true,
        teardownAvailability: true,
        eventAvailability: true,
        arrivalDateTime: null,
        departureDateTime: null,
      })
      prismaMock.volunteerMeal.findMany.mockResolvedValue([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          enabled: true,
        },
      ])
      prismaMock.volunteerMealSelection.findMany
        .mockResolvedValueOnce([]) // sélections existantes
        .mockResolvedValueOnce([{ id: 50, mealId: 1, accepted: true }]) // nouvelles relues

      const result = await createDefaultVolunteerPorts().meals.getVolunteerSelfMeals(10, 99)

      expect(prismaMock.volunteerMealSelection.createMany).toHaveBeenCalledWith({
        data: [{ volunteerId: 7, mealId: 1, accepted: true }],
      })
      expect(result).toEqual([
        {
          id: 1,
          date: new Date('2026-06-16'),
          mealType: 'LUNCH',
          phases: ['EVENT'],
          selectionId: 50,
          accepted: true,
        },
      ])
    })

    it('lève 403 si la candidature n’est pas ACCEPTED', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        id: 7,
        status: 'PENDING',
      })

      await expect(
        createDefaultVolunteerPorts().meals.getVolunteerSelfMeals(10, 99)
      ).rejects.toThrow()
    })
  })

  describe('setVolunteerMeals', () => {
    it('crée les sélections sans selectionId et met à jour celles avec', async () => {
      prismaMock.editionVolunteerApplication.findUnique.mockResolvedValue({
        eventId: 10,
        setupAvailability: true,
        eventAvailability: true,
        teardownAvailability: true,
        arrivalDateTime: null,
        departureDateTime: null,
      })
      prismaMock.volunteerMeal.findMany.mockResolvedValue([])

      await createDefaultVolunteerPorts().meals.setVolunteerMeals(10, 5, [
        { mealId: 1, accepted: true }, // pas de selectionId → create
        { selectionId: 88, mealId: 2, accepted: false }, // selectionId → update
      ])

      expect(prismaMock.volunteerMealSelection.create).toHaveBeenCalledWith({
        data: { volunteerId: 5, mealId: 1, accepted: true },
      })
      expect(prismaMock.volunteerMealSelection.update).toHaveBeenCalledWith({
        where: { id: 88, volunteerId: 5 },
        data: { accepted: false },
      })
    })
  })
})
