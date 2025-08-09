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
    '@nuxtjs/i18n'
  ],
  ui: {
    icons: ['heroicons', 'simple-icons']
  },
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'fr', name: 'Français', file: 'fr.json' },
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'es', name: 'Español', file: 'es.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
      { code: 'it', name: 'Italiano', file: 'it.json' },
      { code: 'pt', name: 'Português', file: 'pt.json' },
      { code: 'da', name: 'Dansk', file: 'da.json' },
      { code: 'pl', name: 'Polski', file: 'pl.json' }
    ],
    langDir: 'locales/',
    lazy: true,
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
      sourcemap: process.env.NODE_ENV === 'development' // Sourcemaps seulement en dev
    },
    plugins: [
      tsconfigPaths()
    ]
  },
  experimental: {
    appManifest: false,
  }
})