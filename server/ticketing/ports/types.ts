// Ports du module « billetterie » (layers/ticketing). Le layer consomme ces interfaces pour résoudre
// les données propres au domaine (réglages de billetterie portés par l'Edition, existence de
// l'événement) sans lire directement le modèle Edition. Même pattern que server/carpool/ports,
// server/artists/ports, etc.
//
// Frontière : les **permissions** (`canManageTicketing`, `canAccessEditionData`,
// `canManageEditionVolunteers`) et les **modèles propres** à la billetterie (`SumupConfig`,
// `ExternalTicketing`, `HelloAssoConfig`, `InfomaniakConfig`) restent consommés directement par le
// layer via `#server` / ses propres modèles — ce n'est pas un couplage inter-modules. Seuls les
// champs de configuration portés par l'Edition et l'existence de l'événement passent par ce port.

/** Réglages de billetterie propres au domaine (jonglerie : champs `ticketing*` portés par Edition). */
export interface TicketingSettings {
  allowOnsiteRegistration: boolean | null
  allowAnonymousOrders: boolean | null
  paymentCash: boolean | null
  paymentCard: boolean | null
  paymentCheck: boolean | null
  sumupEnabled: boolean | null
  handoutItemsEnabled: boolean | null
}

/** Accès aux métadonnées d'événement et aux réglages de billetterie nécessaires au module. */
export interface TicketingEventPort {
  /** Réglages de billetterie de l'événement, ou `null` si l'événement n'existe pas. */
  getSettings(editionId: number): Promise<TicketingSettings | null>
  /**
   * Met à jour les réglages de billetterie fournis (champs non définis ignorés) et renvoie l'état
   * complet après écriture.
   */
  updateSettings(
    editionId: number,
    settings: Partial<TicketingSettings>
  ): Promise<TicketingSettings>
  /** L'événement existe-t-il ? (vérifié avant la configuration d'une billetterie externe). */
  eventExists(editionId: number): Promise<boolean>
}

export interface TicketingPorts {
  event: TicketingEventPort
}
