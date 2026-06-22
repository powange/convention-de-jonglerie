// Registre des ports du module gestion des tâches. Par défaut : câblage jonglerie ; surcharge via
// setTaskboardPorts() (2ᵉ app / tests). Même mécanisme que les autres modules.
import { createDefaultTaskboardPorts } from './default-binding'

import type { TaskboardPorts } from './types'

let override: TaskboardPorts | null = null
let cached: TaskboardPorts | null = null

/** Surcharge l'implémentation des ports tâches (null pour réinitialiser). Remplacement complet. */
export function setTaskboardPorts(ports: TaskboardPorts | null): void {
  override = ports
  cached = null
}

/** Récupère les ports tâches : surcharge si définie, sinon implémentation par défaut (lazy). */
export function useTaskboardPorts(): TaskboardPorts {
  if (override) return override
  if (!cached) cached = createDefaultTaskboardPorts()
  return cached
}
