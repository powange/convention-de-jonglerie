import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import {
  invalidateContextLengthCache,
  invalidateDbConfigCache,
  serializeAiConfig,
} from '#server/utils/ai-config'
import { createSuccessResponse, wrapApiHandler } from '#server/utils/api-helpers'

const bodySchema = z.object({
  provider: z.enum(['lmstudio', 'anthropic', 'ollama']),
  lmstudioBaseUrl: z.string().url().default('http://host.docker.internal:1234'),
  lmstudioModelId: z.string().nullable().default(null),
  lmstudioTextModelId: z.string().nullable().default(null),
  anthropicApiKey: z.string().nullable().default(null),
  ollamaBaseUrl: z.string().url().default('http://localhost:11434'),
  ollamaModel: z.string().default('llava'),
})

/**
 * PUT /api/admin/ai/config
 * Met à jour la configuration IA en BDD
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event)
    const data = bodySchema.parse(body)

    const updateData: Record<string, unknown> = {
      provider: data.provider,
      lmstudioBaseUrl: data.lmstudioBaseUrl,
      lmstudioModelId: data.lmstudioModelId,
      lmstudioTextModelId: data.lmstudioTextModelId,
      ollamaBaseUrl: data.ollamaBaseUrl,
      ollamaModel: data.ollamaModel,
    }

    // Gestion clé API Anthropic :
    // - "****" → ne pas toucher (clé masquée renvoyée par le GET)
    // - null/vide → supprimer la clé
    // - autre valeur → mettre à jour
    if (data.anthropicApiKey === '****') {
      // Ne rien faire, garder la valeur existante
    } else if (!data.anthropicApiKey) {
      updateData.anthropicApiKey = null
    } else {
      updateData.anthropicApiKey = data.anthropicApiKey
    }

    const config = await prisma.aiConfig.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        ...updateData,
      },
    })

    // Invalider les caches après modification
    invalidateContextLengthCache()
    invalidateDbConfigCache()

    return createSuccessResponse({ config: serializeAiConfig(config) })
  },
  { operationName: 'UpdateAIConfig' }
)
