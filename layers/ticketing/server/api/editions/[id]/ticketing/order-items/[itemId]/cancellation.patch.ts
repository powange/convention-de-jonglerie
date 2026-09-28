import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  canceled: z.boolean(),
})

/**
 * Annuler UN billet, ou revenir sur cette annulation.
 *
 * Jusqu'ici, la seule annulation possible portait sur la commande entière
 * (`orders/[orderId]/index.delete.ts`). Or un tiers des commandes portent plusieurs billets —
 * 234 sur 711, relevé sur les données — et il est courant qu'une seule personne se décommande.
 *
 * ## Ce que l'annulation veut dire, et ce qu'elle ne dit pas
 *
 * Elle retire le droit d'entrer et sort le billet des comptages : `state = 'Canceled'` est déjà lu
 * en ce sens par la porte, les statistiques, les repas et la trésorerie. Rien de tout cela n'a eu
 * besoin d'être touché.
 *
 * Elle ne dit **rien** de l'argent. Un billet réglé puis annulé reste dû tant que `refunded` n'est
 * pas coché, et c'est l'objet du point d'API voisin.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'billet')

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const body = bodySchema.parse(await readBody(event))

    try {
      const item = await prisma.ticketingOrderItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          state: true,
          refunded: true,
          order: {
            select: { editionId: true, externalTicketingId: true, status: true },
          },
        },
      })

      // Le billet suffit à s'adresser : son identifiant est unique, et l'édition est vérifiée
      // juste après. Exiger aussi celui de la commande rendrait la route inutilisable depuis le
      // contrôle d'accès, qui n'expose que l'identifiant HelloAsso — `null` sur une commande
      // saisie à la main.
      if (!item) throw createError({ status: 404, message: 'Billet non trouvé' })

      if (item.order.editionId !== editionId)
        throw createError({ status: 403, message: "Ce billet n'appartient pas à cette édition" })

      // Même refus que l'annulation d'une commande : ce qui vient d'une billetterie externe se
      // règle chez elle, sinon la prochaine synchronisation réécrit `state` depuis sa charge et
      // efface l'annulation sans que rien ne le signale.
      if (item.order.externalTicketingId !== null)
        throw createError({
          status: 400,
          message:
            "Impossible d'annuler un billet provenant d'une billetterie externe. Veuillez l'annuler directement sur la plateforme externe.",
        })

      if (body.canceled) {
        if (item.state === 'Canceled')
          throw createError({ status: 400, message: 'Ce billet est déjà annulé' })

        await prisma.ticketingOrderItem.update({
          where: { id: itemId },
          data: { state: 'Canceled', canceledAt: new Date(), canceledById: user.id },
        })

        return createSuccessResponse(null, 'Billet annulé')
      }

      if (item.state !== 'Canceled')
        throw createError({ status: 400, message: "Ce billet n'est pas annulé" })

      // Rétablir un billet dont on a rendu l'argent le remettrait en circulation sans contrepartie.
      // Il faut d'abord décocher le remboursement — c'est-à-dire constater qu'on a repris l'argent.
      if (item.refunded)
        throw createError({
          status: 400,
          message:
            "Ce billet a été remboursé : décochez d'abord le remboursement pour pouvoir le rétablir",
        })

      // L'état d'avant se déduit du paiement de la COMMANDE, que l'annulation d'un billet ne touche
      // jamais : réglée, ses billets valent `Processed` ; en attente, `Pending`. C'est exactement la
      // règle qu'applique la création d'un participant au guichet.
      const regle = item.order.status === 'Processed' || item.order.status === 'Onsite'

      await prisma.ticketingOrderItem.update({
        where: { id: itemId },
        data: {
          state: regle ? 'Processed' : 'Pending',
          canceledAt: null,
          canceledById: null,
        },
      })

      return createSuccessResponse(null, 'Annulation du billet levée')
    } catch (error: unknown) {
      if (isHttpError(error)) throw error
      console.error('Cancel order item error:', error)
      throw createError({
        status: 500,
        message: "Erreur lors de l'annulation du billet",
      })
    }
  },
  { operationName: 'PATCH ticketing order item cancellation' }
)
