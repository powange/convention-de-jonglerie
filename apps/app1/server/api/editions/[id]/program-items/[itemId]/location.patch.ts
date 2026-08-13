import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageProgram } from '#server/utils/permissions/program-permissions'
import { assurerLieuDeLEdition } from '#server/utils/program-location'
import { programItemLocationSchema } from '#server/utils/program-validation'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Change le lieu d'un élément, sans toucher au reste.
 *
 * Un point dédié plutôt que le `PUT` : celui-ci attend l'élément complet, parce que la règle
 * « fin après début » ne se vérifie pas sur un fragment. Depuis la frise, on ne dispose que d'une
 * ligne — lui faire réémettre tout l'élément pour changer son lieu exposerait à réécrire un titre
 * ou un horaire modifié entre-temps ailleurs.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = Number(getRouterParam(event, 'itemId'))
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw createError({ status: 400, message: 'Identifiant d’élément invalide' })
    }

    const allowed = await canManageProgram(editionId, user, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const { locationName, zoneId, markerId } = programItemLocationSchema.parse(
      await readBody(event)
    )

    // Sans ce contrôle, un identifiant deviné rattacherait le créneau à la carte d'une autre
    // convention. Les clés étrangères garantissent que la zone existe, pas qu'elle est la bonne.
    await assurerLieuDeLEdition(editionId, zoneId, markerId)

    // Le filtre sur l'édition empêche d'atteindre l'élément d'une autre convention.
    const misAJour = await prisma.editionProgramItem.updateMany({
      where: { id: itemId, editionId },
      data: { locationName, zoneId, markerId },
    })
    if (misAJour.count === 0) {
      throw createError({ status: 404, message: 'Élément de programmation introuvable' })
    }

    return { success: true, data: { locationName, zoneId, markerId } }
  },
  { operationName: 'Lieu d’un élément de programmation' }
)
