// Registre des ports du module repas. Par défaut, câblage jonglerie (default-binding) ; une 2ᵉ app
// surcharge via setMealsPorts() (typiquement dans un plugin serveur). Même mécanisme que
// server/volunteers/ports/registry.ts.
import { createDefaultMealsPorts } from './default-binding'

import type { MealsPorts } from './types'

let override: MealsPorts | null = null
let cached: MealsPorts | null = null

/**
 * Surcharge l'implémentation des ports repas (2ᵉ app, ou tests). Passer null pour réinitialiser.
 * Remplacement complet (pas de merge partiel).
 */
export function setMealsPorts(ports: MealsPorts | null): void {
  override = ports
  cached = null
}

/** Récupère les ports repas : surcharge si définie, sinon implémentation par défaut (lazy). */
export function useMealsPorts(): MealsPorts {
  if (override) return override
  if (!cached) cached = createDefaultMealsPorts()
  return cached
}
