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
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logos/logo-jc.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicons/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicons/favicon-192x192.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicons/favicon-180x180.png' },
        { rel: 'manifest', href: '/api/site.webmanifest?v=2' },
        { rel: 'alternate icon', href: '/favicon.ico' },
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
    '@prisma/nuxt',
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
      external: ['node-cron'],
    },
    experimental: {
      tasks: true,
    },
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
      { code: 'uk', name: 'Українська', file: 'uk.json' },
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
    sessionPassword: process.env.NUXT_SESSION_PASSWORD || '',
    emailEnabled: process.env.SEND_EMAILS || 'false', // Enable/disable real email sending
    smtpUser: process.env.SMTP_USER || '', // SMTP username for email sending
    smtpPass: process.env.SMTP_PASS || '', // SMTP password for email sending
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
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000', // Base URL of the site
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
      alias: {
        '.prisma/client/index-browser': './node_modules/.prisma/client/index-browser.js',
      },
    },
    optimizeDeps: {
      exclude: ['node-cron'],
    },
  },
  // Configuration du module Prisma
  prisma: {
    installStudio: false,
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
      '/login',
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
    sources: ['/api/__sitemap__/editions'],
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
