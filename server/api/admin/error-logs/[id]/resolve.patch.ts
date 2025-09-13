import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '../../../../utils/admin-auth'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  resolved: z.boolean(),
  adminNotes: z.string().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  const adminUser = await requireGlobalAdminWithDbCheck(event)

  const logId = getRouterParam(event, 'id')
  if (!logId) {
    throw createError({ statusCode: 400, statusMessage: 'ID du log requis' })
  }

  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.parse(body)

  // Vérifier que le log existe
  const existingLog = await prisma.apiErrorLog.findUnique({
    where: { id: logId },
    select: { id: true, resolved: true },
  })

  if (!existingLog) {
    throw createError({ statusCode: 404, statusMessage: "Log d'erreur introuvable" })
  }

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

  return {
    success: true,
    log: updatedLog,
    message: parsed.resolved ? 'Log marqué comme résolu' : 'Log marqué comme non résolu',
  }
})
