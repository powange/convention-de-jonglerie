import { wrapApiHandler } from '#server/utils/api-helpers'
import { lireEtatRestauration } from '#server/utils/backup-restore-job'

/**
 * Avancement de la restauration en cours, ou état de la dernière terminée.
 * Interrogé en boucle par la page d'administration : comme l'état est persisté sur disque,
 * fermer puis rouvrir la page permet de retrouver la progression, et le verdict final.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    return createSuccessResponse({ etat: await lireEtatRestauration() })
  },
  { operationName: 'RestoreBackupStatus' }
)
