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

  /**
   * ⚠️ Ces tests employaient le format des BÉNÉVOLES — « 2026-06-17_morning » — pour un artiste.
   * Les artistes n'ont jamais stocké cela. Les tests validaient donc une hypothèse fausse, et
   * c'est ce qui a rendu le défaut invisible : la fonction retombait toujours sur « tous les
   * repas », et aucun test ne pouvait le voir puisqu'ils la nourrissaient du mauvais format.
   *
   * Les cas complets vivent dans le bloc dédié, plus bas, sur de vrais instants.
   */
  describe('isArtistEligibleForMeal', () => {
    it('éligible sans contrainte de dates', () => {
      expect(
        isArtistEligibleForMeal(meal(), { arrivalDateTime: null, departureDateTime: null })
      ).toBe(true)
    })

    it('inéligible si arrivée après le repas', () => {
      expect(
        isArtistEligibleForMeal(meal({ date: new Date('2026-06-16') }), {
          arrivalDateTime: new Date('2026-06-17T09:00:00.000Z'),
          departureDateTime: null,
        })
      ).toBe(false)
    })

    it('inéligible si départ avant le repas', () => {
      expect(
        isArtistEligibleForMeal(meal({ date: new Date('2026-06-16') }), {
          arrivalDateTime: null,
          departureDateTime: new Date('2026-06-15T20:00:00.000Z'),
        })
      ).toBe(false)
    })
  })
})

/**
 * L'éligibilité d'un ARTISTE, réparée en même temps que ses horaires devenaient des instants.
 *
 * La fonction découpait la valeur sur un `_`, attendant le format `AAAA-MM-JJ_moment` des
 * bénévoles. Les artistes n'ont jamais stocké cela : le moment ressortait toujours `undefined`,
 * et le repli « tous les repas » s'appliquait sans que personne ne le voie.
 */
describe('isArtistEligibleForMeal — le moment se déduit de l’heure', () => {
  const repas = (jour: string, type: 'BREAKFAST' | 'LUNCH' | 'DINNER') => ({
    date: new Date(`${jour}T00:00:00.000Z`),
    mealType: type as never,
  })

  it('refuse le petit-déjeuner du jour où l’artiste arrive le soir', () => {
    // C'est le cas qui passait avant : arrivée à 23 h, et le petit-déjeuner du matin même était
    // accordé. Personne n'arrive avant d'être arrivé.
    const artiste = {
      arrivalDateTime: new Date('2026-09-25T23:00:00.000Z'),
      departureDateTime: null,
    }

    expect(isArtistEligibleForMeal(repas('2026-09-25', 'BREAKFAST'), artiste)).toBe(false)
    expect(isArtistEligibleForMeal(repas('2026-09-25', 'DINNER'), artiste)).toBe(true)
  })

  it('accorde les trois repas à qui arrive le matin', () => {
    const artiste = {
      arrivalDateTime: new Date('2026-09-25T08:00:00.000Z'),
      departureDateTime: null,
    }

    expect(isArtistEligibleForMeal(repas('2026-09-25', 'BREAKFAST'), artiste)).toBe(true)
    expect(isArtistEligibleForMeal(repas('2026-09-25', 'DINNER'), artiste)).toBe(true)
  })

  it('refuse le dîner du jour où l’artiste repart le matin', () => {
    const artiste = {
      arrivalDateTime: null,
      departureDateTime: new Date('2026-09-28T09:00:00.000Z'),
    }

    expect(isArtistEligibleForMeal(repas('2026-09-28', 'BREAKFAST'), artiste)).toBe(true)
    expect(isArtistEligibleForMeal(repas('2026-09-28', 'DINNER'), artiste)).toBe(false)
  })

  it('écarte les jours hors du séjour', () => {
    const artiste = {
      arrivalDateTime: new Date('2026-09-25T08:00:00.000Z'),
      departureDateTime: new Date('2026-09-28T09:00:00.000Z'),
    }

    expect(isArtistEligibleForMeal(repas('2026-09-24', 'DINNER'), artiste)).toBe(false)
    expect(isArtistEligibleForMeal(repas('2026-09-29', 'BREAKFAST'), artiste)).toBe(false)
    expect(isArtistEligibleForMeal(repas('2026-09-26', 'LUNCH'), artiste)).toBe(true)
  })

  it('reste ouvert quand aucun horaire n’est déclaré', () => {
    // Un artiste qui n'a rien dit ne doit pas se retrouver privé de repas.
    const artiste = { arrivalDateTime: null, departureDateTime: null }

    expect(isArtistEligibleForMeal(repas('2026-09-25', 'BREAKFAST'), artiste)).toBe(true)
  })
})
