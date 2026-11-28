import {
  classifyRequest,
  MAX_CACHED_ASSETS,
  MAX_CACHED_TILES,
  OFFLINE_CACHES,
} from '../../shared/utils/offline-cache'
import { BLOC_PUSH_SW } from '../utils/push-sw'

import { blocDuCacheHorsLigne } from '#core/server/socle/cache-hors-ligne-sw'

/**
 * Le service worker de Flowvent : ce qui rend l'application INSTALLABLE et lisible hors ligne.
 *
 * Même rôle que celui d'app1 (`firebase-messaging-sw.js`) : cache hors ligne ET notifications push
 * — en Web Push standard (server/utils/push-sw.ts), là où app1 passe par Firebase. Les stratégies
 * de cache sont communes (`cache-hors-ligne-sw`, layer core) ; le classement des requêtes est celui
 * de Flowvent (`shared/utils/offline-cache.ts`).
 *
 * Toujours servi, même si l'injection du cache échoue : un worker sans cache garde l'application
 * installable, et porte la cause en commentaire.
 */
export default defineEventHandler((event) => {
  let blocDeCache: string
  try {
    blocDeCache = blocDuCacheHorsLigne({
      classifier: classifyRequest,
      caches: OFFLINE_CACHES,
      maxTuiles: MAX_CACHED_TILES,
      maxRessources: MAX_CACHED_ASSETS,
    })
  } catch (error) {
    blocDeCache = `// Cache hors ligne indisponible : ${
      error instanceof Error ? error.message : String(error)
    }`
  }

  setResponseHeader(event, 'Content-Type', 'application/javascript; charset=utf-8')
  setResponseHeader(event, 'Service-Worker-Allowed', '/')
  // Jamais gardé : un worker figé empêcherait toute mise à jour (CDN compris).
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')

  return `/**
 * Service worker de Flowvent (cache hors ligne, notifications push).
 * Environnement : ${process.env.NODE_ENV}
 */
${blocDeCache}
${BLOC_PUSH_SW}
`
})
