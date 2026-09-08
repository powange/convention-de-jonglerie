/**
 * Les tags du stock : une étiquette transversale posée sur du matériel.
 *
 * Le format de couleur est le même que pour les tags de tâches — un seul format dans
 * l'application, plutôt que deux qui divergeraient au premier ajout.
 */
export const STOCK_TAG_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

/**
 * Vérifie que tous les identifiants désignent des tags de CETTE édition.
 *
 * Sans ce contrôle, un identifiant emprunté à une édition voisine passerait la permission de
 * celle-ci et rattacherait son tag à notre matériel.
 */
export async function assertTagsBelongToEdition(
  editionId: number,
  tagIds: number[]
): Promise<void> {
  if (tagIds.length === 0) return
  const uniqueIds = Array.from(new Set(tagIds))
  const tags = await prisma.stockTag.findMany({
    where: { id: { in: uniqueIds }, editionId },
    select: { id: true },
  })
  if (tags.length !== uniqueIds.length) {
    throw createError({
      status: 400,
      message: "Certains tags n'appartiennent pas à cette édition",
    })
  }
}
