import { prisma } from './prisma'

import type { VolunteerMealType } from '@prisma/client'

/**
 * Détermine quels types de repas sont disponibles selon l'heure d'arrivée
 * Règles :
 * - Arrivée matin (early_morning, morning) → petit-déj + déjeuner + dîner
 * - Arrivée midi (lunch) → déjeuner + dîner
 * - Arrivée après-midi (early_afternoon, late_afternoon) → dîner seulement
 * - Arrivée soir (evening, late_evening, night) → dîner seulement
 */
export function getAvailableMealsOnArrival(timeOfDay: string): VolunteerMealType[] {
  switch (timeOfDay) {
    case 'early_morning':
    case 'morning':
      return ['BREAKFAST', 'LUNCH', 'DINNER']
    case 'lunch':
      return ['LUNCH', 'DINNER']
    case 'early_afternoon':
    case 'late_afternoon':
    case 'evening':
    case 'late_evening':
    case 'night':
      return ['DINNER']
    default:
      return ['BREAKFAST', 'LUNCH', 'DINNER']
  }
}

/**
 * Détermine quels types de repas sont disponibles selon l'heure de départ
 * Règles inverses :
 * - Départ matin (early_morning, morning) → petit-déj
 * - Départ midi (lunch) → petit-déj + déjeuner
 * - Départ après-midi (early_afternoon, late_afternoon) → petit-déj + déjeuner
 * - Départ soir (evening, late_evening, night) → petit-déj + déjeuner + dîner
 */
export function getAvailableMealsOnDeparture(timeOfDay: string): VolunteerMealType[] {
  switch (timeOfDay) {
    case 'early_morning':
    case 'morning':
      return ['BREAKFAST']
    case 'lunch':
    case 'early_afternoon':
    case 'late_afternoon':
      return ['BREAKFAST', 'LUNCH']
    case 'evening':
    case 'late_evening':
    case 'night':
      return ['BREAKFAST', 'LUNCH', 'DINNER']
    default:
      return ['BREAKFAST', 'LUNCH', 'DINNER']
  }
}

/**
 * Vérifie si un bénévole est éligible à un repas spécifique
 * en fonction de ses disponibilités et dates d'arrivée/départ
 */
export function isVolunteerEligibleForMeal(
  meal: { date: Date; mealType: VolunteerMealType; phase: string },
  volunteer: {
    setupAvailability: boolean
    teardownAvailability: boolean
    eventAvailability: boolean
    arrivalDateTime: string | null
    departureDateTime: string | null
  }
): boolean {
  // Filtrer par phase selon les disponibilités
  if (meal.phase === 'SETUP' && !volunteer.setupAvailability) return false
  if (meal.phase === 'TEARDOWN' && !volunteer.teardownAvailability) return false
  if (meal.phase === 'EVENT' && !volunteer.eventAvailability) return false

  // Filtrer par dates d'arrivée et de départ si renseignées
  const mealDate = new Date(meal.date)
  mealDate.setUTCHours(0, 0, 0, 0)

  if (volunteer.arrivalDateTime) {
    // Format: YYYY-MM-DD_timeOfDay
    const [arrivalDatePart, arrivalTimeOfDay] = volunteer.arrivalDateTime.split('_')
    const arrivalDate = new Date(arrivalDatePart)
    arrivalDate.setUTCHours(0, 0, 0, 0)

    if (mealDate < arrivalDate) return false

    // Si c'est le jour d'arrivée, vérifier l'heure
    if (mealDate.getTime() === arrivalDate.getTime()) {
      const availableMeals = getAvailableMealsOnArrival(arrivalTimeOfDay)
      if (!availableMeals.includes(meal.mealType)) return false
    }
  }

  if (volunteer.departureDateTime) {
    // Format: YYYY-MM-DD_timeOfDay
    const [departureDatePart, departureTimeOfDay] = volunteer.departureDateTime.split('_')
    const departureDate = new Date(departureDatePart)
    departureDate.setUTCHours(0, 0, 0, 0)

    if (mealDate > departureDate) return false

    // Si c'est le jour de départ, vérifier l'heure
    if (mealDate.getTime() === departureDate.getTime()) {
      const availableMeals = getAvailableMealsOnDeparture(departureTimeOfDay)
      if (!availableMeals.includes(meal.mealType)) return false
    }
  }

  return true
}

