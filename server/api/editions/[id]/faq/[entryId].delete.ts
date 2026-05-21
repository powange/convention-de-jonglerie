import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canEditEdition,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const entryId = Number(getRouterParam(event, 'entryId'))
    if (isNaN(entryId)) {
      throw createError({ status: 400, message: 'Identifiant invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canEditEdition(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const existing = await prisma.faqEntry.findFirst({
      where: { id: entryId, editionId },
      select: { id: true },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Entrée introuvable' })
    }

    await prisma.faqEntry.delete({ where: { id: entryId } })

    return createSuccessResponse({ deleted: true })
  },
  { operationName: 'DeleteFaqEntry' }
)
