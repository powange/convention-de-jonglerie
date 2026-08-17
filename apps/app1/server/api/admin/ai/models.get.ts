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
    // Chaque serveur LM Studio a son propre catalogue : la machine de secours n'héberge pas
    // forcément les mêmes modèles que la principale.
    const serveur = query.serveur as string | undefined

    const where = {
      ...(provider ? { provider } : {}),
      ...(serveur ? { serveur } : {}),
    }

    const models = await prisma.aiModel.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return { models }
  },
  { operationName: 'GetAIModels' }
)