/**
 * Vérifie si un artiste est éligible à un repas spécifique
 * en fonction de ses dates d'arrivée/départ
 */
export function isArtistEligibleForMeal(
  meal: { date: Date; mealType: VolunteerMealType },
  artist: {
    arrivalDateTime: string | null
    departureDateTime: string | null
  }
): boolean {
  // Filtrer par dates d'arrivée et de départ si renseignées
  const mealDate = new Date(meal.date)
  mealDate.setUTCHours(0, 0, 0, 0)

  if (artist.arrivalDateTime) {
    // Format: YYYY-MM-DD_timeOfDay
    const [arrivalDatePart, arrivalTimeOfDay] = artist.arrivalDateTime.split('_')
    const arrivalDate = new Date(arrivalDatePart)
    arrivalDate.setUTCHours(0, 0, 0, 0)

    if (mealDate < arrivalDate) return false

    // Si c'est le jour d'arrivée, vérifier l'heure
    if (mealDate.getTime() === arrivalDate.getTime()) {
      const availableMeals = getAvailableMealsOnArrival(arrivalTimeOfDay)
      if (!availableMeals.includes(meal.mealType)) return false
    }
  }

  if (artist.departureDateTime) {
    // Format: YYYY-MM-DD_timeOfDay
    const [departureDatePart, departureTimeOfDay] = artist.departureDateTime.split('_')
    const departureDate = new Date(departureDatePart)
    departureDate.setUTCHours(0, 0, 0, 0)

    if (mealDate > departureDate) return false

    // Si c'est le jour de départ, vérifier l'heure
    if (mealDate.getTime() === departureDate.getTime()) {
      const availableMeals = getAvailableMealsOnDeparture(departureTimeOfDay)
      if (!availableMeals.includes(meal.mealType)) return false
    }
  }

  return true
}

/**
 * Crée automatiquement les sélections de repas pour un bénévole accepté
 * Filtre selon ses disponibilités (setup/event/teardown) et ses dates d'arrivée/départ
 */
export async function createVolunteerMealSelections(
  volunteerId: number,
  editionId: number
): Promise<void> {
  // Récupérer le bénévole avec ses disponibilités
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: { id: volunteerId },
    select: {
      id: true,
      setupAvailability: true,
      teardownAvailability: true,
      eventAvailability: true,
      arrivalDateTime: true,
      departureDateTime: true,
    },
  })

  if (!volunteer) {
    throw new Error('Bénévole introuvable')
  }

  // Récupérer tous les repas activés pour l'édition
  const allMeals = await prisma.volunteerMeal.findMany({
    where: {
      editionId,
      enabled: true,
    },
  })

  // Filtrer les repas selon les disponibilités du bénévole
  const eligibleMeals = allMeals.filter((meal) => isVolunteerEligibleForMeal(meal, volunteer))

  // Vérifier quelles sélections existent déjà
  const existingSelections = await prisma.volunteerMealSelection.findMany({
    where: {
      volunteerId: volunteer.id,
      mealId: {
        in: eligibleMeals.map((m) => m.id),
      },
    },
  })

  const existingMealIds = new Set(existingSelections.map((s) => s.mealId))

  // Créer les sélections manquantes avec accepted=true par défaut
  const selectionsToCreate = eligibleMeals
    .filter((meal) => !existingMealIds.has(meal.id))
    .map((meal) => ({
      volunteerId: volunteer.id,
      mealId: meal.id,
      accepted: true,
    }))

  if (selectionsToCreate.length > 0) {
    await prisma.volunteerMealSelection.createMany({
      data: selectionsToCreate,
    })
  }
}

/**
 * Supprime toutes les sélections de repas d'un bénévole
 */
export async function deleteVolunteerMealSelections(volunteerId: number): Promise<void> {
  await prisma.volunteerMealSelection.deleteMany({
    where: {
      volunteerId,
    },
  })
}
