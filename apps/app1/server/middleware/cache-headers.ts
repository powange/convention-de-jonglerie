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

  /*
   * Fichiers de build, servis comme immuables.
   *
   * ⚠️ `_nuxt` OU `_nuxt-<empreinte>` : en production, le répertoire porte l'empreinte du build
   * (cf. `buildAssetsDir` dans nuxt.config.ts). Ne reconnaître que `/_nuxt/` ferait tomber ces
   * fichiers dans la branche « pas de cache » — sans erreur, mais en rechargeant tout le bundle
   * à chaque visite.
   *
   * 📍 Et c'est bien le répertoire par build qui REND cette promesse vraie : sous `/_nuxt/`, deux
   * constructions pouvaient servir un même nom avec des contenus différents, et `immutable`
   * figeait le mauvais pour un an.
   */
  if (
    url.match(
      /\/_nuxt(-[A-Za-z0-9]+)?\/.*\.(js|css|png|jpg|jpeg|gif|svg|webp|avif|woff2?|ttf|eot|ico)$/
    )
  ) {
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
