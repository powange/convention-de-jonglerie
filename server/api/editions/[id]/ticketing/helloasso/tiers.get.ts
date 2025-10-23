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
    // Utiliser une transaction pour synchroniser les tarifs
    await prisma.$transaction(async (tx) => {
      // Récupérer les tarifs existants
      const existingTiers = await tx.ticketingTier.findMany({
        where: { externalTicketingId: config.id },
      })

      const fetchedTierIds = new Set((result.tiers || []).map((t) => t.id))

      // Supprimer les tarifs qui n'existent plus dans HelloAsso
      const tiersToDelete = existingTiers.filter(
        (t) => t.helloAssoTierId !== null && !fetchedTierIds.has(t.helloAssoTierId)
      )
      if (tiersToDelete.length > 0) {
        console.log(
          `🗑️ Suppression de ${tiersToDelete.length} tarif(s) obsolète(s):`,
          tiersToDelete.map((t) => t.name)
        )
        await tx.ticketingTier.deleteMany({
          where: {
            id: { in: tiersToDelete.map((t) => t.id) },
          },
        })
      }

      // Créer ou mettre à jour les tarifs et leurs customFields
      if (result.tiers && result.tiers.length > 0) {
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
          const tierCustomFieldIds = (tier.customFields || []).map((cf) => cf.id)

          // Supprimer les associations obsolètes pour ce tarif
          if (tierCustomFieldIds.length > 0) {
            // Récupérer les customFields actuellement associés à ce tarif
            const currentAssociations = await tx.ticketingTierCustomFieldAssociation.findMany({
              where: { tierId: upsertedTier.id },
              include: { customField: true },
            })

            // Supprimer les associations dont le customField n'existe plus dans HelloAsso
            const associationsToDelete = currentAssociations.filter(
              (assoc) =>
                assoc.customField.helloAssoCustomFieldId !== null &&
                !tierCustomFieldIds.includes(assoc.customField.helloAssoCustomFieldId)
            )

            if (associationsToDelete.length > 0) {
              await tx.ticketingTierCustomFieldAssociation.deleteMany({
                where: {
                  id: { in: associationsToDelete.map((a) => a.id) },
                },
              })
            }
          } else {
            // Si le tarif n'a plus de custom fields, supprimer toutes les associations
            await tx.ticketingTierCustomFieldAssociation.deleteMany({
              where: { tierId: upsertedTier.id },
            })
          }

          // Créer ou mettre à jour les customFields
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
                  editionId: editionId,
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

        // Nettoyer les custom fields orphelins (non associés à aucun tarif)
        const allCustomFields = await tx.ticketingTierCustomField.findMany({
          where: { externalTicketingId: config.id },
          include: { tiers: true },
        })

        const orphanCustomFields = allCustomFields.filter((cf) => cf.tiers.length === 0)
        if (orphanCustomFields.length > 0) {
          await tx.ticketingTierCustomField.deleteMany({
            where: {
              id: { in: orphanCustomFields.map((cf) => cf.id) },
            },
          })
        }
      }
    })

    // Sauvegarder les options en BDD
    await prisma.$transaction(async (tx) => {
      // Récupérer les options existantes
      const existingOptions = await tx.ticketingOption.findMany({
        where: { externalTicketingId: config.id },
      })

      const fetchedOptionIds = new Set((result.options || []).map((o) => String(o.id)))

      // Supprimer les options qui n'existent plus dans HelloAsso
      const optionsToDelete = existingOptions.filter(
        (o) => o.helloAssoOptionId !== null && !fetchedOptionIds.has(o.helloAssoOptionId)
      )
      if (optionsToDelete.length > 0) {
        console.log(
          `🗑️ Suppression de ${optionsToDelete.length} option(s) obsolète(s):`,
          optionsToDelete.map((o) => o.name)
        )
        await tx.ticketingOption.deleteMany({
          where: {
            id: { in: optionsToDelete.map((o) => o.id) },
          },
        })
      }

      // Créer ou mettre à jour les options
      if (result.options && result.options.length > 0) {
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
      }
    })

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
