import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'

const bodySchema = z.object({
  resolved: z.boolean(),
  adminNotes: z.string().max(1000).optional(),
})

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    const logId = getRouterParam(event, 'id')
    if (!logId) {
      throw createError({ status: 400, message: 'ID du log requis' })
    }

    const body = await readBody(event).catch(() => ({}))
    const parsed = bodySchema.parse(body)

    // Vérifier que le log existe
    await fetchResourceOrFail(prisma.apiErrorLog, logId, {
      errorMessage: "Log d'erreur introuvable",
      select: { id: true, resolved: true },
    })

    // Mettre à jour le statut de résolution
    const updatedLog = await prisma.apiErrorLog.update({
      where: { id: logId },
      data: {
        resolved: parsed.resolved,
        resolvedBy: parsed.resolved ? adminUser.id : null,
        resolvedAt: parsed.resolved ? new Date() : null,
        adminNotes: parsed.adminNotes || null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        resolved: true,
        resolvedBy: true,
        resolvedAt: true,
        adminNotes: true,
        updatedAt: true,
      },
    })

    return createSuccessResponse(
      { log: updatedLog },
      parsed.resolved ? 'Log marqué comme résolu' : 'Log marqué comme non résolu'
    )
  },
  { operationName: 'ResolveErrorLog' }
)
