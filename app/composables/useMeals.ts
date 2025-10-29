/**
 * Composable pour gérer les repas
 */

import type { MealType, MealPhase } from '~/utils/meals'

import type { ComputedRef } from 'vue'

/**
 * Récupère le label traduit d'un type de repas
 */
export const useMealTypeLabel = () => {
  const { t } = useI18n()

  const mealTypeLabels: ComputedRef<Record<MealType, string>> = computed(() => ({
    BREAKFAST: t('common.breakfast'),
    LUNCH: t('common.lunch'),
    DINNER: t('common.dinner'),
  }))

  const getMealTypeLabel = (mealType: string): string => {
    return mealTypeLabels.value[mealType as MealType] || mealType
  }

  return {
    mealTypeLabels,
    getMealTypeLabel,
  }
}

/**
 * Récupère le label traduit d'une phase
 */
export const useMealPhaseLabel = () => {
  const { t } = useI18n()

  const phaseLabels: ComputedRef<Record<MealPhase, string>> = computed(() => ({
    SETUP: t('common.setup'),
    EVENT: t('common.event'),
    TEARDOWN: t('common.teardown'),
  }))

  const getPhasesLabel = (phases: string[] | undefined): string => {
    if (!phases || phases.length === 0) return ''
    return phases.map((phase) => phaseLabels.value[phase as MealPhase] || phase).join(' + ')
  }

  return {
    phaseLabels,
    getPhasesLabel,
  }
}
