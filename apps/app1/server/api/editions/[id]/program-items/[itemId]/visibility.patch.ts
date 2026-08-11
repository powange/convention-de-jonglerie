import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditEditionById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const schema = z.object({ isPublic: z.boolean() })

/**
 * Publie ou remet en brouillon un élément, sans toucher au reste.
 *
 * Un point dédié plutôt que le `PUT` : celui-ci attend l'élément complet, parce que la règle
 * « fin après début » ne se vérifie pas sur un fragment. Depuis la frise, on ne dispose que d'une
 * ligne — lui faire réémettre tout l'élément pour changer une case exposerait à écraser un champ
 * au passage.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = Number(getRouterParam(event, 'itemId'))
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw createError({ status: 400, message: 'Identifiant d’élément invalide' })
    }

    const allowed = await canEditEditionById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const { isPublic } = schema.parse(await readBody(event))

    // Le filtre sur l'édition empêche d'atteindre l'élément d'une autre convention.
    const misAJour = await prisma.editionProgramItem.updateMany({
      where: { id: itemId, editionId },
      data: { isPublic },
    })
    if (misAJour.count === 0) {
      throw createError({ status: 404, message: 'Élément de programmation introuvable' })
    }

    return { success: true, data: { isPublic } }
  },
  { operationName: 'Visibilité d’un élément de programmation' }
)
