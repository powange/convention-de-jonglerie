import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'
import { validateAndSanitize } from '@@/server/utils/validation-schemas'
import { z } from 'zod'

const resolveSchema = z.object({
  resolved: z.boolean(),
  adminNotes: z
    .string()
    .max(2000, 'Les notes admin ne peuvent pas dépasser 2000 caractères')
    .optional(),
})

export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)
    const feedbackId = validateResourceId(event, 'id', 'feedback')

    const body = await readBody(event)
    const validatedData = validateAndSanitize(resolveSchema, body)
    const { resolved, adminNotes } = validatedData

    // Vérifier que le feedback existe
    await fetchResourceOrFail(prisma.feedback, feedbackId, {
      errorMessage: 'Feedback introuvable',
    })

    // Mettre à jour le feedback
    const updatedFeedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        resolved,
        adminNotes,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            email: true,
          },
        },
      },
    })

    return {
      success: true,
      message: resolved ? 'Feedback marqué comme résolu' : 'Feedback marqué comme non résolu',
      feedback: updatedFeedback,
    }
  },
  { operationName: 'ResolveFeedback' }
)
