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
  // Récupérer tous les quotas de l'édition avec leurs tarifs et options associés
  const quotas = await prisma.ticketingQuota.findMany({
    where: { editionId },
    include: {
      tiers: {
        include: {
          tier: {
            include: {
              orderItems: {
                where: {
                  state: 'Processed', // Uniquement les billets payés
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
    },
    orderBy: { position: 'asc' },
  })

  // Récupérer tous les order items avec leurs customFields pour analyser les options
  const allOrderItems = await prisma.ticketingOrderItem.findMany({
    where: {
      state: 'Processed',
      order: {
        externalTicketing: {
          editionId: editionId,
        },
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
    // Compter le nombre de participants ayant un billet lié à un tarif de ce quota
    let currentCount = 0
    let validatedCount = 0

    // 1. Compter les participants via les tarifs
    for (const tierQuota of quota.tiers) {
      for (const orderItem of tierQuota.tier.orderItems) {
        currentCount++
        if (orderItem.entryValidated) {
          validatedCount++
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
            currentCount++
            if (orderItem.entryValidated) {
              validatedCount++
            }
          }
        }
      }
    }

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
