import { wrapApiHandler } from '#server/utils/api-helpers'
import { listBackupFiles } from '#server/utils/backup-files'

export default wrapApiHandler(
  async (event) => {
    // Vérifier les permissions super admin
    const _user = await requireGlobalAdminWithDbCheck(event)

    try {
      // Sauvegardes triées de la plus récente à la plus ancienne (liste vide si aucun dossier)
      return await listBackupFiles()
    } catch (error: unknown) {
      console.error('Erreur lors de la lecture des sauvegardes:', error)

      throw createError({
        status: 500,
        statusText:
          'Erreur lors de la lecture des sauvegardes: ' +
          (error instanceof Error ? error.message : 'erreur inconnue'),
      })
    }
  },
  { operationName: 'ListBackups' }
)
