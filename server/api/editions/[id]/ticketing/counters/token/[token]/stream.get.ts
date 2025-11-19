import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  addCounterConnection,
  counterStreamManager,
  getActiveCounterConnections,
} from '@@/server/utils/ticketing-counter-sse'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

export default wrapApiHandler(
  async (event) => {
    // Authentification requise mais pas de vérification de permissions
    // Les compteurs partagés via QR code sont accessibles à tous les utilisateurs authentifiés
    requireAuth(event)
    const editionId = validateEditionId(event)
    const token = z.string().min(1).parse(getRouterParam(event, 'token'))

    // Récupérer le sessionId depuis les query params
    const query = getQuery(event)
    const sessionId = query.sessionId as string | undefined

    // Vérifier que le compteur existe
    const counter = await prisma.ticketingCounter.findFirst({
      where: {
        token,
        editionId,
      },
    })

    if (!counter) {
      throw createError({
        statusCode: 404,
        message: 'Compteur introuvable',
      })
    }

    // Configurer le SSE
    setResponseStatus(event, 200)
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const eventStream = createEventStream(event)

    // Ajouter cette connexion au compteur et stocker l'ID avec le sessionId
    const connectionId = addCounterConnection(editionId, counter.id, eventStream, sessionId)

    console.log(`[Counter SSE] onClosed handler enregistré pour ${connectionId}`)

    // Nettoyer lors de la déconnexion - DOIT être enregistré AVANT eventStream.send()
    eventStream.onClosed(async () => {
      console.log(`[Counter SSE] Connexion ${connectionId} fermée par le client`)
      clearInterval(pingInterval)
      counterStreamManager.removeConnection(connectionId, editionId, counter.id)
    })

    // Ping périodique (toutes les 30 secondes)
    const pingInterval = setInterval(() => {
      try {
        eventStream.push({
          event: 'ping',
          data: JSON.stringify({
            type: 'ping',
            counterId: counter.id,
            activeConnections: getActiveCounterConnections(editionId, counter.id),
          }),
        })
      } catch (err) {
        console.error('[Counter SSE] Erreur lors du ping:', err)
        clearInterval(pingInterval)
      }
    }, 30000)

    // Envoyer un message de connexion initial
    eventStream.push({
      event: 'connected',
      data: JSON.stringify({
        type: 'connected',
        counterId: counter.id,
        activeConnections: getActiveCounterConnections(editionId, counter.id),
      }),
    })

    return eventStream.send()
  },
  { operationName: 'GET ticketing counter SSE stream by token' }
)
