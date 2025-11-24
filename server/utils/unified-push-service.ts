import { firebaseAdmin } from './firebase-admin'
import { pushNotificationService } from './push-notification-service'

/**
 * Service unifié de notifications push
 * Utilise Firebase FCM en priorité, puis Web Push VAPID en fallback
 */

interface PushNotificationData {
  title: string
  message: string
  icon?: string
  badge?: string
  url?: string
  actionText?: string
  id?: string
  type?: string
}

class UnifiedPushService {
  /**
   * Envoyer une notification à un utilisateur spécifique
   * Utilise FCM en priorité, sinon VAPID en fallback
   * Cette stratégie évite d'envoyer deux notifications au même utilisateur
   */
  async sendToUser(userId: number, data: PushNotificationData): Promise<boolean> {
    // Essayer Firebase FCM en premier
    const fcmSuccess = await this.sendViaFirebase(userId, data)

    if (fcmSuccess) {
      console.log(`✅ [Unified] Notification envoyée via FCM à l'utilisateur ${userId}`)
      return true // FCM a fonctionné, pas besoin de VAPID
    }

    // Fallback sur VAPID si FCM a échoué ou n'est pas disponible
    console.log(`🔄 [Unified] FCM non disponible, tentative via VAPID pour l'utilisateur ${userId}`)
    const vapidSuccess = await this.sendViaVapid(userId, data)

    if (vapidSuccess) {
      console.log(`✅ [Unified] Notification envoyée via VAPID à l'utilisateur ${userId}`)
    } else {
      console.log(`❌ [Unified] Échec d'envoi de notification à l'utilisateur ${userId}`)
    }

    return vapidSuccess
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

      console.log(
        `📲 [FCM] Envoi à l'utilisateur ${userId}: ${result.success} succès, ${result.failure} échecs`
      )

      return result.success > 0
    } catch (error) {
      console.error("[FCM] Erreur lors de l'envoi:", error)
      return false
    }
  }

  /**
   * Envoyer via Web Push VAPID
   */
  private async sendViaVapid(userId: number, data: PushNotificationData): Promise<boolean> {
    try {
      const success = await pushNotificationService.sendToUser(userId, data)

      if (success) {
        console.log(`📲 [VAPID] Notification envoyée à l'utilisateur ${userId}`)
      }

      return success
    } catch (error) {
      console.error("[VAPID] Erreur lors de l'envoi:", error)
      return false
    }
  }

  /**
   * Envoyer une notification à tous les utilisateurs
   */
  async sendToAll(data: PushNotificationData): Promise<number> {
    // Pour l'instant, utilise seulement VAPID pour sendToAll
    // Firebase FCM nécessiterait de récupérer tous les tokens et envoyer par batch
    const count = await pushNotificationService.sendToAll(data)
    console.log(`📲 [Unified] Notification envoyée à ${count} utilisateur(s)`)
    return count
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
   * Obtenir les statistiques des deux systèmes
   */
  async getStats() {
    const [fcmCount, vapidStats] = await Promise.all([
      prisma.fcmToken.count({
        where: { isActive: true },
      }),
      pushNotificationService.getStats(),
    ])

    return {
      fcm: {
        totalTokens: fcmCount,
        enabled: firebaseAdmin.isInitialized(),
      },
      vapid: vapidStats,
    }
  }
}

// Exporter une instance unique
export const unifiedPushService = new UnifiedPushService()
