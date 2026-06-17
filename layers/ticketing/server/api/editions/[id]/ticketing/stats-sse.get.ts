import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { addSSEConnection, removeSSEConnection } from '#server/utils/sse-manager'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès)
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message:
          "Droits insuffisants pour accéder à cette fonctionnalité - vous devez être gestionnaire ou en créneau actif de contrôle d'accès",
      })

    // Configurer les headers SSE
    setResponseHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    // Créer un event stream
    const eventStream = createEventStream(event)

    // Fonction pour envoyer un message SSE
    const push = (message: string) => {
      eventStream.push(message)
    }

    // Enregistrer la connexion
    addSSEConnection(editionId, push)

    // Envoyer un message de confirmation initial
    // h3's eventStream.push() gère automatiquement le formatage SSE (data: ... \n\n)
    eventStream.push(JSON.stringify({ type: 'connected', editionId }))

    // Gérer la déconnexion
    event.node.req.on('close', () => {
      removeSSEConnection(editionId, push)
      eventStream.close()
    })

    // Retourner le stream (h3 gèrera l'envoi automatiquement)
    return eventStream.send()
  },
  { operationName: 'GET ticketing stats-sse' }
)
