import { z } from 'zod'

import { useFaqPorts } from '#server/faq/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageFAQ,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Rend la page publique de la FAQ visible des visiteurs, ou la masque (`{ faqPagePublic }`).
 *
 * Point propre au layer : la page de gestion appelait la mise à jour GÉNÉRALE de l'édition
 * (`PUT /api/editions/:id`), qui n'existe que dans app1. L'écriture passe par le port de l'app
 * hôte (l'édition d'app1, l'événement de Flowvent). Droit : `canManageFAQ`.
 */
const bodySchema = z.object({ faqPagePublic: z.boolean() })

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) throw createError({ status: 404, message: 'Édition non trouvée' })
    if (!canManageFAQ(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }
    const corps = bodySchema.safeParse(await readBody(event))
    if (!corps.success) throw createError({ status: 400, message: 'Données invalides' })
    await useFaqPorts().directory.setFaqPagePublic(editionId, corps.data.faqPagePublic)
    return createSuccessResponse({ faqPagePublic: corps.data.faqPagePublic })
  },
  { operationName: 'UpdateFaqVisibility' }
)
