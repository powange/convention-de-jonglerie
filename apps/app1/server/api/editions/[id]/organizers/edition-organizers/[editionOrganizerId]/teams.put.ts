import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import {
  ensureVolunteerConversations,
  removeVolunteerFromTeamConversations,
} from '#server/utils/messenger-helpers'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'

const bodySchema = z.object({
  teamIds: z.array(z.string()),
})

/**
 * PUT /api/editions/[id]/organizers/edition-organizers/[editionOrganizerId]/teams
 *
 * Rattache un organisateur présent sur l'édition à des équipes de bénévoles, et remplace
 * l'ensemble de ses rattachements existants.
 *
 * Ce rattachement est volontairement sans effet sur la mécanique du bénévolat : un
 * organisateur ne compte ni dans la capacité d'un créneau, ni dans les statistiques de
 * couverture, ni dans l'assignation automatique. Il apparaît dans l'équipe — et dans sa
 * conversation, la place valant accès quel que soit le titre auquel on l'occupe.
 *
 * La permission est celle des bénévoles, pas celle des organisateurs : ce qu'on modifie ici,
 * c'est la composition d'une équipe de bénévolat. Elle ne suffit pas : encore faut-il que
 * l'édition ait ouvert l'option `organizersInTeams`, fermée par défaut.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const editionOrganizerId = validateResourceId(event, 'editionOrganizerId', 'organisateur')

    const allowed = await canManageEditionVolunteers(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les bénévoles',
      })
    }

    // L'option doit être ouverte sur l'édition. La refermer ne supprime pas les rattachements
    // déjà posés : elle les masque. On peut donc la rouvrir sans avoir rien perdu.
    const settings = await prisma.eventVolunteerSettings.findUnique({
      where: { eventId: editionId },
      select: { organizersInTeams: true },
    })
    if (!settings?.organizersInTeams) {
      throw createError({
        status: 403,
        message: "L'option « organisateurs dans les équipes » est désactivée sur cette édition",
      })
    }

    // L'organisateur doit être présent sur CETTE édition : sans ce contrôle, l'identifiant
    // d'un organisateur d'une autre édition passerait la permission de celle-ci.
    const editionOrganizer = await prisma.editionOrganizer.findFirst({
      where: { id: editionOrganizerId, editionId },
      select: { id: true, organizer: { select: { userId: true } } },
    })
    if (!editionOrganizer) {
      throw createError({ status: 404, message: 'Organisateur introuvable sur cette édition' })
    }

    const { teamIds } = bodySchema.parse(await readBody(event))

    // Les équipes doivent appartenir à cette édition, pour la même raison.
    if (teamIds.length > 0) {
      const count = await prisma.volunteerTeam.count({
        where: { id: { in: teamIds }, eventId: editionId },
      })
      if (count !== teamIds.length) {
        throw createError({
          status: 400,
          message: "Certaines équipes n'appartiennent pas à cette édition",
        })
      }
    }

    const userId = editionOrganizer.organizer.userId
    const equipesDemandees = [...new Set(teamIds)]

    await prisma.$transaction(async (tx) => {
      const rattachementsActuels = await tx.organizerTeamAssignment.findMany({
        where: { editionOrganizerId },
        select: { teamId: true, isLeader: true },
      })

      // La responsabilité survit au ré-enregistrement : cette route remplace la liste des
      // équipes, elle ne destitue personne. La perdre en cochant une case de plus serait une
      // disparition silencieuse.
      const responsableDe = new Map(
        rattachementsActuels.map((rattachement) => [rattachement.teamId, rattachement.isLeader])
      )

      await tx.organizerTeamAssignment.deleteMany({ where: { editionOrganizerId } })

      if (equipesDemandees.length > 0) {
        await tx.organizerTeamAssignment.createMany({
          data: equipesDemandees.map((teamId) => ({
            editionOrganizerId,
            teamId,
            isLeader: responsableDe.get(teamId) ?? false,
          })),
        })
      }

      // Les conversations d'équipe suivent le rattachement : on y entre en la rejoignant, on en
      // sort en la quittant. Même mécanique que pour un bénévole assigné.
      const equipesQuittees = rattachementsActuels
        .map((rattachement) => rattachement.teamId)
        .filter((teamId) => !equipesDemandees.includes(teamId))

      for (const teamId of equipesQuittees) {
        await removeVolunteerFromTeamConversations(editionId, teamId, userId, tx)
      }
      for (const teamId of equipesDemandees) {
        await ensureVolunteerConversations(editionId, teamId, userId, tx)
      }
    })

    return createSuccessResponse({ editionOrganizerId, teamIds })
  },
  { operationName: 'UpdateEditionOrganizerTeams' }
)
