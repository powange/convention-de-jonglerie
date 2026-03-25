import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const expenses = await prisma.projectExpense.findMany({
      include: {
        rates: {
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return createSuccessResponse({ expenses })
  },
  { operationName: 'GET admin project-costs' }
)
