import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { AI_TIMEOUTS } from '#server/utils/ai-config'
import { wrapApiHandler } from '#server/utils/api-helpers'

const bodySchema = z.object({
  baseUrl: z.string().url(),
})

/**
 * POST /api/admin/ai/models/ollama
 * Liste les modèles installés dans Ollama via l'API /api/tags
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

      const response = await fetch(`${baseUrl}/api/tags`, {
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw createError({
          statusCode: 502,
          message: `Ollama a répondu avec le statut ${response.status}`,
        })
      }

      const data = await response.json()

      if (!data.models || !Array.isArray(data.models)) {
        return { models: [] }
      }

      const models = data.models.map(
        (model: { name: string; size?: number; details?: { parameter_size?: string } }) => ({
          modelId: model.name,
          name: model.name,
          size: model.size ?? null,
          parameterSize: model.details?.parameter_size ?? null,
        })
      )

      return { models }
    } catch (error: any) {
      if (error.statusCode) throw error

      if (error.name === 'AbortError') {
        throw createError({
          statusCode: 504,
          message: 'Timeout lors de la connexion à Ollama',
        })
      }

      throw createError({
        statusCode: 502,
        message: `Impossible de se connecter à Ollama: ${error.message}`,
      })
    }
  },
  { operationName: 'DetectOllamaModels' }
)
