import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { assertCodeBelongsToEdition } from '#server/utils/treasury-guards'
import { validateEditionId } from '#server/utils/validation-helpers'
import { toCents } from '~~/shared/utils/money'

/**
 * Le montant arrive en unité courante, comme partout dans les formulaires, et repart en centimes.
 * Toujours positif : c'est `kind` qui décide s'il s'ajoute aux charges ou aux produits.
 */
const bodySchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME']),
  title: z.string().min(1).max(150),
  description: z.string().max(2000).nullable().optional(),
  amount: z.number().positive().max(10_000_000),
  codeId: z.number().int().positive().nullable().optional(),
})

/** POST /api/editions/:id/treasury/entries — ajoute une ligne saisie à la main. */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    const data = bodySchema.parse(await readBody(event))
    await assertCodeBelongsToEdition(editionId, data.codeId)

    const entry = await prisma.treasuryEntry.create({
      data: {
        editionId,
        kind: data.kind,
        title: data.title,
        description: data.description ?? null,
        amount: toCents(data.amount)!,
        codeId: data.codeId ?? null,
      },
      select: { id: true },
    })

    return createSuccessResponse({ id: entry.id })
  },
  { operationName: 'CreateTreasuryEntry' }
)
