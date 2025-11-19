export default defineTask({
  meta: {
    name: 'cleanup-resolved-error-logs',
    description: 'Remove resolved error logs older than 1 month',
  },
  async run({ payload: _payload }) {
    console.log("🗑️ Exécution de la tâche: nettoyage des logs d'erreur résolus")

    try {
      const now = new Date()
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Compter d'abord les logs qui vont être supprimés
      const logsToDelete = await prisma.apiErrorLog.count({
        where: {
          resolved: true,
          resolvedAt: {
            lt: oneMonthAgo,
          },
        },
      })

      console.log(`🔍 Trouvé ${logsToDelete} logs d'erreur résolus de plus d'un mois`)

      // Supprimer les logs d'erreur résolus depuis plus d'un mois
      const deletedLogs = await prisma.apiErrorLog.deleteMany({
        where: {
          resolved: true,
          resolvedAt: {
            lt: oneMonthAgo,
          },
        },
      })

      console.log(`🗑️ Supprimé ${deletedLogs.count} logs d'erreur résolus`)

      // Nettoyer aussi les anciens logs non résolus (plus de 1 mois)
      // Garder 6 mois crée trop d'accumulation et des problèmes de performance
      const veryOldLogsToDelete = await prisma.apiErrorLog.count({
        where: {
          resolved: false,
          createdAt: {
            lt: oneMonthAgo, // Utiliser la même période qu'avant (1 mois)
          },
        },
      })

      console.log(`🔍 Trouvé ${veryOldLogsToDelete} logs d'erreur non résolus de plus de 1 mois`)

      let deletedVeryOldLogs = { count: 0 }
      if (veryOldLogsToDelete > 0) {
        deletedVeryOldLogs = await prisma.apiErrorLog.deleteMany({
          where: {
            resolved: false,
            createdAt: {
              lt: oneMonthAgo,
            },
          },
        })
        console.log(`🗑️ Supprimé ${deletedVeryOldLogs.count} anciens logs d'erreur non résolus`)
      }

      // Statistiques finales
      const totalDeleted = deletedLogs.count + deletedVeryOldLogs.count

      if (totalDeleted > 0) {
        console.log(`✅ Tâche terminée: ${totalDeleted} logs d'erreur supprimés au total`)
        console.log(`   - ${deletedLogs.count} logs résolus (> 1 mois)`)
        console.log(`   - ${deletedVeryOldLogs.count} logs non résolus (> 1 mois)`)
      } else {
        console.log("✅ Tâche terminée: aucun log d'erreur à nettoyer")
      }

      // Afficher les statistiques restantes
      const remainingLogs = await prisma.apiErrorLog.count()
      const unresolvedLogs = await prisma.apiErrorLog.count({
        where: {
          resolved: false,
        },
      })

      console.log(`📊 Statistiques après nettoyage:`)
      console.log(`   - ${remainingLogs} logs d'erreur restants`)
      console.log(`   - ${unresolvedLogs} logs non résolus`)

      return {
        success: true,
        resolvedLogsDeleted: deletedLogs.count,
        veryOldLogsDeleted: deletedVeryOldLogs.count,
        totalDeleted,
        remainingLogs,
        unresolvedLogs,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error("❌ Erreur lors du nettoyage des logs d'erreur:", error)
      throw error
    }
  },
})
