import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  code: z.string().min(1).max(32),
  label: z.string().min(1).max(120),
})

/**
 * POST /api/editions/:id/treasury/codes
 *
 * Crée un code d'imputation. Il est rattaché à la **convention** et non à l'édition : un plan
 * comptable se réutilise d'une année sur l'autre. L'édition sert seulement à savoir de quelle
 * convention il s'agit et à vérifier le droit.
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
      select: { conventionId: true },
    })
    if (!edition) throw createError({ status: 404, message: 'Édition non trouvée' })

    const data = bodySchema.parse(await readBody(event))
    const code = data.code.trim()

    // Deux codes identiques rendraient tout regroupement ambigu. La contrainte d'unicité tranche
    // en base ; ce contrôle donne un message compréhensible plutôt qu'une erreur brute.
    const existing = await prisma.treasuryCode.findFirst({
      where: { conventionId: edition.conventionId, code },
      select: { id: true },
    })
    if (existing) {
      throw createError({ status: 400, message: 'Ce code existe déjà pour cette convention' })
    }

    const created = await prisma.treasuryCode.create({
      data: { conventionId: edition.conventionId, code, label: data.label.trim() },
      select: { id: true, code: true, label: true },
    })

    return createSuccessResponse({ code: created })
  },
  { operationName: 'CreateTreasuryCode' }
)
