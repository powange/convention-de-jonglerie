import { wrapApiHandler } from '#server/utils/api-helpers'
import { optionalAuth } from '#server/utils/auth-utils'
import {
  canEditEdition,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/faq
 *
 * Liste les entrées de FAQ d'une édition.
 * - Organisateur avec `canEditEdition` : toutes les entrées (publiques + privées)
 * - Visiteur ou query `?publicOnly=1` : seulement les entrées `isPublic = true`
 *
 * Le query param `publicOnly` permet à la page publique d'éviter de recevoir
 * les entrées privées même si l'utilisateur connecté est éditeur.
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)
    const publicOnly = getQuery(event).publicOnly === '1'

    const edition = await getEditionWithPermissions(editionId, {
      userId: optionalAuth(event)?.id,
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    const user = optionalAuth(event)
    const isEditor = !!user && canEditEdition(edition, user)
    const faqPagePublic = (edition as { faqPagePublic?: boolean }).faqPagePublic === true

    // Côté visiteur, si la page publique est désactivée ou le module FAQ off,
    // on ne fuit pas l'info et on ne tape pas la table.
    if (!isEditor && (!edition.faqEnabled || !faqPagePublic)) {
      throw createError({ status: 404, message: 'FAQ non disponible' })
    }

    // Pour la page publique, on force toujours le filtre isPublic même si
    // l'utilisateur est éditeur (sinon il verrait les privées sur le public).
    const restrictToPublic = !isEditor || publicOnly

    const entries = await prisma.faqEntry.findMany({
      where: {
        editionId,
        ...(restrictToPublic ? { isPublic: true } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        question: true,
        answer: true,
        isPublic: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return createSuccessResponse({
      faqEnabled: edition.faqEnabled,
      faqPagePublic,
      entries,
    })
  },
  { operationName: 'GetFaqEntries' }
)
