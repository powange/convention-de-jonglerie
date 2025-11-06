import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import {
  addCounterConnection,
  getActiveCounterConnections,
  removeCounterConnection,
} from '@@/server/utils/ticketing-counter-sse'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const token = z.string().min(1).parse(getRouterParam(event, 'token'))

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à ce compteur',
      })
    }

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

    // Ajouter cette connexion au compteur
    addCounterConnection(editionId, counter.id, eventStream)

    // Envoyer un message de connexion initial
    await eventStream.push(
      JSON.stringify({
        type: 'connected',
        counterId: counter.id,
        activeConnections: getActiveCounterConnections(editionId, counter.id),
      })
    )

    // Ping périodique (toutes les 30 secondes)
    const pingInterval = setInterval(async () => {
      try {
        await eventStream.push(
          JSON.stringify({
            type: 'ping',
            counterId: counter.id,
            activeConnections: getActiveCounterConnections(editionId, counter.id),
          })
        )
      } catch (err) {
        console.error('[Counter SSE] Erreur lors du ping:', err)
        clearInterval(pingInterval)
      }
    }, 30000)

    // Nettoyer lors de la déconnexion
    event.node.req.on('close', () => {
      clearInterval(pingInterval)
      removeCounterConnection(editionId, counter.id, eventStream)
      eventStream.close()
    })

    return eventStream.send()
  },
  { operationName: 'GET ticketing counter SSE stream by token' }
)
