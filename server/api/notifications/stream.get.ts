import { notificationStreamManager } from '../../utils/notification-stream-manager'

export default defineEventHandler(async (event) => {
  // Vérification de l'authentification
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required for notification stream',
    })
  }

  console.log(`[SSE] Nouvelle connexion de streaming pour user ${user.id}`)

  // Configuration des headers SSE
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Headers', 'Cache-Control')

  // Approche manuelle SSE avec ReadableStream

  const stream = new ReadableStream({
    start(controller) {
      let isControllerClosed = false

      const safeClose = () => {
        if (!isControllerClosed) {
          try {
            controller.close()
            isControllerClosed = true
          } catch {
            // Controller déjà fermé, ignorer l'erreur
            console.log(`[SSE] Controller déjà fermé pour user ${user.id}`)
          }
        }
      }

      // Créer un wrapper pour le stream manager
      const streamWrapper = {
        push: (message: { event?: string; data: string }) => {
          if (isControllerClosed) {
            console.log(`[SSE] Tentative d'envoi sur controller fermé pour user ${user.id}`)
            return
          }
          try {
            const eventName = message.event || 'message'
            const sseData = `event: ${eventName}\ndata: ${message.data}\n\n`
            controller.enqueue(new TextEncoder().encode(sseData))
          } catch (error) {
            console.error("[SSE] Erreur lors de l'envoi:", error)
            isControllerClosed = true
          }
        },
        onClosed: (callback: () => void) => {
          // Géré par la fermeture du stream
          event.node.req.on('close', callback)
          event.node.req.on('aborted', callback)
        },
      }

      // Ajouter la connexion au gestionnaire
      const connectionId = notificationStreamManager.addConnection(user.id, streamWrapper)

      // Message de bienvenue
      streamWrapper.push({
        event: 'connected',
        data: JSON.stringify({
          status: 'connected',
          userId: user.id,
          connectionId,
          timestamp: new Date().toISOString(),
        }),
      })

      // Ping initial
      setTimeout(() => {
        if (!isControllerClosed) {
          try {
            streamWrapper.push({
              event: 'ping',
              data: JSON.stringify({ timestamp: Date.now() }),
            })
          } catch (error) {
            console.error(`[SSE] Erreur ping initial pour user ${user.id}:`, error)
            notificationStreamManager.removeConnection(connectionId)
            safeClose()
          }
        }
      }, 1000)

      // Gestion de la fermeture (une seule fois)
      const cleanup = () => {
        console.log(`[SSE] Nettoyage connexion pour user ${user.id}`)
        notificationStreamManager.removeConnection(connectionId)
        safeClose()
      }

      event.node.req.on('close', cleanup)
      event.node.req.on('aborted', cleanup)
    },

    cancel() {
      console.log(`[SSE] Stream annulé pour user ${user.id}`)
    },
  })

  return stream
})
