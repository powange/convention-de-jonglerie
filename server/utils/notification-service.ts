import { prisma } from './prisma'
import { WebPushService } from './web-push-service'

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

    // Envoyer la notification push en parallèle (ne pas bloquer la création)
    this.sendPushNotification(notification).catch(error => {
      console.error('Erreur lors de l\'envoi de la notification push:', error)
    })

    return notification
  },

  /**
   * Envoie une notification push
   */
  async sendPushNotification(notification: any) {
    try {
      // Déterminer l'icône selon le type
      let icon = '/favicons/favicon-192x192.png'
      if (notification.type === 'SUCCESS') icon = '/favicons/favicon-192x192.png'
      else if (notification.type === 'WARNING') icon = '/favicons/favicon-192x192.png'
      else if (notification.type === 'ERROR') icon = '/favicons/favicon-192x192.png'

      const pushPayload = {
        title: notification.title,
        body: notification.message,
        icon,
        url: notification.actionUrl || '/notifications',
        tag: `notification-${notification.id}`,
        requireInteraction: notification.type === 'ERROR',
      }

      const result = await WebPushService.sendToUser(notification.userId, pushPayload)
      
      if (result.success && result.summary) {
        console.log(`Push envoyé à l'utilisateur ${notification.userId}: ${result.summary.success}/${result.summary.total} succès`)
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi push:', error)
    }
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
      actionUrl: '/conventions',
      actionText: 'Voir les conventions',
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
    })
  },

  /**
   * Notification de candidature de bénévolat acceptée
   */
  async volunteerAccepted(userId: number, editionName: string, editionId: number) {
    return await NotificationService.create({
      userId,
      type: 'SUCCESS',
      title: 'Candidature acceptée ! ✅',
      message: `Votre candidature de bénévolat pour "${editionName}" a été acceptée.`,
      category: 'volunteer',
      entityType: 'Edition',
      entityId: editionId.toString(),
      actionUrl: `/editions/${editionId}/volunteers`,
      actionText: 'Voir les détails',
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
    })
  },
}
