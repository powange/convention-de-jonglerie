import { readFile } from 'fs/promises'
import path from 'path'

import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier les permissions super admin
    const _user = await requireGlobalAdminWithDbCheck(event)

    const query = getQuery(event)
    const filename = query.filename as string

    if (!filename || (!filename.endsWith('.sql') && !filename.endsWith('.tar.gz'))) {
      throw createError({
        status: 400,
        statusText: 'Nom de fichier invalide',
      })
    }

    // Vérifier que le fichier existe dans le dossier backup
    const backupPath = path.join(process.cwd(), 'backups', filename)

    try {
      const fileContent = await readFile(backupPath)

      // Définir le Content-Type selon le type de fichier
      const contentType = filename.endsWith('.tar.gz') ? 'application/gzip' : 'application/sql'

      // Définir les en-têtes pour le téléchargement
      setHeader(event, 'Content-Type', contentType)
      setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
      setHeader(event, 'Content-Length', fileContent.length)

      return fileContent
    } catch (fileError: any) {
      if (fileError.code === 'ENOENT') {
        throw createError({
          status: 404,
          statusText: 'Fichier de sauvegarde non trouvé',
        })
      }
      throw fileError
    }
  },
  { operationName: 'DownloadBackup' }
)
