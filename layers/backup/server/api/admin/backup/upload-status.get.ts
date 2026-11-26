import { stat } from 'fs/promises'
import path from 'path'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { backupsDir } from '#server/utils/backup-files'

/** Même règle que pour l'envoi : un identifiant sert à nommer un fichier, il doit être inoffensif. */
const UPLOAD_ID_VALIDE = /^[a-zA-Z0-9-]{8,64}$/

/**
 * GET /api/admin/backup/upload-status?uploadId=…
 * Combien d'octets le serveur détient-il déjà pour cet envoi ?
 *
 * C'est ce qui rend une reprise possible après une coupure : le client sait quelles tranches il
 * a envoyées, mais pas lesquelles sont réellement arrivées — et sa propre mémoire peut être
 * périmée, le fichier partiel étant effacé au bout d'un jour. Seul le disque fait foi.
 *
 * Rend `0` quand rien n'existe : ce n'est pas une erreur, mais la réponse à « où en suis-je ? »
 * pour un envoi qui n'a pas commencé, ou dont les traces ont été nettoyées.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const { uploadId } = getQuery(event)
    if (typeof uploadId !== 'string' || !UPLOAD_ID_VALIDE.test(uploadId)) {
      throw createError({ status: 400, statusText: "Identifiant d'envoi invalide" })
    }

    const recu = await stat(path.join(backupsDir(), `${uploadId}.part`))
      .then((infos) => infos.size)
      .catch(() => 0)

    return createSuccessResponse({ recu })
  },
  { operationName: 'BackupUploadStatus' }
)
