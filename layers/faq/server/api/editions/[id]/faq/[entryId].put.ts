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
  question: z.string().trim().min(1).max(500).optional(),
  answer: z.string().trim().min(1).max(20000).optional(),
  isPublic: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const entryId = Number(getRouterParam(event, 'entryId'))
    if (isNaN(entryId)) {
      throw createError({ status: 400, message: 'Identifiant invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canEditEdition(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const existing = await prisma.faqEntry.findFirst({
      where: { id: entryId, editionId },
      select: { id: true },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Entrée introuvable' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const updateData: Record<string, unknown> = {}
    if (data.question !== undefined) updateData.question = data.question
    if (data.answer !== undefined) updateData.answer = data.answer
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder

    const entry = await prisma.faqEntry.update({
      where: { id: entryId },
      data: updateData,
    })

    return createSuccessResponse({ entry })
  },
  { operationName: 'UpdateFaqEntry' }
)
