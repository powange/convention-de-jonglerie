import { firebaseAdmin } from './firebase-admin'

/**
 * Service de notifications push via Firebase Cloud Messaging (FCM)
 */

export interface PushNotificationData {
  title: string
  message: string
  icon?: string
  badge?: string
  url?: string
  actionText?: string
  id?: string
  type?: string
  image?: string // Image à afficher à droite de la notification (ex: avatar de l'expéditeur)
}

class UnifiedPushService {
  /**
   * Envoyer une notification à un utilisateur spécifique via FCM
   */
  async sendToUser(userId: number, data: PushNotificationData): Promise<boolean> {
    if (!firebaseAdmin.isInitialized()) {
      return false
    }

    // Vérifier si l'utilisateur a des tokens FCM actifs
    const fcmTokensCount = await prisma.fcmToken.count({
      where: { userId, isActive: true },
    })

    if (fcmTokensCount === 0) {
      // Pas de token = rien à faire, ce n'est pas un échec
      return false
    }

    return this.sendViaFirebase(userId, data)
  }

  /**
   * Envoyer une notification à plusieurs utilisateurs
   */
  async sendToUsers(userIds: number[], data: PushNotificationData): Promise<Map<number, boolean>> {
    const results = new Map<number, boolean>()

    for (const userId of userIds) {
      const success = await this.sendToUser(userId, data)
      results.set(userId, success)
    }

    return results
  }

  /**
   * Envoyer via Firebase Cloud Messaging
   */
  private async sendViaFirebase(userId: number, data: PushNotificationData): Promise<boolean> {
    if (!firebaseAdmin.isInitialized()) {
      return false
    }

    try {
      // Récupérer tous les tokens FCM de l'utilisateur
      const fcmTokens = await prisma.fcmToken.findMany({
        where: {
          userId,
          isActive: true,
        },
      })

      if (fcmTokens.length === 0) {
        return false
      }

      const tokens = fcmTokens.map((t) => t.token)

      const result = await firebaseAdmin.sendToTokens(
        tokens,
        {
          title: data.title,
          body: data.message,
        },
        {
          url: data.url || '/',
          actionText: data.actionText || '',
          id: data.id || '',
          type: data.type || 'info',
          timestamp: new Date().toISOString(),
          icon: data.icon || '', // Icon personnalisé (avatar pour les messages)
          image: data.image || '', // Grande image (si fournie)
        }
      )

      // Supprimer les tokens invalides
      if (result.invalidTokens.length > 0) {
        await prisma.fcmToken.deleteMany({
          where: {
            token: {
              in: result.invalidTokens,
            },
          },
        })
        console.log(`🧹 [FCM] ${result.invalidTokens.length} tokens invalides supprimés`)
      }

      if (result.success > 0) {
        console.log(`📲 [FCM] Notification envoyée à l'utilisateur ${userId}`)
      } else {
        console.log(`❌ [FCM] Échec d'envoi à l'utilisateur ${userId}`)
      }

      return result.success > 0
    } catch (error) {
      console.error("[FCM] Erreur lors de l'envoi:", error)
      return false
    }
  }

  /**
   * Envoyer une notification à tous les utilisateurs ayant des tokens FCM
   */
  async sendToAll(data: PushNotificationData): Promise<number> {
    if (!firebaseAdmin.isInitialized()) {
      return 0
    }

    try {
      // Récupérer tous les utilisateurs avec des tokens FCM actifs
      const usersWithTokens = await prisma.fcmToken.findMany({
        where: { isActive: true },
        select: { userId: true },
        distinct: ['userId'],
      })

      let successCount = 0
      for (const { userId } of usersWithTokens) {
        const success = await this.sendViaFirebase(userId, data)
        if (success) successCount++
      }

      console.log(
        `📲 [FCM] Notification envoyée à ${successCount}/${usersWithTokens.length} utilisateur(s)`
      )
      return successCount
    } catch (error) {
      console.error("[FCM] Erreur lors de l'envoi à tous:", error)
      return 0
    }
  }

  /**
   * Tester l'envoi d'une notification
   */
  async testPush(userId: number): Promise<boolean> {
    const testData: PushNotificationData = {
      title: '🎯 Test de notification',
      message: 'Si vous voyez ceci, les notifications push fonctionnent !',
      url: '/notifications',
      actionText: 'Voir mes notifications',
    }

    return this.sendToUser(userId, testData)
  }

  /**
   * Obtenir les statistiques FCM
   */
  async getStats() {
    const [totalTokens, activeTokens, uniqueUsers] = await Promise.all([
      prisma.fcmToken.count(),
      prisma.fcmToken.count({ where: { isActive: true } }),
      prisma.fcmToken.groupBy({
        by: ['userId'],
        where: { isActive: true },
      }),
    ])

    return {
      fcm: {
        totalTokens,
        activeTokens,
        uniqueUsers: uniqueUsers.length,
        enabled: firebaseAdmin.isInitialized(),
      },
    }
  }
}

// Exporter une instance unique
export const unifiedPushService = new UnifiedPushService()
