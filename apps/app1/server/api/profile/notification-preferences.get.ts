import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { defaultPreferences } from '#server/utils/notification-preferences'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const userWithPrefs = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        notificationPreferences: true,
      },
    })

    // Si l'utilisateur n'a pas de préférences, retourner les défauts
    // Merge avec les defaults pour s'assurer que toutes les clés sont présentes
    const userPrefs = (userWithPrefs?.notificationPreferences as any) || {}
    const preferences = {
      ...defaultPreferences,
      ...userPrefs,
    }

    return createSuccessResponse({ preferences })
  },
  { operationName: 'GetNotificationPreferences' }
)
