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
  ],
  ui: {
    icons: ['heroicons', 'simple-icons']
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
    public: {
      // Public keys that are available on both client and server
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
  }
})