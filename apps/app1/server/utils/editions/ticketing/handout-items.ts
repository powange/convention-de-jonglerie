import { z } from 'zod'

/**
 * La longueur de la colonne `name`, telle que la migration initiale la pose : `VARCHAR(191)`.
 *
 * Sans cette borne côté validation, un nom plus long remontait en erreur Prisma, que le `catch`
 * du point d'API transformait en 500 « Erreur lors de la création ». L'utilisateur recevait une
 * panne là où il devait recevoir la phrase qui lui dit quoi corriger.
 */
export const NOM_ARTICLE_MAX = 191

/**
 * Ce qu'un article à remettre exige, en un seul endroit.
 *
 * Le schéma était recopié à l'identique dans la création et la mise à jour — deux endroits où
 * ajouter la même borne, donc un endroit où l'oublier. Le `trim` vit ici aussi : l'interface le
 * fait déjà, mais l'interface n'est pas le contrat, et « Bracelet » avec une espace de trop est
 * un autre article pour l'index d'unicité comme pour l'œil.
 */
export const handoutItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est obligatoire')
    .max(NOM_ARTICLE_MAX, `Le nom ne peut pas dépasser ${NOM_ARTICLE_MAX} caractères`),
  /** Remis autant de fois qu'il est associé au participant (défaut : une seule fois) */
  cumulative: z.boolean().optional(),
})

export type HandoutItemData = z.infer<typeof handoutItemSchema>

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
      cumulative: data.cumulative ?? false,
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
      ...(data.cumulative !== undefined ? { cumulative: data.cumulative } : {}),
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
