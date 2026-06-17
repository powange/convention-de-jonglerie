// Registre des ports du module FAQ. Par défaut : câblage jonglerie ; surcharge via setFaqPorts()
// (2ᵉ app / tests). Même mécanisme que les autres modules.
import { createDefaultFaqPorts } from './default-binding'

import type { FaqPorts } from './types'

let override: FaqPorts | null = null
let cached: FaqPorts | null = null

/** Surcharge l'implémentation des ports FAQ (null pour réinitialiser). Remplacement complet. */
export function setFaqPorts(ports: FaqPorts | null): void {
  override = ports
  cached = null
}

/** Récupère les ports FAQ : surcharge si définie, sinon implémentation par défaut (lazy). */
export function useFaqPorts(): FaqPorts {
  if (override) return override
  if (!cached) cached = createDefaultFaqPorts()
  return cached
}
