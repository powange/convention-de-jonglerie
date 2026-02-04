import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { requireShowApplicationAccess } from '#server/utils/show-application-helpers'

/**
 * GET /api/show-applications/[applicationId]/conversation
 * Vérifie si une conversation existe pour cette candidature (sans la créer)
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

    // Vérifier si une conversation existe
    const conversation = await prisma.conversation.findUnique({
      where: { showApplicationId: application.id },
      select: { id: true },
    })

    return {
      success: true,
      exists: !!conversation,
      conversationId: conversation?.id || null,
    }
  },
  { operationName: 'CheckShowApplicationConversation' }
)
