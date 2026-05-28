/**
 * Pattern de validation pour les couleurs de tags : format hexadécimal
 * `#RRGGBB` (6 caractères hex après le `#`).
 */
export const TASK_TAG_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

/**
 * Vérifie que tous les tagIds appartiennent au groupe de tâches donné. Lance
 * une erreur 400 si un ID ne correspond à aucun tag du groupe.
 */
export async function assertTagsBelongToGroup(
  taskGroupId: number,
  tagIds: number[]
): Promise<void> {
  if (tagIds.length === 0) return
  const uniqueIds = Array.from(new Set(tagIds))
  const tags = await prisma.taskTag.findMany({
    where: { id: { in: uniqueIds }, taskGroupId },
    select: { id: true },
  })
  if (tags.length !== uniqueIds.length) {
    throw createError({
      status: 400,
      message: "Certains tags n'appartiennent pas à ce groupe",
    })
  }
}
