import { sendEmail, generateNotificationEmailHtml } from './emailService'
import {
  isNotificationAllowed,
  isEmailNotificationAllowed,
  NotificationTypeMapping,
  type NotificationType as CustomNotificationType,
} from './notification-preferences'
import { notificationStreamManager } from './notification-stream-manager'
import { prisma } from './prisma'
import { pushNotificationService } from './push-notification-service'
import { translateServerSide } from './server-i18n'

import type { NotificationType } from '@prisma/client'

/**
 * Données pour créer une notification
 * Doit contenir SOIT des clés de traduction SOIT du texte libre
 */
export interface CreateNotificationData {
  userId: number
  type: NotificationType
  category?: string
  entityType?: string
  entityId?: string
  actionUrl?: string
  // Type de notification pour vérifier les préférences
  notificationType?: CustomNotificationType

  // SYSTÈME DE TRADUCTION (notifications système)
  titleKey?: string
  messageKey?: string
  translationParams?: Record<string, any>
  actionTextKey?: string

  // TEXTE LIBRE (notifications custom/orgas)
  titleText?: string
  messageText?: string
  actionText?: string
}

export interface NotificationFilters {
  userId: number
  isRead?: boolean
  category?: string
  limit?: number
  offset?: number
}

/**
 * Service de gestion des notifications utilisateur
 */
