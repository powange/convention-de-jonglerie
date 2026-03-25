import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'

const bodySchema = z.object({
  fixedHours: z.number().min(0),
  referenceDate: z.string().datetime({ offset: true }).or(z.string().date()),
  weeklyHours: z.number().min(0),
})

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const body = bodySchema.parse(await readBody(event))

    const existing = await prisma.timeEstimateConfig.findFirst()

    const data = {
      fixedHours: body.fixedHours,
      referenceDate: new Date(body.referenceDate),
      weeklyHours: body.weeklyHours,
    }

    if (existing) {
      await prisma.timeEstimateConfig.update({
        where: { id: existing.id },
        data,
      })
    } else {
      await prisma.timeEstimateConfig.create({ data })
    }

    return createSuccessResponse({}, 'Estimation de temps sauvegardée')
  },
  { operationName: 'POST admin time-estimate' }
)
