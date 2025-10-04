import { canAccessEditionData } from '../../../../utils/edition-permissions'
import { getHelloAssoTiersAndOptions } from '../../../../utils/editions/ticketing/helloasso'
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

    // Sauvegarder les tarifs en BDD
    if (result.tiers && result.tiers.length > 0) {
      // Utiliser une transaction pour synchroniser les tarifs
      await prisma.$transaction(async (tx) => {
        // Récupérer les tarifs existants
        const existingTiers = await tx.helloAssoTier.findMany({
          where: { externalTicketingId: config.id },
        })

        const fetchedTierIds = new Set(result.tiers.map((t) => t.id))

        // Supprimer les tarifs qui n'existent plus dans HelloAsso
        const tiersToDelete = existingTiers.filter((t) => !fetchedTierIds.has(t.helloAssoTierId))
        if (tiersToDelete.length > 0) {
          await tx.helloAssoTier.deleteMany({
            where: {
              id: { in: tiersToDelete.map((t) => t.id) },
            },
          })
        }

        // Créer ou mettre à jour les tarifs
        for (const tier of result.tiers) {
          await tx.helloAssoTier.upsert({
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
        }
      })
    }

    // Sauvegarder les options en BDD
    if (result.options && result.options.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Récupérer les options existantes
        const existingOptions = await tx.helloAssoOption.findMany({
          where: { externalTicketingId: config.id },
        })

        const fetchedOptionIds = new Set(result.options.map((o) => String(o.id)))

        // Supprimer les options qui n'existent plus dans HelloAsso
        const optionsToDelete = existingOptions.filter(
          (o) => !fetchedOptionIds.has(o.helloAssoOptionId)
        )
        if (optionsToDelete.length > 0) {
          await tx.helloAssoOption.deleteMany({
            where: {
              id: { in: optionsToDelete.map((o) => o.id) },
            },
          })
        }

        // Créer ou mettre à jour les options
        for (const option of result.options) {
          await tx.helloAssoOption.upsert({
            where: {
              externalTicketingId_helloAssoOptionId: {
                externalTicketingId: config.id,
                helloAssoOptionId: String(option.id),
              },
            },
            create: {
              externalTicketingId: config.id,
              helloAssoOptionId: String(option.id),
              name: option.name,
              description: option.description,
              type: option.type,
              isRequired: option.isRequired,
              choices: option.choices,
            },
            update: {
              name: option.name,
              description: option.description,
              type: option.type,
              isRequired: option.isRequired,
              choices: option.choices,
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
  } catch (error: any) {
    console.error('HelloAsso tiers fetch error:', error)

    // L'utilitaire gère déjà les erreurs, on les relance simplement
    throw error
  }
})
