import { createPaginatedResponse, wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validatePagination } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * Les calculs d'assignation automatique déjà lancés sur cette édition.
 *
 * Le journal existait depuis le début — c'est lui qui permet d'annuler — mais rien ne le montrait :
 * l'écran ne connaissait que le dernier calcul, et seulement tant que la page restait ouverte. Un
 * organisateur qui revenait le lendemain n'avait aucun moyen de savoir qu'un collègue avait
 * appliqué un calcul, avec quels réglages, ni combien d'affectations en avaient découlé.
 *
 * Volontairement sans le détail des affectations : `createdAssignments` et `deletedAssignments`
 * pèsent plusieurs centaines de kilo-octets par ligne sur une grosse édition, et l'écran n'en
 * affiche que les compteurs, déjà consignés à part.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    if (!(await useVolunteerPorts().organizers.canManage(editionId, user.id, event))) {
      throw createError({
        status: 403,
        statusText: 'Droits insuffisants pour gérer les bénévoles',
      })
    }

    const { page, limit, skip, take } = validatePagination(event)

    const [calculs, total] = await Promise.all([
      prisma.volunteerAutoAssignRun.findMany({
        where: { eventId: editionId },
        orderBy: { executedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          executedAt: true,
          mode: true,
          constraints: true,
          createdCount: true,
          deletedCount: true,
          undoneAt: true,
          executedBy: { select: userWithNameSelect },
          undoneBy: { select: userWithNameSelect },
        },
      }),
      prisma.volunteerAutoAssignRun.count({ where: { eventId: editionId } }),
    ])

    /**
     * Lequel de ces calculs le bouton « annuler » défait-il ?
     *
     * L'endpoint d'annulation ne défait que le dernier calcul non annulé — défaire par-dessus un
     * autre restaurerait un état que le suivant a déjà modifié. L'écran doit donc n'offrir le
     * bouton que sur cette ligne-là, et le calculer côté client à partir d'une page de résultats
     * serait faux dès la deuxième page.
     */
    const annulable = await prisma.volunteerAutoAssignRun.findFirst({
      where: { eventId: editionId, undoneAt: null },
      orderBy: { executedAt: 'desc' },
      select: { id: true },
    })

    return {
      ...createPaginatedResponse(calculs, total, page, limit),
      annulableId: annulable?.id ?? null,
    }
  },
  { operationName: 'GetAutoAssignHistory' }
)
