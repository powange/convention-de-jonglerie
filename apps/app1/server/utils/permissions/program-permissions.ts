import { canEditEditionById } from '#server/utils/permissions/edition-permissions'

/**
 * Droit de composer le programme d'une édition.
 *
 * Reprend `canEditEditionById` — créateur, auteur de la convention, organisateur habilité, ou mode
 * administrateur — et y ajoute l'administrateur global, comme le fait déjà la mise à jour d'une
 * édition.
 *
 * Cet ajout n'est pas une facilité : la mise à jour par IA s'ouvre notamment sur les conventions
 * non revendiquées, où l'administrateur n'est ni créateur ni organisateur. Sans lui, l'extraction
 * aboutissait mais refusait d'enregistrer, précisément là où la fonctionnalité sert.
 */
export async function canManageProgram(
  editionId: number,
  user: { id: number; isGlobalAdmin?: boolean },
  event?: unknown
): Promise<boolean> {
  if (user.isGlobalAdmin) return true
  return canEditEditionById(editionId, user.id, event)
}