export const NotificationService = {
  /**
   * Crée une nouvelle notification
   */
  async create(data: CreateNotificationData) {
    // Validation : au moins un système doit être utilisé
    const hasTranslationKeys = !!(data.titleKey || data.messageKey)
    const hasTextFields = !!(data.titleText || data.messageText)

    if (!hasTranslationKeys && !hasTextFields) {
      throw new Error(
        'Au moins un système doit être utilisé (titleKey/messageKey OU titleText/messageText)'
      )
    }

    // Vérifier les préférences utilisateur si un type de notification est spécifié
    if (data.notificationType) {
      const preferenceKey = NotificationTypeMapping[data.notificationType]
      const allowed = await isNotificationAllowed(data.userId, preferenceKey)

      if (!allowed) {
        console.log(
          `[NotificationService] Notification ${data.notificationType} bloquée par les préférences utilisateur ${data.userId}`
        )
        return null // Ne pas créer la notification
      }
      console.log(
        `[NotificationService] Notification ${data.notificationType} autorisée pour l'utilisateur ${data.userId}`
      )
    } else {
      console.log(
        `[NotificationService] Notification sans type spécifié envoyée à l'utilisateur ${data.userId} (non filtrée)`
      )
    }

    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        // Système de traduction
        titleKey: data.titleKey,
        messageKey: data.messageKey,
        translationParams: data.translationParams,
        actionTextKey: data.actionTextKey,
        // Texte libre
        titleText: data.titleText,
        messageText: data.messageText,
        actionText: data.actionText,
        // Métadonnées
        category: data.category,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            email: true,
            preferredLanguage: true,
          },
        },
      },
    })

    // Envoyer la notification en temps réel via SSE
    try {
      const sent = await notificationStreamManager.notifyUser(data.userId, notification)
      console.log(
        `[NotificationService] Notification ${notification.id} ${sent ? 'envoyée' : 'non envoyée'} via SSE`
      )
    } catch (error) {
      console.error('[NotificationService] Erreur envoi SSE:', error)
      // Ne pas faire échouer la création de notification si SSE échoue
    }

    // Envoyer aussi en push notification si disponible
    try {
      // Traduire la notification pour le push selon la langue préférée de l'utilisateur
      const userLang = notification.user.preferredLanguage || 'fr'

      const pushData = {
        title: notification.titleKey
          ? translateServerSide(
              notification.titleKey,
              notification.translationParams || {},
              userLang
            )
          : notification.titleText || '',
        body: notification.messageKey
          ? translateServerSide(
              notification.messageKey,
              notification.translationParams || {},
              userLang
            )
          : notification.messageText || '',
        data: {
          url: notification.actionUrl,
          notificationId: notification.id,
        },
      }

      const pushSent = await pushNotificationService.sendToUser(notification.userId, pushData)
      console.log(
        `[NotificationService] Notification ${notification.id} ${pushSent ? 'envoyée' : 'non envoyée'} via Push (langue: ${userLang})`
      )
    } catch (error) {
      console.error('[NotificationService] Erreur envoi Push:', error)
      // Ne pas faire échouer la création de notification si Push échoue
    }

    // Envoyer aussi par email si les préférences le permettent
    if (data.notificationType) {
      try {
        const preferenceKey = NotificationTypeMapping[data.notificationType]
        const emailAllowed = await isEmailNotificationAllowed(data.userId, preferenceKey)

        if (emailAllowed) {
          const user = await prisma.user.findUnique({
            where: { id: data.userId },
            select: { email: true, prenom: true, pseudo: true, preferredLanguage: true },
          })

          if (user?.email) {
            const prenom = user.prenom || user.pseudo || 'Utilisateur'
            const preferredLanguage = user.preferredLanguage || 'fr'

            // Traduire le contenu de l'email selon la langue préférée
            const emailTitle = notification.titleKey
              ? translateServerSide(
                  notification.titleKey,
                  notification.translationParams || {},
                  preferredLanguage
                )
              : notification.titleText || ''

            const emailMessage = notification.messageKey
              ? translateServerSide(
                  notification.messageKey,
                  notification.translationParams || {},
                  preferredLanguage
                )
              : notification.messageText || ''

            const emailActionText = notification.actionTextKey
              ? translateServerSide(
                  notification.actionTextKey,
                  notification.translationParams || {},
                  preferredLanguage
                )
              : notification.actionText

            const emailHtml = await generateNotificationEmailHtml(
              prenom,
              emailTitle,
              emailMessage,
              notification.actionUrl,
              emailActionText
            )

            const emailSent = await sendEmail({
              to: user.email,
              subject: emailTitle,
              html: emailHtml,
              text: emailMessage,
            })

            console.log(
              `[NotificationService] Email notification ${notification.id} ${emailSent ? 'envoyé' : 'non envoyé'} à ${user.email} (langue: ${preferredLanguage})`
            )
          }
        } else {
          console.log(
            `[NotificationService] Email notification bloquée par les préférences utilisateur ${data.userId}`
          )
        }
      } catch (error) {
        console.error('[NotificationService] Erreur envoi Email:', error)
        // Ne pas faire échouer la création de notification si Email échoue
      }
    }

    return notification
  },

  /**
   * Récupère les notifications d'un utilisateur
   */
  async getForUser(filters: NotificationFilters) {
    const where: any = {
      userId: filters.userId,
    }

    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead
    }

    if (filters.category) {
      where.category = filters.category
    }

    return await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit || 50,
      skip: filters.offset || 0,
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
      },
    })
  },

  /**
   * Marque une notification comme lue
   */
  async markAsRead(notificationId: string, userId: number) {
    return await prisma.notification.update({
      where: {
        id: notificationId,
        userId, // S'assurer que l'utilisateur est propriétaire
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  },

  /**
   * Marque une notification comme non lue
   */
  async markAsUnread(notificationId: string, userId: number) {
    return await prisma.notification.update({
      where: {
        id: notificationId,
        userId, // S'assurer que l'utilisateur est propriétaire
      },
      data: {
        isRead: false,
        readAt: null,
      },
    })
  },

  /**
   * Marque toutes les notifications d'un utilisateur comme lues
   */
  async markAllAsRead(userId: number, category?: string) {
    const where: any = { userId, isRead: false }

    if (category) {
      where.category = category
    }

    return await prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  },

  /**
   * Supprime une notification
   */
  async delete(notificationId: string, userId: number) {
    return await prisma.notification.delete({
      where: {
        id: notificationId,
        userId, // S'assurer que l'utilisateur est propriétaire
      },
    })
  },

  /**
   * Supprime les anciennes notifications (plus de X jours)
   */
  async cleanup(daysOld: number = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    return await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        isRead: true, // Supprimer uniquement les notifications lues
      },
    })
  },

  /**
   * Compte les notifications non lues d'un utilisateur
   */
  async getUnreadCount(userId: number, category?: string) {
    const where: any = {
      userId,
      isRead: false,
    }

    if (category) {
      where.category = category
    }

    return await prisma.notification.count({ where })
  },

  /**
   * Obtient les statistiques des notifications d'un utilisateur
   */
  async getStats(userId: number) {
    const [total, unread, byType] = await Promise.all([
      prisma.notification.count({
        where: { userId },
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: true,
      }),
    ])

    return {
      total,
      unread,
      byType: byType.map((item) => ({
        type: item.type,
        count: item._count,
      })),
    }
  },
}

