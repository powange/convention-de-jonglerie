import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { supprimerJustificatif } from '#server/utils/treasury-receipt-files'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

/** DELETE /api/editions/:id/treasury/entries/:entryId */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const entryId = validateResourceId(event, 'entryId', 'ligne')

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const existing = await prisma.treasuryEntry.findFirst({
      where: { id: entryId, editionId },
      select: { id: true, imageUrl: true, edition: { select: { id: true, conventionId: true } } },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Ligne introuvable' })
    }

    await prisma.treasuryEntry.delete({ where: { id: entryId } })

    // Après la suppression en base, et sans la conditionner : un fichier introuvable ne doit pas
    // laisser une ligne que l'on croyait effacée.
    await supprimerJustificatif(existing.imageUrl, existing.edition)

    // Renvoie l'identifiant plutôt que `null` : une réponse vide oblige l'appelant à deviner le
    // succès depuis l'absence d'erreur, ce qui a déjà coûté un correctif sur l'import de carte.
    return createSuccessResponse({ deleted: entryId })
  },
  { operationName: 'DeleteTreasuryEntry' }
)
