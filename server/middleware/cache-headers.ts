/**
 * Middleware pour configurer les en-têtes de cache HTTP
 *
 * Stratégie de cache :
 * - Assets statiques avec hash : cache agressif (1 an, immutable)
 * - Pages HTML : pas de cache (toujours à jour)
 * - API : pas de cache
 */
export default defineEventHandler((event) => {
  const url = event.node.req.url || ''

  // Assets statiques avec hash (générés par Vite avec fingerprinting)
  // Ces fichiers ont un hash dans leur nom, donc si le contenu change, le nom change
  if (url.match(/\/_nuxt\/.*\.(js|css|png|jpg|jpeg|gif|svg|webp|avif|woff2?|ttf|eot|ico)$/)) {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  }

  // Fichiers statiques dans /public sans hash (moins agressif)
  else if (url.match(/^\/(logos|favicons|images)\/.*\.(png|jpg|jpeg|gif|svg|webp|avif|ico)$/)) {
    // Cache de 1 mois, mais revalidation possible
    setResponseHeader(event, 'Cache-Control', 'public, max-age=2592000')
  }

  // Fonts statiques
  else if (url.match(/\.(woff2?|ttf|eot)$/)) {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  }

  // Pages HTML : pas de cache pour avoir toujours la dernière version
  else if (url.match(/\.(html?)$/) || url === '/') {
    setResponseHeader(event, 'Cache-Control', 'no-cache, must-revalidate')
  }

  // API : pas de cache par défaut
  else if (url.startsWith('/api/')) {
    setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')
  }
})
