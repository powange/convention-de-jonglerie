import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { ensureOrganizersGroupConversation } from '#server/utils/messenger-helpers'

/*
 * Le corps n'était pas validé : seule la PRÉSENCE d'`editionId` était contrôlée. Un identifiant
 * reçu en chaîne (« 3 ») passait ce contrôle, puis Prisma refusait la requête et l'ouverture du
 * groupe rendait 500. `coerce` accepte les deux écritures, `int().positive()` refuse le reste.
 *
 * Même schéma que `team-conversation.post.ts`, qui a reçu cette validation avant lui : les deux
 * points d'API ouvrent une conversation de groupe sur une édition, et rien ne justifiait qu'ils
 * lisent leur corps différemment.
 */
const schemaDuCorps = z.object({
  editionId: z.coerce.number().int().positive(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const { editionId } = schemaDuCorps.parse(await readBody(event))

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
