import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier que l'édition existe
    await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition introuvable',
    })

    const userWithAttendance = await prisma.user.findUnique({
      where: { id: user.id },
      include: { attendingEditions: true },
    })

    if (!userWithAttendance) {
      throw createError({
        status: 404,
        message: 'User not found',
      })
    }

    const isAttending = userWithAttendance.attendingEditions.some(
      (edition) => edition.id === editionId
    )

    if (isAttending) {
      // Remove from attendance
      await prisma.user.update({
        where: { id: user.id },
        data: {
          attendingEditions: {
            disconnect: { id: editionId },
          },
        },
      })
      return createSuccessResponse({ isAttending: false })
    } else {
      // Add to attendance
      await prisma.user.update({
        where: { id: user.id },
        data: {
          attendingEditions: {
            connect: { id: editionId },
          },
        },
      })
      return createSuccessResponse({ isAttending: true })
    }
  },
  { operationName: 'ToggleEditionAttendance' }
)
