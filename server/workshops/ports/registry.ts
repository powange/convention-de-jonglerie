// Registre des ports du module ateliers. Par défaut : câblage jonglerie ; surcharge via
// setWorkshopsPorts() (2ᵉ app / tests). Même mécanisme que les autres modules.
import { createDefaultWorkshopsPorts } from './default-binding'

import type { WorkshopsPorts } from './types'

let override: WorkshopsPorts | null = null
let cached: WorkshopsPorts | null = null

/** Surcharge l'implémentation des ports ateliers (null pour réinitialiser). */
export function setWorkshopsPorts(ports: WorkshopsPorts | null): void {
  override = ports
  cached = null
}

/** Récupère les ports ateliers : surcharge si définie, sinon implémentation par défaut (lazy). */
export function useWorkshopsPorts(): WorkshopsPorts {
  if (override) return override
  if (!cached) cached = createDefaultWorkshopsPorts()
  return cached
}
