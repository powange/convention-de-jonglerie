import { readBody } from 'h3'

import type { NitroApp } from 'nitropack'

import { logApiError } from '#server/utils/error-logger'

export default async function errorLoggingPlugin(nitroApp: NitroApp) {
  // Intercepter toutes les erreurs non gérées dans les routes API
  nitroApp.hooks.hook('error', async (error, { event }) => {
    // Nitro déclenche aussi ce hook hors d'une requête — au démarrage, ou depuis une tâche de
    // fond. `event` est alors absent, et tout ce qui suit le lit sans détour : le journaliseur
    // d'erreurs planterait lui-même, en avalant l'erreur d'origine.
    if (!event) return

    // Ne pas logger si c'est déjà loggé ou si ce n'est pas une route API
    if (!event.node.req.url?.startsWith('/api/')) {
      return
    }

    // Éviter de logger certaines erreurs "normales"
    const statusCode = (error as any).status || (error as any).statusCode || 500

    // Ne pas logger les 401 (non authentifié) et les 404 sauf si c'est vraiment une erreur
    if (statusCode === 401) return

    // Rejets CSRF : événements de sécurité, pas des pannes applicatives. Les scanners qui
    // sondent des chemins inexistants en POST (/api/graphql, /api/wp-admin…) sont tous arrêtés
    // par le middleware CSRF avant la résolution de route et rempliraient le journal pour rien.
    //
    // On teste le marqueur porté par l'erreur, jamais le code 403 : les refus de permission
    // partagent ce code et doivent, eux, rester journalisés.
    if ((error as any).data?.csrfRejection === true) return
    if (statusCode === 404 && event.node.req.url?.includes('/api/')) {
      // Logger uniquement les 404 sur des routes API qui devraient exister
      const isApiRoute = /^\/api\/[^/]+/.test(event.node.req.url)
      if (!isApiRoute) return
    }

    try {
      // Sauvegarder le body dans le contexte pour le logger s'il n'est pas déjà là
      if (
        !event.context._body &&
        event.node.req.method !== 'GET' &&
        event.node.req.method !== 'HEAD'
      ) {
        try {
          // Essayer de lire le body s'il n'a pas encore été lu
          // Note: readBody peut échouer si le body a déjà été consommé
          const body = await readBody(event).catch(() => null)
          if (body) {
            event.context._body = body
          }
        } catch {
          // Ignorer les erreurs de lecture du body
          // Le body pourrait être dans event.context.body si déjà parsé
        }
      }

      // Si le body n'est toujours pas disponible, vérifier d'autres emplacements
      if (!event.context._body && !event.context.body) {
        // Essayer de récupérer depuis les données brutes si possible
        try {
          // Certaines routes peuvent stocker le body ailleurs
          if ((event as any)._body) {
            event.context._body = (event as any)._body
          }
        } catch {
          // Ignorer
        }
      }

      await logApiError({
        error: error as Error,
        statusCode,
        event,
      })
    } catch (loggingError) {
      // Ne pas faire planter l'app si le logging échoue
      console.error('Error logging failed:', loggingError)
    }
  })

  // Hook pour capturer les erreurs lors du rendu (optionnel)
  nitroApp.hooks.hook('render:response', async (response, { event }) => {
    // `statusCode` est facultatif dans une réponse de rendu : sans code, rien à journaliser.
    const statusCode = response.statusCode
    // Capturer les réponses d'erreur HTTP même si elles n'ont pas levé d'exception
    if (statusCode !== undefined && statusCode >= 400 && event.node.req.url?.startsWith('/api/')) {
      const error = new Error(`HTTP ${statusCode}: ${response.statusMessage || 'Unknown error'}`)

      try {
        await logApiError({
          error,
          statusCode,
          event,
        })
      } catch (loggingError) {
        console.error('Error logging failed:', loggingError)
      }
    }
  })
}
