import { wrapApiHandler } from '#server/utils/api-helpers'
import { listSearchableTables } from '#server/utils/backup-search'

/**
 * GET /api/admin/backup/searchable-schema
 * Tables et colonnes interrogeables dans les sauvegardes, dérivées du schéma Prisma.
 * Alimente les listes déroulantes du formulaire de recherche.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    return createSuccessResponse({ tables: listSearchableTables() })
  },
  { operationName: 'ListSearchableBackupSchema' }
)
