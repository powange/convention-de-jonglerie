import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z
    .enum(['DOMAIN', 'HOSTING', 'HARDWARE', 'ELECTRICITY', 'SOFTWARE', 'SERVICE', 'OTHER'])
    .optional(),
  icon: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const id = validateResourceId(event, 'id', 'dépense')
    await fetchResourceOrFail(prisma.projectExpense, id, 'dépense')

    const body = bodySchema.parse(await readBody(event))

    const updated = await prisma.projectExpense.update({
      where: { id },
      data: body,
      include: {
        rates: {
          orderBy: { startDate: 'desc' },
        },
      },
    })

    return createSuccessResponse({ expense: updated }, 'Dépense mise à jour')
  },
  { operationName: 'PUT admin project-costs' }
)
