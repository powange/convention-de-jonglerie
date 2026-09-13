import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'

/**
 * `adminNotes` distingue TROIS cas, et c'est le cœur du correctif.
 *
 * Absent   → on ne touche pas au champ.
 * Vide ou `null` → effacement demandé explicitement.
 * Renseigné → remplacement.
 *
 * Le champ était écrit sans condition (`adminNotes: parsed.adminNotes || null`), si bien que toute
 * bascule du statut sans renvoyer les notes les effaçait. Le chemin rapide depuis le tableau est
 * précisément dans ce cas : il bascule un statut, il n'a rien à dire des notes. Le diagnostic écrit
 * à la main par un administrateur disparaissait donc au premier clic de quelqu'un d'autre.
 */
const bodySchema = z.object({
  resolved: z.boolean(),
  adminNotes: z.string().max(1000).nullable().optional(),
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

    // Une absence laisse les notes en place ; seule une valeur fournie les remplace ou les efface.
    // `undefined` ne peut PAS être passé à Prisma pour dire « ne touche pas » de façon lisible : la
    // clé est simplement ignorée, ce qui marche mais se lit comme un oubli. On construit donc la
    // donnée explicitement.
    const notesFournies = parsed.adminNotes !== undefined

    // Mettre à jour le statut de résolution
    const updatedLog = await prisma.apiErrorLog.update({
      where: { id: logId },
      data: {
        resolved: parsed.resolved,
        resolvedBy: parsed.resolved ? adminUser.id : null,
        resolvedAt: parsed.resolved ? new Date() : null,
        ...(notesFournies ? { adminNotes: parsed.adminNotes || null } : {}),
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
