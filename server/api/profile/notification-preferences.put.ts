import { z } from 'zod'

import { prisma } from '../../utils/prisma'

const notificationPreferencesSchema = z.object({
  volunteerReminders: z.boolean(),
  applicationUpdates: z.boolean(),
  conventionNews: z.boolean(),
  systemNotifications: z.boolean(),
  carpoolUpdates: z.boolean(),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  const body = await readBody(event)
  const preferences = notificationPreferencesSchema.parse(body)

  try {
    const updatedUser = await prisma.user.update({
      where: { id: event.context.user.id },
      data: {
        notificationPreferences: preferences,
      },
      select: {
        id: true,
        notificationPreferences: true,
      },
    })

    return {
      success: true,
      preferences: updatedUser.notificationPreferences,
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des préférences de notifications:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la sauvegarde des préférences',
    })
  }
})
