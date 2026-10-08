import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { userWithProfileAndGravatarSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { etatDuFondsDeCaisse } from '~~/shared/utils/fonds-de-caisse'

/**
 * GET /api/editions/:id/treasury/cash-float — les apports au fonds de caisse et leur état.
 *
 * ⚠️ UN POINT D'API À PART, et ce n'est pas un détail d'organisation. Les apports ne figurent pas
 * dans la charge utile de `/treasury` : quelqu'un qui ajoutera un total sur le compte de résultat
 * n'aura pas ces montants sous la main, et ne *peut* donc pas les y compter par mégarde. C'est
 * l'invariant « le fonds de caisse n'entre dans aucun total », tenu par la forme plutôt que par la
 * vigilance.
 *
 * 📍 Le droit exigé est celui de la trésorerie, comme pour `/treasury` : les apports nomment des
 * personnes et des sommes qu'on leur doit.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, currency: true, cashFloatCount: true, cashFloatCountedAt: true },
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition introuvable' })
    }

    const apports = await prisma.treasuryCashFloat.findMany({
      where: { editionId },
      select: {
        id: true,
        amount: true,
        lentById: true,
        lentByName: true,
        operationDate: true,
        restitutedAt: true,
        note: true,
        lentBy: { select: userWithProfileAndGravatarSelect },
      },
      // Les plus récents d'abord, les apports sans date en queue : on ne leur invente pas un jour.
      orderBy: [{ operationDate: 'desc' }, { id: 'desc' }],
    })

    return createSuccessResponse({
      currency: edition.currency,
      countedAt: edition.cashFloatCountedAt,
      apports,
      etat: etatDuFondsDeCaisse(apports, edition.cashFloatCount),
    })
  },
  { operationName: 'GetTreasuryCashFloat' }
)
