import { execSync } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

export default defineEventHandler(async (event) => {
  // Vérifier les permissions super admin
  const _user = await requireGlobalAdminWithDbCheck(event)

  try {
    let sqlContent: string

    // Vérifier si c'est un upload de fichier ou une restauration depuis un fichier existant
    const contentType = getHeader(event, 'content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Upload de fichier
      const form = await readMultipartFormData(event)
      if (!form || form.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Aucun fichier fourni',
        })
      }

      const fileData = form[0]
      if (!fileData.data || !fileData.filename?.endsWith('.sql')) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Fichier SQL invalide',
        })
      }

      sqlContent = fileData.data.toString('utf8')
    } else {
      // Restauration depuis un fichier existant
      const body = await readBody(event)
      const { filename } = body

      if (!filename || !filename.endsWith('.sql')) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Nom de fichier invalide',
        })
      }

      const backupPath = path.join(process.cwd(), 'backups', filename)
      sqlContent = await readFile(backupPath, 'utf8')
    }

    // Obtenir les informations de connexion à la base de données
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Configuration de base de données manquante',
      })
    }

    // Parser l'URL de connexion MySQL
    const dbUrl = new URL(databaseUrl)
    const dbHost = dbUrl.hostname
    const dbPort = dbUrl.port || '3306'
    const dbName = dbUrl.pathname.slice(1) // Enlever le '/' du début
    const dbUser = dbUrl.username
    const dbPassword = dbUrl.password

    // Créer un fichier temporaire pour le SQL
    const tempFilePath = path.join(tmpdir(), `restore-${Date.now()}.sql`)
    await writeFile(tempFilePath, sqlContent)

    try {
      // Construire la commande mysql pour restaurer
      const mysqlCmd = [
        'mysql',
        `-h${dbHost}`,
        `-P${dbPort}`,
        `-u${dbUser}`,
        `-p${dbPassword}`,
        dbName,
        `< ${tempFilePath}`,
      ].join(' ')

      // Exécuter la restauration
      console.log('Restauration de la base de données en cours...')
      execSync(mysqlCmd, {
        encoding: 'utf8',
        shell: true,
        maxBuffer: 1024 * 1024 * 100, // 100MB buffer
      })

      console.log('Restauration terminée avec succès')
    } finally {
      // Nettoyer le fichier temporaire
      try {
        await import('fs').then((fs) => fs.promises.unlink(tempFilePath))
      } catch (cleanupError) {
        console.warn('Impossible de supprimer le fichier temporaire:', cleanupError)
      }
    }

    return {
      success: true,
      message: 'Base de données restaurée avec succès',
    }
  } catch (error: any) {
    console.error('Erreur lors de la restauration:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la restauration: ' + error.message,
    })
  }
})