// Helpers pour créer des notifications courantes
export const NotificationHelpers = {
  /**
   * Notification de bienvenue pour nouveaux utilisateurs
   */
  async welcome(userId: number) {
    return await NotificationService.create({
      userId,
      type: 'SUCCESS',
      titleKey: 'notifications.welcome.title',
      messageKey: 'notifications.welcome.message',
      actionTextKey: 'notifications.welcome.action',
      category: 'system',
      actionUrl: '/',
      notificationType: 'welcome',
    })
  },

  /**
   * Notification de nouvelle convention ajoutée
   */
  async newConvention(userId: number, conventionName: string, conventionId: number) {
    return await NotificationService.create({
      userId,
      type: 'INFO',
      titleKey: 'notifications.edition.new_convention.title',
      messageKey: 'notifications.edition.new_convention.message',
      translationParams: { conventionName },
      actionTextKey: 'notifications.common.view_details',
      category: 'edition',
      entityType: 'Convention',
      entityId: conventionId.toString(),
      actionUrl: `/conventions/${conventionId}`,
      notificationType: 'new_convention',
    })
  },

  /**
   * Notification de candidature de bénévolat soumise
   */
  async volunteerApplicationSubmitted(userId: number, editionName: string, editionId: number) {
    return await NotificationService.create({
      userId,
      type: 'SUCCESS',
      titleKey: 'notifications.volunteer.application_submitted.title',
      messageKey: 'notifications.volunteer.application_submitted.message',
      translationParams: { editionName },
      actionTextKey: 'notifications.volunteer.application_submitted.action',
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: '/my-volunteer-applications',
      notificationType: 'volunteer_application_submitted',
    })
  },

  /**
   * Notification de candidature de bénévolat acceptée
   */
  async volunteerAccepted(
    userId: number,
    editionName: string,
    editionId: number,
    assignedTeams?: string[],
    organizerNote?: string | null
  ) {
    // Choisir la bonne clé de message selon le contexte
    let messageKey = 'notifications.volunteer.application_accepted.message'
    const translationParams: Record<string, any> = { editionName }

    // Version avec équipes et note
    if (assignedTeams && assignedTeams.length > 0 && organizerNote?.trim()) {
      messageKey = 'notifications.volunteer.application_accepted.message_complete'
      translationParams.teams = assignedTeams.join('\n• ')
      translationParams.note = organizerNote.trim()
    }
    // Version avec équipes uniquement
    else if (assignedTeams && assignedTeams.length > 0) {
      messageKey = 'notifications.volunteer.application_accepted.message_with_teams'
      translationParams.teams = assignedTeams.join('\n• ')
    }
    // Version avec note uniquement
    else if (organizerNote?.trim()) {
      messageKey = 'notifications.volunteer.application_accepted.message_with_note'
      translationParams.note = organizerNote.trim()
    }

    return await NotificationService.create({
      userId,
      type: 'SUCCESS',
      titleKey: 'notifications.volunteer.application_accepted.title',
      messageKey,
      translationParams,
      actionTextKey: 'notifications.volunteer.application_accepted.action',
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: `/editions/${editionId}/volunteers`,
      notificationType: 'volunteer_application_accepted',
    })
  },

  /**
   * Notification de candidature de bénévolat refusée
   */
  async volunteerRejected(userId: number, editionName: string, editionId: number) {
    return await NotificationService.create({
      userId,
      type: 'WARNING',
      titleKey: 'notifications.volunteer.application_rejected.title',
      messageKey: 'notifications.volunteer.application_rejected.message',
      translationParams: { editionName },
      actionTextKey: 'notifications.volunteer.application_rejected.action',
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: `/editions/${editionId}`,
      notificationType: 'volunteer_application_rejected',
    })
  },

  /**
   * Notification de candidature remise en attente
   */
  async volunteerBackToPending(userId: number, editionName: string, editionId: number) {
    return await NotificationService.create({
      userId,
      type: 'INFO',
      titleKey: 'notifications.volunteer.back_to_pending.title',
      messageKey: 'notifications.volunteer.back_to_pending.message',
      translationParams: { editionName },
      actionTextKey: 'notifications.volunteer.back_to_pending.action',
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: '/my-volunteer-applications',
      notificationType: 'volunteer_application_modified',
    })
  },

  /**
   * Notification de rappel d'événement
   */
  async eventReminder(userId: number, editionName: string, editionId: number, daysUntil: number) {
    return await NotificationService.create({
      userId,
      type: 'INFO',
      titleKey: 'notifications.edition.reminder.title',
      messageKey: 'notifications.edition.reminder.message',
      translationParams: { editionName, daysUntil },
      actionTextKey: 'notifications.edition.reminder.action',
      category: 'edition',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: `/editions/${editionId}`,
    })
  },

  /**
   * Notification d'erreur système
   */
  async systemError(userId: number, errorMessage: string) {
    return await NotificationService.create({
      userId,
      type: 'ERROR',
      titleKey: 'notifications.system.error.title',
      messageKey: 'notifications.system.error.message',
      translationParams: { errorMessage },
      category: 'system',
      notificationType: 'system_error',
    })
  },

  /**
   * Notification de demande de covoiturage reçue
   */
  async carpoolBookingReceived(
    userId: number,
    requesterName: string,
    offerId: number,
    seats: number,
    note?: string
  ) {
    // Récupérer l'ID de l'édition pour construire la bonne URL
    const offer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      select: { editionId: true },
    })

    const actionUrl = offer
      ? `/editions/${offer.editionId}/covoiturage?offerId=${offerId}`
      : `/carpool-offers/${offerId}`

    // Choisir la bonne clé selon si il y a un message ou non
    const messageKey = note
      ? 'notifications.carpool.booking_received.message_with_note'
      : 'notifications.carpool.booking_received.message'

    const translationParams: Record<string, any> = { requesterName, seats }
    if (note) {
      translationParams.note = note
    }

    return await NotificationService.create({
      userId,
      type: 'INFO',
      titleKey: 'notifications.carpool.booking_received.title',
      messageKey,
      translationParams,
      actionTextKey: 'notifications.carpool.booking_received.action',
      category: 'carpool',
      entityType: 'CarpoolOffer',
      entityId: offerId.toString(),
      actionUrl,
      notificationType: 'carpool_booking_received',
    })
  },

  /**
   * Notification de demande de covoiturage acceptée
   */
  async carpoolBookingAccepted(
    userId: number,
    ownerName: string,
    offerId: number,
    seats: number,
    locationCity: string,
    tripDate: Date
  ) {
    // Récupérer l'ID de l'édition pour construire la bonne URL
    const offer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      select: { editionId: true },
    })

    const actionUrl = offer
      ? `/editions/${offer.editionId}/covoiturage?offerId=${offerId}`
      : `/carpool-offers/${offerId}`

    // Note: La date sera formatée côté client selon la locale
    const dateStr = tripDate.toISOString()

    return await NotificationService.create({
      userId,
      type: 'SUCCESS',
      titleKey: 'notifications.carpool.booking_accepted.title',
      messageKey: 'notifications.carpool.booking_accepted.message',
      translationParams: { ownerName, seats, locationCity, date: dateStr },
      actionTextKey: 'notifications.carpool.booking_accepted.action',
      category: 'carpool',
      entityType: 'CarpoolOffer',
      entityId: offerId.toString(),
      actionUrl,
      notificationType: 'carpool_booking_accepted',
    })
  },

  /**
   * Notification de demande de covoiturage refusée
   */
  async carpoolBookingRejected(
    userId: number,
    ownerName: string,
    offerId: number,
    seats: number,
    locationCity: string
  ) {
    // Récupérer l'ID de l'édition pour construire la bonne URL
    const offer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      select: { editionId: true },
    })

    const actionUrl = offer
      ? `/editions/${offer.editionId}/covoiturage?offerId=${offerId}`
      : `/carpool-offers/${offerId}`

    return await NotificationService.create({
      userId,
      type: 'WARNING',
      titleKey: 'notifications.carpool.booking_rejected.title',
      messageKey: 'notifications.carpool.booking_rejected.message',
      translationParams: { ownerName, seats, locationCity },
      actionTextKey: 'notifications.carpool.booking_rejected.action',
      category: 'carpool',
      entityType: 'CarpoolOffer',
      entityId: offerId.toString(),
      actionUrl,
      notificationType: 'carpool_booking_rejected',
    })
  },

  /**
   * Notification d'annulation d'une réservation acceptée
   */
  async carpoolBookingCancelled(
    userId: number,
    passengerName: string,
    offerId: number,
    seats: number,
    locationCity: string,
    tripDate: Date
  ) {
    // Récupérer l'ID de l'édition pour construire la bonne URL
    const offer = await prisma.carpoolOffer.findUnique({
      where: { id: offerId },
      select: { editionId: true },
    })

    const actionUrl = offer
      ? `/editions/${offer.editionId}/covoiturage?offerId=${offerId}`
      : `/carpool-offers/${offerId}`

    // Note: La date sera formatée côté client selon la locale
    const dateStr = tripDate.toISOString()

    return await NotificationService.create({
      userId,
      type: 'INFO',
      titleKey: 'notifications.carpool.booking_cancelled.title',
      messageKey: 'notifications.carpool.booking_cancelled.message',
      translationParams: { passengerName, seats, locationCity, date: dateStr },
      actionTextKey: 'notifications.carpool.booking_cancelled.action',
      category: 'carpool',
      entityType: 'CarpoolOffer',
      entityId: offerId.toString(),
      actionUrl,
      notificationType: 'carpool_booking_cancelled',
    })
  },

  /**
   * Notification d'arrivée d'un artiste
   */
  async artistArrival(
    userId: number,
    artistName: string,
    editionId: number,
    artistId: number,
    shows?: string[]
  ) {
    // Choisir la bonne clé de message selon si il y a des spectacles ou non
    const messageKey =
      shows && shows.length > 0
        ? 'notifications.artist.arrival.message_with_shows'
        : 'notifications.artist.arrival.message'

    const translationParams: Record<string, any> = { artistName }
    if (shows && shows.length > 0) {
      translationParams.shows = shows.join('\n• ')
    }

    return await NotificationService.create({
      userId,
      type: 'INFO',
      titleKey: 'notifications.artist.arrival.title',
      messageKey,
      translationParams,
      actionTextKey: 'notifications.artist.arrival.action',
      category: 'artist',
      entityType: 'EditionArtist',
      entityId: artistId.toString(),
      actionUrl: `/editions/${editionId}/gestion/artists`,
      notificationType: 'artist_arrival',
    })
  },
}
