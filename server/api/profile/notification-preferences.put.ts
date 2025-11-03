import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const notificationPreferencesSchema = z.object({
  volunteerReminders: z.boolean(),
  applicationUpdates: z.boolean(),
  conventionNews: z.boolean(),
  systemNotifications: z.boolean(),
  carpoolUpdates: z.boolean(),
  // Préférences email pour chaque type
  emailVolunteerReminders: z.boolean(),
  emailApplicationUpdates: z.boolean(),
  emailConventionNews: z.boolean(),
  emailSystemNotifications: z.boolean(),
  emailCarpoolUpdates: z.boolean(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)
    const preferences = notificationPreferencesSchema.parse(body)

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
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
  },
  { operationName: 'UpdateNotificationPreferences' }
)
