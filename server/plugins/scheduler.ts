import { CronJob } from 'cron'

export default defineNitroPlugin(async (_nitroApp) => {
  // Ne lancer les crons qu'en production ou si explicitement demandé
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    console.log('🕒 Initialisation du système de cron...')

    // Rappels aux bénévoles (toutes les minutes pour vérifier les créneaux dans 30min)
    CronJob.from({
      cronTime: '* * * * *',
      onTick: async () => {
        try {
          await runTask('volunteer-reminders')
        } catch (error) {
          console.error("Erreur lors de l'exécution de volunteer-reminders:", error)
        }
      },
      start: true,
    })

    // Notifications conventions favorites (quotidien à 10h)
    CronJob.from({
      cronTime: '0 10 * * *',
      onTick: async () => {
        try {
          await runTask('convention-favorites-reminders')
        } catch (error) {
          console.error("Erreur lors de l'exécution de convention-favorites-reminders:", error)
        }
      },
      start: true,
    })

    // Nettoyage des tokens expirés (quotidien à 2h du matin)
    CronJob.from({
      cronTime: '0 2 * * *',
      onTick: async () => {
        try {
          await runTask('cleanup-expired-tokens')
        } catch (error) {
          console.error("Erreur lors de l'exécution de cleanup-expired-tokens:", error)
        }
      },
      start: true,
    })

    // Nettoyage des logs d'erreur résolus (quotidien à 3h du matin)
    CronJob.from({
      cronTime: '0 3 * * *',
      onTick: async () => {
        try {
          await runTask('cleanup-resolved-error-logs')
        } catch (error) {
          console.error("Erreur lors de l'exécution de cleanup-resolved-error-logs:", error)
        }
      },
      start: true,
    })

    // Nettoyage des subscriptions push inactives (quotidien à 4h du matin)
    CronJob.from({
      cronTime: '0 4 * * *',
      onTick: async () => {
        try {
          await runTask('cleanup-inactive-subscriptions')
        } catch (error) {
          console.error("Erreur lors de l'exécution de cleanup-inactive-subscriptions:", error)
        }
      },
      start: true,
    })

    // Nettoyage des conversations vides (quotidien à 5h du matin)
    CronJob.from({
      cronTime: '0 5 * * *',
      onTick: async () => {
        try {
          await runTask('cleanup-empty-conversations')
        } catch (error) {
          console.error("Erreur lors de l'exécution de cleanup-empty-conversations:", error)
        }
      },
      start: true,
    })

    console.log('✅ Système de cron initialisé avec succès')
  } else {
    console.log('⏸️ Système de cron désactivé (développement)')
  }
})
