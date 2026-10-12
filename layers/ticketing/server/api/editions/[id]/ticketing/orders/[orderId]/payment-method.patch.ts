import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'check']),
  checkNumber: z.string().optional(),
})

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

    const body = bodySchema.parse(await readBody(event))

    try {
      // Récupérer la commande pour vérification
      const order = await prisma.ticketingOrder.findUnique({
        where: { id: orderId },
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

      // Vérifier que la commande est bien payée
      if (order.status !== 'Processed' && order.status !== 'Onsite') {
        throw createError({
          status: 400,
          message: 'Seules les commandes payées peuvent avoir une méthode de paiement définie',
        })
      }

      /*
       * ⚠️ UNE COMMANDE IMPORTÉE N'EST PAS MODIFIABLE ICI — constat D8.
       *
       * La synchronisation réécrit `paymentMethod: 'card'` à CHAQUE passage : une correction
       * posée ici serait silencieusement effacée au prochain import, en laissant au passage un
       * `checkNumber` orphelin. Le point d'API acceptait pourtant la requête, et répondait
       * « Méthode de paiement mise à jour avec succès ».
       *
       * 📍 L'ÉCRAN, LUI, NE L'OFFRAIT DÉJÀ PAS : le menu d'actions de la liste des commandes est
       * gardé par `!order.externalTicketing`, et la pastille cliquable n'apparaît que si le
       * moyen de paiement est VIDE — ce que la synchronisation ne laisse jamais. Cette garde ne
       * retire donc rien à personne : elle aligne le serveur sur ce que l'interface promet, pour
       * qu'une requête fabriquée à la main ne puisse pas écrire un état qui ne survivra pas.
       *
       * Mesuré sur la base de développement : 600 commandes importées, 600 en `card`, zéro
       * numéro de chèque. Aucune n'a jamais été corrigée.
       *
       * 409 et non 403 : ce n'est pas une question de droits — la même personne peut corriger
       * une commande de guichet — mais un conflit avec la source qui fait foi.
       */
      if (order.externalTicketingId !== null) {
        throw createError({
          status: 409,
          message:
            'Le moyen de paiement d’une commande importée est celui de la billetterie externe : ' +
            'il serait écrasé à la prochaine synchronisation',
        })
      }

      // Mettre à jour la méthode de paiement
      await prisma.ticketingOrder.update({
        where: { id: orderId },
        data: {
          paymentMethod: body.paymentMethod,
          checkNumber: body.paymentMethod === 'check' ? body.checkNumber : null,
        },
      })

      return createSuccessResponse(null, 'Méthode de paiement mise à jour avec succès')
    } catch (error: unknown) {
      console.error('Update payment method error:', error)
      if (isHttpError(error)) throw error
      throw createError({
        status: 500,
        message: 'Erreur lors de la mise à jour de la méthode de paiement',
      })
    }
  },
  { operationName: 'PATCH ticketing order payment method' }
)
