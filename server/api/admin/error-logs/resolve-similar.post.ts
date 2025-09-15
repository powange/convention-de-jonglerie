import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'
import { prisma } from '../../../utils/prisma'

const requestSchema = z.object({
  message: z.string().min(1, 'Le message est requis'),
  adminNotes: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (même méthode que resolve.patch.ts)
  const adminUser = await requireGlobalAdminWithDbCheck(event)

  const body = await readBody(event).catch(() => ({}))
  const { message, adminNotes } = requestSchema.parse(body)

  try {
    // Marquer tous les logs avec le même message comme résolus
    const result = await prisma.apiErrorLog.updateMany({
      where: {
        message: message,
        resolved: false,
      },
      data: {
        resolved: true,
        resolvedBy: adminUser.id,
        resolvedAt: new Date(),
        adminNotes: adminNotes || `Résolu en masse - logs identiques`,
        updatedAt: new Date(),
      },
    })

    return {
      success: true,
      message: `${result.count} log(s) identique(s) marqué(s) comme résolu(s)`,
      count: result.count,
    }
  } catch (error) {
    console.error('Erreur lors de la résolution en masse:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la résolution des logs',
    })
  }
})
