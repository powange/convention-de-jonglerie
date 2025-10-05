import { prisma } from '../../prisma'

export interface TierData {
  name: string
  description?: string | null
  price: number
  minAmount?: number | null
  maxAmount?: number | null
  position: number
  isActive: boolean
  quotaIds?: number[]
  returnableItemIds?: number[]
}

/**
 * Récupère tous les tarifs d'une édition (HelloAsso et manuels)
 */
export async function getEditionTiers(editionId: number) {
  return await prisma.helloAssoTier.findMany({
    where: { editionId },
    orderBy: [{ position: 'asc' }, { price: 'desc' }],
    include: {
      quotas: {
        include: {
          quota: true,
        },
      },
      returnableItems: {
        include: {
          returnableItem: true,
        },
      },
    },
  })
}

/**
 * Crée un nouveau tarif manuel
 */
export async function createTier(editionId: number, data: TierData) {
  return await prisma.helloAssoTier.create({
    data: {
      editionId,
      name: data.name,
      description: data.description,
      price: data.price,
      minAmount: data.minAmount,
      maxAmount: data.maxAmount,
      position: data.position,
      isActive: data.isActive,
      // externalTicketingId et helloAssoTierId restent null pour un tarif manuel
      quotas: {
        create: (data.quotaIds || []).map((quotaId) => ({ quotaId })),
      },
      returnableItems: {
        create: (data.returnableItemIds || []).map((returnableItemId) => ({
          returnableItemId,
        })),
      },
    },
  })
}

/**
 * Met à jour un tarif existant
 */
export async function updateTier(tierId: number, editionId: number, data: TierData) {
  // Vérifier que le tarif existe et appartient à cette édition
  const existingTier = await prisma.helloAssoTier.findFirst({
    where: {
      id: tierId,
      editionId,
    },
  })

  if (!existingTier) {
    throw createError({
      statusCode: 404,
      message: 'Tarif introuvable',
    })
  }

  const isHelloAssoTier = existingTier.helloAssoTierId !== null

  // Mettre à jour le tarif avec ses relations
  return await prisma.$transaction(async (tx) => {
    // Supprimer les anciennes relations
    await tx.tierQuota.deleteMany({ where: { tierId } })
    await tx.tierReturnableItem.deleteMany({ where: { tierId } })

    // Pour les tarifs HelloAsso, on met à jour uniquement les relations
    // Pour les tarifs manuels, on met à jour tout
    if (isHelloAssoTier) {
      return await tx.helloAssoTier.update({
        where: { id: tierId },
        data: {
          quotas: {
            create: (data.quotaIds || []).map((quotaId) => ({ quotaId })),
          },
          returnableItems: {
            create: (data.returnableItemIds || []).map((returnableItemId) => ({
              returnableItemId,
            })),
          },
        },
      })
    } else {
      return await tx.helloAssoTier.update({
        where: { id: tierId },
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          minAmount: data.minAmount,
          maxAmount: data.maxAmount,
          position: data.position,
          isActive: data.isActive,
          quotas: {
            create: (data.quotaIds || []).map((quotaId) => ({ quotaId })),
          },
          returnableItems: {
            create: (data.returnableItemIds || []).map((returnableItemId) => ({
              returnableItemId,
            })),
          },
        },
      })
    }
  })
}

/**
 * Supprime un tarif manuel
 */
export async function deleteTier(tierId: number, editionId: number) {
  // Vérifier que le tarif existe et appartient à cette édition
  const existingTier = await prisma.helloAssoTier.findFirst({
    where: {
      id: tierId,
      editionId,
    },
  })

  if (!existingTier) {
    throw createError({
      statusCode: 404,
      message: 'Tarif introuvable',
    })
  }

  // Vérifier que ce n'est pas un tarif HelloAsso (non supprimable)
  if (existingTier.helloAssoTierId !== null) {
    throw createError({
      statusCode: 403,
      message: 'Impossible de supprimer un tarif synchronisé depuis HelloAsso',
    })
  }

  await prisma.helloAssoTier.delete({
    where: { id: tierId },
  })

  return {
    success: true,
    message: 'Tarif supprimé avec succès',
  }
}
