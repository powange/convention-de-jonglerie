export interface NotificationPreferences {
  volunteerReminders: boolean
  applicationUpdates: boolean
  conventionNews: boolean
  systemNotifications: boolean
  carpoolUpdates: boolean
  artistUpdates: boolean
  /**
   * Les messages de la messagerie.
   *
   * ⚠️ AUCUNE DES SIX AUTRES PRÉFÉRENCES NE LES COUVRAIT. Les messages n'appellent pas
   * `NotificationService.create` : ils envoient un push directement, donc sans passer par
   * `isNotificationAllowed`. Un membre d'une équipe de quarante personnes actives recevait un push
   * par message de groupe, sans autre issue que de couper TOUT le push de son compte.
   */
  messengerMessages: boolean
  // Préférences email pour chaque type de notification
  emailVolunteerReminders: boolean
  emailApplicationUpdates: boolean
  emailConventionNews: boolean
  emailSystemNotifications: boolean
  emailCarpoolUpdates: boolean
  emailArtistUpdates: boolean
  /**
   * ⚠️ AUCUN COURRIEL N'EST ENVOYÉ POUR UN MESSAGE, et aucun interrupteur n'est proposé pour
   * celui-ci : une case qui promet des courriels que rien n'envoie est pire que pas de case.
   *
   * La clé existe quand même, et à `false` : `isEmailNotificationAllowed` déduit le nom de la clé
   * d'e-mail de celui de la préférence (`messengerMessages` → `emailMessengerMessages`) et rend
   * `true` quand elle est absente. Sans cette ligne, brancher un courriel de messagerie plus tard
   * l'enverrait à tout le monde d'emblée.
   */
  emailMessengerMessages: boolean
}

// Préférences par défaut : notifications in-app activées, emails désactivés
export const defaultPreferences: NotificationPreferences = {
  volunteerReminders: true,
  applicationUpdates: true,
  conventionNews: true,
  systemNotifications: true,
  carpoolUpdates: true,
  artistUpdates: true,
  messengerMessages: true,
  // Les notifications email sont désactivées par défaut pour éviter de spammer ;
  // chaque utilisateur peut les réactiver depuis ses préférences.
  emailVolunteerReminders: false,
  emailApplicationUpdates: false,
  emailConventionNews: false,
  emailSystemNotifications: false,
  emailCarpoolUpdates: false,
  emailArtistUpdates: false,
  emailMessengerMessages: false,
}

/**
 * Décide d'après des préférences DÉJÀ CHARGÉES, sans repasser par la base.
 *
 * ⚠️ POURQUOI CETTE PORTE EXISTE À CÔTÉ DE [isNotificationAllowed]. L'envoi d'un message de
 * messagerie boucle sur les participants : interroger la base par destinataire ajouterait une
 * requête par personne à chaque message, alors que la préférence peut être lue dans le même
 * `select` que le reste. La règle, elle, ne doit exister qu'une fois — d'où cette fonction, dont
 * [isNotificationAllowed] n'est que la variante qui charge d'abord.
 */
export function notificationAutoriseeDapres(
  preferencesEnBase: unknown,
  notificationType: keyof NotificationPreferences
): boolean {
  const preferences = {
    ...defaultPreferences,
    ...((preferencesEnBase as Partial<NotificationPreferences> | null) ?? {}),
  }
  return preferences[notificationType] ?? true
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
  return notificationAutoriseeDapres(preferences, notificationType)
}

/**
 * Vérifie si l'envoi d'email est autorisé pour un type de notification
 */
export async function isEmailNotificationAllowed(
  userId: number,
  notificationType: keyof NotificationPreferences
): Promise<boolean> {
  const preferences = await getUserNotificationPreferences(userId)
  // Convertir le type de notification en clé d'email
  const emailKey =
    `email${notificationType.charAt(0).toUpperCase()}${notificationType.slice(1)}` as keyof NotificationPreferences
  return preferences[emailKey] ?? true // Par défaut activé si pas défini
}

/**
 * Types de notifications mappés aux préférences
 */
export const NotificationTypeMapping = {
  // Rappels de créneaux bénévoles
  volunteer_reminder: 'volunteerReminders' as const,
  volunteer_schedule: 'volunteerReminders' as const,

  // Candidatures bénévoles
  volunteer_application_submitted: 'applicationUpdates' as const,
  // Reçue par les organisateurs qui gèrent les bénévoles, pas par le candidat
  volunteer_application_received: 'applicationUpdates' as const,
  volunteer_application_accepted: 'applicationUpdates' as const,
  volunteer_application_rejected: 'applicationUpdates' as const,
  volunteer_application_modified: 'applicationUpdates' as const,
  volunteer_arrival: 'applicationUpdates' as const,

  // Nouvelles conventions
  new_convention: 'conventionNews' as const,

  // Covoiturage
  carpool_booking_received: 'carpoolUpdates' as const,
  carpool_booking_accepted: 'carpoolUpdates' as const,
  carpool_booking_rejected: 'carpoolUpdates' as const,
  carpool_booking_cancelled: 'carpoolUpdates' as const,
  /*
   * Le commentaire suit le MÊME réglage que les réservations, et c'est ce que le libellé promet
   * déjà : « Soyez notifié des réservations ET MESSAGES de covoiturage ». Un réglage séparé aurait
   * créé une case que personne n'a demandée, pour une promesse qui existait sans être tenue.
   */
  carpool_comment_received: 'carpoolUpdates' as const,
  carpool_booking_revoked: 'carpoolUpdates' as const,
  /*
   * La suppression et la modification d'une offre suivent le même réglage, pour la même raison : ce
   * sont des nouvelles de SA réservation, pas une catégorie à part. Les décrocher de `carpoolUpdates`
   * permettrait d'accepter une place et de ne pas apprendre qu'elle a disparu.
   */
  carpool_offer_deleted: 'carpoolUpdates' as const,
  carpool_offer_changed: 'carpoolUpdates' as const,

  // Artistes
  artist_arrival: 'artistUpdates' as const,

  // Éditions
  edition_published: 'conventionNews' as const,

  // Organisateurs
  organizer_added: 'conventionNews' as const,

  // Appels à spectacles et candidatures artiste
  show_call_opened: 'artistUpdates' as const,
  show_application_submitted: 'artistUpdates' as const,
  show_application_accepted: 'artistUpdates' as const,
  show_application_rejected: 'artistUpdates' as const,

  // Dons
  coffee_donation_received: 'systemNotifications' as const,

  // Système
  system_notification: 'systemNotifications' as const,
  welcome: 'systemNotifications' as const,
  system_error: 'systemNotifications' as const,
} as const

export type NotificationType = keyof typeof NotificationTypeMapping
