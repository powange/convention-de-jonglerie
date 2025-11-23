import admin from 'firebase-admin'

/**
 * Service Firebase Admin SDK pour le serveur
 * Utilisé pour envoyer des notifications push via Firebase Cloud Messaging
 */
class FirebaseAdminService {
  private app: admin.app.App | null = null
  private initialized = false

  constructor() {
    this.initialize()
  }

  /**
   * Initialiser Firebase Admin SDK
   */
  private initialize() {
    if (this.initialized) return

    try {
      // Récupérer les credentials depuis les variables d'environnement
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT

      if (!serviceAccountJson) {
        console.warn(
          '[Firebase Admin] FIREBASE_SERVICE_ACCOUNT non configuré - FCM désactivé (utilisation de web-push VAPID)'
        )
        return
      }

      let serviceAccount
      try {
        serviceAccount = JSON.parse(serviceAccountJson)
      } catch (error) {
        console.error('[Firebase Admin] Erreur de parsing du service account:', error)
        return
      }

      // Vérifier si Firebase n'est pas déjà initialisé
      if (admin.apps.length === 0) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
        })
        console.log('✅ Firebase Admin SDK initialisé')
      } else {
        this.app = admin.apps[0]
        console.log('♻️ Firebase Admin SDK déjà initialisé')
      }

      this.initialized = true
    } catch (error) {
      console.error('[Firebase Admin] Erreur lors de l\'initialisation:', error)
    }
  }

  /**
   * Vérifier si Firebase Admin est initialisé
   */
  isInitialized(): boolean {
    return this.initialized && this.app !== null
  }

  /**
   * Obtenir l'instance Firebase Messaging
   */
  getMessaging(): admin.messaging.Messaging | null {
    if (!this.isInitialized() || !this.app) {
      return null
    }
    return admin.messaging(this.app)
  }

  /**
   * Envoyer une notification à un ou plusieurs tokens FCM
   */
  async sendToTokens(
    tokens: string[],
    notification: {
      title: string
      body: string
    },
    data?: Record<string, string>
  ): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
    const messaging = this.getMessaging()

    if (!messaging) {
      console.error('[Firebase Admin] Messaging non disponible')
      return { success: 0, failure: tokens.length, invalidTokens: [] }
    }

    if (tokens.length === 0) {
      return { success: 0, failure: 0, invalidTokens: [] }
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification,
        data,
        tokens,
      }

      const response = await messaging.sendEachForMulticast(message)

      // Identifier les tokens invalides pour nettoyage
      const invalidTokens: string[] = []
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error
          // Codes d'erreur indiquant un token invalide ou expiré
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx])
          }
        }
      })

      return {
        success: response.successCount,
        failure: response.failureCount,
        invalidTokens,
      }
    } catch (error) {
      console.error('[Firebase Admin] Erreur lors de l\'envoi:', error)
      return { success: 0, failure: tokens.length, invalidTokens: [] }
    }
  }

  /**
   * Envoyer une notification à un topic
   */
  async sendToTopic(
    topic: string,
    notification: {
      title: string
      body: string
    },
    data?: Record<string, string>
  ): Promise<boolean> {
    const messaging = this.getMessaging()

    if (!messaging) {
      console.error('[Firebase Admin] Messaging non disponible')
      return false
    }

    try {
      const message: admin.messaging.Message = {
        notification,
        data,
        topic,
      }

      await messaging.send(message)
      return true
    } catch (error) {
      console.error('[Firebase Admin] Erreur lors de l\'envoi au topic:', error)
      return false
    }
  }

  /**
   * S'abonner à un topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
    const messaging = this.getMessaging()

    if (!messaging) {
      console.error('[Firebase Admin] Messaging non disponible')
      return false
    }

    try {
      await messaging.subscribeToTopic(tokens, topic)
      return true
    } catch (error) {
      console.error('[Firebase Admin] Erreur lors de l\'abonnement au topic:', error)
      return false
    }
  }

  /**
   * Se désabonner d'un topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<boolean> {
    const messaging = this.getMessaging()

    if (!messaging) {
      console.error('[Firebase Admin] Messaging non disponible')
      return false
    }

    try {
      await messaging.unsubscribeFromTopic(tokens, topic)
      return true
    } catch (error) {
      console.error('[Firebase Admin] Erreur lors du désabonnement du topic:', error)
      return false
    }
  }
}

// Exporter une instance unique
export const firebaseAdmin = new FirebaseAdminService()
