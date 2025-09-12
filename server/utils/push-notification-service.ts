import webpush from 'web-push'

import { prisma } from './prisma'

import type { Notification } from '@prisma/client'

// Interface pour les données de notification push
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

class PushNotificationService {
  private initialized = false

  constructor() {
    this.initialize()
  }

  /**
   * Initialiser le service avec les clés VAPID
   */
  private initialize() {
    if (this.initialized) return

    const config = useRuntimeConfig()

    // Récupérer les clés VAPID depuis les variables d'environnement
    const vapidPublicKey = config.public.vapidPublicKey || process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    const vapidSubject = process.env.VAPID_SUBJECT || process.env.VAPID_EMAIL

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error("[Push Service] Clés VAPID manquantes dans les variables d'environnement")
      console.error('Public Key:', vapidPublicKey ? 'Présente' : 'Manquante')
      console.error('Private Key:', vapidPrivateKey ? 'Présente' : 'Manquante')
      console.error('Subject:', vapidSubject ? 'Présente' : 'Manquante')
      return
    }

    try {
      // Configurer web-push avec les clés VAPID
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

      this.initialized = true
      console.log('[Push Service] Service initialisé avec succès', {
        subject: vapidSubject,
        publicKeyLength: vapidPublicKey?.length,
        privateKeyLength: vapidPrivateKey?.length
      })
    } catch (error) {
      console.error("[Push Service] Erreur lors de l'initialisation:", error)
    }
  }

  /**
   * Envoyer une notification push à un utilisateur spécifique
   */
  async sendToUser(userId: number, data: PushNotificationData): Promise<boolean> {
    if (!this.initialized) {
      console.error('[Push Service] Service non initialisé')
      return false
    }

    try {
      // Récupérer toutes les subscriptions de l'utilisateur
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
      })

      if (subscriptions.length === 0) {
        console.log(`[Push Service] Aucune subscription pour l'utilisateur ${userId}`)
        return false
      }

      console.log(
        `[Push Service] Envoi à ${subscriptions.length} appareil(s) pour l'utilisateur ${userId}`
      )

      // Envoyer à toutes les subscriptions
      const results = await Promise.allSettled(
        subscriptions.map((sub) => this.sendToSubscription(sub, data))
      )

      // Compter les succès
      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length
      console.log(
        `[Push Service] ${successCount}/${subscriptions.length} notifications envoyées avec succès`
      )

      return successCount > 0
    } catch (error) {
      console.error("[Push Service] Erreur lors de l'envoi à l'utilisateur:", error)
      return false
    }
  }

  /**
   * Envoyer une notification push à plusieurs utilisateurs
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
   * Envoyer une notification push à tous les utilisateurs ayant des subscriptions
   */
  async sendToAll(data: PushNotificationData): Promise<number> {
    if (!this.initialized) {
      console.error('[Push Service] Service non initialisé')
      return 0
    }

    try {
      // Récupérer toutes les subscriptions
      const subscriptions = await prisma.pushSubscription.findMany()

      if (subscriptions.length === 0) {
        console.log('[Push Service] Aucune subscription trouvée')
        return 0
      }

      console.log(`[Push Service] Envoi à ${subscriptions.length} subscription(s)`)

      // Envoyer à toutes les subscriptions
      const results = await Promise.allSettled(
        subscriptions.map((sub) => this.sendToSubscription(sub, data))
      )

      // Compter les succès
      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length
      console.log(
        `[Push Service] ${successCount}/${subscriptions.length} notifications envoyées avec succès`
      )

      return successCount
    } catch (error) {
      console.error("[Push Service] Erreur lors de l'envoi à tous:", error)
      return 0
    }
  }

  /**
   * Envoyer une notification depuis un objet Notification de la DB
   */
  async sendNotification(notification: Notification): Promise<boolean> {
    const data: PushNotificationData = {
      title: notification.title,
      message: notification.message,
      url: notification.actionUrl || '/',
      actionText: notification.actionText || 'Voir',
      id: notification.id.toString(),
      type: notification.type,
    }

    return this.sendToUser(notification.userId, data)
  }

  /**
   * Envoyer à une subscription spécifique
   */
  private async sendToSubscription(
    subscription: { id: string; endpoint: string; p256dh: string; auth: string },
    data: PushNotificationData
  ): Promise<boolean> {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }

      // Préparer le payload
      const payload = JSON.stringify({
        title: data.title,
        message: data.message,
        body: data.message, // Alias pour compatibilité
        icon: data.icon || '/favicons/android-chrome-192x192.png',
        badge: data.badge || '/favicons/favicon-32x32.png',
        actionUrl: data.url,
        actionText: data.actionText,
        id: data.id,
        type: data.type,
        timestamp: new Date().toISOString(),
      })

      // Envoyer la notification
      await webpush.sendNotification(pushSubscription, payload)
      console.log(
        `[Push Service] ✓ Notification envoyée à ${subscription.endpoint.substring(0, 50)}...`
      )
      return true
    } catch (error: any) {
      console.error(`[Push Service] ✗ Erreur d'envoi:`, {
        message: error.message,
        statusCode: error.statusCode,
        body: error.body,
        headers: error.headers,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      })

      // Si l'erreur est 410 (Gone), la subscription n'est plus valide
      if (error.statusCode === 410) {
        console.log('[Push Service] Subscription expirée, suppression...')
        try {
          await prisma.pushSubscription.delete({
            where: { id: subscription.id },
          })
        } catch (deleteError) {
          console.error('[Push Service] Erreur lors de la suppression:', deleteError)
        }
      }

      return false
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
   * Obtenir les statistiques des subscriptions
   */
  async getStats() {
    const totalSubscriptions = await prisma.pushSubscription.count()
    const uniqueUsers = await prisma.pushSubscription.groupBy({
      by: ['userId'],
    })

    return {
      totalSubscriptions,
      uniqueUsers: uniqueUsers.length,
      initialized: this.initialized,
    }
  }
}

// Exporter une instance unique
export const pushNotificationService = new PushNotificationService()
