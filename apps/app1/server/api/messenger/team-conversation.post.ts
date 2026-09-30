import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { assurerConversationsEquipeDesMembres } from '#server/utils/messenger-helpers'

/*
 * Le corps n'était pas validé : un `editionId` reçu en chaîne (« 3 ») passait le contrôle de
 * présence, puis Prisma refusait la requête et l'ouverture rendait 500. `coerce` accepte les deux
 * écritures, `int().positive()` refuse le reste.
 */
const schemaDuCorps = z.object({
  editionId: z.coerce.number().int().positive(),
  teamId: z.string().min(1),
})

/**
 * POST /api/messenger/team-conversation
 * Crée ou récupère la conversation de groupe d'une équipe
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const { editionId, teamId } = schemaDuCorps.parse(await readBody(event))

    // Vérifier que l'utilisateur est bien membre de l'équipe
    const teamAssignment = await prisma.applicationTeamAssignment.findFirst({
      where: {
        teamId,
        application: {
          eventId: editionId,
          userId: user.id,
          status: 'ACCEPTED',
        },
      },
    })

    if (!teamAssignment) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas membre de cette équipe",
      })
    }

    // Tous les membres acceptés de l'équipe, le demandeur compris
    const membresDeLEquipe = await prisma.applicationTeamAssignment.findMany({
      where: {
        teamId,
        application: {
          eventId: editionId,
          status: 'ACCEPTED',
        },
      },
      select: {
        application: {
          select: { userId: true },
        },
      },
    })

    /*
     * ⚠️ UN SEUL APPEL POUR TOUTE L'ÉQUIPE. Auparavant, la synchronisation était appelée une fois
     * pour le demandeur puis une fois par membre accepté, en série — quatre à huit requêtes
     * chacune, dont plusieurs identiques d'un membre au suivant. Pour une équipe de quarante
     * personnes, ouvrir la discussion coûtait ≈ 250 requêtes séquentielles avant que le premier
     * message ne s'affiche.
     *
     * Le demandeur reste passé explicitement, comme avant : la garde du dessus vient de prouver
     * qu'il est bénévole accepté de l'équipe, donc il figure dans `membresDeLEquipe` — le `Set` de
     * la fonction en lot absorbe le doublon. C'est une ceinture, pas une nécessité.
     */
    await assurerConversationsEquipeDesMembres(editionId, teamId, [
      user.id,
      ...membresDeLEquipe.map((membre) => membre.application.userId),
    ])

    // Récupérer la conversation de groupe de l'équipe
    const teamGroupConversation = await prisma.conversation.findFirst({
      where: {
        editionId,
        teamId,
        type: 'TEAM_GROUP',
      },
      select: {
        id: true,
      },
    })

    if (!teamGroupConversation) {
      throw createError({
        status: 404,
        message: "La conversation de l'équipe n'a pas pu être créée",
      })
    }

    return createSuccessResponse({ conversationId: teamGroupConversation.id })
  },
  { operationName: 'CreateTeamConversation' }
)
