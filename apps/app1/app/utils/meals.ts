/**
 * Utilitaires pour la gestion des repas (frontend)
 */

import type { ComputedRef, Ref } from 'vue'

import { formaterJournee } from '~~/shared/utils/fuseau-edition'

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
 * La JOURNÉE qu'une date de repas désigne, `YYYY-MM-DD`.
 *
 * ⚠️⚠️ UNE DATE DE REPAS EST UN JOUR, PAS UN INSTANT — et c'est tout le constat F1.
 *
 * La colonne est une `@db.Date`, mais Prisma la rend en `DateTime` à **minuit UTC** : l'API
 * envoie donc `"2025-10-29T00:00:00.000Z"`. Formaté avec `toLocaleDateString` sans fuseau, ce
 * moment est converti dans celui du lecteur — et pour quiconque se trouve à l'ouest de
 * Greenwich, minuit UTC tombe **la veille**. Le repas du 29 s'affichait au 28.
 *
 * 📍 ET PASSER LE FUSEAU DE L'ÉDITION N'AURAIT PAS SUFFI, contrairement à ce que la fiche
 * suggérait : pour une édition déclarée à `America/New_York`, minuit UTC vaut 19 h la veille.
 * Le défaut aurait changé de victime, pas disparu.
 *
 * On lit donc les dix premiers caractères de l'instant — la journée telle qu'elle a été
 * enregistrée — et on la formate comme une journée NUE. `formaterJournee` ne convertit jamais une
 * journée nue, et son commentaire documente précisément ce piège.
 */
const journeeDuRepas = (dateStr: string | Date): string =>
  (dateStr instanceof Date ? dateStr.toISOString() : String(dateStr)).slice(0, 10)

/**
 * Formate une date pour l'affichage des repas
 */
export const formatMealDate = (dateStr: string | Date, locale: string = 'fr-FR'): string =>
  formaterJournee(journeeDuRepas(dateStr), undefined, locale)

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
  // Même règle que `formatMealDate` : la journée, pas l'instant. Sans cela, un lecteur à l'ouest
  // de Greenwich voyait « 28 oct. » sur le repas du 29.
  const dateStr = formaterJournee(journeeDuRepas(meal.date), undefined, locale, {
    day: 'numeric',
    month: 'short',
  })
  return `${formatMealType(meal.mealType)} - ${dateStr}`
}
