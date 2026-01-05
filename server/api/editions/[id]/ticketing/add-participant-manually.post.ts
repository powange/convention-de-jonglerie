import { createHash } from 'crypto'

import { requireAuth } from '@@/server/utils/auth-utils'
import { applyCustomName } from '@@/server/utils/editions/ticketing/tiers'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { z } from 'zod'

const itemSchema = z.object({
  tierId: z.number(),
  quantity: z.number().min(1),
  customAmount: z.number().optional(), // Montant personnalisé en centimes pour les tarifs à prix libre
  customParticipants: z
    .array(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        customFields: z
          .array(
            z.object({
              optionId: z.number().optional(), // ID de l'option (pour les billets créés manuellement)
              name: z.string(),
              answer: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional(),
})

const bodySchema = z.object({
  // Informations de l'acheteur (payeur)
  payerFirstName: z.string().min(1),
  payerLastName: z.string().min(1),
  payerEmail: z.string().email(),
  // Liste des tarifs sélectionnés avec quantités et participants personnalisés
  items: z.array(itemSchema).min(1),
  // Type de paiement (cash, card, check) ou null si non payé
  paymentMethod: z.enum(['cash', 'card', 'check']).nullable().default(null),
  // Numéro de chèque (uniquement si paymentMethod = 'check')
  checkNumber: z.string().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour gérer la billeterie',
      })

    const body = bodySchema.parse(await readBody(event))

    try {
      // Vérifier que l'édition existe
      const edition = await prisma.edition.findUnique({
        where: { id: editionId },
        select: {
          id: true,
          name: true,
          convention: {
            select: {
              name: true,
            },
          },
        },
      })

      if (!edition) {
        throw createError({
          statusCode: 404,
          message: 'Edition introuvable',
        })
      }

      // Récupérer les tarifs demandés (externes et manuels)
      const tierIds = body.items.map((item) => item.tierId)
      const uniqueTierIds = [...new Set(tierIds)]
      const tiers = await prisma.ticketingTier.findMany({
        where: {
          id: { in: uniqueTierIds },
          editionId: editionId,
        },
        select: {
          id: true,
          name: true,
          customName: true,
          price: true,
        },
      })

      if (tiers.length !== uniqueTierIds.length) {
        throw createError({
          statusCode: 400,
          message: 'Certains tarifs sont invalides',
        })
      }

      // Appliquer le nom personnalisé
      const tiersWithCustomName = tiers.map(applyCustomName)

      // Créer un map des tarifs pour un accès rapide
      const tierMap = new Map(tiersWithCustomName.map((tier) => [tier.id, tier]))

      // Calculer le montant total
      const totalAmount = body.items.reduce((sum, item) => {
        const tier = tierMap.get(item.tierId)
        // Utiliser le montant personnalisé si disponible, sinon le prix du tarif
        const itemPrice = item.customAmount ?? tier?.price ?? 0
        return sum + itemPrice * item.quantity
      }, 0)

      // Créer la date de commande
      const orderDate = new Date()

      // Générer le QR code unique basé sur email + date
      const hashInput = `${body.payerEmail}-${orderDate.toISOString()}`
      const hash = createHash('sha256').update(hashInput).digest('hex').substring(0, 16)
      const qrCode = `onsite-${hash}`

      // Créer la commande
      const order = await prisma.ticketingOrder.create({
        data: {
          editionId: editionId,
          externalTicketingId: null,
          helloAssoOrderId: null,
          payerFirstName: body.payerFirstName,
          payerLastName: body.payerLastName,
          payerEmail: body.payerEmail,
          amount: totalAmount,
          status: body.paymentMethod ? 'Onsite' : 'Pending',
          paymentMethod: body.paymentMethod,
          checkNumber: body.checkNumber || null,
          orderDate,
        },
      })

      // Créer les items de commande
      const orderItems = []
      for (const item of body.items) {
        const tier = tierMap.get(item.tierId)!
        const customParticipants = item.customParticipants || []
        // Utiliser le montant personnalisé si disponible, sinon le prix du tarif
        const itemPrice = item.customAmount ?? tier.price

        // Créer un item pour chaque quantité
        for (let i = 0; i < item.quantity; i++) {
          const participant = customParticipants[i] || {
            firstName: body.payerFirstName,
            lastName: body.payerLastName,
            email: body.payerEmail,
            customFields: undefined,
          }

          // Séparer les options des vrais customFields
          const allCustomFields = participant.customFields || []
          const optionFields = allCustomFields.filter((field) => field.optionId)
          const realCustomFields = allCustomFields.filter((field) => !field.optionId)

          const orderItem = await prisma.ticketingOrderItem.create({
            data: {
              orderId: order.id,
              helloAssoItemId: null,
              tierId: tier.id,
              firstName: participant.firstName,
              lastName: participant.lastName,
              email: participant.email,
              name: tier.name,
              type: 'Registration',
              amount: itemPrice,
              state: body.paymentMethod ? 'Processed' : 'Pending',
              qrCode, // Même QR code pour tous les items de la commande
              entryValidated: false,
              customFields: realCustomFields.length > 0 ? realCustomFields : null,
            },
          })

          // Créer les associations d'options et les accès repas
          if (optionFields.length > 0) {
            for (const optionField of optionFields) {
              // Récupérer l'option avec ses repas associés
              const option = await prisma.ticketingOption.findUnique({
                where: { id: optionField.optionId },
                include: {
                  meals: {
                    include: {
                      meal: true,
                    },
                  },
                },
              })

              if (option) {
                // Créer l'association orderItem <-> option
                await prisma.ticketingOrderItemOption.create({
                  data: {
                    orderItemId: orderItem.id,
                    optionId: option.id,
                    amount: 0,
                    customFields: null,
                  },
                })

                // Créer les accès repas si l'option donne accès à des repas
                if (option.meals && option.meals.length > 0) {
                  for (const mealRelation of option.meals) {
                    await prisma.ticketingOrderItemMeal.create({
                      data: {
                        orderItemId: orderItem.id,
                        mealId: mealRelation.mealId,
                      },
                    })
                  }
                }
              }
            }
          }

          orderItems.push(orderItem)
        }
      }

      // Retourner le QR code pour redirection
      return {
        success: true,
        qrCode,
        order: {
          id: order.id,
          payerFirstName: order.payerFirstName,
          payerLastName: order.payerLastName,
          payerEmail: order.payerEmail,
          amount: order.amount,
          itemCount: orderItems.length,
        },
      }
    } catch (error: unknown) {
      console.error("Erreur lors de l'ajout manuel du participant:", error)
      throw error
    }
  },
  { operationName: 'POST ticketing add-participant-manually' }
)
