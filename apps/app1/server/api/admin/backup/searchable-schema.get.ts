import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { collectSearchableTables, listSearchableTables } from '#server/utils/backup-search'

const querySchema = z.object({
  // Relever la structure des sauvegardes demande de lire chaque dump (et d'extraire le .sql
  // des archives) : c'est à la demande, pour ne pas retarder l'ouverture de l'écran.
  includeBackups: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

/**
 * GET /api/admin/backup/searchable-schema
 * Tables et colonnes proposées par le formulaire de recherche.
 *
 * Par défaut, le schéma actuel (immédiat). Avec `includeBackups=true`, y sont ajoutées les
 * tables et colonnes que seules les anciennes sauvegardes contiennent encore — une table
 * supprimée depuis reste ainsi interrogeable.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const { includeBackups } = querySchema.parse(getQuery(event))
    const tables = includeBackups ? await collectSearchableTables() : listSearchableTables()

    return createSuccessResponse({
      tables,
      includesBackups: includeBackups,
      legacyCount: tables.filter((table) => !table.inCurrentSchema).length,
    })
  },
  { operationName: 'ListSearchableBackupSchema' }
)
