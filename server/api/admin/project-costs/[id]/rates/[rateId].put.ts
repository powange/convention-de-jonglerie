import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'

const bodySchema = z.object({
  amount: z.number().positive().optional(),
  currency: z.string().max(10).optional(),
  period: z.enum(['MONTHLY', 'YEARLY', 'ONE_TIME']).optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const expenseId = validateResourceId(event, 'id', 'dépense')
    const rateId = validateResourceId(event, 'rateId', 'tarif')

    // Vérifier que le tarif appartient bien à cette dépense
    const rate = await prisma.projectExpenseRate.findFirst({
      where: { id: rateId, expenseId },
    })

    if (!rate) {
      throw createError({
        status: 404,
        message: 'Tarif introuvable pour cette dépense',
      })
    }

    const body = bodySchema.parse(await readBody(event))

    const updated = await prisma.projectExpenseRate.update({
      where: { id: rateId },
      data: {
        ...(body.amount !== undefined && { amount: body.amount }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.period !== undefined && { period: body.period }),
        ...(body.startDate !== undefined && { startDate: new Date(body.startDate) }),
        ...(body.endDate !== undefined && {
          endDate: body.endDate ? new Date(body.endDate) : null,
        }),
        ...(body.note !== undefined && { note: body.note }),
      },
    })

    return createSuccessResponse({ rate: updated }, 'Tarif mis à jour')
  },
  { operationName: 'PUT admin project-costs rate' }
)
