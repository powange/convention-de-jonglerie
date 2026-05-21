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
  question: z.string().trim().min(1, 'La question est requise').max(500),
  answer: z.string().trim().min(1, 'La réponse est requise').max(20000),
  isPublic: z.boolean().optional().default(false),
  displayOrder: z.number().int().optional(),
})

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

    let displayOrder = data.displayOrder
    if (displayOrder === undefined) {
      const last = await prisma.faqEntry.findFirst({
        where: { editionId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      })
      displayOrder = (last?.displayOrder ?? -1) + 1
    }

    const entry = await prisma.faqEntry.create({
      data: {
        editionId,
        question: data.question,
        answer: data.answer,
        isPublic: data.isPublic,
        displayOrder,
      },
    })

    return createSuccessResponse({ entry })
  },
  { operationName: 'CreateFaqEntry' }
)
