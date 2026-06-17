import { isHttpError } from '#server/types/api'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const orderId = validateResourceId(event, 'orderId', 'commande')

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    try {
      // Récupérer la commande pour vérification
      const order = await prisma.ticketingOrder.findUnique({
        where: { id: orderId },
        include: {
          externalTicketing: true,
        },
      })

      if (!order) {
        throw createError({
          status: 404,
          message: 'Commande non trouvée',
        })
      }

      // Vérifier que la commande appartient à l'édition
      if (order.editionId !== editionId) {
        throw createError({
          status: 403,
          message: "Cette commande n'appartient pas à cette édition",
        })
      }

      // Vérifier que la commande n'est PAS de HelloAsso (ou d'un autre provider externe)
      if (order.externalTicketingId !== null) {
        throw createError({
          status: 400,
          message:
            "Impossible d'annuler ou supprimer une commande provenant d'une billetterie externe. Veuillez annuler la commande directement sur la plateforme externe.",
        })
      }

      // Si la commande est déjà annulée (Refunded), la supprimer définitivement
      if (order.status === 'Refunded') {
        await prisma.ticketingOrder.delete({
          where: { id: orderId },
        })

        return createSuccessResponse(null, 'Commande supprimée avec succès')
      }

      // Sinon, changer le statut de la commande à "Refunded" (annuler)
      await prisma.ticketingOrder.update({
        where: { id: orderId },
        data: {
          status: 'Refunded',
        },
      })

      return createSuccessResponse(null, 'Commande annulée avec succès')
    } catch (error: unknown) {
      console.error('Delete order error:', error)
      if (isHttpError(error)) throw error
      throw createError({
        status: 500,
        message: "Erreur lors de l'annulation ou de la suppression de la commande",
      })
    }
  },
  { operationName: 'DELETE ticketing orders resource' }
)
