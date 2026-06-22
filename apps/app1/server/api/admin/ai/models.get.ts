import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * GET /api/admin/ai/models?provider=lmstudio
 * Retourne la liste des modèles IA enregistrés
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const query = getQuery(event)
    const provider = query.provider as string | undefined

    const where = provider ? { provider } : {}

    const models = await prisma.aiModel.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return { models }
  },
  { operationName: 'GetAIModels' }
)
