// Registre des ports du module artistes. Par défaut : câblage jonglerie ; surcharge via
// setArtistsPorts() (2ᵉ app / tests). Même mécanisme que les autres modules.
import { createDefaultArtistsPorts } from './default-binding'

import type { ArtistsPorts } from './types'

let override: ArtistsPorts | null = null
let cached: ArtistsPorts | null = null

/** Surcharge l'implémentation des ports artistes (null pour réinitialiser). */
export function setArtistsPorts(ports: ArtistsPorts | null): void {
  override = ports
  cached = null
}

/** Récupère les ports artistes : surcharge si définie, sinon implémentation par défaut (lazy). */
export function useArtistsPorts(): ArtistsPorts {
  if (override) return override
  if (!cached) cached = createDefaultArtistsPorts()
  return cached
}
