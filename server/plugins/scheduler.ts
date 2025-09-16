import cron from 'node-cron'

export default defineNitroPlugin(async (nitroApp) => {
  // Ne lancer les crons qu'en production ou si explicitement demandé
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    console.log('🕒 Initialisation du système de cron...')

    // Rappels aux bénévoles (toutes les minutes pour vérifier les créneaux dans 30min)
    cron.schedule('* * * * *', async () => {
      try {
        await runTask('volunteer-reminders')
      } catch (error) {
        console.error('Erreur lors de l\'exécution de volunteer-reminders:', error)
      }
    })

    // Notifications conventions favorites (quotidien à 10h)
    cron.schedule('0 10 * * *', async () => {
      try {
        await runTask('convention-favorites-reminders')
      } catch (error) {
        console.error('Erreur lors de l\'exécution de convention-favorites-reminders:', error)
      }
    })

    // Nettoyage des tokens expirés (quotidien à 2h du matin)
    cron.schedule('0 2 * * *', async () => {
      try {
        await runTask('cleanup-expired-tokens')
      } catch (error) {
        console.error('Erreur lors de l\'exécution de cleanup-expired-tokens:', error)
      }
    })

    // Nettoyage des logs d'erreur résolus (mensuel, 1er du mois à 3h)
    cron.schedule('0 3 1 * *', async () => {
      try {
        await runTask('cleanup-resolved-error-logs')
      } catch (error) {
        console.error('Erreur lors de l\'exécution de cleanup-resolved-error-logs:', error)
      }
    })

    console.log('✅ Système de cron initialisé avec succès')
  } else {
    console.log('⏸️ Système de cron désactivé (développement)')
  }
})