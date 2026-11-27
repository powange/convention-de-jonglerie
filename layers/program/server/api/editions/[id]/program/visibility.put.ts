import { z } from 'zod'

import { canManageProgram } from '#program/server/utils/permissions/program-permissions'
import { useProgramPorts } from '#server/program/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Rend la page publique du programme visible des visiteurs, ou la masque
 * (`{ programPagePublic }`).
 *
 * Point propre au layer : la page de composition appelait la mise à jour GÉNÉRALE de l'édition
 * (`PUT /api/editions/:id`), qui n'existe que dans app1. L'écriture passe par le port de l'app
 * hôte. Droit : `canManageProgram`, celui de toutes les écritures du programme.
 */
const bodySchema = z.object({ programPagePublic: z.boolean() })

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    if (!(await canManageProgram(editionId, user, event))) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }
    const corps = bodySchema.safeParse(await readBody(event))
    if (!corps.success) throw createError({ status: 400, message: 'Données invalides' })
    await useProgramPorts().enregistrerPagePublique(editionId, corps.data.programPagePublic)
    return createSuccessResponse({ programPagePublic: corps.data.programPagePublic })
  },
  { operationName: 'Visibilité du programme' }
)
