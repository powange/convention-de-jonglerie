/**
 * Notifications internes de Flowvent (modèle `Notification`, même forme qu'app1).
 *
 * Deux consommateurs :
 * - `layers/auth/` : `NotificationHelpers.welcome` (sans objet ici : no-op) ;
 * - `layers/volunteers/` : `NotificationService.create`, `safeNotify` et les notifications de
 *   candidature et d'échange de créneau (contrat d'hôte, cf. docs/flowvent-benevoles.md).
 *
 * Différences assumées avec app1 : Flowvent est en français seul, donc des textes plutôt que des
 * clés de traduction ; pas de préférences de notification, pas de push ; et les liens visent les
 * pages de Flowvent (`/events/<id>/…`), pas celles d'app1 (`/editions/<id>/…`).
 */
import type { NotificationType } from '#server/types/prisma'

export interface CreateNotificationData {
  userId: number
  type: NotificationType
  category?: string
  entityType?: string
  entityId?: string
  actionUrl?: string
  /** Accepté pour compatibilité avec les appelants d'app1, ignoré : pas de préférences ici. */
  notificationType?: string
  titleKey?: string
  messageKey?: string
  translationParams?: Record<string, unknown>
  actionTextKey?: string
  titleText?: string
  messageText?: string
  actionText?: string
}

/** Exécute une notification sans jamais faire échouer l'opération qui l'a déclenchée. */
export async function safeNotify<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    console.error(`[NotificationService] Erreur ${context || 'notification'}:`, error)
    return null
  }
}

export const NotificationService = {
  async create(data: CreateNotificationData) {
    // Même garde qu'app1 : une notification sans titre ni message n'a pas de sens.
    if (!data.titleKey && !data.messageKey && !data.titleText && !data.messageText) {
      throw new Error(
        'Au moins un système doit être utilisé (titleKey/messageKey OU titleText/messageText)'
      )
    }
    return prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        category: data.category,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
        titleKey: data.titleKey,
        messageKey: data.messageKey,
        translationParams: data.translationParams as never,
        actionTextKey: data.actionTextKey,
        titleText: data.titleText,
        messageText: data.messageText,
        actionText: data.actionText,
      },
    })
  },
}

const ECHANGES = {
  REQUESTED: {
    type: 'INFO',
    titre: "Proposition d'échange de créneau 🔁",
    message: (p: ParamsEchange) =>
      `${p.otherName} vous propose d'échanger un créneau sur ${p.editionName}.`,
    action: 'Voir la demande',
  },
  PEER_ACCEPTED: {
    type: 'INFO',
    titre: 'Échange en attente de validation ⏳',
    message: (p: ParamsEchange) =>
      `L'échange proposé à ${p.otherName} sur ${p.editionName} attend la validation d'un organisateur.`,
    action: 'Voir la demande',
  },
  DECIDED: {
    type: 'SUCCESS',
    titre: 'Échange de créneau validé ✅',
    message: (p: ParamsEchange) => `Votre échange de créneau sur ${p.editionName} a été validé.`,
    action: 'Voir mes créneaux',
  },
  REFUSED: {
    type: 'WARNING',
    titre: 'Échange de créneau refusé',
    message: (p: ParamsEchange) =>
      `L'échange de créneau proposé sur ${p.editionName} n'a pas abouti.`,
    action: 'Voir mes créneaux',
  },
} as const

interface ParamsEchange {
  editionId: number
  editionName: string
  swapId: string
  otherName: string
}

export const NotificationHelpers = {
  /** Bienvenue (layer d'auth) — sans objet pour Flowvent. */
  async welcome(_userId: number): Promise<void> {},

  async volunteerApplicationSubmitted(userId: number, editionName: string, editionId: number) {
    return NotificationService.create({
      userId,
      type: 'SUCCESS',
      titleText: 'Candidature bénévole envoyée ! 🎉',
      messageText: `Votre candidature de bénévole pour « ${editionName} » a été envoyée. Les organisateurs vont l'examiner.`,
      actionText: 'Voir ma candidature',
      category: 'volunteer',
      entityType: 'Event',
      entityId: String(editionId),
      actionUrl: `/events/${editionId}/volunteers`,
    })
  },

  async volunteerApplicationReceived(
    userId: number,
    editionName: string,
    editionId: number,
    applicantName: string
  ) {
    return NotificationService.create({
      userId,
      type: 'INFO',
      titleText: 'Nouvelle candidature bénévole',
      messageText: `${applicantName} vient de postuler comme bénévole pour « ${editionName} ».`,
      actionText: 'Voir les candidatures',
      category: 'volunteer',
      entityType: 'Event',
      entityId: String(editionId),
      actionUrl: `/events/${editionId}/gestion/volunteers/applications`,
    })
  },

  async volunteerAccepted(
    userId: number,
    editionName: string,
    editionId: number,
    assignedTeams?: string[],
    organizerNote?: string | null
  ) {
    let message = `Votre candidature de bénévole pour « ${editionName} » a été acceptée.`
    if (assignedTeams?.length) {
      message += `\n\nVous avez été affecté aux équipes suivantes :\n• ${assignedTeams.join('\n• ')}`
    }
    if (organizerNote?.trim())
      message += `\n\nMessage de l'organisateur :\n« ${organizerNote.trim()} »`
    return NotificationService.create({
      userId,
      type: 'SUCCESS',
      titleText: 'Candidature bénévole acceptée ! ✅',
      messageText: message,
      actionText: 'Voir les détails',
      category: 'volunteer',
      entityType: 'Event',
      entityId: String(editionId),
      actionUrl: `/events/${editionId}/volunteers`,
    })
  },

  async volunteerRejected(userId: number, editionName: string, editionId: number) {
    return NotificationService.create({
      userId,
      type: 'INFO',
      titleText: 'Candidature bénévole non acceptée',
      messageText: `Votre candidature de bénévole pour « ${editionName} » n'a pas été acceptée cette fois.`,
      actionText: "Voir l'événement",
      category: 'volunteer',
      entityType: 'Event',
      entityId: String(editionId),
      actionUrl: `/events/${editionId}`,
    })
  },

  async volunteerBackToPending(userId: number, editionName: string, editionId: number) {
    return NotificationService.create({
      userId,
      type: 'INFO',
      titleText: 'Candidature remise en attente',
      messageText: `Votre candidature de bénévole pour « ${editionName} » a été remise en attente par les organisateurs.`,
      actionText: 'Voir ma candidature',
      category: 'volunteer',
      entityType: 'Event',
      entityId: String(editionId),
      actionUrl: `/events/${editionId}/volunteers`,
    })
  },

  async volunteerSwap(
    userId: number,
    kind: 'REQUESTED' | 'PEER_ACCEPTED' | 'DECIDED' | 'REFUSED',
    params: ParamsEchange
  ) {
    const e = ECHANGES[kind]
    return NotificationService.create({
      userId,
      type: e.type,
      titleText: e.titre,
      messageText: e.message(params),
      actionText: e.action,
      category: 'volunteer',
      entityType: 'VolunteerSwapRequest',
      entityId: params.swapId,
      actionUrl: `/events/${params.editionId}/volunteers/swaps`,
    })
  },
}
