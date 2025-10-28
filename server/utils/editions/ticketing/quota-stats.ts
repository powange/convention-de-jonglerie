import { prisma } from '../../prisma'

export interface QuotaStats {
  id: number
  title: string
  description: string | null
  quantity: number
  currentCount: number
  validatedCount: number
  percentage: number
}

/**
 * Calcule les statistiques d'utilisation des quotas pour une édition
 */
export async function getQuotaStats(editionId: number): Promise<QuotaStats[]> {
  // Récupérer tous les quotas de l'édition avec leurs tarifs, options et custom fields associés
  const quotas = await prisma.ticketingQuota.findMany({
    where: { editionId },
    include: {
      tiers: {
        include: {
          tier: {
            include: {
              orderItems: {
                where: {
                  state: { in: ['Processed', 'Pending'] }, // Billets payés et en attente
                },
              },
            },
          },
        },
      },
      options: {
        include: {
          option: true,
        },
      },
      customFields: {
        include: {
          customField: true,
        },
      },
    },
    orderBy: { position: 'asc' },
  })

  // Récupérer tous les order items avec leurs customFields pour analyser les options
  // On inclut les billets payés (Processed) et en attente de paiement (Pending)
  // On inclut les billets externes (HelloAsso) ET manuels
  const allOrderItems = await prisma.ticketingOrderItem.findMany({
    where: {
      state: { in: ['Processed', 'Pending'] },
      order: {
        editionId: editionId,
      },
    },
    select: {
      id: true,
      customFields: true,
      entryValidated: true,
    },
  })

  // Calculer les stats pour chaque quota
  return quotas.map((quota) => {
    // Utiliser des Sets pour éviter de compter plusieurs fois le même billet
    const matchingOrderItemIds = new Set<number>()
    const validatedOrderItemIds = new Set<number>()

    // 1. Compter les participants via les tarifs
    for (const tierQuota of quota.tiers) {
      for (const orderItem of tierQuota.tier.orderItems) {
        matchingOrderItemIds.add(orderItem.id)
        if (orderItem.entryValidated) {
          validatedOrderItemIds.add(orderItem.id)
        }
      }
    }

    // 2. Compter les participants via les options (dans customFields)
    for (const optionQuota of quota.options) {
      const optionName = optionQuota.option.name

      for (const orderItem of allOrderItems) {
        if (orderItem.customFields && Array.isArray(orderItem.customFields)) {
          // Vérifier si cet orderItem a sélectionné cette option
          const hasOption = (orderItem.customFields as any[]).some(
            (field) => field.name === optionName && field.answer
          )

          if (hasOption) {
            matchingOrderItemIds.add(orderItem.id)
            if (orderItem.entryValidated) {
              validatedOrderItemIds.add(orderItem.id)
            }
          }
        }
      }
    }

    // 3. Compter les participants via les custom fields (champs personnalisés de tarifs)
    for (const customFieldQuota of quota.customFields) {
      const customFieldLabel = customFieldQuota.customField.label
      const choiceValue = customFieldQuota.choiceValue

      for (const orderItem of allOrderItems) {
        if (orderItem.customFields && Array.isArray(orderItem.customFields)) {
          // Vérifier si cet orderItem a ce custom field avec le bon choix
          const hasCustomField = (orderItem.customFields as any[]).some((field) => {
            if (field.name !== customFieldLabel) {
              return false
            }

            // Si choiceValue est null, on compte tous les participants qui ont répondu à ce champ
            if (choiceValue === null) {
              return !!field.answer
            }

            // Sinon, on vérifie que la réponse correspond au choix spécifique
            return field.answer === choiceValue
          })

          if (hasCustomField) {
            matchingOrderItemIds.add(orderItem.id)
            if (orderItem.entryValidated) {
              validatedOrderItemIds.add(orderItem.id)
            }
          }
        }
      }
    }

    // Convertir les Sets en nombre
    const currentCount = matchingOrderItemIds.size
    const validatedCount = validatedOrderItemIds.size

    const percentage = quota.quantity > 0 ? Math.round((currentCount / quota.quantity) * 100) : 0

    return {
      id: quota.id,
      title: quota.title,
      description: quota.description,
      quantity: quota.quantity,
      currentCount,
      validatedCount,
      percentage,
    }
  })
}
