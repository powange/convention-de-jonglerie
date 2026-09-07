import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canManageEditionVolunteers } from '#server/utils/organizer-management'

const bodySchema = z.object({
  isLeader: z.boolean(),
})

/**
 * PATCH /api/editions/[id]/organizers/edition-organizers/[id]/teams/[teamId]/leader
 *
 * Nomme un organisateur responsable d'une de ses équipes, ou le destitue.
 *
 * Ce n'est pas une étiquette : le statut de responsable tient lieu, dans cette application, du
 * droit « gestion des bénévoles » sur le périmètre de l'équipe — voir ses bénévoles, leur
 * écrire. Le poser revient donc à ouvrir cet accès, ce qui justifie d'exiger ici le droit
 * complet sur les bénévoles.
 *
 * Le rattachement à l'équipe doit exister : on ne dirige pas une équipe dont on ne fait pas
 * partie.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const editionOrganizerId = validateResourceId(event, 'editionOrganizerId', 'organisateur')
    const teamId = validateStringId(event, 'teamId', 'équipe')

    const allowed = await canManageEditionVolunteers(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les bénévoles',
      })
    }

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

    const { isLeader } = bodySchema.parse(await readBody(event))

    // Le rattachement doit exister ET appartenir à cette édition : sans ce contrôle, un
    // identifiant emprunté à une édition voisine passerait la permission de celle-ci.
    const rattachement = await prisma.organizerTeamAssignment.findFirst({
      where: {
        editionOrganizerId,
        teamId,
        editionOrganizer: { editionId },
        team: { eventId: editionId },
      },
      select: { teamId: true },
    })
    if (!rattachement) {
      throw createError({
        status: 404,
        message: "Cet organisateur n'est pas rattaché à cette équipe",
      })
    }

    await prisma.organizerTeamAssignment.update({
      where: { editionOrganizerId_teamId: { editionOrganizerId, teamId } },
      data: { isLeader },
    })

    return createSuccessResponse({ editionOrganizerId, teamId, isLeader })
  },
  { operationName: 'UpdateOrganizerTeamLeader' }
)
