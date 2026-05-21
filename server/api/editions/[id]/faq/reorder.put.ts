import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canEditEdition,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  // Liste des IDs dans le nouvel ordre
  orderedIds: z.array(z.number().int().positive()).max(500),
})

/**
 * PUT /api/editions/[id]/faq/reorder
 *
 * Réordonne les entrées FAQ en fonction de l'ordre du tableau `orderedIds`.
 * `displayOrder` est réassigné selon l'index dans le tableau.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canEditEdition(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    // Vérifier que tous les IDs appartiennent bien à cette édition
    const entries = await prisma.faqEntry.findMany({
      where: { id: { in: data.orderedIds }, editionId },
      select: { id: true },
    })
    if (entries.length !== data.orderedIds.length) {
      throw createError({
        status: 400,
        message: "Certaines entrées n'appartiennent pas à cette édition",
      })
    }

    // Défense en profondeur : re-vérifier `editionId` dans chaque update.
    await prisma.$transaction(
      data.orderedIds.map((id, index) =>
        prisma.faqEntry.updateMany({
          where: { id, editionId },
          data: { displayOrder: index },
        })
      )
    )

    return createSuccessResponse({ reordered: data.orderedIds.length })
  },
  { operationName: 'ReorderFaqEntries' }
)
