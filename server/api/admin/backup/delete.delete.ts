import { unlink } from 'fs/promises'
import path from 'path'

export default defineEventHandler(async (event) => {
  // Vérifier les permissions super admin
  const _user = await requireGlobalAdminWithDbCheck(event)

  try {
    const body = await readBody(event)
    const { filename } = body

    if (!filename || !filename.endsWith('.sql')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Nom de fichier invalide',
      })
    }

    // Vérifier que le fichier existe dans le dossier backup
    const backupPath = path.join(process.cwd(), 'backups', filename)

    try {
      await unlink(backupPath)

      console.log(`Sauvegarde supprimée: ${filename}`)

      return {
        success: true,
        message: 'Sauvegarde supprimée avec succès',
      }
    } catch (fileError: any) {
      if (fileError.code === 'ENOENT') {
        throw createError({
          statusCode: 404,
          statusMessage: 'Fichier de sauvegarde non trouvé',
        })
      }
      throw fileError
    }
  } catch (error: any) {
    console.error('Erreur lors de la suppression:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression: ' + error.message,
    })
  }
})
