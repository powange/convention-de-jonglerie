import { isHttpError } from '#server/types/api'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { journaliserMouvementDEntree } from '#server/utils/ticketing/journal-des-entrees'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const orderId = validateResourceId(event, 'orderId', 'commande')

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
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

      // Sinon, annuler : le statut de la commande, ET l'état de chacun de ses billets.
      //
      // Stamper les billets n'est pas redondant. « Ce billet vaut-il encore ? » se lisait sur deux
      // niveaux — l'état de la ligne OU le statut de sa commande — et c'est cette double lecture
      // qui a produit les divergences que `billets-qui-comptent.ts` documente : un écran
      // interrogeait l'un, son voisin l'autre. Tout se lit désormais sur le billet.
      //
      // Le remboursement, lui, n'est pas touché : annuler ne dit pas qu'on a rendu l'argent. Ces
      // billets apparaîtront comme dus, ce qui est exactement l'effet recherché.
      // Les billets déjà entrés doivent ressortir : relevés AVANT la mise à jour, puisqu'elle
      // efface le drapeau qui permet de les reconnaître.
      const billetsEntres = await prisma.ticketingOrderItem.findMany({
        where: { orderId, entryValidated: true },
        select: { id: true },
      })

      await prisma.$transaction([
        prisma.ticketingOrder.update({
          where: { id: orderId },
          data: { status: 'Refunded' },
        }),
        prisma.ticketingOrderItem.updateMany({
          where: { orderId, state: { not: 'Canceled' } },
          data: {
            state: 'Canceled',
            canceledAt: new Date(),
            canceledById: user.id,
            // Un billet annulé ne reste pas « entré ». Le drapeau ne suffit pas : le graphique
            // d'affluence se lit sur le journal des mouvements, d'où l'écriture juste après.
            entryValidated: false,
            entryValidatedAt: null,
            entryValidatedBy: null,
          },
        }),
      ])

      if (billetsEntres.length > 0) {
        await journaliserMouvementDEntree({
          editionId,
          type: 'ticket',
          participantIds: billetsEntres.map((billet) => billet.id),
          mouvement: 'INVALIDATED',
          actorId: user.id,
        })
      }

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
