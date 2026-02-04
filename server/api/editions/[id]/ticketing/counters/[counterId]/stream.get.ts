import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { counterStreamManager } from '#server/utils/ticketing-counter-sse'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier que l'utilisateur est authentifié
    // Tout utilisateur authentifié peut accéder aux compteurs (incluant les super admins)
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const counterId = validateResourceId(event, 'counterId', 'compteur')

    // Vérifier que le compteur existe et appartient à cette édition
    const counter = await prisma.ticketingCounter.findFirst({
      where: {
        id: counterId,
        editionId,
      },
    })

    if (!counter) {
      throw createError({
        status: 404,
        message: 'Compteur introuvable',
      })
    }

    console.log(
      `[Counter SSE] Nouvelle connexion de streaming pour counter ${counterId} (user ${user.id})`
    )

    // Configuration des headers SSE
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    setHeader(event, 'Access-Control-Allow-Origin', '*')
    setHeader(event, 'Access-Control-Allow-Headers', 'Cache-Control')

    const stream = new ReadableStream({
      start(controller) {
        let isControllerClosed = false

        const safeClose = () => {
          if (!isControllerClosed) {
            try {
              controller.close()
              isControllerClosed = true
            } catch {
              console.log(`[Counter SSE] Controller déjà fermé pour counter ${counterId}`)
            }
          }
        }

        // Créer un wrapper pour le stream manager
        const streamWrapper = {
          push: (message: { event?: string; data: string }) => {
            if (isControllerClosed) {
              console.log(
                `[Counter SSE] Tentative d'envoi sur controller fermé pour counter ${counterId}`
              )
              return
            }
            try {
              const eventName = message.event || 'message'
              const sseData = `event: ${eventName}\ndata: ${message.data}\n\n`
              controller.enqueue(new TextEncoder().encode(sseData))
            } catch (error) {
              console.error("[Counter SSE] Erreur lors de l'envoi:", error)
              isControllerClosed = true
            }
          },
          onClosed: (callback: () => void) => {
            event.node.req.on('close', callback)
            event.node.req.on('aborted', callback)
          },
        }

        // Ajouter la connexion au gestionnaire
        const connectionId = counterStreamManager.addConnection(editionId, counterId, streamWrapper)

        // Message de bienvenue avec les données actuelles du compteur
        streamWrapper.push({
          event: 'connected',
          data: JSON.stringify({
            status: 'connected',
            userId: user.id,
            connectionId,
            counter: {
              id: counter.id,
              name: counter.name,
              value: counter.value,
              editionId: counter.editionId,
            },
            activeConnections: counterStreamManager.getConnectionCount(editionId, counterId),
            timestamp: new Date().toISOString(),
          }),
        })

        // Ping périodique pour maintenir la connexion
        const pingInterval = setInterval(() => {
          if (!isControllerClosed) {
            try {
              streamWrapper.push({
                event: 'ping',
                data: JSON.stringify({
                  timestamp: Date.now(),
                  activeConnections: counterStreamManager.getConnectionCount(editionId, counterId),
                }),
              })
            } catch (error) {
              console.error(`[Counter SSE] Erreur ping pour counter ${counterId}:`, error)
              clearInterval(pingInterval)
              counterStreamManager.removeConnection(connectionId, editionId, counterId)
              safeClose()
            }
          } else {
            clearInterval(pingInterval)
          }
        }, 30000) // Ping toutes les 30 secondes

        // Gestion de la fermeture
        const cleanup = () => {
          console.log(`[Counter SSE] Nettoyage connexion pour counter ${counterId}`)
          clearInterval(pingInterval)
          counterStreamManager.removeConnection(connectionId, editionId, counterId)
          safeClose()
        }

        event.node.req.on('close', cleanup)
        event.node.req.on('aborted', cleanup)
      },

      cancel() {
        console.log(`[Counter SSE] Stream annulé pour counter ${counterId}`)
      },
    })

    return stream
  },
  { operationName: 'StreamCounter' }
)
