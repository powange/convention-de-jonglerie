import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const orderId = parseInt(getRouterParam(event, 'orderId') || '0')

  if (!editionId || !orderId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
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
        statusCode: 404,
        message: 'Commande non trouvée',
      })
    }

    // Vérifier que la commande appartient à l'édition
    if (order.editionId !== editionId) {
      throw createError({
        statusCode: 403,
        message: "Cette commande n'appartient pas à cette édition",
      })
    }

    // Vérifier que la commande n'est PAS de HelloAsso (ou d'un autre provider externe)
    if (order.externalTicketingId !== null) {
      throw createError({
        statusCode: 400,
        message:
          "Impossible d'annuler ou supprimer une commande provenant d'une billetterie externe. Veuillez annuler la commande directement sur la plateforme externe.",
      })
    }

    // Si la commande est déjà annulée (Refunded), la supprimer définitivement
    if (order.status === 'Refunded') {
      await prisma.ticketingOrder.delete({
        where: { id: orderId },
      })

      return {
        success: true,
        message: 'Commande supprimée avec succès',
      }
    }

    // Sinon, changer le statut de la commande à "Refunded" (annuler)
    await prisma.ticketingOrder.update({
      where: { id: orderId },
      data: {
        status: 'Refunded',
      },
    })

    return {
      success: true,
      message: 'Commande annulée avec succès',
    }
  } catch (error: unknown) {
    console.error('Delete order error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'annulation ou de la suppression de la commande",
    })
  }
})
