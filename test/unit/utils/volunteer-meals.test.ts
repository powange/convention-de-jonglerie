import { describe, it, expect } from 'vitest'

import {
  getAvailableMealsOnArrival,
  getAvailableMealsOnDeparture,
  isVolunteerEligibleForMeal,
  isArtistEligibleForMeal,
} from '../../../server/utils/volunteer-meals'

// Disponibilités de base d'un bénévole (toutes phases dispo, sans contrainte de dates).
const fullyAvailable = {
  setupAvailability: true,
  teardownAvailability: true,
  eventAvailability: true,
  arrivalDateTime: null,
  departureDateTime: null,
}

const meal = (over: Partial<{ date: Date; mealType: any; phases: string[] }> = {}) => ({
  date: over.date ?? new Date('2026-06-16'),
  mealType: over.mealType ?? 'LUNCH',
  phases: over.phases ?? ['EVENT'],
})

describe('volunteer-meals — fonctions pures d’éligibilité', () => {
  describe('getAvailableMealsOnArrival', () => {
    it('matin → petit-déj + déjeuner + dîner', () => {
      expect(getAvailableMealsOnArrival('morning')).toEqual(['BREAKFAST', 'LUNCH', 'DINNER'])
    })
    it('midi → déjeuner + dîner', () => {
      expect(getAvailableMealsOnArrival('noon')).toEqual(['LUNCH', 'DINNER'])
    })
    it('après-midi et soir → dîner seulement', () => {
      expect(getAvailableMealsOnArrival('afternoon')).toEqual(['DINNER'])
      expect(getAvailableMealsOnArrival('evening')).toEqual(['DINNER'])
    })
    it('valeur inconnue → tous les repas (défaut permissif)', () => {
      expect(getAvailableMealsOnArrival('whatever')).toEqual(['BREAKFAST', 'LUNCH', 'DINNER'])
    })
  })

  describe('getAvailableMealsOnDeparture', () => {
    it('matin → petit-déj seulement', () => {
      expect(getAvailableMealsOnDeparture('morning')).toEqual(['BREAKFAST'])
    })
    it('midi et après-midi → petit-déj + déjeuner', () => {
      expect(getAvailableMealsOnDeparture('noon')).toEqual(['BREAKFAST', 'LUNCH'])
      expect(getAvailableMealsOnDeparture('afternoon')).toEqual(['BREAKFAST', 'LUNCH'])
    })
    it('soir → tous les repas', () => {
      expect(getAvailableMealsOnDeparture('evening')).toEqual(['BREAKFAST', 'LUNCH', 'DINNER'])
    })
    it('valeur inconnue → tous les repas (défaut permissif)', () => {
      expect(getAvailableMealsOnDeparture('whatever')).toEqual(['BREAKFAST', 'LUNCH', 'DINNER'])
    })
  })

  describe('isVolunteerEligibleForMeal — phases', () => {
    it('éligible si une phase du repas correspond à une disponibilité', () => {
      expect(isVolunteerEligibleForMeal(meal({ phases: ['EVENT'] }), fullyAvailable)).toBe(true)
    })

    it('inéligible si aucune phase ne correspond à une disponibilité', () => {
      expect(
        isVolunteerEligibleForMeal(meal({ phases: ['SETUP'] }), {
          ...fullyAvailable,
          setupAvailability: false,
        })
      ).toBe(false)
    })

    it('éligible si AU MOINS une phase correspond (multi-phases)', () => {
      const v = {
        setupAvailability: false,
        teardownAvailability: true,
        eventAvailability: false,
        arrivalDateTime: null,
        departureDateTime: null,
      }
      expect(isVolunteerEligibleForMeal(meal({ phases: ['SETUP', 'TEARDOWN'] }), v)).toBe(true)
    })
  })

  describe('isVolunteerEligibleForMeal — dates d’arrivée / départ', () => {
    it('inéligible si arrivée après le jour du repas', () => {
      expect(
        isVolunteerEligibleForMeal(meal({ date: new Date('2026-06-16') }), {
          ...fullyAvailable,
          arrivalDateTime: '2026-06-17_morning',
        })
      ).toBe(false)
    })

    it('le jour d’arrivée, filtre selon l’heure d’arrivée', () => {
      // Arrive à midi → BREAKFAST indisponible, LUNCH disponible
      expect(
        isVolunteerEligibleForMeal(meal({ mealType: 'BREAKFAST' }), {
          ...fullyAvailable,
          arrivalDateTime: '2026-06-16_noon',
        })
      ).toBe(false)
      expect(
        isVolunteerEligibleForMeal(meal({ mealType: 'LUNCH' }), {
          ...fullyAvailable,
          arrivalDateTime: '2026-06-16_noon',
        })
      ).toBe(true)
    })

    it('inéligible si départ avant le jour du repas', () => {
      expect(
        isVolunteerEligibleForMeal(meal({ date: new Date('2026-06-16') }), {
          ...fullyAvailable,
          departureDateTime: '2026-06-15_evening',
        })
      ).toBe(false)
    })

    it('le jour de départ, filtre selon l’heure de départ', () => {
      // Part le matin → seul BREAKFAST disponible
      expect(
        isVolunteerEligibleForMeal(meal({ mealType: 'DINNER' }), {
          ...fullyAvailable,
          departureDateTime: '2026-06-16_morning',
        })
      ).toBe(false)
      expect(
        isVolunteerEligibleForMeal(meal({ mealType: 'BREAKFAST' }), {
          ...fullyAvailable,
          departureDateTime: '2026-06-16_morning',
        })
      ).toBe(true)
    })

    it('éligible sur un jour intermédiaire (entre arrivée et départ)', () => {
      expect(
        isVolunteerEligibleForMeal(meal({ date: new Date('2026-06-16'), mealType: 'BREAKFAST' }), {
          ...fullyAvailable,
          arrivalDateTime: '2026-06-15_morning',
          departureDateTime: '2026-06-17_evening',
        })
      ).toBe(true)
    })
  })

  describe('isArtistEligibleForMeal', () => {
    it('éligible sans contrainte de dates', () => {
      expect(
        isArtistEligibleForMeal(meal(), { arrivalDateTime: null, departureDateTime: null })
      ).toBe(true)
    })

    it('inéligible si arrivée après le repas', () => {
      expect(
        isArtistEligibleForMeal(meal({ date: new Date('2026-06-16') }), {
          arrivalDateTime: '2026-06-17_morning',
          departureDateTime: null,
        })
      ).toBe(false)
    })

    it('le jour d’arrivée, filtre selon l’heure', () => {
      expect(
        isArtistEligibleForMeal(meal({ mealType: 'BREAKFAST' }), {
          arrivalDateTime: '2026-06-16_afternoon',
          departureDateTime: null,
        })
      ).toBe(false)
      expect(
        isArtistEligibleForMeal(meal({ mealType: 'DINNER' }), {
          arrivalDateTime: '2026-06-16_afternoon',
          departureDateTime: null,
        })
      ).toBe(true)
    })

    it('inéligible si départ avant le repas', () => {
      expect(
        isArtistEligibleForMeal(meal({ date: new Date('2026-06-16') }), {
          arrivalDateTime: null,
          departureDateTime: '2026-06-15_evening',
        })
      ).toBe(false)
    })
  })
})
