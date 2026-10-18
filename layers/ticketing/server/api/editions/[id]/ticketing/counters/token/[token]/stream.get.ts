import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  addCounterConnection,
  counterStreamManager,
  getActiveCounterConnections,
} from '#server/utils/ticketing-counter-sse'
import { validateEditionId } from '#server/utils/validation-helpers'

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
        status: 404,
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

    /*
     * ⚠️ UN ADAPTATEUR, et non `eventStream` tel quel. Deux raisons, et la seconde est un défaut.
     *
     * 1. `EventStream` de h3 est une CLASSE À MEMBRES PRIVÉS — donc nominale : elle ne peut jamais
     *    satisfaire structurellement `CounterStreamConnection`, quelles que soient ses méthodes.
     *    Le type disait vrai, il n'y avait pas à le contourner.
     * 2. Son `push` rend `Promise<void>`, jamais un booléen. Or `aEtePousse()` ne retire la
     *    connexion que sur un `false` EXPLICITE : une promesse étant toujours véridique, aucune
     *    connexion morte n'était jamais retirée SUR CE FLUX. Le correctif documenté dans
     *    `ticketing-counter-sse.ts` n'avait donc été appliqué qu'au flux principal, et le compteur
     *    affiché au guichet continuait de surévaluer les connexions par jeton.
     *
     * L'adaptateur tient un drapeau de fermeture et répond d'après le dernier état connu. Un
     * échec asynchrone le met à jour, de sorte que la diffusion SUIVANTE retire la connexion —
     * `push` ne pouvant pas attendre sans ralentir la diffusion pour tout le monde.
     */
    let fluxFerme = false
    eventStream.onClosed(() => {
      fluxFerme = true
    })

    const connexion = {
      push: (message: { event?: string; data: string; id?: string; retry?: number }): boolean => {
        if (fluxFerme) return false
        eventStream.push(message).catch((erreur) => {
          console.error('[Counter SSE] Envoi refusé sur le flux par jeton :', erreur)
          fluxFerme = true
        })
        return true
      },
      close: () => {
        fluxFerme = true
        void eventStream.close()
      },
    }

    // Ajouter cette connexion au compteur et stocker l'ID avec le sessionId
    const connectionId = addCounterConnection(editionId, counter.id, connexion, sessionId)

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
