import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { equipesDontIlEstResponsable } from '#server/utils/editions/volunteers/responsables-equipe'
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

    /*
     * ⚠️ MEMBRE DE L'ÉQUIPE **OU** RESPONSABLE, et la seconde moitié est le correctif.
     *
     * Cette garde n'interrogeait que `applicationTeamAssignment`, c'est-à-dire les candidatures de
     * bénévoles. Un responsable d'équipe qui tient ce rôle comme ORGANISATEUR n'a pas de
     * candidature : le bouton « écrire à l'équipe » lui rendait 403, alors que la page lui montre
     * ses équipes et la liste de leurs bénévoles. C'est exactement l'angle mort que
     * `responsables-equipe.ts` dit de ne pas rouvrir en interrogeant cette table directement.
     */
    const [teamAssignment, equipesDirigees] = await Promise.all([
      prisma.applicationTeamAssignment.findFirst({
        where: {
          teamId,
          application: {
            eventId: editionId,
            userId: user.id,
            status: 'ACCEPTED',
          },
        },
      }),
      equipesDontIlEstResponsable(editionId, user.id),
    ])

    if (!teamAssignment && !equipesDirigees.includes(teamId)) {
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
     * ⚠️ LE DEMANDEUR EST PASSÉ EXPLICITEMENT, ET CE N'EST PLUS UNE CEINTURE. Tant que la garde
     * exigeait une candidature acceptée, il figurait forcément dans `membresDeLEquipe` et le `Set`
     * de la fonction en lot absorbait le doublon. Depuis qu'un responsable ORGANISATEUR est admis,
     * il n'y figure pas : le retirer d'ici le laisserait hors de la conversation qu'il vient
     * d'ouvrir.
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
