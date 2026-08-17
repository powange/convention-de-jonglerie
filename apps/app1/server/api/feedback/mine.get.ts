import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

/**
 * Retours envoyés par l'utilisateur connecté, pour le suivi affiché sur /feedback.
 *
 * La sélection est explicite, et non un `include` : `adminNotes` est une note interne de
 * l'équipe et n'a rien à faire dans une réponse destinée à l'auteur du retour. Seul
 * `adminReply` lui est adressé.
 *
 * Les retours envoyés en visiteur ne sont pas rattachés à un compte (`userId` nul) : ils
 * n'apparaissent donc pas ici, même si l'adresse e-mail laissée correspond à celle du compte.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const feedbacks = await prisma.feedback.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        subject: true,
        message: true,
        url: true,
        status: true,
        adminReply: true,
        repliedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return createSuccessResponse(feedbacks)
  },
  { operationName: 'GetMyFeedbacks' }
)
