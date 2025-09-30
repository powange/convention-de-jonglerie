import { execSync } from 'child_process'
import { writeFile } from 'fs/promises'
import path from 'path'

export default defineEventHandler(async (event) => {
  // Vérifier les permissions super admin
  const _user = await requireGlobalAdminWithDbCheck(event)

  try {
    // Générer un nom de fichier unique avec timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
    const filename = `backup-${timestamp}.sql`
    const backupPath = path.join(process.cwd(), 'backups', filename)

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

    // Construire la commande mysqldump (sans options nécessitant PROCESS privilege)
    const mysqldumpCmd = [
      'mysqldump',
      `-h${dbHost}`,
      `-P${dbPort}`,
      `-u${dbUser}`,
      `-p${dbPassword}`,
      '--single-transaction',
      '--add-drop-table',
      '--quick',
      '--extended-insert',
      '--no-tablespaces',
      dbName,
    ].join(' ')

    // Exécuter mysqldump
    console.log('Création de la sauvegarde en cours...')
    const dumpOutput = execSync(mysqldumpCmd, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 50, // 50MB buffer
    })

    // Écrire le fichier de sauvegarde
    await writeFile(backupPath, dumpOutput)

    console.log(`Sauvegarde créée: ${filename}`)

    return {
      success: true,
      filename,
      path: backupPath,
      size: Buffer.byteLength(dumpOutput, 'utf8'),
    }
  } catch (error: any) {
    console.error('Erreur lors de la création de la sauvegarde:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la création de la sauvegarde: ' + error.message,
    })
  }
})
