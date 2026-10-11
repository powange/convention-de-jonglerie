import { isHttpError } from '#server/types/api'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    try {
      const quotas = await prisma.ticketingQuota.findMany({
        where: { editionId },
        orderBy: { position: 'asc' },
      })

      return createSuccessResponse({ quotas })
    } catch (error: unknown) {
      /*
       * Un refus DÉJÀ ÉCRIT reste lisible — constat D6. Sans ce relais, ce `catch` réécrit en
       * 500 générique les 4xx levés dans le `try`, y compris par les fonctions qu'il appelle :
       * au comptoir, « Erreur lors de la validation » remplace « Ce billet a été remboursé », et
       * la différence est entre comprendre et appeler quelqu'un.
       */
      if (isHttpError(error)) throw error
      console.error('Failed to fetch quotas:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des quotas',
      })
    }
  },
  { operationName: 'GET ticketing quotas index' }
)
