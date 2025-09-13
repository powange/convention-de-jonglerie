import { requireAuth } from '../../../utils/auth-utils'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(event.context.params?.id as string)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid Edition ID',
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
        statusMessage: 'Edition introuvable',
      })
    }

    const userWithAttendance = await prisma.user.findUnique({
      where: { id: user.id },
      include: { attendingEditions: true },
    })

    if (!userWithAttendance) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found',
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
      statusMessage: 'Internal Server Error',
    })
  }
})
