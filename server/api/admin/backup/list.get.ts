import { readdir, stat } from 'fs/promises'
import path from 'path'

export default defineEventHandler(async (event) => {
  // Vérifier les permissions super admin
  const _user = await requireGlobalAdminWithDbCheck(event)

  try {
    const backupDir = path.join(process.cwd(), 'backups')

    // Lire le contenu du dossier backup
    const files = await readdir(backupDir)

    // Filtrer les fichiers .sql et obtenir leurs informations
    const backups = []

    for (const file of files) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(backupDir, file)
        const fileStat = await stat(filePath)

        backups.push({
          filename: file,
          createdAt: fileStat.birthtime.toISOString(),
          size: fileStat.size,
        })
      }
    }

    // Trier par date de création (plus récent en premier)
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return backups
  } catch (error: any) {
    // Si le dossier n'existe pas, retourner une liste vide
    if (error.code === 'ENOENT') {
      return []
    }

    console.error('Erreur lors de la lecture des sauvegardes:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la lecture des sauvegardes: ' + error.message,
    })
  }
})
