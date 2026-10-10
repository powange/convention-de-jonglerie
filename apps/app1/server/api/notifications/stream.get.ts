import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { notificationStreamManager } from '#server/utils/notification-stream-manager'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

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

        /*
         * ⚠️ `push` REND UN BOOLÉEN, et c'est tout le constat A2.
         *
         * Il attrapait l'erreur d'`enqueue`, posait `isControllerClosed` et retournait sans rien
         * dire. Le gestionnaire ne voyait donc JAMAIS d'échec : son `try/catch` ne pouvait pas se
         * déclencher, `lastPing` était rafraîchi à chaque cycle même sur un contrôleur fermé, et
         * `cleanupStaleConnections` — écrit trente lignes plus bas, avec son seuil de deux minutes
         * — était du code mort.
         *
         * Conséquence : une connexion dont le `close` de la requête ne remonte pas (intermédiaire
         * réseau, coupure brutale) restait indéfiniment dans les Maps, comptée dans `getStats` et
         * parcourue à chaque envoi. Un `catch` qui ne relance pas rend inatteignable le nettoyage
         * prévu pour lui.
         */
        const streamWrapper = {
          push: (message: { event?: string; data: string }): boolean => {
            if (isControllerClosed) {
              console.log(`[SSE] Tentative d'envoi sur controller fermé pour user ${user.id}`)
              return false
            }
            try {
              const eventName = message.event || 'message'
              const sseData = `event: ${eventName}\ndata: ${message.data}\n\n`
              controller.enqueue(new TextEncoder().encode(sseData))
              return true
            } catch (error) {
              console.error("[SSE] Erreur lors de l'envoi:", error)
              isControllerClosed = true
              return false
            }
          },
          /**
           * Fermer le flux à la demande du gestionnaire.
           *
           * Sans elle, `removeConnection` retirait la connexion de ses Maps et laissait le
           * contrôleur ouvert : le client gardait une connexion que plus rien n'alimentait, et
           * attendait son ping jusqu'à ce que son propre réseau tranche.
           */
          close: safeClose,
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
  },
  { operationName: 'StreamNotifications' }
)
