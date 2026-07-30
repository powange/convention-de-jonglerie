import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

/**
 * DELETE /api/editions/:id/treasury/codes/:codeId
 *
 * Les lignes qui l'utilisaient conservent leur montant et perdent seulement leur imputation
 * (`onDelete: SetNull`). Supprimer un code ne doit pas faire disparaître des charges.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const codeId = validateResourceId(event, 'codeId', 'code')

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const code = await prisma.treasuryCode.findFirst({
      where: { id: codeId, convention: { editions: { some: { id: editionId } } } },
      select: { id: true },
    })
    if (!code) throw createError({ status: 404, message: 'Code introuvable' })

    await prisma.treasuryCode.delete({ where: { id: codeId } })

    return createSuccessResponse({ deleted: codeId })
  },
  { operationName: 'DeleteTreasuryCode' }
)
