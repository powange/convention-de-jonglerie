import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { criteresDePurge, RETENTION_PAR_DEFAUT } from '~~/shared/utils/retention-journal-erreurs'

/**
 * La purge lancée à la main depuis l'écran d'administration.
 *
 * Elle recopiait mot pour mot la tâche planifiée : même fenêtre de trente jours, même paire de
 * `deleteMany`. Ce qu'elle supprime se décide désormais dans `retention-journal-erreurs.ts`,
 * partagé avec la tâche, pour que modifier la rétention d'un côté ne laisse plus l'autre à son
 * ancienne valeur.
 */

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin
    await requireGlobalAdminWithDbCheck(event)

    const criteres = criteresDePurge(new Date())

    // Compter d'abord les logs qui vont être supprimés
    const [resolvedCount, unresolvedCount] = await Promise.all([
      prisma.apiErrorLog.count({ where: criteres.resolues }),
      prisma.apiErrorLog.count({ where: criteres.nonResolues }),
    ])

    const totalToDelete = resolvedCount + unresolvedCount

    if (totalToDelete === 0) {
      return createSuccessResponse(
        {
          deleted: {
            resolved: 0,
            unresolved: 0,
            total: 0,
          },
        },
        `Aucun log à purger (résolus de plus de ${RETENTION_PAR_DEFAUT.resolues} jours, non résolus de plus de ${RETENTION_PAR_DEFAUT.nonResolues})`
      )
    }

    const deletedResolved = await prisma.apiErrorLog.deleteMany({ where: criteres.resolues })
    const deletedUnresolved = await prisma.apiErrorLog.deleteMany({ where: criteres.nonResolues })

    // Statistiques après nettoyage
    const [remainingTotal, remainingUnresolved] = await Promise.all([
      prisma.apiErrorLog.count(),
      prisma.apiErrorLog.count({ where: { resolved: false } }),
    ])

    return createSuccessResponse(
      {
        deleted: {
          resolved: deletedResolved.count,
          unresolved: deletedUnresolved.count,
          total: deletedResolved.count + deletedUnresolved.count,
        },
        remaining: {
          total: remainingTotal,
          unresolved: remainingUnresolved,
        },
      },
      `${deletedResolved.count + deletedUnresolved.count} logs d'erreur supprimés`
    )
  },
  { operationName: 'CleanupOldErrorLogs' }
)
