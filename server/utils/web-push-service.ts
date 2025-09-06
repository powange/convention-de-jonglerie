import webpush from 'web-push'

import { prisma } from './prisma'

// Configuration des clés VAPID
const vapidPublicKey = useRuntimeConfig().public.vapidPublicKey
const vapidPrivateKey = useRuntimeConfig().vapidPrivateKey
const vapidSubject = useRuntimeConfig().vapidSubject

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  )
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

export const WebPushService = {
  /**
   * Envoie une notification push à un utilisateur
   */
  async sendToUser(userId: number, payload: PushNotificationPayload) {
    // Vérifier que VAPID est configuré
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys non configurées - notifications push désactivées')
      return { success: false, error: 'VAPID keys non configurées' }
    }

    try {
      // Récupérer toutes les subscriptions actives de l'utilisateur
      const subscriptions = await prisma.pushSubscription.findMany({
        where: {
          userId,
          active: true,
        },
      })

      if (subscriptions.length === 0) {
        return { success: true, message: 'Aucune subscription active' }
      }

      const results = []
      const failedSubscriptions = []

      // Envoyer à chaque subscription
      for (const subscription of subscriptions) {
        try {
          const subscriptionData = JSON.parse(subscription.subscription)
          
          const notificationPayload = {
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/favicons/favicon-192x192.png',
            badge: payload.badge || '/favicons/favicon-96x96.png',
            data: {
              url: payload.url || '/',
              timestamp: Date.now(),
            },
            tag: payload.tag || 'convention-notification',
            requireInteraction: payload.requireInteraction || false,
            actions: payload.url ? [{
              action: 'open',
              title: 'Ouvrir',
              icon: '/favicons/favicon-64x64.png',
            }] : undefined,
          }

          await webpush.sendNotification(
            subscriptionData,
            JSON.stringify(notificationPayload),
            {
              TTL: 24 * 60 * 60, // 24 heures
              urgency: 'normal',
            }
          )

          results.push({ subscriptionId: subscription.id, success: true })
        } catch (error: any) {
          console.error(`Erreur push pour subscription ${subscription.id}:`, error)
          
          // Marquer comme inactive si la subscription est expirée ou invalide
          if (
            error.statusCode === 410 || // Gone
            error.statusCode === 404 || // Not Found
            error.statusCode === 400    // Bad Request (subscription invalide)
          ) {
            failedSubscriptions.push(subscription.id)
          }
          
          results.push({ 
            subscriptionId: subscription.id, 
            success: false, 
            error: error.message,
            statusCode: error.statusCode,
          })
        }
      }

      // Désactiver les subscriptions qui ont échoué
      if (failedSubscriptions.length > 0) {
        await prisma.pushSubscription.updateMany({
          where: {
            id: { in: failedSubscriptions },
          },
          data: {
            active: false,
          },
        })
        console.log(`${failedSubscriptions.length} subscriptions désactivées (expirées/invalides)`)
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount,
          deactivated: failedSubscriptions.length,
        },
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi des notifications push:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Teste si les clés VAPID sont configurées
   */
  isConfigured(): boolean {
    return !!(vapidPublicKey && vapidPrivateKey)
  },

  /**
   * Nettoie les subscriptions expirées (à appeler périodiquement)
   */
  async cleanupExpiredSubscriptions() {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 30) // 30 jours

      const result = await prisma.pushSubscription.deleteMany({
        where: {
          active: false,
          updatedAt: {
            lt: cutoffDate,
          },
        },
      })

      console.log(`${result.count} subscriptions push expirées supprimées`)
      return result.count
    } catch (error) {
      console.error('Erreur lors du nettoyage des subscriptions:', error)
      return 0
    }
  },
}