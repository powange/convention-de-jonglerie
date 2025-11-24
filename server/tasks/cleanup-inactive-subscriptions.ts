import { pushNotificationService } from '@@/server/utils/push-notification-service'

export default defineTask({
  meta: {
    name: 'cleanup-inactive-subscriptions',
    description: 'Clean up inactive push subscriptions older than 30 days',
  },
  async run({ payload: _payload }) {
    console.log('🗑️ Exécution de la tâche: nettoyage des subscriptions inactives')

    try {
      // Nettoyer les anciennes subscriptions inactives (plus de 30 jours)
      const count = await pushNotificationService.cleanupInactiveSubscriptions()

      if (count > 0) {
        console.log(`✅ Tâche terminée: ${count} subscriptions inactives supprimées`)
      } else {
        console.log('✅ Tâche terminée: aucune subscription inactive à nettoyer')
      }

      return {
        success: true,
        subscriptionsCleaned: count,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage des subscriptions inactives:', error)
      throw error
    }
  },
})
