import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const requestSchema = z.object({
  message: z.string().min(1, 'Le message est requis'),
  adminNotes: z.string().optional(),
})

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (même méthode que resolve.patch.ts)
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event).catch(() => ({}))
    const { message, adminNotes } = requestSchema.parse(body)

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
  },
  { operationName: 'ResolveSimilarErrorLogs' }
)
