// Registre des ports du module covoiturage. Par défaut : câblage jonglerie ; surcharge via
// setCarpoolPorts() (2ᵉ app / tests). Même mécanisme que les autres modules.
import { createDefaultCarpoolPorts } from './default-binding'

import type { CarpoolPorts } from './types'

let override: CarpoolPorts | null = null
let cached: CarpoolPorts | null = null

/** Surcharge l'implémentation des ports covoiturage (null pour réinitialiser). */
export function setCarpoolPorts(ports: CarpoolPorts | null): void {
  override = ports
  cached = null
}

/** Récupère les ports covoiturage : surcharge si définie, sinon implémentation par défaut (lazy). */
export function useCarpoolPorts(): CarpoolPorts {
  if (override) return override
  if (!cached) cached = createDefaultCarpoolPorts()
  return cached
}
