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
  // Facultative, et tolérant la chaîne vide : laisser le champ blanc doit vouloir dire
  // « pas de secours », pas « adresse invalide ».
  lmstudioBackupBaseUrl: z.string().url().or(z.literal('')).nullish(),
  lmstudioModelId: z.string().nullable().default(null),
  lmstudioTextModelId: z.string().nullable().default(null),
  // Modèles de la machine de secours. Laissés vides, ceux du serveur principal s'appliquent.
  lmstudioBackupModelId: z.string().nullable().default(null),
  lmstudioBackupTextModelId: z.string().nullable().default(null),
  anthropicApiKey: z.string().nullable().default(null),
  ollamaBaseUrl: z.string().url().default('http://localhost:11434'),
  ollamaModel: z.string().default('llava'),
  // Entre 30 s et 30 min : en dessous aucun modèle local n'a le temps, au-dessus l'utilisateur
  // resterait bloqué sur une page sans retour pendant une demi-heure.
  llmTimeoutMs: z.number().int().min(30_000).max(1_800_000).default(180_000),
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
      lmstudioBackupBaseUrl: data.lmstudioBackupBaseUrl || null,
      lmstudioModelId: data.lmstudioModelId,
      lmstudioTextModelId: data.lmstudioTextModelId,
      lmstudioBackupModelId: data.lmstudioBackupModelId,
      lmstudioBackupTextModelId: data.lmstudioBackupTextModelId,
      ollamaBaseUrl: data.ollamaBaseUrl,
      ollamaModel: data.ollamaModel,
      llmTimeoutMs: data.llmTimeoutMs,
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
