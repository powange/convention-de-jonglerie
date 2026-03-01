import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'

/** Masque un secret en montrant les 4 derniers caractères */
function maskSecret(value: string | undefined): string {
  if (!value) return 'non défini'
  if (value.length <= 8) return '***…' + value.slice(-2)
  return '***…' + value.slice(-4)
}

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const config = useRuntimeConfig()

    return {
      server: {
        nodeEnv: process.env.NODE_ENV,
        nuxtVersion: config.nuxtVersion || 'inconnu',
        // Configuration IA
        ai: {
          provider: process.env.AI_PROVIDER || config.aiProvider || 'non défini',
          anthropicApiKey: maskSecret(process.env.ANTHROPIC_API_KEY || config.anthropicApiKey),
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
          smtpPass: maskSecret(process.env.SMTP_PASS || config.smtpPass),
        },
        // Configuration OAuth
        oauth: {
          googleClientId: maskSecret(process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID),
          googleClientSecret: maskSecret(process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET),
          googleRedirectUrl: process.env.NUXT_OAUTH_GOOGLE_REDIRECT_URL || 'non défini',
          facebookClientId: maskSecret(process.env.NUXT_OAUTH_FACEBOOK_CLIENT_ID),
          facebookClientSecret: maskSecret(process.env.NUXT_OAUTH_FACEBOOK_CLIENT_SECRET),
          facebookRedirectUrl: process.env.NUXT_OAUTH_FACEBOOK_REDIRECT_URL || 'non défini',
        },
        // Configuration base de données
        database: {
          url: maskSecret(process.env.DATABASE_URL),
        },
        // Configuration reCAPTCHA
        recaptcha: {
          secretKey: maskSecret(process.env.NUXT_RECAPTCHA_SECRET_KEY),
          minScore: config.recaptchaMinScore || 0.5,
          devBypass: config.recaptchaDevBypass || false,
        },
        // Session
        session: {
          password: maskSecret(process.env.NUXT_SESSION_PASSWORD),
        },
        // Chiffrement
        encryption: {
          secret: maskSecret(process.env.ENCRYPTION_SECRET),
          salt: maskSecret(process.env.ENCRYPTION_SALT),
        },
        // Services externes
        browserless: {
          url: process.env.BROWSERLESS_URL || 'non défini',
        },
        // VAPID (notifications push)
        vapid: {
          privateKey: maskSecret(process.env.VAPID_PRIVATE_KEY),
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
          privateKey: maskSecret(process.env.FIREBASE_PRIVATE_KEY),
        },
      },
      public: {
        siteUrl: config.public.siteUrl || 'non défini',
        recaptchaSiteKey: config.public.recaptchaSiteKey || 'non défini',
        vapidPublicKey: maskSecret(config.public.vapidPublicKey),
        firebaseApiKey: maskSecret(process.env.NUXT_PUBLIC_FIREBASE_API_KEY),
        firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || 'non défini',
        firebaseVapidKey: maskSecret(process.env.NUXT_PUBLIC_FIREBASE_VAPID_KEY),
      },
      env: {
        // Variables d'environnement brutes (pour comparaison)
        AI_PROVIDER: process.env.AI_PROVIDER || 'non défini',
        LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL || 'non défini',
        LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL || 'non défini',
        LMSTUDIO_TEXT_MODEL: process.env.LMSTUDIO_TEXT_MODEL || 'non défini',
        OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'non défini',
        OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'non défini',
        ANTHROPIC_API_KEY: maskSecret(process.env.ANTHROPIC_API_KEY),
        SEND_EMAILS: process.env.SEND_EMAILS || 'non défini',
        NODE_ENV: process.env.NODE_ENV || 'non défini',
      },
    }
  },
  { operationName: 'GetAdminConfig' }
)
