import { prisma } from '../../prisma'

export interface ReturnableItemData {
  name: string
}

/**
 * Récupère tous les items à restituer d'une édition
 */
export async function getReturnableItems(editionId: number) {
  return await prisma.returnableItem.findMany({
    where: { editionId },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Crée un nouvel item à restituer
 */
export async function createReturnableItem(editionId: number, data: ReturnableItemData) {
  return await prisma.returnableItem.create({
    data: {
      editionId,
      name: data.name,
    },
  })
}

/**
 * Met à jour un item à restituer
 */
export async function updateReturnableItem(
  itemId: number,
  editionId: number,
  data: ReturnableItemData
) {
  // Vérifier que l'item existe et appartient à cette édition
  const existingItem = await prisma.returnableItem.findUnique({
    where: { id: itemId },
  })

  if (!existingItem) {
    throw createError({ statusCode: 404, message: 'Item introuvable' })
  }

  if (existingItem.editionId !== editionId) {
    throw createError({
      statusCode: 403,
      message: "Cet item n'appartient pas à cette édition",
    })
  }

  return await prisma.returnableItem.update({
    where: { id: itemId },
    data: {
      name: data.name,
    },
  })
}

/**
 * Supprime un item à restituer
 */
export async function deleteReturnableItem(itemId: number, editionId: number) {
  // Vérifier que l'item existe et appartient à cette édition
  const existingItem = await prisma.returnableItem.findUnique({
    where: { id: itemId },
  })

  if (!existingItem) {
    throw createError({ statusCode: 404, message: 'Item introuvable' })
  }

  if (existingItem.editionId !== editionId) {
    throw createError({
      statusCode: 403,
      message: "Cet item n'appartient pas à cette édition",
    })
  }

  await prisma.returnableItem.delete({
    where: { id: itemId },
  })

  return { success: true }
}
