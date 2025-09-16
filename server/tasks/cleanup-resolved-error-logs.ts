import { prisma } from '../utils/prisma'

export default defineTask({
  meta: {
    name: 'cleanup-resolved-error-logs',
    description: 'Remove resolved error logs older than 1 month',
  },
  async run({ payload }) {
    console.log('🗑️ Exécution de la tâche: nettoyage des logs d\'erreur résolus')

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

      // Optionnel : Nettoyer aussi les très anciens logs non résolus (plus de 6 mois)
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

      const veryOldLogsToDelete = await prisma.apiErrorLog.count({
        where: {
          resolved: false,
          createdAt: {
            lt: sixMonthsAgo,
          },
        },
      })

      console.log(`🔍 Trouvé ${veryOldLogsToDelete} logs d'erreur non résolus de plus de 6 mois`)

      let deletedVeryOldLogs = { count: 0 }
      if (veryOldLogsToDelete > 0) {
        deletedVeryOldLogs = await prisma.apiErrorLog.deleteMany({
          where: {
            resolved: false,
            createdAt: {
              lt: sixMonthsAgo,
            },
          },
        })
        console.log(`🗑️ Supprimé ${deletedVeryOldLogs.count} très anciens logs d'erreur non résolus`)
      }

      // Statistiques finales
      const totalDeleted = deletedLogs.count + deletedVeryOldLogs.count

      if (totalDeleted > 0) {
        console.log(`✅ Tâche terminée: ${totalDeleted} logs d'erreur supprimés au total`)
        console.log(`   - ${deletedLogs.count} logs résolus (> 1 mois)`)
        console.log(`   - ${deletedVeryOldLogs.count} logs non résolus (> 6 mois)`)
      } else {
        console.log('✅ Tâche terminée: aucun log d\'erreur à nettoyer')
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
      console.error('❌ Erreur lors du nettoyage des logs d\'erreur:', error)
      throw error
    }
  },
})