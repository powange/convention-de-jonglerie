import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageProgram } from '#server/utils/permissions/program-permissions'
import { assurerLieuDeLEdition } from '#server/utils/program-location'
import { programItemSchema } from '#server/utils/program-validation'
import { validateEditionId } from '#server/utils/validation-helpers'

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

    // Le filtre porte aussi sur l'édition : sans lui, connaître un identifiant suffirait à
    // modifier l'élément d'une autre convention depuis une édition qu'on administre.
    const existant = await prisma.editionProgramItem.findFirst({
      where: { id: itemId, editionId },
      select: { id: true },
    })
    if (!existant) {
      throw createError({ status: 404, message: 'Élément de programmation introuvable' })
    }

    const data = programItemSchema.parse(await readBody(event))
    await assurerLieuDeLEdition(editionId, data.zoneId, data.markerId)

    const item = await prisma.editionProgramItem.update({
      where: { id: itemId },
      data: {
        title: data.title,
        description: data.description ?? null,
        startDateTime: data.startDateTime,
        endDateTime: data.endDateTime ?? null,
        locationName: data.locationName ?? null,
        zoneId: data.zoneId ?? null,
        markerId: data.markerId ?? null,
        ...(data.isPublic === undefined ? {} : { isPublic: data.isPublic }),
      },
    })

    return { success: true, data: { item } }
  },
  { operationName: 'Modification d’un élément de programmation' }
)
