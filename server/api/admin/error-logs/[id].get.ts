import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    const logId = getRouterParam(event, 'id')
    if (!logId) {
      throw createError({ status: 400, message: 'ID du log requis' })
    }

    // Récupération du log avec tous les détails
    const errorLog = await fetchResourceOrFail(prisma.apiErrorLog, logId, {
      errorMessage: "Log d'erreur introuvable",
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

    return errorLog
  },
  { operationName: 'GetErrorLogDetails' }
)
