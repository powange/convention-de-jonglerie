import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(event.context.params?.id as string)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid Edition ID',
    })
  }

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Edition introuvable',
      })
    }

    const userWithAttendance = await prisma.user.findUnique({
      where: { id: user.id },
      include: { attendingEditions: true },
    })

    if (!userWithAttendance) {
      throw createError({
        statusCode: 404,
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
      return { isAttending: false }
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
      return { isAttending: true }
    }
  } catch (error) {
    console.error('Error toggling attendance:', error)
    throw createError({
      statusCode: 500,
      message: 'Internal Server Error',
    })
  }
})
