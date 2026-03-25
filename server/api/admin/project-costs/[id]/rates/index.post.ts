import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'

const bodySchema = z.object({
  amount: z.number().positive(),
  currency: z.string().max(10).default('EUR'),
  period: z.enum(['MONTHLY', 'YEARLY', 'ONE_TIME']),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()),
  endDate: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const expenseId = validateResourceId(event, 'id', 'dépense')
    await fetchResourceOrFail(prisma.projectExpense, expenseId, 'dépense')

    const body = bodySchema.parse(await readBody(event))

    const rate = await prisma.projectExpenseRate.create({
      data: {
        expenseId,
        amount: body.amount,
        currency: body.currency,
        period: body.period,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        note: body.note,
      },
    })

    return createSuccessResponse({ rate }, 'Tarif ajouté')
  },
  { operationName: 'POST admin project-costs rate' }
)
