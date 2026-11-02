import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const corps = z.object({
  actif: z.boolean().optional(),
  label: z.string().trim().max(120).nullable().optional(),
})

/**
 * Modifie une source : son activation, son libellé.
 *
 * ⚠️ La mise à jour est adressée par `{ id, editionId }` et non par `id` seul. Sans l'édition dans
 * le `where`, un organisateur d'une édition pourrait basculer la source d'une AUTRE en changeant
 * l'identifiant dans l'URL : la garde ci-dessus ne vérifie que ses droits sur l'édition du chemin,
 * pas l'appartenance de la ligne visée.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    await getEditionForEdit(editionId, user)

    const sourceId = Number(getRouterParam(event, 'sourceId'))
    if (!Number.isInteger(sourceId) || sourceId <= 0) {
      throw createError({ status: 400, message: 'Identifiant de source invalide' })
    }

    const champs = corps.parse(await readBody(event))
    if (champs.actif === undefined && champs.label === undefined) {
      throw createError({ status: 400, message: 'Rien à modifier' })
    }

    const resultat = await prisma.editionAnalysisSource.updateMany({
      where: { id: sourceId, editionId },
      data: {
        ...(champs.actif !== undefined ? { actif: champs.actif } : {}),
        ...(champs.label !== undefined ? { label: champs.label || null } : {}),
      },
    })

    // `updateMany` ne lève pas sur une ligne absente : il rend 0. Sans ce contrôle, modifier la
    // source d'une autre édition répondrait 200 en n'ayant rien fait — un succès mensonger.
    if (resultat.count === 0) {
      throw createError({ status: 404, message: 'Source introuvable pour cette édition' })
    }

    return createSuccessResponse({ id: sourceId, ...champs })
  },
  { operationName: 'ModifierSourceAnalyse' }
)
