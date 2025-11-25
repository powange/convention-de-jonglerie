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
      // Méthode 1: Variables d'environnement séparées (recommandé pour multi-environnements)
      const projectId = process.env.FIREBASE_PROJECT_ID
      const privateKey = process.env.FIREBASE_PRIVATE_KEY
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL

      // Méthode 2: JSON complet (legacy, pour compatibilité)
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT

      let serviceAccount: any

      if (projectId && privateKey && clientEmail) {
        // Utiliser les variables séparées
        serviceAccount = {
          projectId,
          privateKey,
          clientEmail,
        }
        console.log(`[Firebase Admin] Configuration via variables séparées (projet: ${projectId})`)
      } else if (serviceAccountJson) {
        // Utiliser le JSON complet (legacy)
        try {
          serviceAccount = JSON.parse(serviceAccountJson)
          console.log(
            `[Firebase Admin] Configuration via JSON complet (projet: ${serviceAccount.project_id})`
          )
        } catch (error) {
          console.error('[Firebase Admin] Erreur de parsing du service account:', error)
          return
        }
      } else {
        console.warn(
          '[Firebase Admin] Configuration Firebase manquante - FCM désactivé (utilisation de web-push VAPID uniquement)'
        )
        return
      }

      // Vérifier si Firebase n'est pas déjà initialisé
      if (admin.apps.length === 0) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.projectId || serviceAccount.project_id,
        })
        console.log('✅ Firebase Admin SDK initialisé')
      } else {
        this.app = admin.apps[0]
        console.log('♻️ Firebase Admin SDK déjà initialisé')
      }

      this.initialized = true
    } catch (error) {
      console.error("[Firebase Admin] Erreur lors de l'initialisation:", error)
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
      // Récupérer l'image (avatar) si fournie - doit être une URL absolue pour Android
      // On ne met pas d'imageUrl si pas d'image fournie (évite l'erreur invalid-payload)
      const imageUrl = data?.image && data.image.startsWith('http') ? data.image : undefined

      const message: admin.messaging.MulticastMessage = {
        // Data pour le service worker web (messages data-only pour éviter les doublons web)
        data: {
          ...data,
          title: notification.title,
          body: notification.body,
        },
        tokens,
        // Configuration Android native avec notification visible
        android: {
          priority: 'high',
          notification: {
            title: notification.title,
            body: notification.body,
            icon: 'ic_notification', // Small icon (doit être dans l'app native, sinon ignoré)
            ...(imageUrl && { imageUrl }), // Large icon à droite du texte (seulement si URL valide)
            clickAction: 'OPEN_APP',
          },
        },
        // Configuration Web - pas de notification pour éviter les doublons (géré par SW)
        webpush: {
          headers: {
            Urgency: 'high',
          },
          fcmOptions: {
            link: data?.url || '/',
          },
        },
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
      console.error("[Firebase Admin] Erreur lors de l'envoi:", error)
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
      console.error("[Firebase Admin] Erreur lors de l'envoi au topic:", error)
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
      console.error("[Firebase Admin] Erreur lors de l'abonnement au topic:", error)
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
