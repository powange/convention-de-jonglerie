import { prisma } from '../../utils/prisma'

// Préférences par défaut (tout activé)
const defaultPreferences = {
  volunteerReminders: true,
  applicationUpdates: true,
  conventionNews: true,
  systemNotifications: true,
  carpoolUpdates: true,
}

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: event.context.user.id },
      select: {
        notificationPreferences: true,
      },
    })

    // Si l'utilisateur n'a pas de préférences, retourner les défauts
    const preferences = user?.notificationPreferences || defaultPreferences

    return {
      success: true,
      preferences,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des préférences de notifications:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des préférences',
    })
  }
})
