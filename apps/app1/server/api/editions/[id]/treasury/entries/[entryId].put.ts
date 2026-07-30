import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { assertCodeBelongsToEdition } from '#server/utils/treasury-guards'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { toCents } from '~~/shared/utils/money'

const bodySchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME']).optional(),
  title: z.string().min(1).max(150).optional(),
  description: z.string().max(2000).nullable().optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  codeId: z.number().int().positive().nullable().optional(),
})

/** PUT /api/editions/:id/treasury/entries/:entryId — modifie une ligne saisie à la main. */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const entryId = validateResourceId(event, 'entryId', 'ligne')

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    // Le filtre sur `editionId` évite qu'une ligne appartenant à une autre édition ne soit
    // modifiée depuis celle-ci : le droit est vérifié sur l'édition de l'URL, pas sur la ligne.
    const existing = await prisma.treasuryEntry.findFirst({
      where: { id: entryId, editionId },
      select: { id: true },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Ligne introuvable' })
    }

    const data = bodySchema.parse(await readBody(event))
    await assertCodeBelongsToEdition(editionId, data.codeId)

    await prisma.treasuryEntry.update({
      where: { id: entryId },
      data: {
        ...(data.kind !== undefined && { kind: data.kind }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.amount !== undefined && { amount: toCents(data.amount)! }),
        ...(data.codeId !== undefined && { codeId: data.codeId }),
      },
    })

    return createSuccessResponse({ updated: entryId })
  },
  { operationName: 'UpdateTreasuryEntry' }
)
