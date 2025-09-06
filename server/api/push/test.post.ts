import { NotificationService } from '../../utils/notification-service'

export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  try {
    // Créer une notification de test
    const notification = await NotificationService.create({
      userId: event.context.user.id,
      type: 'INFO',
      title: 'Test de notification push 📱',
      message: 'Si vous voyez cette notification, les push notifications fonctionnent correctement !',
      category: 'system',
      actionUrl: '/notifications',
      actionText: 'Voir les notifications',
    })

    // La notification push sera envoyée automatiquement par le service modifié
    
    return { 
      success: true, 
      message: 'Notification de test envoyée',
      notificationId: notification.id,
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de test:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de l\'envoi de la notification de test',
    })
  }
})