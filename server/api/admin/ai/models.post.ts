import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'

const bodySchema = z.object({
  provider: z.string().min(1),
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
        provider_modelId: {
          provider: data.provider,
          modelId: data.modelId,
        },
      },
      update: { name: data.name },
      create: {
        provider: data.provider,
        modelId: data.modelId,
        name: data.name,
      },
    })

    return createSuccessResponse({ model })
  },
  { operationName: 'CreateAIModel' }
)
