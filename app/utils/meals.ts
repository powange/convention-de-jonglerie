/**
 * Utilitaires pour la gestion des repas (frontend)
 */

import type { ComputedRef, Ref } from 'vue'

// Types
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER'
export type MealPhase = 'SETUP' | 'EVENT' | 'TEARDOWN'

export interface Meal {
  id: number
  date: string | Date
  mealType: MealType
  phases?: MealPhase[]
  accepted?: boolean
  afterShow?: boolean
  [key: string]: any
}

export interface GroupedMeal {
  date: string
  meals: Meal[]
}

/**
 * Formate une date pour l'affichage des repas
 */
export const formatMealDate = (dateStr: string | Date, locale: string = 'fr-FR'): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Groupe les repas par date
 */
export const groupMealsByDate = (meals: Meal[]): Record<string, Meal[]> => {
  const grouped: Record<string, Meal[]> = {}

  meals.forEach((meal) => {
    const dateKey =
      typeof meal.date === 'string'
        ? meal.date.split('T')[0]
        : meal.date.toISOString().split('T')[0]

    if (!dateKey) return

    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }

    grouped[dateKey]!.push(meal)
  })

  return grouped
}

/**
 * Vérifie si les repas ont été modifiés
 */
export const hasUnsavedMealChanges = (
  currentMeals: Ref<Meal[]>,
  initialMeals: Ref<Meal[]>
): ComputedRef<boolean> => {
  return computed(() => {
    if (currentMeals.value.length !== initialMeals.value.length) return true

    return currentMeals.value.some((meal, index) => {
      const initialMeal = initialMeals.value[index]
      if (!initialMeal) return true

      // Vérifier les propriétés communes
      if (meal.accepted !== initialMeal.accepted) return true
      if (meal.afterShow !== undefined && meal.afterShow !== initialMeal.afterShow) return true

      return false
    })
  })
}

/**
 * Formate les phases pour l'affichage (version simple sans traduction)
 */
export const formatPhases = (phases: string[] | undefined): string => {
  if (!phases || phases.length === 0) return ''

  const phaseMap: Record<string, string> = {
    SETUP: 'Montage',
    EVENT: 'Édition',
    TEARDOWN: 'Démontage',
  }

  return phases.map((phase) => phaseMap[phase] || phase).join(' + ')
}

/**
 * Formate le type de repas pour l'affichage
 */
export const formatMealType = (mealType: MealType): string => {
  const mealTypeMap: Record<MealType, string> = {
    BREAKFAST: 'Petit-déjeuner',
    LUNCH: 'Déjeuner',
    DINNER: 'Dîner',
  }

  return mealTypeMap[mealType] || mealType
}

/**
 * Formate un repas complet pour l'affichage (type + date courte)
 */
export const formatMealDisplay = (meal: Meal, locale: string = 'fr-FR'): string => {
  const date = new Date(meal.date)
  const dateStr = date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
  return `${formatMealType(meal.mealType)} - ${dateStr}`
}
