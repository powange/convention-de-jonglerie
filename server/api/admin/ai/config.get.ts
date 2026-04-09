import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { serializeAiConfig } from '#server/utils/ai-config'
import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * GET /api/admin/ai/config
 * Retourne la configuration IA depuis la BDD (crée l'entrée par défaut si absente)
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const config = await prisma.aiConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    })

    return { config: serializeAiConfig(config) }
  },
  { operationName: 'GetAIConfig' }
)
