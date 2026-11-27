/**
 * Contrat d'hôte du layer carte : ce que le layer demande à l'application sur l'édition (app1)
 * ou l'événement (Flowvent) qui porte la carte. Chaque app fournit `#server/map/ports/registry`.
 */
export interface DrapeauxCarte {
  id: number
  /** Le module carte est-il activé ? */
  siteMapEnabled: boolean
  /** La carte est-elle publique (visible sans droit de gestion) ? */
  mapPublic: boolean
}

export interface CarteExterne {
  id: number
  externalMapProvider: string | null
  externalMapRef: string | null
}

export interface MapPorts {
  /** Les drapeaux qui décident qui lit la carte ; `null` si l'édition n'existe pas. */
  lireDrapeaux(editionId: number): Promise<DrapeauxCarte | null>
  /** Le nom à donner à la carte exportée (KML) : celui de l'édition ou de l'événement. */
  lireNom(editionId: number): Promise<string | null>
  /** Rend la carte publique, ou la réserve à la gestion. */
  enregistrerVisibilite(
    editionId: number,
    mapPublic: boolean
  ): Promise<{ id: number; mapPublic: boolean }>
  /** Enregistre (ou efface, avec `null`) la carte externe d'où l'on importe zones et repères. */
  enregistrerCarteExterne(
    editionId: number,
    carte: { provider: string | null; ref: string | null }
  ): Promise<CarteExterne>
}
