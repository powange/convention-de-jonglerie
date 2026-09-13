import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { composantesDEmpreinte } from '~~/shared/utils/empreinte-erreur'

/**
 * Résout d'un coup toutes les entrées qui décrivent le MÊME problème.
 *
 * « Le même » se juge sur l'empreinte à quatre composantes (`~~/shared/utils/empreinte-erreur.ts`)
 * et non sur le seul message, comme c'était le cas. Le `where` était `{ message, resolved: false }` :
 * marquer résolu un « Données invalides » sur une route les résolvait sur TOUTES les autres, parce
 * qu'un message de validation générique est partagé par des dizaines d'endpoints. Rien à l'écran
 * n'indiquait cette portée, et l'opération est irréversible.
 *
 * ⚠️ Le corps attendu a changé : le message ne suffit plus. Cet endpoint n'est appelé que par
 * `/admin/error-logs` ; un appel resté à l'ancienne forme est refusé par la validation plutôt que
 * d'agir trop largement, ce qui est le bon sens de l'échec pour une action destructrice.
 */
const requestSchema = z.object({
  // Nullable : la colonne l'est, et une entrée sans type doit rester résoluble.
  errorType: z.string().nullable().optional(),
  method: z.string().min(1, 'La méthode est requise'),
  path: z.string().min(1, 'Le chemin est requis'),
  message: z.string().min(1, 'Le message est requis'),
  adminNotes: z.string().max(1000).optional(),
})

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (même méthode que resolve.patch.ts)
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event).catch(() => ({}))
    const parsed = requestSchema.parse(body)

    const { errorType, method, path, message } = composantesDEmpreinte(parsed)

    const result = await prisma.apiErrorLog.updateMany({
      where: {
        // `errorType: null` filtre bien sur IS NULL côté Prisma : une entrée sans type ne se
        // confond donc pas avec les autres.
        errorType,
        method,
        path,
        message,
        resolved: false,
      },
      data: {
        resolved: true,
        resolvedBy: adminUser.id,
        resolvedAt: new Date(),
        adminNotes: parsed.adminNotes || `Résolu en masse — ${method} ${path}`,
        updatedAt: new Date(),
      },
    })

    return createSuccessResponse(
      { count: result.count },
      `${result.count} entrée(s) résolue(s) sur ${method} ${path}`
    )
  },
  { operationName: 'ResolveSimilarErrorLogs' }
)
