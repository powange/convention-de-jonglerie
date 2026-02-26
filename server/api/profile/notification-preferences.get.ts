import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

// Préférences par défaut (tout activé)
const defaultPreferences = {
  volunteerReminders: true,
  applicationUpdates: true,
  conventionNews: true,
  systemNotifications: true,
  carpoolUpdates: true,
  // Par défaut, les notifications email sont activées
  emailVolunteerReminders: true,
  emailApplicationUpdates: true,
  emailConventionNews: true,
  emailSystemNotifications: true,
  emailCarpoolUpdates: true,
}

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
