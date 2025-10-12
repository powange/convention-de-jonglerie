import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

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

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  try {
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

    return {
      success: true,
      preferences,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des préférences de notifications:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des préférences',
    })
  }
})
