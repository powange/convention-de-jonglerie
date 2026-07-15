// Configuration Nuxt de Flowvent (app2) : plateforme SaaS d'organisation d'événements.
// App autonome, base MySQL via Prisma (adapter mariadb), auth via nuxt-auth-utils.
export default defineNuxtConfig({
  compatibilityDate: '2026-03-02',
  devtools: { enabled: true },

  // Réutilise le layer d'authentification partagé (email/mot de passe + OAuth Google).
  // Le layer résout Prisma/utils/i18n via l'app hôte (apps/app2).
  extends: ['../../layers/auth'],

  modules: ['@nuxt/ui', 'nuxt-auth-utils', '@pinia/nuxt', '@nuxtjs/i18n'],

  css: ['~/assets/css/main.css'],

  // Enregistre les helpers de session nuxt-auth-utils pour l'alias `#imports`
  // utilisé par le code serveur du layer d'auth.
  imports: {
    imports: [
      { from: 'nuxt-auth-utils', name: 'getUserSession' },
      { from: 'nuxt-auth-utils', name: 'requireUserSession' },
      { from: 'nuxt-auth-utils', name: 'setUserSession' },
      { from: 'nuxt-auth-utils', name: 'clearUserSession' },
    ],
  },

  // app2 est en français uniquement ; le layer d'auth utilise des clés de traduction
  // fournies dans i18n/locales/fr.json.
  i18n: {
    defaultLocale: 'fr',
    strategy: 'no_prefix',
    locales: [{ code: 'fr', language: 'fr-FR', file: 'fr.json' }],
  },

  // Après vérification d'email, le layer redirige vers /welcome/categories ; app2 n'a
  // pas d'étape « catégories » → on renvoie directement vers le tableau de bord.
  routeRules: {
    '/welcome/categories': { redirect: '/dashboard' },
  },

  runtimeConfig: {
    session: {
      // Mot de passe de chiffrement des cookies de session (NUXT_SESSION_PASSWORD).
      password: process.env.NUXT_SESSION_PASSWORD || '',
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    },
  },

  // Serveur de dev (Vite) : autoriser l'accès derrière le reverse proxy via le domaine
  // auto-signé. N'affecte QUE `nuxt dev` (pas le build de prod). Si l'hôte transmis par
  // le proxy diffère, remplacer par `allowedHosts: true`.
  vite: {
    server: {
      allowedHosts: ['dev.event.powange.com'],
    },
  },
})
