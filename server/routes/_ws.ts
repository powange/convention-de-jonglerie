// Route handler pour `/_ws` afin d'éviter que Vue Router (SSR) tente de matcher
// cette URL et émette le warning "No match found for location with path '/_ws'".
//
// Cette URL est utilisée par Vite HMR comme endpoint WebSocket. Quand le WS échoue
// (CSP, proxy mal configuré...), Vite peut faire des requêtes HTTP de fallback qui
// arrivent sur le serveur Nuxt et déclenchent le SSR.
//
// On capture ces requêtes ici pour court-circuiter le SSR.
export default defineEventHandler((event) => {
  setResponseStatus(event, 204)
  return null
})
