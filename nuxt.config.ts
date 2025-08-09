import tsconfigPaths from 'vite-tsconfig-paths';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint', 
    '@nuxt/image', 
    '@nuxt/scripts', 
    '@nuxt/test-utils/module', 
    '@nuxt/ui', 
    '@pinia/nuxt', 
    '@nuxtjs/i18n',
    '@vueuse/nuxt'
  ],
  ui: {
    icons: ['heroicons', 'simple-icons']
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
    lazy: true,
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
      cookieSameSite: 'lax',
      cookieHttpOnly: false,
      redirectOn: 'no redirect',
      alwaysRedirect: false,
      fallbackLocale: 'fr'
    },
    // Optimisation: précharger uniquement les langues principales
    preloadLocales: ['en', 'fr'],
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
    optimizeDeps: {
      // Pré-bundler ces dépendances pour améliorer les performances
      include: [
        'vue',
        '@vue/runtime-core',
        '@vue/runtime-dom',
        '@vue/shared'
      ]
    },
    build: {
      sourcemap: process.env.NODE_ENV === 'development', // Sourcemaps seulement en dev
      chunkSizeWarningLimit: 600, // Augmenter la limite d'avertissement à 600KB
      // Optimisation du code splitting
      rollupOptions: {
        output: {
          // Séparer les chunks admin des chunks publics et les vendor libraries
          manualChunks: (id) => {
            // Séparer le code admin dans son propre chunk
            if (id.includes('/admin/') || id.includes('\\admin\\')) {
              return 'admin';
            }
            
            // Séparer les grandes bibliothèques dans des chunks individuels
            if (id.includes('node_modules')) {
              // Bibliothèques de carte
              if (id.includes('leaflet')) {
                return 'vendor-leaflet';
              }
              // Bibliothèques UI
              if (id.includes('@nuxt/ui') || id.includes('@headlessui')) {
                return 'vendor-ui';
              }
              // Internationalisation
              if (id.includes('vue-i18n') || id.includes('@intlify')) {
                return 'vendor-i18n';
              }
              // Date utilities
              if (id.includes('@internationalized/date')) {
                return 'vendor-date';
              }
              // VueUse
              if (id.includes('@vueuse')) {
                return 'vendor-vueuse';
              }
              // Vue core et associés
              if (id.includes('vue') || id.includes('@vue')) {
                return 'vendor-vue';
              }
              // Autres vendor libraries
              return 'vendor-misc';
            }
          },
          // Configuration pour optimiser la taille des chunks
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
            return `_nuxt/${chunkInfo.name || facadeModuleId}-[hash].js`;
          }
        }
      }
    },
    plugins: [
      tsconfigPaths()
    ]
  },
  experimental: {
    appManifest: false,
    // Optimisation du rendu et du préchargement
    payloadExtraction: false,
    renderJsonPayloads: true
  },
  // Optimisation du routeur
  nitro: {
    prerender: {
      // Ne pas prérender les pages admin
      ignore: ['/admin', '/admin/**']
    },
    // Compression des assets
    compressPublicAssets: true,
    // Optimisation de la minification
    minify: true
  },
  // Optimisations supplémentaires
  typescript: {
    strict: true,
    shim: false // Désactiver le shim TypeScript en production
  }
})