import { readBody } from 'h3'

import { logApiError } from '../utils/error-logger'

import type { NitroApp } from 'nitropack'

export default async function errorLoggingPlugin(nitroApp: NitroApp) {
  // Intercepter toutes les erreurs non gérées dans les routes API
  nitroApp.hooks.hook('error', async (error, { event }) => {
    // Ne pas logger si c'est déjà loggé ou si ce n'est pas une route API
    if (!event.node.req.url?.startsWith('/api/')) {
      return
    }

    // Éviter de logger certaines erreurs "normales"
    const statusCode = (error as any).statusCode || 500

    // Ne pas logger les 401 (non authentifié) et les 404 sauf si c'est vraiment une erreur
    if (statusCode === 401) return
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
    // Capturer les réponses d'erreur HTTP même si elles n'ont pas levé d'exception
    if (response.statusCode >= 400 && event.node.req.url?.startsWith('/api/')) {
      const error = new Error(
        `HTTP ${response.statusCode}: ${response.statusMessage || 'Unknown error'}`
      )

      try {
        await logApiError({
          error,
          statusCode: response.statusCode,
          event,
        })
      } catch (loggingError) {
        console.error('Error logging failed:', loggingError)
      }
    }
  })
}
