import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageProgram } from '#server/utils/permissions/program-permissions'
import { assurerLieuDeLEdition } from '#server/utils/program-location'
import { PROGRAM_ITEM_LIMITS, programItemSchema } from '#server/utils/program-validation'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageProgram(editionId, user, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const data = programItemSchema.parse(await readBody(event))
    await assurerLieuDeLEdition(editionId, data.zoneId, data.markerId)

    const count = await prisma.editionProgramItem.count({ where: { editionId } })
    if (count >= PROGRAM_ITEM_LIMITS.MAX_ITEMS_PER_EDITION) {
      throw createError({
        status: 400,
        message: `Limite de ${PROGRAM_ITEM_LIMITS.MAX_ITEMS_PER_EDITION} éléments atteinte pour cette édition`,
      })
    }

    const item = await prisma.editionProgramItem.create({
      data: {
        editionId,
        title: data.title,
        description: data.description ?? null,
        startDateTime: data.startDateTime,
        endDateTime: data.endDateTime ?? null,
        locationName: data.locationName ?? null,
        zoneId: data.zoneId ?? null,
        markerId: data.markerId ?? null,
        // Brouillon par défaut : un programme se compose sur des semaines.
        isPublic: data.isPublic ?? false,
      },
    })

    return { success: true, data: { item } }
  },
  { operationName: 'Création d’un élément de programmation' }
)
