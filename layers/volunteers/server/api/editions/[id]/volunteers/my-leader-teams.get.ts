import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { equipesDontIlEstResponsable } from '#server/utils/editions/volunteers/responsables-equipe'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Récupère les équipes dont l'utilisateur connecté est responsable
 * Retourne uniquement les équipes où l'utilisateur a au moins une assignation avec isLeader=true
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Bénévole responsable ou organisateur responsable : les deux titres se valent ici.
    const teamIds = await equipesDontIlEstResponsable(editionId, user.id)
    if (teamIds.length === 0) return []

    const equipes = await prisma.volunteerTeam.findMany({
      where: { id: { in: teamIds } },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        maxVolunteers: true,
        isRequired: true,
        isAccessControlTeam: true,
        isVisibleToVolunteers: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignments: {
              where: {
                application: {
                  status: 'ACCEPTED',
                },
              },
            },
          },
        },
      },
    })

    // L'effectif d'une équipe, c'est le nombre de personnes qui la composent : les
    // organisateurs rattachés s'ajoutent aux bénévoles acceptés.
    const parEquipe = await prisma.organizerTeamAssignment.groupBy({
      by: ['teamId'],
      where: { teamId: { in: teamIds } },
      _count: { teamId: true },
    })
    const organisateurs = new Map(parEquipe.map((ligne) => [ligne.teamId, ligne._count.teamId]))

    return equipes.map((equipe) => ({
      ...equipe,
      assignedVolunteersCount: equipe._count?.assignments || 0,
      assignedOrganizersCount: organisateurs.get(equipe.id) ?? 0,
    }))
  },
  { operationName: 'GetMyLeaderTeams' }
)
