/**
 * Câblage du layer repas pour FLOWVENT (contrat d'hôte, cf. layers/meals/server/ports/types.ts).
 *
 * Flowvent a les mêmes modèles qu'app1 pour ce que les repas lisent (fiches d'artiste et leurs
 * sélections de repas, articles de billetterie et options) : l'implémentation partagée du layer
 * s'applique telle quelle, sans réécriture.
 */
import type { MealsPorts } from '#meals/server/ports/types'

import { createDefaultMealsPorts } from '#meals/server/ports/default-binding'

let cached: MealsPorts | null = null

export function useMealsPorts(): MealsPorts {
  if (!cached) cached = createDefaultMealsPorts()
  return cached
}
