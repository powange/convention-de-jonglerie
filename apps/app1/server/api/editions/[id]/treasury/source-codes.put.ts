import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { assertCodeBelongsToEdition } from '#server/utils/treasury-guards'
import { validateEditionId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  source: z.enum([
    'ARTIST_PAYMENT',
    'ARTIST_REIMBURSEMENT',
    'ARTIST_CONSUMABLES',
    'TICKETING_PARTICIPANTS',
    'TICKETING_DONATIONS',
    'TICKETING_OTHER',
  ]),
  /** `null` retire l'imputation de cette origine. */
  codeId: z.number().int().positive().nullable(),
})

/**
 * PUT /api/editions/:id/treasury/source-codes
 *
 * Choisit le code d'imputation d'une origine calculée. Un code par origine, et non par artiste :
 * un comptable impute l'ensemble des cachets sur un même compte.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const { source, codeId } = bodySchema.parse(await readBody(event))
    await assertCodeBelongsToEdition(editionId, codeId)

    if (codeId === null) {
      await prisma.treasurySourceCode.deleteMany({ where: { editionId, source } })
      return createSuccessResponse({ source, codeId: null })
    }

    await prisma.treasurySourceCode.upsert({
      where: { editionId_source: { editionId, source } },
      create: { editionId, source, codeId },
      update: { codeId },
    })

    return createSuccessResponse({ source, codeId })
  },
  { operationName: 'SetTreasurySourceCode' }
)
