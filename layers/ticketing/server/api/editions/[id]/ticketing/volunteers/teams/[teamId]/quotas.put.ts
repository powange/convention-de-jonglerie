import { z } from 'zod'

import { remplacerLesQuotas } from '../../../../../../../utils/quotas-personnes'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  quotaIds: z.array(z.number().int()),
})

/**
 * PUT /api/editions/[id]/ticketing/volunteers/teams/[teamId]/quotas
 *
 * Les quotas que consomment les bénévoles d'UNE équipe. Remplace l'ensemble.
 *
 * Ces quotas s'AJOUTENT à ceux de la ligne globale — contrairement aux articles à remettre, où
 * ceux d'une équipe remplacent les articles globaux. Un article est un colis qu'on reçoit ; un
 * quota est une place qu'on occupe, et on l'occupe une fois.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // L'identifiant d'équipe est un `cuid`, pas un entier : les aides de validation numériques ne
    // s'y appliquent pas.
    const teamId = getRouterParam(event, 'teamId')
    if (!teamId) {
      throw createError({ status: 400, message: "Identifiant d'équipe manquant" })
    }

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    /**
     * L'équipe doit être celle de cette édition.
     *
     * `eventId` et non `editionId` : les équipes de bénévolat sont rattachées à l'`Event`. Les
     * deux identifiants coïncident sur toutes les éditions, et c'est la convention du dépôt.
     */
    const equipe = await prisma.volunteerTeam.findFirst({
      where: { id: teamId, eventId: editionId },
      select: { id: true },
    })
    if (!equipe) {
      throw createError({ status: 404, message: 'Équipe introuvable sur cette édition' })
    }

    const body = bodySchema.parse(await readBody(event))
    const quotaIds = await remplacerLesQuotas({
      editionId,
      quotaIds: body.quotaIds,
      table: (tx) => tx.editionVolunteerQuota,
      cible: { teamId },
    })

    return createSuccessResponse({ teamId, quotaIds })
  },
  { operationName: 'PUT ticketing volunteer team quotas' }
)
