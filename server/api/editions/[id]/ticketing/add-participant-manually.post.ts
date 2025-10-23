import { createHash } from 'crypto'

import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
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
  // Statut de paiement
  isPaid: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

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
        price: true,
      },
    })

    if (tiers.length !== uniqueTierIds.length) {
      throw createError({
        statusCode: 400,
        message: 'Certains tarifs sont invalides',
      })
    }

    // Créer un map des tarifs pour un accès rapide
    const tierMap = new Map(tiers.map((tier) => [tier.id, tier]))

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
        status: body.isPaid ? 'Onsite' : 'Pending',
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

        const orderItem = await prisma.ticketingOrderItem.create({
          data: {
            orderId: order.id,
            helloAssoItemId: null,
            tierId: tier.id,
            firstName: participant.firstName,
            lastName: participant.lastName,
            email: participant.email,
            name: tier.name,
            type: null,
            amount: itemPrice,
            state: body.isPaid ? 'Processed' : 'Pending',
            qrCode, // Même QR code pour tous les items de la commande
            entryValidated: false,
            customFields: participant.customFields || null,
          },
        })

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
})
