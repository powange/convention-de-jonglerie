// Configuration Nuxt de la 2ᵉ app (autonome, sans layers pour l'instant).
// On pourra plus tard ajouter `extends: ['../../layers/...']` pour réutiliser les modules partagés.
export default defineNuxtConfig({
  compatibilityDate: '2026-03-02',
  devtools: { enabled: true },
})
