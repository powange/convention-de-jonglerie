import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * Le dernier calcul d'assignation automatique encore annulable, s'il y en a un.
 *
 * Sert à l'écran de gestion : sans cela, le bouton « Annuler ce calcul » ne survivrait pas à un
 * rechargement de page, alors que c'est précisément le lendemain matin qu'on se rend compte
 * qu'on s'est trompé de mode.
 *
 * Ne rend jamais l'état conservé, qui pèse et ne sert qu'à l'annulation elle-même.
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

    const dernier = await prisma.volunteerAutoAssignRun.findFirst({
      where: { eventId: editionId, undoneAt: null },
      orderBy: { executedAt: 'desc' },
      select: {
        id: true,
        executedAt: true,
        mode: true,
        createdCount: true,
        deletedCount: true,
        executedBy: { select: userWithNameSelect },
      },
    })

    return createSuccessResponse({ lastRun: dernier })
  },
  { operationName: 'GetLastAutoAssignRun' }
)
