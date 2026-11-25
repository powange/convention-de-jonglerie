/**
 * Navigation côté client vers une adresse d'app1 (`/editions/:id/…`) → page équivalente de
 * Flowvent (`/events/:id/…`).
 *
 * Le layer bénévoles écrit ses liens en dur avec le préfixe d'app1 : boutons de ses pages,
 * `actionUrl` des notifications. Les pages, elles, sont montées sous `/events/` (nuxt.config.ts,
 * hook `pages:extend`). Un chargement complet est redirigé par `routeRules` ; mais une navigation
 * dans l'application ne passe pas par le serveur, et sans ce middleware elle aboutirait à un 404.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/editions/')) {
    return navigateTo(to.fullPath.replace(/^\/editions\//, '/events/'), { replace: true })
  }
})
