import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { ensureVolunteerToOrganizersConversation } from '#server/utils/messenger-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)
    const { editionId } = body

    if (!editionId) {
      throw createError({
        status: 400,
        message: "L'ID de l'édition est requis",
      })
    }

    // Vérifier que l'utilisateur est bien bénévole accepté de cette édition
    const volunteerApplication = await prisma.editionVolunteerApplication.findFirst({
      where: {
        editionId,
        userId: user.id,
        status: 'ACCEPTED',
      },
    })

    if (!volunteerApplication) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas bénévole de cette édition",
      })
    }

    const conversationId = await ensureVolunteerToOrganizersConversation(editionId, user.id)

    return {
      conversationId,
    }
  },
  { operationName: 'CreateVolunteerToOrganizersConversation' }
)
