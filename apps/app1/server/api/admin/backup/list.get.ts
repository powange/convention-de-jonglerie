import { isHttpError } from '#server/types/api'
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
      /*
       * Un refus DÉJÀ ÉCRIT reste lisible — constat D6. Sans ce relais, ce `catch` réécrit en
       * 500 générique les 4xx levés dans le `try`, y compris par les fonctions qu'il appelle :
       * au comptoir, « Erreur lors de la validation » remplace « Ce billet a été remboursé », et
       * la différence est entre comprendre et appeler quelqu'un.
       */
      if (isHttpError(error)) throw error
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
