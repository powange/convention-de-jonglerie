import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { ensureOrganizersGroupConversation } from '#server/utils/messenger-helpers'

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

    // Vérifier que l'utilisateur est bien un organisateur de cette édition
    // `EditionOrganizer` n'a pas de `userId` : il pointe l'organisateur de la CONVENTION, qui
    // lui en porte un. La requête précédente nommait un champ inexistant — Prisma refusait alors
    // la requête entière, et créer ce groupe rendait 500.
    const isOrganizer = await prisma.editionOrganizer.findFirst({
      where: {
        editionId,
        organizer: { userId: user.id },
      },
    })

    if (!isOrganizer) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas organisateur de cette édition",
      })
    }

    const conversationId = await ensureOrganizersGroupConversation(editionId)

    return createSuccessResponse({ conversationId })
  },
  { operationName: 'CreateOrganizersGroupConversation' }
)
