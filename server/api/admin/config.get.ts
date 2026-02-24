import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireGlobalAdmin } from '#server/utils/auth-utils'

export default wrapApiHandler(
  async (event) => {
    requireGlobalAdmin(event)

    const config = useRuntimeConfig()

    return {
      server: {
        nodeEnv: process.env.NODE_ENV,
        nuxtVersion: config.nuxtVersion || 'inconnu',
        // Configuration IA
        ai: {
          provider: process.env.AI_PROVIDER || config.aiProvider || 'non défini',
          anthropicApiKey: process.env.ANTHROPIC_API_KEY
            ? '***SET***'
            : config.anthropicApiKey
              ? '***SET***'
              : 'non défini',
          ollamaBaseUrl: process.env.OLLAMA_BASE_URL || config.ollamaBaseUrl || 'non défini',
          ollamaModel: process.env.OLLAMA_MODEL || config.ollamaModel || 'non défini',
          lmstudioBaseUrl: process.env.LMSTUDIO_BASE_URL || config.lmstudioBaseUrl || 'non défini',
          lmstudioModel: process.env.LMSTUDIO_MODEL || config.lmstudioModel || 'non défini',
          lmstudioTextModel:
            process.env.LMSTUDIO_TEXT_MODEL || config.lmstudioTextModel || 'non défini',
        },
        // Configuration email
        email: {
          enabled: process.env.SEND_EMAILS || config.emailEnabled || 'false',
          smtpUser: process.env.SMTP_USER || config.smtpUser || 'non défini',
          smtpPass: process.env.SMTP_PASS
            ? '***SET***'
            : config.smtpPass
              ? '***SET***'
              : 'non défini',
        },
        // Configuration OAuth
        oauth: {
          googleClientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID ? '***SET***' : 'non défini',
          googleClientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET
            ? '***SET***'
            : 'non défini',
          googleRedirectUrl: process.env.NUXT_OAUTH_GOOGLE_REDIRECT_URL || 'non défini',
          facebookClientId: process.env.NUXT_OAUTH_FACEBOOK_CLIENT_ID ? '***SET***' : 'non défini',
          facebookClientSecret: process.env.NUXT_OAUTH_FACEBOOK_CLIENT_SECRET
            ? '***SET***'
            : 'non défini',
          facebookRedirectUrl: process.env.NUXT_OAUTH_FACEBOOK_REDIRECT_URL || 'non défini',
        },
        // Configuration base de données
        database: {
          url: process.env.DATABASE_URL ? '***SET***' : 'non défini',
        },
        // Configuration reCAPTCHA
        recaptcha: {
          secretKey: process.env.NUXT_RECAPTCHA_SECRET_KEY ? '***SET***' : 'non défini',
          minScore: config.recaptchaMinScore || 0.5,
          devBypass: config.recaptchaDevBypass || false,
        },
        // Session
        session: {
          password: process.env.NUXT_SESSION_PASSWORD ? '***SET***' : 'non défini',
        },
        // Chiffrement
        encryption: {
          secret: process.env.ENCRYPTION_SECRET ? '***SET***' : 'non défini',
          salt: process.env.ENCRYPTION_SALT ? '***SET***' : 'non défini',
        },
        // Services externes
        browserless: {
          url: process.env.BROWSERLESS_URL || 'non défini',
        },
        // VAPID (notifications push)
        vapid: {
          privateKey: process.env.VAPID_PRIVATE_KEY ? '***SET***' : 'non défini',
          subject: process.env.VAPID_SUBJECT || 'non défini',
        },
        // Cron
        cron: {
          enabled: process.env.ENABLE_CRON || 'false',
        },
        // Firebase Admin
        firebase: {
          projectId: process.env.FIREBASE_PROJECT_ID || 'non défini',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'non défini',
          privateKey: process.env.FIREBASE_PRIVATE_KEY ? '***SET***' : 'non défini',
        },
      },
      public: {
        siteUrl: config.public.siteUrl || 'non défini',
        recaptchaSiteKey: config.public.recaptchaSiteKey || 'non défini',
        vapidPublicKey: config.public.vapidPublicKey ? '***SET***' : 'non défini',
        firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY ? '***SET***' : 'non défini',
        firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || 'non défini',
        firebaseVapidKey: process.env.NUXT_PUBLIC_FIREBASE_VAPID_KEY ? '***SET***' : 'non défini',
      },
      env: {
        // Variables d'environnement brutes (pour comparaison)
        AI_PROVIDER: process.env.AI_PROVIDER || 'non défini',
        LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL || 'non défini',
        LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL || 'non défini',
        LMSTUDIO_TEXT_MODEL: process.env.LMSTUDIO_TEXT_MODEL || 'non défini',
        OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'non défini',
        OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'non défini',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '***SET***' : 'non défini',
        SEND_EMAILS: process.env.SEND_EMAILS || 'non défini',
        NODE_ENV: process.env.NODE_ENV || 'non défini',
      },
    }
  },
  { operationName: 'GetAdminConfig' }
)
