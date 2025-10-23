import { requireAuth } from '@@/server/utils/auth-utils'
import { getHelloAssoTiersAndOptions } from '@@/server/utils/editions/ticketing/helloasso'
import { decrypt } from '@@/server/utils/encryption'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
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

  console.log("🎫 [Endpoint] Récupération des tarifs HelloAsso pour l'édition:", editionId)
  console.log('🎫 [Endpoint] Configuration HelloAsso ID:', haConfig.id)

  try {
    // Déchiffrer le client secret
    const clientSecret = decrypt(haConfig.clientSecret)

    console.log('🎫 [Endpoint] Client ID:', haConfig.clientId)
    console.log('🎫 [Endpoint] Client Secret déchiffré:', clientSecret ? '✓ OK' : '✗ ERREUR')
    console.log('🎫 [Endpoint] Organization Slug:', haConfig.organizationSlug)
    console.log('🎫 [Endpoint] Form Type:', haConfig.formType)
    console.log('🎫 [Endpoint] Form Slug:', haConfig.formSlug)

    // Récupérer les tarifs et options via l'utilitaire
    const result = await getHelloAssoTiersAndOptions(
      {
        clientId: haConfig.clientId,
        clientSecret,
      },
      {
        organizationSlug: haConfig.organizationSlug,
        formType: haConfig.formType,
        formSlug: haConfig.formSlug,
      }
    )

    // Logger le retour complet de l'API HelloAsso
    console.log('🎫 [HelloAsso API] Retour complet:', JSON.stringify(result, null, 2))
    console.log('🎫 [HelloAsso API] Nombre de tarifs reçus:', result.tiers?.length || 0)
    console.log("🎫 [HelloAsso API] Nombre d'options reçues:", result.options?.length || 0)

    // Sauvegarder les tarifs en BDD
    if (result.tiers && result.tiers.length > 0) {
      // Utiliser une transaction pour synchroniser les tarifs
      await prisma.$transaction(async (tx) => {
        // Récupérer les tarifs existants
        const existingTiers = await tx.ticketingTier.findMany({
          where: { externalTicketingId: config.id },
        })

        const fetchedTierIds = new Set(result.tiers.map((t) => t.id))

        // Supprimer les tarifs qui n'existent plus dans HelloAsso
        const tiersToDelete = existingTiers.filter(
          (t) => t.helloAssoTierId !== null && !fetchedTierIds.has(t.helloAssoTierId)
        )
        if (tiersToDelete.length > 0) {
          await tx.ticketingTier.deleteMany({
            where: {
              id: { in: tiersToDelete.map((t) => t.id) },
            },
          })
        }

        // Créer ou mettre à jour les tarifs et leurs customFields
        for (const tier of result.tiers) {
          const upsertedTier = await tx.ticketingTier.upsert({
            where: {
              externalTicketingId_helloAssoTierId: {
                externalTicketingId: config.id,
                helloAssoTierId: tier.id,
              },
            },
            create: {
              externalTicketingId: config.id,
              helloAssoTierId: tier.id,
              editionId: editionId,
              name: tier.name,
              description: tier.description,
              price: tier.price,
              minAmount: tier.minAmount,
              maxAmount: tier.maxAmount,
              isActive: tier.isActive,
            },
            update: {
              name: tier.name,
              description: tier.description,
              price: tier.price,
              minAmount: tier.minAmount,
              maxAmount: tier.maxAmount,
              isActive: tier.isActive,
            },
          })

          // Gérer les customFields pour ce tarif
          if (tier.customFields && tier.customFields.length > 0) {
            for (const customField of tier.customFields) {
              // Créer ou mettre à jour le customField
              const upsertedCustomField = await tx.ticketingTierCustomField.upsert({
                where: {
                  externalTicketingId_helloAssoCustomFieldId: {
                    externalTicketingId: config.id,
                    helloAssoCustomFieldId: customField.id,
                  },
                },
                create: {
                  externalTicketingId: config.id,
                  helloAssoCustomFieldId: customField.id,
                  label: customField.label,
                  type: customField.type,
                  isRequired: customField.isRequired,
                  values: customField.values,
                },
                update: {
                  label: customField.label,
                  type: customField.type,
                  isRequired: customField.isRequired,
                  values: customField.values,
                },
              })

              // Créer l'association tier-customField si elle n'existe pas déjà
              await tx.ticketingTierCustomFieldAssociation.upsert({
                where: {
                  tierId_customFieldId: {
                    tierId: upsertedTier.id,
                    customFieldId: upsertedCustomField.id,
                  },
                },
                create: {
                  tierId: upsertedTier.id,
                  customFieldId: upsertedCustomField.id,
                },
                update: {},
              })
            }
          }
        }
      })
    }

    // Sauvegarder les options en BDD
    if (result.options && result.options.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Récupérer les options existantes
        const existingOptions = await tx.ticketingOption.findMany({
          where: { externalTicketingId: config.id },
        })

        const fetchedOptionIds = new Set(result.options.map((o) => String(o.id)))

        // Supprimer les options qui n'existent plus dans HelloAsso
        const optionsToDelete = existingOptions.filter(
          (o) => o.helloAssoOptionId !== null && !fetchedOptionIds.has(o.helloAssoOptionId)
        )
        if (optionsToDelete.length > 0) {
          await tx.ticketingOption.deleteMany({
            where: {
              id: { in: optionsToDelete.map((o) => o.id) },
            },
          })
        }

        // Créer ou mettre à jour les options
        for (const option of result.options) {
          await tx.ticketingOption.upsert({
            where: {
              externalTicketingId_helloAssoOptionId: {
                externalTicketingId: config.id,
                helloAssoOptionId: String(option.id),
              },
            },
            create: {
              externalTicketingId: config.id,
              helloAssoOptionId: String(option.id),
              editionId: editionId,
              name: option.name,
              description: option.description,
              type: option.type,
              isRequired: option.isRequired,
              choices: option.choices,
              price: option.price, // Prix de l'option en centimes
            },
            update: {
              name: option.name,
              description: option.description,
              type: option.type,
              isRequired: option.isRequired,
              choices: option.choices,
              price: option.price, // Prix de l'option en centimes
            },
          })
        }
      })
    }

    // Mettre à jour la date de dernière synchronisation
    await prisma.externalTicketing.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date() },
    })

    return result
  } catch (error: unknown) {
    console.error('HelloAsso tiers fetch error:', error)

    // L'utilitaire gère déjà les erreurs, on les relance simplement
    throw error
  }
})
