import { canAccessEditionData } from '../../../../utils/edition-permissions'
import { getHelloAssoOrders } from '../../../../utils/editions/ticketing/helloasso'
import { decrypt } from '../../../../utils/encryption'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette configuration',
    })

  // Récupérer la configuration HelloAsso
  const config = await prisma.externalTicketing.findUnique({
    where: { editionId },
    include: {
      helloAssoConfig: true,
    },
  })

  if (!config || !config.helloAssoConfig) {
    throw createError({
      statusCode: 404,
      message: 'Configuration HelloAsso introuvable',
    })
  }

  const haConfig = config.helloAssoConfig

  console.log("📦 [Endpoint] Récupération des commandes HelloAsso pour l'édition:", editionId)
  console.log('📦 [Endpoint] Configuration HelloAsso ID:', haConfig.id)

  try {
    // Déchiffrer le client secret
    const clientSecret = decrypt(haConfig.clientSecret)

    console.log('📦 [Endpoint] Client ID:', haConfig.clientId)
    console.log('📦 [Endpoint] Client Secret déchiffré:', clientSecret ? '✓ OK' : '✗ ERREUR')
    console.log('📦 [Endpoint] Organization Slug:', haConfig.organizationSlug)
    console.log('📦 [Endpoint] Form Type:', haConfig.formType)
    console.log('📦 [Endpoint] Form Slug:', haConfig.formSlug)

    // Récupérer les commandes via l'utilitaire (toutes les pages)
    const result = await getHelloAssoOrders(
      {
        clientId: haConfig.clientId,
        clientSecret,
      },
      {
        organizationSlug: haConfig.organizationSlug,
        formType: haConfig.formType,
        formSlug: haConfig.formSlug,
      },
      {
        withDetails: true,
        pageSize: 100, // Nombre de commandes par page (max 100)
      }
    )

    // Sauvegarder les commandes et items en BDD
    console.log('💾 Nombre de commandes à sauvegarder:', result.data?.length || 0)
    if (result.data && result.data.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Récupérer tous les tarifs de l'édition pour faire la correspondance
        const tiers = await tx.helloAssoTier.findMany({
          where: { editionId },
        })
        console.log('📊 Nombre de tarifs disponibles:', tiers.length)

        for (const order of result.data) {
          // Créer ou mettre à jour la commande
          const savedOrder = await tx.helloAssoOrder.upsert({
            where: {
              externalTicketingId_helloAssoOrderId: {
                externalTicketingId: config.id,
                helloAssoOrderId: order.id,
              },
            },
            create: {
              externalTicketingId: config.id,
              helloAssoOrderId: order.id,
              editionId,
              payerFirstName: order.payer.firstName,
              payerLastName: order.payer.lastName,
              payerEmail: order.payer.email,
              amount: order.items.reduce((sum, item) => sum + item.amount, 0),
              status: 'Processed', // TODO: récupérer le statut réel
              orderDate: new Date(), // TODO: récupérer la date réelle
            },
            update: {
              payerFirstName: order.payer.firstName,
              payerLastName: order.payer.lastName,
              payerEmail: order.payer.email,
              amount: order.items.reduce((sum, item) => sum + item.amount, 0),
              status: 'Processed',
            },
          })

          // Créer ou mettre à jour les items
          for (const item of order.items) {
            // Trouver le tarif correspondant par l'ID HelloAsso du tarif
            const matchingTier = tiers.find((tier) => {
              // Utiliser le tierId de HelloAsso si disponible
              if (item.tierId && tier.helloAssoTierId === item.tierId) {
                return true
              }
              // Sinon, fallback sur le nom (et ignorer le prix pour les tarifs libres)
              return tier.name === item.name || tier.name === item.priceCategory
            })

            // Log pour déboguer
            if (!matchingTier) {
              console.log('❌ Aucun tarif trouvé pour:', {
                itemType: item.type,
                itemTierId: item.tierId,
                itemName: item.name,
                itemPriceCategory: item.priceCategory,
                itemAmount: item.amount,
                availableTiers: tiers.map((t) => ({
                  helloAssoTierId: t.helloAssoTierId,
                  name: t.name,
                  price: t.price,
                })),
              })
            } else {
              console.log('✅ Tarif trouvé:', {
                tierName: matchingTier.name,
                itemName: item.name,
                itemTierId: item.tierId,
              })
            }

            // Vérifier si l'item existe déjà
            const existingItem = await tx.helloAssoOrderItem.findFirst({
              where: {
                orderId: savedOrder.id,
                helloAssoItemId: item.id,
              },
            })

            if (existingItem) {
              // Mettre à jour l'item existant
              await tx.helloAssoOrderItem.update({
                where: { id: existingItem.id },
                data: {
                  tierId: matchingTier?.id,
                  firstName: item.user?.firstName || order.payer.firstName,
                  lastName: item.user?.lastName || order.payer.lastName,
                  email: item.user?.email || order.payer.email,
                  name: item.name || null,
                  type: item.type,
                  amount: item.amount,
                  state: item.state,
                  qrCode: item.qrCode,
                  customFields: item.customFields || null,
                },
              })
            } else {
              // Créer un nouvel item
              await tx.helloAssoOrderItem.create({
                data: {
                  orderId: savedOrder.id,
                  helloAssoItemId: item.id,
                  tierId: matchingTier?.id,
                  firstName: item.user?.firstName || order.payer.firstName,
                  lastName: item.user?.lastName || order.payer.lastName,
                  email: item.user?.email || order.payer.email,
                  name: item.name || null,
                  type: item.type,
                  amount: item.amount,
                  state: item.state,
                  qrCode: item.qrCode,
                  customFields: item.customFields || null,
                },
              })
            }
          }
        }
      })
    }

    // Mettre à jour la date de dernière synchronisation
    await prisma.externalTicketing.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date() },
    })

    // Récupérer les statistiques
    const totalOrders = await prisma.helloAssoOrder.count({
      where: { externalTicketingId: config.id },
    })

    const totalItems = await prisma.helloAssoOrderItem.count({
      where: {
        order: {
          externalTicketingId: config.id,
        },
      },
    })

    return {
      success: true,
      orders: result.data,
      pagination: result.pagination,
      stats: {
        totalOrders,
        totalItems,
      },
    }
  } catch (error: any) {
    console.error('HelloAsso orders fetch error:', error)
    throw error
  }
})
