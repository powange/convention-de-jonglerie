import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const presets = await prisma.showPreset.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return createSuccessResponse({ presets })
  },
  { operationName: 'GetShowPresets' }
)
