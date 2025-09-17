import { prisma } from './prisma'

export interface NotificationPreferences {
  volunteerReminders: boolean
  applicationUpdates: boolean
  conventionNews: boolean
  systemNotifications: boolean
  carpoolUpdates: boolean
}

// Préférences par défaut (tout activé)
const defaultPreferences: NotificationPreferences = {
  volunteerReminders: true,
  applicationUpdates: true,
  conventionNews: true,
  systemNotifications: true,
  carpoolUpdates: true,
}

/**
 * Récupère les préférences de notification d'un utilisateur
 */
export async function getUserNotificationPreferences(
  userId: number
): Promise<NotificationPreferences> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    })

    if (!user?.notificationPreferences) {
      return defaultPreferences
    }

    return {
      ...defaultPreferences,
      ...(user.notificationPreferences as NotificationPreferences),
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des préférences:', error)
    return defaultPreferences
  }
}

/**
 * Vérifie si un type de notification est autorisé pour un utilisateur
 */
export async function isNotificationAllowed(
  userId: number,
  notificationType: keyof NotificationPreferences
): Promise<boolean> {
  const preferences = await getUserNotificationPreferences(userId)
  return preferences[notificationType]
}

/**
 * Types de notifications mappés aux préférences
 */
export const NotificationTypeMapping = {
  // Rappels de créneaux bénévoles
  volunteer_reminder: 'volunteerReminders' as const,

  // Candidatures bénévoles
  volunteer_application_accepted: 'applicationUpdates' as const,
  volunteer_application_rejected: 'applicationUpdates' as const,
  volunteer_application_modified: 'applicationUpdates' as const,

  // Nouvelles conventions
  new_convention: 'conventionNews' as const,

  // Covoiturage
  carpool_booking_received: 'carpoolUpdates' as const,
  carpool_booking_accepted: 'carpoolUpdates' as const,
  carpool_booking_rejected: 'carpoolUpdates' as const,
  carpool_booking_cancelled: 'carpoolUpdates' as const,

  // Système
  system_notification: 'systemNotifications' as const,
  welcome: 'systemNotifications' as const,
  system_error: 'systemNotifications' as const,
} as const

export type NotificationType = keyof typeof NotificationTypeMapping
