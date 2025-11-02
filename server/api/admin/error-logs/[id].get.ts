import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdminWithDbCheck(event)

  const logId = getRouterParam(event, 'id')
  if (!logId) {
    throw createError({ statusCode: 400, message: 'ID du log requis' })
  }

  // Récupération du log avec tous les détails
  const errorLog = await prisma.apiErrorLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      message: true,
      statusCode: true,
      stack: true,
      errorType: true,
      method: true,
      url: true,
      path: true,
      userAgent: true,
      ip: true,
      referer: true, // Page d'origine
      origin: true, // Domaine d'origine
      headers: true,
      body: true,
      queryParams: true,
      prismaDetails: true,
      resolved: true,
      resolvedBy: true,
      resolvedAt: true,
      adminNotes: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          pseudo: true,
          email: true,
          nom: true,
          prenom: true,
          isGlobalAdmin: true,
        },
      },
    },
  })

  if (!errorLog) {
    throw createError({ statusCode: 404, message: "Log d'erreur introuvable" })
  }

  return errorLog
})
