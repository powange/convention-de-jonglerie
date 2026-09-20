import { criteresDePurge, RETENTION_PAR_DEFAUT } from '~~/shared/utils/retention-journal-erreurs'

/**
 * La purge quotidienne du journal d'erreurs.
 *
 * Elle s'appelait `cleanup-resolved-error-logs` et se décrivait comme « Remove resolved error
 * logs older than 1 month ». Elle supprimait pourtant **aussi** les erreurs non résolues, c'est
 * à dire exactement celles que personne n'avait regardées. Un nom qui ment sur ce qu'on détruit
 * est pire qu'un nom absent : il dissuade d'aller lire.
 *
 * Le catalogue des tâches, lui, l'annonçait « Mensuel (1er du mois à 3h) » alors que
 * l'ordonnanceur la lance tous les jours. Les deux sont corrigés.
 *
 * Ce qu'elle supprime se décide dans `retention-journal-erreurs.ts`, partagé avec le bouton de
 * l'écran d'administration pour que les deux ne puissent plus diverger.
 */
export default defineTask({
  meta: {
    name: 'purge-journal-erreurs',
    description: `Purge du journal d'erreurs : résolues après ${RETENTION_PAR_DEFAUT.resolues} jours, non résolues après ${RETENTION_PAR_DEFAUT.nonResolues}`,
  },
  async run({ payload: _payload }) {
    try {
      const criteres = criteresDePurge(new Date())

      const resolues = await prisma.apiErrorLog.deleteMany({ where: criteres.resolues })
      const nonResolues = await prisma.apiErrorLog.deleteMany({ where: criteres.nonResolues })

      const total = resolues.count + nonResolues.count
      console.log(
        `[CRON purge-journal-erreurs] ${total} supprimés (${resolues.count} résolus de plus de ${RETENTION_PAR_DEFAUT.resolues} jours, ${nonResolues.count} non résolus de plus de ${RETENTION_PAR_DEFAUT.nonResolues} jours)`
      )

      return {
        success: true,
        resolvedLogsDeleted: resolues.count,
        veryOldLogsDeleted: nonResolues.count,
        totalDeleted: total,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('[CRON purge-journal-erreurs] Erreur:', error)
      throw error
    }
  },
})
