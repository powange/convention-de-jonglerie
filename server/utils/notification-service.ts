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

import type { NotificationType } from '@prisma/client'

export interface CreateNotificationData {
  userId: number
  type: NotificationType
  title: string
  message: string
  category?: string
  entityType?: string
  entityId?: string
  actionUrl?: string
  actionText?: string
  // Type de notification pour vérifier les préférences
  notificationType?: CustomNotificationType
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
        title: data.title,
        message: data.message,
        category: data.category,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
        actionText: data.actionText,
      },
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
      const pushSent = await pushNotificationService.sendNotification(notification)
      console.log(
        `[NotificationService] Notification ${notification.id} ${pushSent ? 'envoyée' : 'non envoyée'} via Push`
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

            // TODO: Implémenter la traduction des emails selon la langue préférée
            // Pour l'instant, les emails sont envoyés en français
            console.log(
              `[NotificationService] Langue préférée de l'utilisateur ${data.userId}: ${preferredLanguage}`
            )

            const emailHtml = await generateNotificationEmailHtml(
              prenom,
              data.title,
              data.message,
              data.actionUrl,
              data.actionText
            )

            const emailSent = await sendEmail({
              to: user.email,
              subject: data.title,
              html: emailHtml,
              text: data.message,
            })

            console.log(
              `[NotificationService] Email notification ${notification.id} ${emailSent ? 'envoyé' : 'non envoyé'} à ${user.email}`
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
      title: 'Bienvenue ! 🎉',
      message:
        'Votre compte a été créé avec succès. Découvrez les conventions de jonglerie près de chez vous !',
      category: 'system',
      actionUrl: '/',
      actionText: 'Voir les conventions',
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
      title: 'Nouvelle convention ajoutée',
      message: `La convention "${conventionName}" vient d'être ajoutée à la plateforme.`,
      category: 'edition',
      entityType: 'Convention',
      entityId: conventionId.toString(),
      actionUrl: `/conventions/${conventionId}`,
      actionText: 'Voir les détails',
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
      title: 'Candidature de bénévolat envoyée ! 🎉',
      message: `Votre candidature pour "${editionName}" a été envoyée avec succès. Les organisateurs vont l'examiner.`,
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: '/my-volunteer-applications',
      actionText: 'Voir mes candidatures',
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
    let message = `Votre candidature de bénévolat pour "${editionName}" a été acceptée.`

    // Ajouter la liste des équipes si présente
    if (assignedTeams && assignedTeams.length > 0) {
      if (assignedTeams.length === 1) {
        message += `<br><br>Vous êtes assigné(e) à l'équipe : ${assignedTeams[0]}`
      } else {
        message += `<br><br>Vous êtes assigné(e) aux équipes :<br>• ${assignedTeams.join('<br>• ')}`
      }
    }

    // Ajouter le message de l'organisateur si présent
    if (organizerNote?.trim()) {
      message += `<br><br>Message de l'organisateur :<br>"${organizerNote.trim()}"`
    }

    return await NotificationService.create({
      userId,
      type: 'SUCCESS',
      title: 'Candidature acceptée ! ✅',
      message,
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: `/editions/${editionId}/volunteers`,
      actionText: 'Voir les détails',
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
      title: 'Candidature non retenue',
      message: `Votre candidature de bénévolat pour "${editionName}" n'a pas été retenue cette fois.`,
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: `/editions/${editionId}`,
      actionText: "Voir l'édition",
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
      title: 'Candidature remise en attente',
      message: `Votre candidature de bénévolat pour "${editionName}" a été remise en attente par les organisateurs.`,
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: '/my-volunteer-applications',
      actionText: 'Voir ma candidature',
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
      title: "Rappel d'événement 📅",
      message: `L'édition "${editionName}" commence dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''} !`,
      category: 'edition',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: `/editions/${editionId}`,
      actionText: 'Voir les détails',
    })
  },

  /**
   * Notification d'erreur système
   */
  async systemError(userId: number, errorMessage: string) {
    return await NotificationService.create({
      userId,
      type: 'ERROR',
      title: 'Erreur système',
      message: `Une erreur s'est produite : ${errorMessage}`,
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
    message?: string
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
      type: 'INFO',
      title: 'Nouvelle demande de covoiturage 🚗',
      message: `${requesterName} souhaite réserver ${seats} place${seats > 1 ? 's' : ''} dans votre covoiturage${message ? ` : "${message}"` : '.'}`,
      category: 'carpool',
      entityType: 'CarpoolOffer',
      entityId: offerId.toString(),
      actionUrl,
      actionText: 'Voir la demande',
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

    const dateStr = tripDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return await NotificationService.create({
      userId,
      type: 'SUCCESS',
      title: 'Demande de covoiturage acceptée ! ✅',
      message: `${ownerName} a accepté votre demande de ${seats} place${seats > 1 ? 's' : ''} pour le trajet au départ de ${locationCity} le ${dateStr}.`,
      category: 'carpool',
      entityType: 'CarpoolOffer',
      entityId: offerId.toString(),
      actionUrl,
      actionText: 'Voir les détails',
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
      title: 'Demande de covoiturage refusée',
      message: `${ownerName} a refusé votre demande de ${seats} place${seats > 1 ? 's' : ''} pour le trajet au départ de ${locationCity}.`,
      category: 'carpool',
      entityType: 'CarpoolOffer',
      entityId: offerId.toString(),
      actionUrl,
      actionText: "Voir d'autres offres",
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

    const dateStr = tripDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    return await NotificationService.create({
      userId,
      type: 'INFO',
      title: 'Réservation annulée 📅',
      message: `${passengerName} a annulé sa réservation de ${seats} place${seats > 1 ? 's' : ''} pour le trajet au départ de ${locationCity} le ${dateStr}.`,
      category: 'carpool',
      entityType: 'CarpoolOffer',
      entityId: offerId.toString(),
      actionUrl,
      actionText: 'Voir le covoiturage',
      notificationType: 'carpool_booking_cancelled',
    })
  },
}
