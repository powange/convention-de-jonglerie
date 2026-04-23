import { requireAuth } from '#server/utils/auth-utils'
import { fetchOrdersFromHelloAsso } from '#server/utils/editions/ticketing/helloasso'
import { decrypt } from '#server/utils/encryption'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
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
        status: 404,
        message: 'Configuration HelloAsso introuvable',
      })
    }

    const haConfig = config.helloAssoConfig

    try {
      // Déchiffrer le client secret
      const clientSecret = decrypt(haConfig.clientSecret)

      // Récupérer les commandes via l'utilitaire (toutes les pages)
      const result = await fetchOrdersFromHelloAsso(
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
          const tiers = await tx.ticketingTier.findMany({
            where: { editionId },
          })
          console.log('📊 Nombre de tarifs disponibles:', tiers.length)

          for (const order of result.data) {
            // Créer ou mettre à jour la commande
            const savedOrder = await tx.ticketingOrder.upsert({
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
                paymentMethod: 'card', // HelloAsso = paiement par carte
                orderDate: new Date(order.date), // Date de la commande HelloAsso
              },
              update: {
                payerFirstName: order.payer.firstName,
                payerLastName: order.payer.lastName,
                payerEmail: order.payer.email,
                amount: order.items.reduce((sum, item) => sum + item.amount, 0),
                status: 'Processed',
                paymentMethod: 'card', // HelloAsso = paiement par carte
                orderDate: new Date(order.date), // Mettre à jour la date si elle a changé
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
              const existingItem = await tx.ticketingOrderItem.findFirst({
                where: {
                  orderId: savedOrder.id,
                  helloAssoItemId: item.id,
                },
              })

              let savedItemId: number

              if (existingItem) {
                // Mettre à jour l'item existant
                // Note: customFields contient UNIQUEMENT les vrais champs personnalisés
                // Les options sont gérées dans TicketingOrderItemOption
                await tx.ticketingOrderItem.update({
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
                    customFields: item.customFields || undefined,
                  },
                })
                savedItemId = existingItem.id
              } else {
                // Créer un nouvel item
                // Note: customFields contient UNIQUEMENT les vrais champs personnalisés
                // Les options sont gérées dans TicketingOrderItemOption
                const newItem = await tx.ticketingOrderItem.create({
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
                    customFields: item.customFields || undefined,
                  },
                })
                savedItemId = newItem.id
              }

              // Synchroniser les options sélectionnées
              if (item.options && item.options.length > 0) {
                // Récupérer toutes les options de l'édition avec leurs repas
                const availableOptions = await tx.ticketingOption.findMany({
                  where: { editionId },
                  include: {
                    meals: true,
                  },
                })

                for (const selectedOption of item.options) {
                  // Chercher l'option correspondante :
                  // 1. Par helloAssoOptionId (si l'option vient de HelloAsso)
                  // 2. Par ID (si l'option a été créée manuellement)
                  const matchingOption = availableOptions.find((opt) => {
                    // D'abord chercher par helloAssoOptionId
                    if (opt.helloAssoOptionId === String(selectedOption.optionId)) {
                      return true
                    }
                    // Sinon, chercher par ID de l'option locale
                    if (opt.id === selectedOption.optionId) {
                      return true
                    }
                    return false
                  })

                  if (matchingOption) {
                    // Upsert l'association orderItem <-> option
                    await tx.ticketingOrderItemOption.upsert({
                      where: {
                        orderItemId_optionId: {
                          orderItemId: savedItemId,
                          optionId: matchingOption.id,
                        },
                      },
                      create: {
                        orderItemId: savedItemId,
                        optionId: matchingOption.id,
                        amount: selectedOption.amount || 0,
                        customFields: selectedOption.customFields || undefined,
                      },
                      update: {
                        amount: selectedOption.amount || 0,
                        customFields: selectedOption.customFields || undefined,
                      },
                    })

                    // Créer les accès repas si l'option donne accès à des repas
                    if (matchingOption.meals && matchingOption.meals.length > 0) {
                      for (const mealRelation of matchingOption.meals) {
                        // Vérifier si l'accès existe déjà
                        const existingMealAccess = await tx.ticketingOrderItemMeal.findUnique({
                          where: {
                            orderItemId_mealId: {
                              orderItemId: savedItemId,
                              mealId: mealRelation.mealId,
                            },
                          },
                        })

                        if (!existingMealAccess) {
                          await tx.ticketingOrderItemMeal.create({
                            data: {
                              orderItemId: savedItemId,
                              mealId: mealRelation.mealId,
                            },
                          })
                        }
                      }
                    }
                  } else {
                    console.log('⚠️ Option HelloAsso non trouvée:', {
                      optionId: selectedOption.optionId,
                      optionName: selectedOption.name,
                      availableOptions: availableOptions.map((o) => ({
                        id: o.id,
                        helloAssoOptionId: o.helloAssoOptionId,
                        name: o.name,
                      })),
                    })
                  }
                }
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
      const totalOrders = await prisma.ticketingOrder.count({
        where: { externalTicketingId: config.id },
      })

      const totalItems = await prisma.ticketingOrderItem.count({
        where: {
          order: {
            externalTicketingId: config.id,
          },
        },
      })

      return createSuccessResponse({
        orders: result.data,
        pagination: result.pagination,
        stats: {
          totalOrders,
          totalItems,
        },
      })
    } catch (error: unknown) {
      console.error('HelloAsso orders fetch error:', error)
      throw error
    }
  },
  { operationName: 'GET ticketing helloasso orders' }
)
