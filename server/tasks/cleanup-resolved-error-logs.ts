export default defineTask({
  meta: {
    name: 'cleanup-resolved-error-logs',
    description: 'Remove resolved error logs older than 1 month',
  },
  async run({ payload: _payload }) {
    try {
      const now = new Date()
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Supprimer les logs d'erreur résolus depuis plus d'un mois
      const deletedLogs = await prisma.apiErrorLog.deleteMany({
        where: { resolved: true, resolvedAt: { lt: oneMonthAgo } },
      })

      // Supprimer aussi les anciens logs non résolus (plus de 1 mois)
      const deletedOldLogs = await prisma.apiErrorLog.deleteMany({
        where: { resolved: false, createdAt: { lt: oneMonthAgo } },
      })

      const totalDeleted = deletedLogs.count + deletedOldLogs.count
      console.log(
        `[CRON cleanup-resolved-error-logs] ${totalDeleted} supprimés (${deletedLogs.count} résolus, ${deletedOldLogs.count} anciens)`
      )

      return {
        success: true,
        resolvedLogsDeleted: deletedLogs.count,
        veryOldLogsDeleted: deletedOldLogs.count,
        totalDeleted,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error('[CRON cleanup-resolved-error-logs] Erreur:', error)
      throw error
    }
  },
})
