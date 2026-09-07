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

    // Voir une conversation et y participer sont deux choses distinctes : un organisateur la
    // consulte sans y être inscrit. Sans cette information, le client appelait `mark-read`
    // pour tout le monde et récoltait un 403 à chaque ouverture — une erreur de production
    // par consultation, pour un cas que le code considère comme normal.
    const isParticipant = conversation
      ? (await prisma.conversationParticipant.count({
          where: { conversationId: conversation.id, userId: user.id, leftAt: null },
        })) > 0
      : false

    return createSuccessResponse({
      exists: !!conversation,
      conversationId: conversation?.id || null,
      isParticipant,
    })
  },
  { operationName: 'CheckShowApplicationConversation' }
)
