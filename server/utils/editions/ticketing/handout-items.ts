export interface HandoutItemData {
  name: string
}

/**
 * Récupère tous les items à remettre d'une édition
 */
export async function getHandoutItems(editionId: number) {
  return await prisma.ticketingHandoutItem.findMany({
    where: { editionId },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Crée un nouvel item à remettre
 */
export async function createHandoutItem(editionId: number, data: HandoutItemData) {
  return await prisma.ticketingHandoutItem.create({
    data: {
      editionId,
      name: data.name,
    },
  })
}

/**
 * Met à jour un item à remettre
 */
export async function updateHandoutItem(itemId: number, editionId: number, data: HandoutItemData) {
  // Vérifier que l'item existe et appartient à cette édition
  const existingItem = await prisma.ticketingHandoutItem.findUnique({
    where: { id: itemId },
  })

  if (!existingItem) {
    throw createError({ status: 404, message: 'Item introuvable' })
  }

  if (existingItem.editionId !== editionId) {
    throw createError({
      status: 403,
      message: "Cet item n'appartient pas à cette édition",
    })
  }

  return await prisma.ticketingHandoutItem.update({
    where: { id: itemId },
    data: {
      name: data.name,
    },
  })
}

/**
 * Supprime un item à remettre
 */
export async function deleteHandoutItem(itemId: number, editionId: number) {
  // Vérifier que l'item existe et appartient à cette édition
  const existingItem = await prisma.ticketingHandoutItem.findUnique({
    where: { id: itemId },
  })

  if (!existingItem) {
    throw createError({ status: 404, message: 'Item introuvable' })
  }

  if (existingItem.editionId !== editionId) {
    throw createError({
      status: 403,
      message: "Cet item n'appartient pas à cette édition",
    })
  }

  await prisma.ticketingHandoutItem.delete({
    where: { id: itemId },
  })

  return { success: true }
}
