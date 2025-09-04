import { z } from 'zod'

import { requireUserSession } from '#imports'

import { logApiError } from '../../utils/error-logger'
import { prisma } from '../../utils/prisma'

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
  // Vérifier l'authentification via la session scellée
  const { user } = await requireUserSession(event)
  const userId = user.id

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Token invalide',
    })
  }

  // Vérifier que l'utilisateur est un super administrateur
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGlobalAdmin: true },
  })

  if (!currentUser?.isGlobalAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Accès refusé - Droits super administrateur requis',
    })
  }

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
        throw createError({ statusCode: 400, statusMessage: 'Erreur de validation de test' })
      }
      break
    }

    case 'database': {
      // Simuler une erreur de base de données
      const dbError = new Error('Connection timeout to database')
      dbError.name = 'PrismaClientKnownRequestError'
      throw createError({
        statusCode: 500,
        statusMessage: 'Erreur de base de données de test',
        cause: dbError,
      })
    }

    case 'authentication':
      throw createError({
        statusCode: 401,
        statusMessage: "Token d'authentification invalide (test)",
      })

    case 'authorization':
      throw createError({
        statusCode: 403,
        statusMessage: 'Permissions insuffisantes pour cette ressource (test)',
      })

    case 'not-found':
      throw createError({ statusCode: 404, statusMessage: 'Ressource de test introuvable' })

    case 'server-error':
      throw createError({ statusCode: 500, statusMessage: 'Erreur interne du serveur (test)' })

    case 'custom': {
      const customError = new Error(parsed.message || 'Erreur personnalisée de test')
      customError.name = 'CustomTestError'
      customError.stack = `CustomTestError: ${customError.message}
    at testErrorEndpoint (/api/admin/test-error-logging:post)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)`

      throw createError({
        statusCode: 500,
        statusMessage: customError.message,
        cause: customError,
      })
    }

    default:
      throw createError({ statusCode: 400, statusMessage: "Type d'erreur de test non reconnu" })
  }
})
