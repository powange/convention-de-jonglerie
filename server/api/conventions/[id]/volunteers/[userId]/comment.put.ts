import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { handleValidationError } from '#server/utils/validation-schemas'

const paramsSchema = z.object({
  id: z.string().transform(Number),
  userId: z.string().transform(Number),
})

const bodySchema = z.object({
  content: z.string().min(1, 'Le commentaire ne peut pas être vide').max(5000),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const parseParamsResult = paramsSchema.safeParse(event.context.params)
    if (!parseParamsResult.success) {
      handleValidationError(parseParamsResult.error)
    }

    const { id: editionId, userId } = parseParamsResult.data

    const body = await readBody(event)
    const parseBodyResult = bodySchema.safeParse(body)
    if (!parseBodyResult.success) {
      handleValidationError(parseBodyResult.error)
    }

    const { content } = parseBodyResult.data

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            organizers: {
              where: { userId: user.id },
            },
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        status: 404,
        statusText: 'Édition non trouvée',
      })
    }

    const isAuthor = edition.convention.authorId === user.id
    const isOrganizer = edition.convention.organizers.length > 0

    if (!isAuthor && !isOrganizer && !user.isGlobalAdmin) {
      throw createError({
        status: 403,
        statusText: "Vous n'avez pas les permissions nécessaires",
      })
    }

    const volunteer = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!volunteer) {
      throw createError({
        status: 404,
        statusText: 'Bénévole non trouvé',
      })
    }

    const comment = await prisma.volunteerComment.upsert({
      where: {
        userId_editionId: {
          userId,
          editionId,
        },
      },
      create: {
        userId,
        editionId,
        content,
      },
      update: {
        content,
      },
    })

    return createSuccessResponse({ comment })
  },
  { operationName: 'UpdateVolunteerComment' }
)
