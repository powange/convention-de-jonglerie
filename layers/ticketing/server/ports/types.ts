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

  /**
   * L'édition (ou l'événement) telle que la billetterie la lit : statut, fuseau, dates, nom affiché
   * (celui de l'édition, à défaut celui de sa convention). `null` si elle n'existe pas.
   */
  lireEdition(editionId: number): Promise<EditionBilletterie | null>

  /**
   * Les AUTRES éditions avec lesquelles comparer les statistiques de celle-ci : celles de la même
   * convention dans app1, les autres événements du même propriétaire dans Flowvent.
   */
  editionsComparables(
    editionId: number
  ): Promise<{ id: number; name: string | null; startDate: Date | null; endDate: Date | null }[]>
}

/** L'édition telle que la billetterie la lit, dans les deux apps. */
export interface EditionBilletterie {
  id: number
  name: string | null
  nomAffiche: string
  status: string
  timezone: string | null
  startDate: Date
  /** Un événement Flowvent sans date de fin dure sa journée de début. */
  endDate: Date
  /** Articles à remettre activés sur l'édition. */
  handoutItemsEnabled: boolean
}

export interface TicketingPorts {
  event: TicketingEventPort
}
