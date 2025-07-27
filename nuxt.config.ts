import tsconfigPaths from 'vite-tsconfig-paths';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    '@nuxt/ui',
    '@pinia/nuxt',
  ],
  css: [
    '~/assets/css/main.css',
    'flag-icons/css/flag-icons.min.css'
  ],
  vite: {
    plugins: [
      tsconfigPaths(),
    ],
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-development', // Private keys that are only available on the server
    public: {
      // Public keys that are available on both client and server
    }
  }
})