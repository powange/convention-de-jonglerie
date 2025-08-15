import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // Active en dev uniquement
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  modules: [
    '@nuxt/eslint', 
    '@nuxt/image', 
    '@nuxt/scripts', 
    // Module de tests uniquement en dev
    process.env.NODE_ENV === 'development' ? '@nuxt/test-utils/module' : undefined,
    '@nuxt/ui', 
    '@pinia/nuxt', 
    '@prisma/nuxt',
    '@nuxtjs/i18n',
    '@vueuse/nuxt'
  ].filter(Boolean),

  // Restreindre les collections d'icônes empaquetées côté serveur
  icon: {
  // Utiliser le mode `remote` pour éviter d'empaqueter les collections locales volumineuses
  // et ne récupérer que les icônes utilisées à l'exécution (taille serveur fortement réduite)
  serverBundle: 'remote'
  },
  nitro: {
    ignore: [
        '**/*.spec.ts',
        '**/*.test.ts',
        'tests/**',
        '__tests__/**',
        'scripts/**'
      ]
  },
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'da', name: 'Dansk', file: 'da.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
      { code: 'es', name: 'Español', file: 'es.json' },
      { code: 'fr', name: 'Français', file: 'fr.json' },
      { code: 'it', name: 'Italiano', file: 'it.json' },
      { code: 'nl', name: 'Nederlands', file: 'nl.json' },
      { code: 'pl', name: 'Polski', file: 'pl.json' },
      { code: 'pt', name: 'Português', file: 'pt.json' },
      { code: 'ru', name: 'Русский', file: 'ru.json' },
      { code: 'uk', name: 'Українська', file: 'uk.json' }
    ],
  langDir: 'locales/',
    compilation: {
      strictMessage: false,
      escapeHtml: false
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
      fallbackLocale: 'fr'
    },
    // Optimiser les traductions pour réduire la taille des bundles
    bundle: {
      compositionOnly: true,
      runtimeOnly: false,
      fullInstall: false,
      // Garder le compilateur de messages même en prod pour éviter les erreurs SSR (intlify)
      dropMessageCompiler: false
    },
    vueI18n: './i18n/i18n.config.ts'
  },
  css: [
    '~/assets/css/main.css',
    'flag-icons/css/flag-icons.min.css'
  ],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-development', // Private keys that are only available on the server
    emailEnabled: process.env.SEND_EMAILS || 'false', // Enable/disable real email sending
    smtpUser: process.env.SMTP_USER || '', // SMTP username for email sending
    smtpPass: process.env.SMTP_PASS || '', // SMTP password for email sending
    recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY || '', // reCAPTCHA secret key for server-side verification
    public: {
      // Public keys that are available on both client and server
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || '' // reCAPTCHA site key for client-side widget
    }
  },
  vite: {
    css: {
      devSourcemap: true
    },
    build: {
      sourcemap: process.env.NODE_ENV !== 'production', // Sourcemaps en dev et preview
      chunkSizeWarningLimit: 800, // Seuil optimal pour les performances
      // Optimisation des imports
      dynamicImportVarsOptions: {
        warnOnError: true,
        exclude: [/node_modules/]
      }
    },
    plugins: [
      tsconfigPaths()
    ],
    // Configuration Vite pour le hot reload dans Docker sur Windows
    server: {
      watch: {
        usePolling: true,
        interval: 1000
      }
    }
  },
  
  // Configuration du module Prisma
  prisma: {
    installStudio: false,
    autoSetupPrisma: true
  },
  experimental: {
    appManifest: false,
    // Améliorer les performances avec la lazy hydration
    lazyHydration: true,
    // Optimiser la gestion d'erreur des chunks
    emitRouteChunkError: 'automatic'
  }
})