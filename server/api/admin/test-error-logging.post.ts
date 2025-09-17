import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '../../utils/admin-auth'
import { logApiError } from '../../utils/error-logger'

const bodySchema = z.object({
  type: z.enum([
    'validation',
    'database',
    'authentication',
    'authorization',
    'not-found',
    'server-error',
    'custom',
  ]),
  message: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdminWithDbCheck(event)

  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.parse(body)

  // Générer différents types d'erreurs pour tester le système de logging
  switch (parsed.type) {
    case 'validation': {
      // Erreur de validation Zod
      const invalidSchema = z.object({ required: z.string() })
      try {
        invalidSchema.parse({ invalid: 'data' })
      } catch (error) {
        // Logger manuellement pour tester
        await logApiError({
          error: error as Error,
          statusCode: 400,
          event,
        })
        throw createError({ statusCode: 400, message: 'Erreur de validation de test' })
      }
      break
    }

    case 'database': {
      // Simuler une erreur de base de données
      const dbError = new Error('Connection timeout to database')
      dbError.name = 'PrismaClientKnownRequestError'
      throw createError({
        statusCode: 500,
        message: 'Erreur de base de données de test',
        cause: dbError,
      })
    }

    case 'authentication':
      throw createError({
        statusCode: 401,
        message: "Token d'authentification invalide (test)",
      })

    case 'authorization':
      throw createError({
        statusCode: 403,
        message: 'Permissions insuffisantes pour cette ressource (test)',
      })

    case 'not-found':
      throw createError({ statusCode: 404, message: 'Ressource de test introuvable' })

    case 'server-error':
      throw createError({ statusCode: 500, message: 'Erreur interne du serveur (test)' })

    case 'custom': {
      const customError = new Error(parsed.message || 'Erreur personnalisée de test')
      customError.name = 'CustomTestError'
      customError.stack = `CustomTestError: ${customError.message}
    at testErrorEndpoint (/api/admin/test-error-logging:post)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)`

      throw createError({
        statusCode: 500,
        message: customError.message,
        cause: customError,
      })
    }

    default:
      throw createError({ statusCode: 400, message: "Type d'erreur de test non reconnu" })
  }
})
