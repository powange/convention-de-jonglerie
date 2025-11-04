import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    // Vérifier que l'utilisateur est super admin
    if (!user.isGlobalAdmin) {
      throw createError({
        statusCode: 403,
        message: 'Accès réservé aux super administrateurs',
      })
    }

    const config = useRuntimeConfig()

    return {
      server: {
        nodeEnv: process.env.NODE_ENV,
        nuxtVersion: '4.0.1',
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
          facebookClientId: process.env.NUXT_OAUTH_FACEBOOK_CLIENT_ID ? '***SET***' : 'non défini',
        },
        // Configuration base de données
        database: {
          url: process.env.DATABASE_URL ? '***SET***' : 'non défini',
        },
        // Configuration reCAPTCHA
        recaptcha: {
          siteKey: config.recaptchaSecretKey ? '***SET***' : 'non défini',
          minScore: config.recaptchaMinScore || 0.5,
          devBypass: config.recaptchaDevBypass || false,
        },
      },
      public: {
        siteUrl: config.public.siteUrl || 'non défini',
        recaptchaSiteKey: config.public.recaptchaSiteKey || 'non défini',
        vapidPublicKey: config.public.vapidPublicKey ? '***SET***' : 'non défini',
      },
      env: {
        // Variables d'environnement brutes (pour comparaison)
        AI_PROVIDER: process.env.AI_PROVIDER || 'non défini',
        LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL || 'non défini',
        LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL || 'non défini',
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
