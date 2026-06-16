// Ports du module bénévole (étape 1 de la modularisation).
// Le module bénévole consomme ces interfaces ; l'app les câble sur ses implémentations
// concrètes (notifications, email, messenger). Voir docs/etape-1-ports-decouplage.md.
import type { PrismaTransaction } from '#server/types/prisma-helpers'
import type { AuthenticatedUser } from '#server/utils/auth-utils'

/** Notification in-app (englobe déjà le « safe » : ne lève pas). */
export interface NotifyInput {
  userId: number
  type: string
  actionUrl?: string
  notificationType?: string
  category?: string
  entityType?: string
  entityId?: string
  // système de traduction
  titleKey?: string
  messageKey?: string
  translationParams?: Record<string, unknown>
  actionTextKey?: string
  // OU texte libre
  titleText?: string
  messageText?: string
  actionText?: string
}

export interface NotificationPort {
  notify(input: NotifyInput): Promise<void>
}

export interface SendEmailInput {
  to: string
  subject: string
  html?: string
  text?: string
}

export interface EmailPort {
  send(input: SendEmailInput): Promise<boolean>
}

export interface MessengerPort {
  /** Assure les conversations équipe ⇄ bénévole (ex-ensureVolunteerConversations). */
  ensureTeamConversation(input: {
    eventId: number
    teamId: string
    userId: number
    tx?: PrismaTransaction
  }): Promise<void>
  /** Retire un bénévole des conversations d'une équipe. */
  removeFromTeamConversations(input: {
    eventId: number
    teamId: string
    userId: number
    tx?: PrismaTransaction
  }): Promise<void>
}

/**
 * Résolution des droits organisateur sur les bénévoles d'un event.
 * Chaque app implémente ces contrôles contre son modèle d'organisateurs/permissions.
 * (Le param `event` est le H3Event de la requête, transmis tel quel.)
 */
export interface OrganizerDirectoryPort {
  requireManagementAccess(event: any, eventId: number): Promise<AuthenticatedUser>
  requireReadAccess(event: any, eventId: number): Promise<AuthenticatedUser>
  canManage(eventId: number, userId: number, event?: any): Promise<boolean>
}

/**
 * Regroupement d'événements propre au domaine. Permet au module bénévole d'afficher des données
 * « transverses » (ex. commentaires laissés sur un bénévole dans les autres événements liés) sans
 * connaître la notion de « convention ».
 * Jonglerie : les autres éditions de la même convention. Domaine générique : l'événement seul.
 */
export interface EventScopePort {
  /** Ids des événements « liés » à un événement (inclut l'événement lui-même). */
  getRelatedEventIds(eventId: number): Promise<number[]>
  /**
   * Données d'affichage propres au domaine pour une liste d'événements (ex. ville, image, entité
   * parente). Le module bénévole les transmet au front sans les interpréter. Jonglerie : champs de
   * l'`Edition` + `Convention`. Clé = eventId.
   *
   * Contrat :
   * - Devrait renvoyer une entrée pour chaque eventId demandé ; un eventId absent du résultat est
   *   toléré (l'appelant retombe sur un objet vide) mais prive le front de ses données d'affichage.
   * - Ne doit pas renvoyer les clés réservées `id`, `name`, `startDate`, `endDate` ni `volunteers*` :
   *   le module les fournit (métadonnées génériques d'`Event` + config bénévole) et elles priment.
   */
  getEventDisplayData(eventIds: number[]): Promise<Record<number, Record<string, unknown>>>
}

/** Identité d'un participant ayant droit à un repas via la billetterie. */
export interface TicketMealParticipant {
  nom: string
  prenom: string
  email: string
}

/** Article à remettre (catalogue billetterie) résolu pour l'affichage. */
export interface HandoutItemInfo {
  id: number
  name: string
}

/**
 * Accès au module billetterie depuis le module bénévole (repas / catering). Le module bénévole ne
 * connaît ni les commandes, ni les tarifs, ni le catalogue d'articles : il délègue au port.
 * Jonglerie : participants issus des tarifs/options « avec repas » + table `TicketingHandoutItem`.
 * Domaine sans billetterie : implémentations renvoyant `{}`.
 */
export interface TicketingPort {
  /**
   * Participants ayant droit à chaque repas via la billetterie (tarifs + options « avec repas »,
   * commandes à l'état traité), **dédupliqués par repas**. Clé = mealId ; un repas sans participant
   * billetterie est absent ou associé à un tableau vide.
   */
  getMealTicketParticipants(mealIds: number[]): Promise<Record<number, TicketMealParticipant[]>>
  /**
   * Détails du catalogue d'articles à remettre pour une liste d'ids. Le module bénévole stocke la
   * liaison repas↔article (`VolunteerMealHandoutItem`) mais pas le catalogue. Clé = handoutItemId ;
   * un id introuvable est simplement absent du résultat.
   */
  getHandoutItems(handoutItemIds: number[]): Promise<Record<number, HandoutItemInfo>>
}

/** Participant artiste d'un repas (pour l'affichage catering). */
export interface ArtistMealParticipant {
  nom: string | null
  prenom: string | null
  email: string | null
  phone: string | null
  dietaryPreference: string | null
  allergies: string | null
  allergySeverity: string | null
  afterShow: boolean
}

/**
 * Accès au module artistes depuis le module bénévole (repas / catering). Le module bénévole ne
 * connaît pas la notion d'« artiste » : il délègue la synchronisation et la lecture des repas
 * artistes. Jonglerie : modèles `EditionArtist` + `ArtistMealSelection`. Domaine sans artistes :
 * `addEligibleMealSelections`/`removeMealSelections` no-op et `getMealArtistParticipants` → `{}`.
 */
export interface ArtistsPort {
  /** Crée (upsert) les sélections de repas des artistes éligibles quand un repas est activé. */
  addEligibleMealSelections(input: {
    editionId: number
    mealId: number
    date: Date
    mealType: string
  }): Promise<void>
  /** Supprime toutes les sélections de repas des artistes pour un repas désactivé. */
  removeMealSelections(mealId: number): Promise<void>
  /**
   * Participants artistes ayant accepté chaque repas (pour le catering). Clé = mealId ; un repas
   * sans artiste est absent ou associé à un tableau vide.
   */
  getMealArtistParticipants(mealIds: number[]): Promise<Record<number, ArtistMealParticipant[]>>
}

export interface VolunteerPorts {
  notifications: NotificationPort
  email: EmailPort
  messenger: MessengerPort
  organizers: OrganizerDirectoryPort
  eventScope: EventScopePort
  ticketing: TicketingPort
  artists: ArtistsPort
}
