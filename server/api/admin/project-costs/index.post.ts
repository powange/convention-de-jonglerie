import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum([
    'DOMAIN',
    'HOSTING',
    'HARDWARE',
    'ELECTRICITY',
    'SOFTWARE',
    'SERVICE',
    'OTHER',
  ]),
  icon: z.string().max(100).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const body = bodySchema.parse(await readBody(event))

    const expense = await prisma.projectExpense.create({
      data: body,
      include: { rates: true },
    })

    return createSuccessResponse({ expense }, 'Dépense créée avec succès')
  },
  { operationName: 'POST admin project-costs' }
)
