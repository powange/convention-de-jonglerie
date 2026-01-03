import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event)
    const editionId = body.editionId || null

    console.log('🔧 Migration des options de repas depuis customFields\n')

    // Construire le filtre pour l'édition
    const whereClause: any = {
      customFields: {
        not: null,
      },
    }

    if (editionId) {
      whereClause.order = { editionId }
      console.log(`🎯 Migration limitée à l'édition ${editionId}\n`)
    } else {
      console.log('🌍 Migration pour toutes les éditions\n')
    }

    // Récupérer tous les orderItems avec customFields
    const orderItems = await prisma.ticketingOrderItem.findMany({
      where: whereClause,
      include: {
        selectedOptions: true, // Options déjà enregistrées
        order: {
          select: {
            editionId: true,
          },
        },
      },
    })

    console.log(`📋 ${orderItems.length} orderItems trouvés avec customFields\n`)

    let migratedCount = 0
    let mealAccessCreated = 0
    let skippedCount = 0
    let errorCount = 0

    for (const orderItem of orderItems) {
      const customFields = orderItem.customFields

      if (!Array.isArray(customFields)) continue

      // Chercher les options dans customFields
      const optionsInCustomFields = customFields.filter((field: any) => field.optionId)

      if (optionsInCustomFields.length === 0) continue

      console.log(
        `\n📦 OrderItem ${orderItem.id} (${orderItem.firstName} ${orderItem.lastName}) - Edition ${orderItem.order.editionId}`
      )
      console.log(`   Options dans customFields: ${optionsInCustomFields.length}`)

      for (const field of optionsInCustomFields) {
        const optionId = field.optionId
        const answer = field.answer

        // Vérifier si l'option existe déjà dans la table de relation
        const existingSelection = orderItem.selectedOptions.find(
          (sel: any) => sel.optionId === optionId
        )

        if (existingSelection) {
          console.log(`   ⏭️  Option ${optionId} (${field.name}) déjà enregistrée`)
          skippedCount++
          continue
        }

        // Vérifier que l'option existe bien en base
        const option = await prisma.ticketingOption.findUnique({
          where: { id: optionId },
          include: {
            meals: {
              include: {
                meal: true,
              },
            },
          },
        })

        if (!option) {
          console.log(`   ❌ Option ${optionId} n'existe pas en base`)
          errorCount++
          continue
        }

        // Pour les options YesNo, vérifier que la réponse est "true"
        if (option.type === 'YesNo' && answer !== 'true' && answer !== true) {
          console.log(
            `   ⏭️  Option ${optionId} (${field.name}) non sélectionnée (answer: ${answer})`
          )
          skippedCount++
          continue
        }

        try {
          // Créer l'entrée dans TicketingOrderItemOption
          await prisma.ticketingOrderItemOption.create({
            data: {
              orderItemId: orderItem.id,
              optionId: optionId,
              amount: 0, // Les options de repas sont généralement incluses
              customFields: undefined,
            },
          })

          console.log(`   ✅ Option ${optionId} (${field.name}) créée`)
          migratedCount++

          // Si l'option donne accès à des repas, créer les accès
          if (option.meals && option.meals.length > 0) {
            console.log(`   🍽️  Création de ${option.meals.length} accès repas...`)

            for (const mealRelation of option.meals) {
              try {
                // Vérifier si l'accès existe déjà
                const existingAccess = await prisma.ticketingOrderItemMeal.findUnique({
                  where: {
                    orderItemId_mealId: {
                      orderItemId: orderItem.id,
                      mealId: mealRelation.mealId,
                    },
                  },
                })

                if (!existingAccess) {
                  await prisma.ticketingOrderItemMeal.create({
                    data: {
                      orderItemId: orderItem.id,
                      mealId: mealRelation.mealId,
                    },
                  })
                  console.log(`      ✅ Accès repas ${mealRelation.mealId} créé`)
                  mealAccessCreated++
                } else {
                  console.log(`      ⏭️  Accès repas ${mealRelation.mealId} déjà existant`)
                }
              } catch (error: any) {
                console.error(
                  `      ❌ Erreur création accès repas ${mealRelation.mealId}:`,
                  error.message
                )
                errorCount++
              }
            }
          }
        } catch (error: any) {
          console.error(`   ❌ Erreur création option ${optionId}:`, error.message)
          errorCount++
        }
      }
    }

    const summary = {
      success: true,
      optionsMigrated: migratedCount,
      mealAccessCreated: mealAccessCreated,
      skipped: skippedCount,
      errors: errorCount,
      totalOrderItems: orderItems.length,
    }

    console.log('\n\n📊 Résumé de la migration:')
    console.log(`   ✅ ${migratedCount} options migrées`)
    console.log(`   🍽️  ${mealAccessCreated} accès repas créés`)
    console.log(`   ⏭️  ${skippedCount} options ignorées (déjà existantes ou non sélectionnées)`)
    if (errorCount > 0) {
      console.log(`   ❌ ${errorCount} erreurs rencontrées`)
    }

    return summary
  },
  { operationName: 'POST admin migrate-meal-options' }
)
