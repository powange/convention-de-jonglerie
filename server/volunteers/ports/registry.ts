// Registre des ports du module bénévole.
// - Par défaut, les ports délèguent aux services concrets (câblage jonglerie) via le lazy default.
// - Une autre app (ou un test) peut surcharger via setVolunteerPorts() — typiquement dans un
//   plugin serveur — pour injecter ses propres implémentations.
import { createDefaultVolunteerPorts } from './default-binding'
import type { VolunteerPorts } from './types'

let override: VolunteerPorts | null = null
let cached: VolunteerPorts | null = null

/** Surcharge l'implémentation des ports (ex. 2ᵉ app, ou tests). Passer null pour réinitialiser. */
export function setVolunteerPorts(ports: VolunteerPorts | null): void {
  override = ports
  cached = null
}

/** Récupère les ports : surcharge si définie, sinon implémentation par défaut (lazy). */
export function useVolunteerPorts(): VolunteerPorts {
  if (override) return override
  if (!cached) cached = createDefaultVolunteerPorts()
  return cached
}
