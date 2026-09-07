import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/volunteers/my-organizer-teams
 *
 * Les équipes de bénévoles auxquelles l'utilisateur connecté est rattaché **en tant
 * qu'organisateur** de cette édition, et s'il en est responsable.
 *
 * Sert d'abord à savoir si la personne est concernée par le bénévolat sans être bénévole : la
 * page bénévoles gardait ses cartes derrière une candidature acceptée, qu'un organisateur n'a
 * pas. Liste vide = il ne l'est pas, et rien ne change pour lui.
 *
 * Chacun ne lit ici que son propre rattachement : aucune permission de gestion n'est requise,
 * et aucune donnée d'autrui n'est exposée.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const rattachements = await prisma.organizerTeamAssignment.findMany({
      where: {
        editionOrganizer: { editionId, organizer: { userId: user.id } },
        team: { eventId: editionId },
      },
      orderBy: { team: { name: 'asc' } },
      select: {
        isLeader: true,
        team: { select: { id: true, name: true, color: true } },
      },
    })

    return createSuccessResponse({
      teams: rattachements.map((rattachement) => ({
        ...rattachement.team,
        isLeader: rattachement.isLeader,
      })),
    })
  },
  { operationName: 'GetMyOrganizerTeams' }
)
