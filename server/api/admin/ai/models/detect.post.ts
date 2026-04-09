import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { AI_TIMEOUTS } from '#server/utils/ai-config'
import { wrapApiHandler } from '#server/utils/api-helpers'

const bodySchema = z.object({
  baseUrl: z.string().url(),
})

/**
 * POST /api/admin/ai/models/detect
 * Auto-détecte les modèles chargés dans LM Studio via l'API /v1/models
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event)
    const { baseUrl } = bodySchema.parse(body)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        AI_TIMEOUTS.CONTEXT_LENGTH_DETECTION * 3 // 9s pour la détection
      )

      const response = await fetch(`${baseUrl}/v1/models`, {
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw createError({
          statusCode: 502,
          message: `LM Studio a répondu avec le statut ${response.status}`,
        })
      }

      const data = await response.json()

      if (!data.data || !Array.isArray(data.data)) {
        return { models: [] }
      }

      const models = data.data.map(
        (model: { id: string; context_length?: number; owned_by?: string }) => ({
          modelId: model.id,
          name: model.id,
          contextLength: model.context_length || null,
          ownedBy: model.owned_by || null,
        })
      )

      return { models }
    } catch (error: any) {
      if (error.statusCode) throw error

      if (error.name === 'AbortError') {
        throw createError({
          statusCode: 504,
          message: 'Timeout lors de la connexion à LM Studio',
        })
      }

      throw createError({
        statusCode: 502,
        message: `Impossible de se connecter à LM Studio: ${error.message}`,
      })
    }
  },
  { operationName: 'DetectAIModels' }
)
