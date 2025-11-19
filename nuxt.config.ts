import vue from '@vitejs/plugin-vue'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  // Configuration SEO du site
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://juggling-convention.com',
    name: 'Juggling Convention',
    description:
      'Find and manage your favorite juggling conventions. Collaborative platform for jugglers and event organizers.',
    defaultLocale: 'en',
  },

  app: {
    head: {
      titleTemplate: '%s | Juggling Convention',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logos/logo-jc.svg?v=3' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicons/favicon-32x32.png?v=3' },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '192x192',
          href: '/favicons/favicon-192x192.png?v=3',
        },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicons/favicon-180x180.png?v=3' },
        { rel: 'manifest', href: '/api/site.webmanifest?v=3' },
        { rel: 'alternate icon', href: '/favicon.ico?v=3' },
      ],
    },
  },
  // Active en dev uniquement
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  // Enregistre explicitement les helpers de session pour l'alias #imports (utile en environnement de test)
  imports: {
    imports: [
      { from: 'nuxt-auth-utils', name: 'getUserSession' },
      { from: 'nuxt-auth-utils', name: 'requireUserSession' },
      { from: 'nuxt-auth-utils', name: 'setUserSession' },
      { from: 'nuxt-auth-utils', name: 'clearUserSession' },
    ],
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/scripts',
    // Activer le module de test-utils sur tous les environnements non-production (incl. test)
    process.env.NODE_ENV !== 'production' ? '@nuxt/test-utils/module' : undefined,
    '@nuxt/ui',
    '@pinia/nuxt',
    'nuxt-auth-utils',
    '@nuxtjs/i18n',
    '@vueuse/nuxt',
    'nuxt-file-storage',
    '@nuxtjs/seo',
    'nuxt-qrcode',
  ].filter(Boolean),

  // Restreindre les collections d'icônes empaquetées côté serveur
  icon: {
    // Utiliser le mode `remote` pour éviter d'empaqueter les collections locales volumineuses
    // et ne récupérer que les icônes utilisées à l'exécution (taille serveur fortement réduite)
    serverBundle: 'remote',
  },
  nitro: {
    ignore: ['**/*.spec.ts', '**/*.test.ts', 'test/**', '__tests__/**', 'scripts/**'],
    externals: {
      external: ['node-cron', '@prisma/client'],
    },
    experimental: {
      tasks: true,
    },
    rollupConfig: {
      plugins: [vue()],
    },
    // Compression des assets statiques (gzip et brotli)
    compressPublicAssets: {
      gzip: true,
      brotli: true,
    },
    // Configuration du cache pour les assets statiques
    publicAssets: [
      {
        // Assets statiques dans /public avec cache de 1 mois
        dir: '../public',
        maxAge: 60 * 60 * 24 * 30, // 30 jours
      },
    ],
  },
  i18n: {
    lazy: true, // Activer le lazy loading
    defaultLocale: 'en',
    locales: [
      {
        code: 'cs',
        language: 'cs',
        name: 'Čeština',
        files: [
          'cs/common.json',
          'cs/notifications.json',
          'cs/components.json',
          'cs/app.json',
          'cs/public.json',
          'cs/feedback.json',
        ],
      },
      {
        code: 'da',
        language: 'da',
        name: 'Dansk',
        files: [
          'da/common.json',
          'da/notifications.json',
          'da/components.json',
          'da/app.json',
          'da/public.json',
          'da/feedback.json',
        ],
      },
      {
        code: 'de',
        language: 'de',
        name: 'Deutsch',
        files: [
          'de/common.json',
          'de/notifications.json',
          'de/components.json',
          'de/app.json',
          'de/public.json',
          'de/feedback.json',
        ],
      },
      {
        code: 'en',
        language: 'en',
        name: 'English',
        files: [
          'en/common.json',
          'en/notifications.json',
          'en/components.json',
          'en/app.json',
          'en/public.json',
          'en/feedback.json',
        ],
      },
      {
        code: 'es',
        language: 'es',
        name: 'Español',
        files: [
          'es/common.json',
          'es/notifications.json',
          'es/components.json',
          'es/app.json',
          'es/public.json',
          'es/feedback.json',
        ],
      },
      {
        code: 'fr',
        language: 'fr',
        name: 'Français',
        files: [
          'fr/common.json',
          'fr/notifications.json',
          'fr/components.json',
          'fr/app.json',
          'fr/public.json',
          'fr/feedback.json',
          'fr/gestion.json',
        ],
      },
      {
        code: 'it',
        language: 'it',
        name: 'Italiano',
        files: [
          'it/common.json',
          'it/notifications.json',
          'it/components.json',
          'it/app.json',
          'it/public.json',
          'it/feedback.json',
        ],
      },
      {
        code: 'nl',
        language: 'nl',
        name: 'Nederlands',
        files: [
          'nl/common.json',
          'nl/notifications.json',
          'nl/components.json',
          'nl/app.json',
          'nl/public.json',
          'nl/feedback.json',
        ],
      },
      {
        code: 'pl',
        language: 'pl',
        name: 'Polski',
        files: [
          'pl/common.json',
          'pl/notifications.json',
          'pl/components.json',
          'pl/app.json',
          'pl/public.json',
          'pl/feedback.json',
        ],
      },
      {
        code: 'pt',
        language: 'pt',
        name: 'Português',
        files: [
          'pt/common.json',
          'pt/notifications.json',
          'pt/components.json',
          'pt/app.json',
          'pt/public.json',
          'pt/feedback.json',
        ],
      },
      {
        code: 'ru',
        language: 'ru',
        name: 'Русский',
        files: [
          'ru/common.json',
          'ru/notifications.json',
          'ru/components.json',
          'ru/app.json',
          'ru/public.json',
          'ru/feedback.json',
        ],
      },
      {
        code: 'sv',
        language: 'sv',
        name: 'Svenska',
        files: [
          'sv/common.json',
          'sv/notifications.json',
          'sv/components.json',
          'sv/app.json',
          'sv/public.json',
          'sv/feedback.json',
        ],
      },
      {
        code: 'uk',
        language: 'uk',
        name: 'Українська',
        files: [
          'uk/common.json',
          'uk/notifications.json',
          'uk/components.json',
          'uk/app.json',
          'uk/public.json',
          'uk/feedback.json',
        ],
      },
    ],
    langDir: 'locales/',
    compilation: {
      strictMessage: false,
      escapeHtml: false,
    },
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      cookieDomain: null,
      cookieSecure: false,
      cookieCrossOrigin: false,
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
    // Optimiser les traductions pour réduire la taille des bundles
    bundle: {
      compositionOnly: true,
      runtimeOnly: false,
      fullInstall: false,
      // Garder le compilateur de messages même en prod pour éviter les erreurs SSR (intlify)
      dropMessageCompiler: false,
    },
    vueI18n: './i18n/i18n.config.ts',
  },
  css: ['~/assets/css/main.css', 'flag-icons/css/flag-icons.min.css'],
  // Configuration pour nuxt-file-storage
  fileStorage: {
    mount: process.env.NUXT_FILE_STORAGE_MOUNT || '/uploads',
  },

  runtimeConfig: {
    // Private keys that are only available on the server
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
      maxAge: 60 * 60 * 24 * 30, // 30 jours par défaut (peut être overridé par login avec "remember me")
    },
    sessionPassword: process.env.NUXT_SESSION_PASSWORD || '',
    emailEnabled: process.env.SEND_EMAILS || 'false', // Enable/disable real email sending
    smtpUser: process.env.SMTP_USER || '', // SMTP username for email sending
    smtpPass: process.env.SMTP_PASS || '', // SMTP password for email sending
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '', // Anthropic Claude API key for AI features
    // Configuration du provider IA (anthropic, ollama ou lmstudio)
    aiProvider: process.env.AI_PROVIDER || 'anthropic', // Provider IA à utiliser (anthropic par défaut)
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434', // URL de base d'Ollama
    ollamaModel: process.env.OLLAMA_MODEL || 'llava', // Modèle Ollama avec vision
    lmstudioBaseUrl: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234', // URL de base de LM Studio
    lmstudioModel: process.env.LMSTUDIO_MODEL || 'auto', // Modèle LM Studio (auto = utilise le modèle chargé)
    // Supporte aussi la convention Nuxt NUXT_*
    recaptchaSecretKey: process.env.NUXT_RECAPTCHA_SECRET_KEY || '', // reCAPTCHA secret key for server-side verification
    recaptchaMinScore: Number(process.env.NUXT_RECAPTCHA_MIN_SCORE || '0.5'), // seuil configurable pour v3
    recaptchaExpectedHostname: process.env.NUXT_RECAPTCHA_EXPECTED_HOSTNAME || '', // optionnel: valider le hostname retourné par Google
    recaptchaDevBypass:
      process.env.NUXT_RECAPTCHA_DEV_BYPASS === 'true' || process.env.NODE_ENV !== 'production', // bypass en dev par défaut
    public: {
      // Public keys that are available on both client and server
      // Supporte aussi la convention Nuxt NUXT_PUBLIC_*
      recaptchaSiteKey: process.env.NUXT_PUBLIC_RECAPTCHA_SITE_KEY || '', // reCAPTCHA site key for client-side widget
      vapidPublicKey: process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY || '', // VAPID public key for push notifications
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || '', // Base URL of the site
    },
  },
  vite: {
    css: {
      devSourcemap: true,
    },
    build: {
      sourcemap: process.env.NODE_ENV !== 'production', // Sourcemaps en dev et preview
      chunkSizeWarningLimit: 800, // Seuil optimal pour les performances
      // Optimisation des imports
      dynamicImportVarsOptions: {
        warnOnError: true,
        exclude: [/node_modules/],
      },
    },
    plugins: [tsconfigPaths()],
    // Configuration Vite pour le hot reload dans Docker sur Windows
    server: {
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
    resolve: {
      alias: {},
    },
    optimizeDeps: {
      exclude: ['node-cron', '@prisma/client'],
    },
  },
  experimental: {
    appManifest: false,
    // Améliorer les performances avec la lazy hydration
    lazyHydration: true,
    // Optimiser la gestion d'erreur des chunks
    emitRouteChunkError: 'automatic',
  },

  // Configuration des modules SEO
  robots: {
    // Permettre l'indexation uniquement sur le domaine principal en production
    disallow: process.env.NUXT_ENV === 'staging' || process.env.NUXT_ENV === 'release' ? ['/'] : [],
    sitemap: '/sitemap.xml',
  },

  sitemap: {
    // Désactiver le sitemap sur les environnements non-production
    enabled:
      process.env.NODE_ENV === 'production' &&
      process.env.NUXT_ENV !== 'staging' &&
      process.env.NUXT_ENV !== 'release',
    // Exclure certaines routes du sitemap
    exclude: [
      '/admin/**',
      '/register',
      '/logout',
      '/verify-email',
      '/auth/**',
      '/profile',
      '/my-**',
      '/favorites',
      '/notifications',
      '/api/**',
      '/editions/add',
    ],
    // Inclure les routes dynamiques importantes
    sources: [
      '/api/__sitemap__/editions',
      '/api/__sitemap__/carpool',
      '/api/__sitemap__/volunteers',
    ],
    // Définir explicitement les routes autorisées
    urls: [
      {
        loc: '/',
        lastmod: new Date(),
        changefreq: 'daily',
        priority: 1.0,
      },
      {
        loc: '/privacy-policy',
        lastmod: new Date(),
        changefreq: 'monthly',
        priority: 0.3,
      },
    ],
  },

  ogImage: {
    // Active la génération d'images OG seulement si SSR est disponible
    enabled: process.env.NODE_ENV !== 'test',
    defaults: {
      // Utilise le logo comme fallback
      component: 'NuxtSeo',
      width: 1200,
      height: 630,
    },
  },

  schemaOrg: {
    // Active Schema.org
    enabled: true,
  },

  linkChecker: {
    // Active la vérification des liens en dev
    enabled: process.env.NODE_ENV !== 'production',
    excludeLinks: ['mailto:*', 'tel:*'],
  },
})
