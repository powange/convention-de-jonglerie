import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin
  await requireGlobalAdminWithDbCheck(event)

  try {
    const now = new Date()
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Compter d'abord les logs qui vont être supprimés
    const [resolvedCount, unresolvedCount] = await Promise.all([
      prisma.apiErrorLog.count({
        where: {
          resolved: true,
          resolvedAt: {
            lt: oneMonthAgo,
          },
        },
      }),
      prisma.apiErrorLog.count({
        where: {
          resolved: false,
          createdAt: {
            lt: oneMonthAgo,
          },
        },
      }),
    ])

    const totalToDelete = resolvedCount + unresolvedCount

    if (totalToDelete === 0) {
      return {
        success: true,
        message: "Aucun log de plus d'un mois à supprimer",
        deleted: {
          resolved: 0,
          unresolved: 0,
          total: 0,
        },
      }
    }

    // Supprimer les logs d'erreur résolus depuis plus d'un mois
    const deletedResolved = await prisma.apiErrorLog.deleteMany({
      where: {
        resolved: true,
        resolvedAt: {
          lt: oneMonthAgo,
        },
      },
    })

    // Supprimer les logs d'erreur non résolus de plus d'un mois
    const deletedUnresolved = await prisma.apiErrorLog.deleteMany({
      where: {
        resolved: false,
        createdAt: {
          lt: oneMonthAgo,
        },
      },
    })

    // Statistiques après nettoyage
    const [remainingTotal, remainingUnresolved] = await Promise.all([
      prisma.apiErrorLog.count(),
      prisma.apiErrorLog.count({ where: { resolved: false } }),
    ])

    return {
      success: true,
      message: `${deletedResolved.count + deletedUnresolved.count} logs d'erreur supprimés`,
      deleted: {
        resolved: deletedResolved.count,
        unresolved: deletedUnresolved.count,
        total: deletedResolved.count + deletedUnresolved.count,
      },
      remaining: {
        total: remainingTotal,
        unresolved: remainingUnresolved,
      },
    }
  } catch (error: unknown) {
    console.error('Failed to cleanup old error logs:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors du nettoyage des logs',
    })
  }
})
