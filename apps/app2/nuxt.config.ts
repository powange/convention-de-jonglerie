// Configuration Nuxt de la 2ᵉ app : plateforme SaaS d'organisation d'événements.
// App autonome (port 3001), base SQLite via Prisma, auth via nuxt-auth-utils.
export default defineNuxtConfig({
  compatibilityDate: '2026-03-02',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', 'nuxt-auth-utils'],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    session: {
      // Le mot de passe de session vient de NUXT_SESSION_PASSWORD (cf. .env)
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
