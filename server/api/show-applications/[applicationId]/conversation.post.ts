import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { ensureShowApplicationConversation } from '#server/utils/messenger-helpers'
import { requireShowApplicationAccess } from '#server/utils/show-application-helpers'

/**
 * POST /api/show-applications/[applicationId]/conversation
 * Crée ou récupère la conversation pour une candidature artiste
 * Ajoute l'utilisateur comme participant s'il ne l'est pas déjà
 *
 * Accessible par :
 * - L'artiste (propriétaire de la candidature)
 * - Les organisateurs avec droits canManageArtists
 * - Les admins en mode admin
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const { application } = await requireShowApplicationAccess(event, user.id)

    const conversationId = await ensureShowApplicationConversation(application.id, user.id)

    return createSuccessResponse({ conversationId })
  },
  { operationName: 'CreateShowApplicationConversation' }
)
