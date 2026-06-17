// Registre des ports du module billetterie. Par défaut : câblage jonglerie ; surcharge via
// setTicketingPorts() (2ᵉ app / tests). Même mécanisme que les autres modules.
import { createDefaultTicketingPorts } from './default-binding'

import type { TicketingPorts } from './types'

let override: TicketingPorts | null = null
let cached: TicketingPorts | null = null

/** Surcharge l'implémentation des ports billetterie (null pour réinitialiser). */
export function setTicketingPorts(ports: TicketingPorts | null): void {
  override = ports
  cached = null
}

/** Récupère les ports billetterie : surcharge si définie, sinon implémentation par défaut (lazy). */
export function useTicketingPorts(): TicketingPorts {
  if (override) return override
  if (!cached) cached = createDefaultTicketingPorts()
  return cached
}
