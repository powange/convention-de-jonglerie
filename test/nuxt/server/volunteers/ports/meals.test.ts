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
})
