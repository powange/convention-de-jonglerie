// Ports du module « ateliers » (layers/workshops). Le layer consomme ces interfaces pour résoudre
// les données propres au domaine (flags d'activation + dates de l'événement) sans lire les modèles
// d'autres modules. Même pattern que server/faq/ports, server/lost-found/ports, etc.

/**
 * Configuration ateliers d'un événement, propre au domaine. Jonglerie : flags `workshopsEnabled` /
 * `workshopLocationsFreeInput` + dates portées par l'`Edition`. Domaine générique : sa propre
 * résolution (ou tout désactivé).
 */
export interface WorkshopsEventPort {
  /**
   * État + bornes temporelles de l'événement pour les ateliers. `found: false` → événement inconnu.
   * `enabled` : module ateliers activé. `locationsFreeInput` : saisie libre de lieu autorisée.
   * `startDate`/`endDate` : bornes de validation des créneaux d'atelier (null si introuvable).
   */
  getConfig(editionId: number): Promise<{
    found: boolean
    enabled: boolean
    locationsFreeInput: boolean
    startDate: Date | null
    endDate: Date | null
  }>
}

export interface WorkshopsPorts {
  event: WorkshopsEventPort
}
