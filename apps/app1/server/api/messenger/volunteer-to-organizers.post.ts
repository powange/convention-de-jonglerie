import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { ensureVolunteerToOrganizersConversation } from '#server/utils/messenger-helpers'

/*
 * Même schéma que `organizers-group.post.ts` et `team-conversation.post.ts` : les trois points
 * d'API ouvrent une conversation sur une édition, et seule la PRÉSENCE de l'identifiant était
 * contrôlée ici. Reçu en chaîne, il passait, puis Prisma refusait la requête — 500 sur une saisie.
 */
const schemaDuCorps = z.object({
  editionId: z.coerce.number().int().positive(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const { editionId } = schemaDuCorps.parse(await readBody(event))

    // Vérifier que l'utilisateur est bien bénévole accepté de cette édition
    const volunteerApplication = await prisma.editionVolunteerApplication.findFirst({
      where: {
        eventId: editionId,
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

    return createSuccessResponse({ conversationId })
  },
  { operationName: 'CreateVolunteerToOrganizersConversation' }
)
