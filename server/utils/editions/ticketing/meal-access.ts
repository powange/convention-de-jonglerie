/**
 * Utilitaires pour gérer les accès repas des participants
 */

import type { PrismaTransaction } from '#server/types/prisma-helpers'

/**
 * Crée les accès repas pour un orderItem basé sur une option
 * @param tx Transaction Prisma
 * @param orderItemId ID de l'item de commande
 * @param optionId ID de l'option
 * @returns Nombre d'accès repas créés
 */
export async function createMealAccessForOption(
  tx: PrismaTransaction,
  orderItemId: number,
  optionId: number
): Promise<number> {
  // Récupérer l'option avec ses repas
  const option = await tx.ticketingOption.findUnique({
    where: { id: optionId },
    include: {
      meals: {
        include: {
          meal: true,
        },
      },
    },
  })

  if (!option || !option.meals || option.meals.length === 0) {
    return 0
  }

  let createdCount = 0

  for (const mealRelation of option.meals) {
    // Vérifier si l'accès existe déjà
    const existingAccess = await tx.ticketingOrderItemMeal.findUnique({
      where: {
        orderItemId_mealId: {
          orderItemId,
          mealId: mealRelation.mealId,
        },
      },
    })

    if (!existingAccess) {
      await tx.ticketingOrderItemMeal.create({
        data: {
          orderItemId,
          mealId: mealRelation.mealId,
        },
      })
      createdCount++
    }
  }

  return createdCount
}

/**
 * Crée les accès repas pour un orderItem basé sur un tarif
 * @param tx Transaction Prisma
 * @param orderItemId ID de l'item de commande
 * @param tierId ID du tarif
 * @returns Nombre d'accès repas créés
 */
export async function createMealAccessForTier(
  tx: PrismaTransaction,
  orderItemId: number,
  tierId: number
): Promise<number> {
  // Récupérer le tarif avec ses repas
  const tier = await tx.ticketingTier.findUnique({
    where: { id: tierId },
    include: {
      meals: {
        include: {
          meal: true,
        },
      },
    },
  })

  if (!tier || !tier.meals || tier.meals.length === 0) {
    return 0
  }

  let createdCount = 0

  for (const mealRelation of tier.meals) {
    // Vérifier si l'accès existe déjà
    const existingAccess = await tx.ticketingOrderItemMeal.findUnique({
      where: {
        orderItemId_mealId: {
          orderItemId,
          mealId: mealRelation.mealId,
        },
      },
    })

    if (!existingAccess) {
      await tx.ticketingOrderItemMeal.create({
        data: {
          orderItemId,
          mealId: mealRelation.mealId,
        },
      })
      createdCount++
    }
  }

  return createdCount
}

/**
 * Supprime un accès repas pour un participant
 * @param tx Transaction Prisma
 * @param orderItemId ID de l'item de commande
 * @param mealId ID du repas
 * @returns true si l'accès a été supprimé, false sinon
 */
export async function removeMealAccess(
  tx: PrismaTransaction,
  orderItemId: number,
  mealId: number
): Promise<boolean> {
  try {
    await tx.ticketingOrderItemMeal.delete({
      where: {
        orderItemId_mealId: {
          orderItemId,
          mealId,
        },
      },
    })
    return true
  } catch {
    return false
  }
}

/**
 * Supprime tous les accès repas pour un orderItem
 * @param tx Transaction Prisma
 * @param orderItemId ID de l'item de commande
 * @returns Nombre d'accès repas supprimés
 */
export async function removeAllMealAccess(
  tx: PrismaTransaction,
  orderItemId: number
): Promise<number> {
  const result = await tx.ticketingOrderItemMeal.deleteMany({
    where: { orderItemId },
  })
  return result.count
}

/**
 * Valide un accès repas (marque comme consommé)
 * @param tx Transaction Prisma
 * @param orderItemId ID de l'item de commande
 * @param mealId ID du repas
 * @returns L'accès repas mis à jour, ou null si non trouvé
 */
export async function validateMealAccess(
  tx: PrismaTransaction,
  orderItemId: number,
  mealId: number
) {
  return await tx.ticketingOrderItemMeal.update({
    where: {
      orderItemId_mealId: {
        orderItemId,
        mealId,
      },
    },
    data: {
      consumedAt: new Date(),
    },
  })
}

/**
 * Annule la validation d'un accès repas
 * @param tx Transaction Prisma
 * @param orderItemId ID de l'item de commande
 * @param mealId ID du repas
 * @returns L'accès repas mis à jour, ou null si non trouvé
 */
export async function unvalidateMealAccess(
  tx: PrismaTransaction,
  orderItemId: number,
  mealId: number
) {
  return await tx.ticketingOrderItemMeal.update({
    where: {
      orderItemId_mealId: {
        orderItemId,
        mealId,
      },
    },
    data: {
      consumedAt: null,
    },
  })
}

/**
 * Récupère tous les accès repas pour un orderItem
 * @param tx Transaction Prisma
 * @param orderItemId ID de l'item de commande
 * @returns Liste des accès repas avec les détails du repas
 */
export async function getMealAccessForOrderItem(tx: PrismaTransaction, orderItemId: number) {
  return await tx.ticketingOrderItemMeal.findMany({
    where: { orderItemId },
    include: {
      meal: true,
    },
  })
}

/**
 * Vérifie si un orderItem a accès à un repas spécifique
 * @param tx Transaction Prisma
 * @param orderItemId ID de l'item de commande
 * @param mealId ID du repas
 * @returns true si l'accès existe, false sinon
 */
export async function hasMealAccess(
  tx: PrismaTransaction,
  orderItemId: number,
  mealId: number
): Promise<boolean> {
  const access = await tx.ticketingOrderItemMeal.findUnique({
    where: {
      orderItemId_mealId: {
        orderItemId,
        mealId,
      },
    },
  })
  return access !== null
}
