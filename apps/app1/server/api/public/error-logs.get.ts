import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireApiToken } from '#server/utils/public-api-auth'

/**
 * API publique : liste des erreurs d'API **non résolues** (`resolved = false`).
 *
 * Mêmes erreurs que la page d'administration `/admin/error-logs`, restreintes
 * aux non résolues. Destinée à la supervision externe (monitoring partenaire).
 *
 * Authentification par token d'API (scope `error-logs`) :
 *   GET /api/public/error-logs?token=<token>
 *   ou en-tête `Authorization: Bearer <token>`
 *
 * ⚠️ Seuls des champs NON sensibles sont exposés (pas d'IP, user-agent,
 * utilisateur, body, headers, stack…), car l'endpoint est public.
 *
 * `referer` fait exception depuis qu'il a manqué : des `/api/editions/NaN` revenaient sans qu'on
 * puisse dire quelle page construisait cette URL, et le diagnostic s'arrêtait là. C'est une
 * adresse de notre propre site, sans donnée personnelle ; elle révèle en revanche quelles pages
 * existent à qui détient le token, ce qui a été jugé acceptable pour ce que le champ fait gagner.
 *
 * Paramètres :
 *   - `limit`  : nombre maximum d'entrées (défaut 100, max 500)
 *   - `cursor` : id du dernier log de la page précédente (pagination par curseur)
 *   - `since`  : date ISO ; ne renvoyer que les erreurs créées après cette date
 */
export default wrapApiHandler(
  async (event) => {
    await requireApiToken(event, 'error-logs')

    const query = getQuery(event)

    const limit = Math.min(Math.max(parseInt(query.limit as string) || 100, 1), 500)
    const cursor = (query.cursor as string) || undefined

    const where: { resolved: false; createdAt?: { gt: Date } } = { resolved: false }

    if (query.since) {
      const since = new Date(query.since as string)
      if (!isNaN(since.getTime())) {
        where.createdAt = { gt: since }
      }
    }

    const total = await prisma.apiErrorLog.count({ where })

    const logs = await prisma.apiErrorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      // Champs NON sensibles uniquement
      select: {
        id: true,
        message: true,
        statusCode: true,
        errorType: true,
        method: true,
        path: true,
        // La page d'où venait la requête : sans elle, une erreur due à un lien mal construit ne
        // se remonte pas jusqu'à la page fautive.
        referer: true,
        createdAt: true,
      },
    })

    const nextCursor = logs.length === limit ? (logs[logs.length - 1]?.id ?? null) : null

    return {
      logs,
      pagination: {
        cursor: nextCursor,
        hasMore: logs.length === limit,
        limit,
        total,
      },
    }
  },
  { operationName: 'GetPublicErrorLogs' }
)
