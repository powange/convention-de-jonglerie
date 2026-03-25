import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const config = await prisma.timeEstimateConfig.findFirst()

    return createSuccessResponse({ config })
  },
  { operationName: 'GET admin time-estimate' }
)
