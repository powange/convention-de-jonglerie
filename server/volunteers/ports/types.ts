// Ports du module bénévole (étape 1 de la modularisation).
// Le module bénévole consomme ces interfaces ; l'app les câble sur ses implémentations
// concrètes (notifications, email, messenger). Voir docs/etape-1-ports-decouplage.md.
import type { PrismaTransaction } from '#server/types/prisma-helpers'

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

export interface VolunteerPorts {
  notifications: NotificationPort
  email: EmailPort
  messenger: MessengerPort
}
