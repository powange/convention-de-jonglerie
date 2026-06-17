import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
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
    const allowed = await canAccessEditionData(editionId, user.id, event)
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
