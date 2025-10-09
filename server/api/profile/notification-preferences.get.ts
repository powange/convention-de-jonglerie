import { prisma } from '../../utils/prisma'

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
  if (!event.context.user) {
    throw createError({ statusCode: 401, message: 'Non authentifié' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: event.context.user.id },
      select: {
        notificationPreferences: true,
      },
    })

    // Si l'utilisateur n'a pas de préférences, retourner les défauts
    // Merge avec les defaults pour s'assurer que toutes les clés sont présentes
    const userPrefs = (user?.notificationPreferences as any) || {}
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
