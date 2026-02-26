import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { handleValidationError } from '#server/utils/validation-schemas'

const paramsSchema = z.object({
  id: z.string().transform(Number),
  userId: z.string().transform(Number),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const parseResult = paramsSchema.safeParse(event.context.params)
    if (!parseResult.success) {
      handleValidationError(parseResult.error)
    }

    const { id: editionId, userId } = parseResult.data

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

    const comment = await prisma.volunteerComment.findUnique({
      where: {
        userId_editionId: {
          userId,
          editionId,
        },
      },
    })

    return {
      comment: comment || null,
    }
  },
  { operationName: 'GetVolunteerComment' }
)
