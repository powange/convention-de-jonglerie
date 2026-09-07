import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
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
 * couverture, ni dans l'assignation automatique. Il apparaît dans l'équipe, rien de plus.
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
      select: { id: true },
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

    await prisma.$transaction(async (tx) => {
      await tx.organizerTeamAssignment.deleteMany({ where: { editionOrganizerId } })
      if (teamIds.length > 0) {
        await tx.organizerTeamAssignment.createMany({
          data: teamIds.map((teamId) => ({ editionOrganizerId, teamId })),
        })
      }
    })

    return createSuccessResponse({ editionOrganizerId, teamIds })
  },
  { operationName: 'UpdateEditionOrganizerTeams' }
)
