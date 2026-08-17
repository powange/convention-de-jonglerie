import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'

const bodySchema = z.object({
  provider: z.string().min(1),
  // Le serveur auquel ce modèle appartient. Par défaut le principal, ce qui laisse les appels
  // existants se comporter comme avant.
  serveur: z.enum(['principal', 'secours']).default('principal'),
  modelId: z.string().min(1),
  name: z.string().min(1),
})

/**
 * POST /api/admin/ai/models
 * Ajoute un modèle IA à la liste
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event)
    const data = bodySchema.parse(body)

    const model = await prisma.aiModel.upsert({
      where: {
        provider_serveur_modelId: {
          provider: data.provider,
          serveur: data.serveur,
          modelId: data.modelId,
        },
      },
      update: { name: data.name },
      create: {
        provider: data.provider,
        serveur: data.serveur,
        modelId: data.modelId,
        name: data.name,
      },
    })

    return createSuccessResponse({ model })
  },
  { operationName: 'CreateAIModel' }
)
