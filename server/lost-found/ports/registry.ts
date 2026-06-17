// Registre des ports du module objets trouvés. Par défaut : câblage jonglerie ; surcharge via
// setLostFoundPorts() (2ᵉ app / tests). Même mécanisme que les autres modules.
import { createDefaultLostFoundPorts } from './default-binding'

import type { LostFoundPorts } from './types'

let override: LostFoundPorts | null = null
let cached: LostFoundPorts | null = null

/** Surcharge l'implémentation des ports objets trouvés (null pour réinitialiser). */
export function setLostFoundPorts(ports: LostFoundPorts | null): void {
  override = ports
  cached = null
}

/** Récupère les ports objets trouvés : surcharge si définie, sinon implémentation par défaut (lazy). */
export function useLostFoundPorts(): LostFoundPorts {
  if (override) return override
  if (!cached) cached = createDefaultLostFoundPorts()
  return cached
}
