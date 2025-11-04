import { execSync } from 'child_process'
import { mkdir, writeFile, stat } from 'fs/promises'
import path from 'path'

import { wrapApiHandler } from '@@/server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier les permissions super admin
    const _user = await requireGlobalAdminWithDbCheck(event)
    const config = useRuntimeConfig()
    const uploadsMountPath = config.fileStorage?.mount || '/uploads'

    // Déterminer l'environnement (production, staging, development, etc.)
    const environment = process.env.NODE_ENV || 'development'

    // Générer un nom de fichier unique avec timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-')
    const sqlFilename = `juggling-convention-${environment}-database-${timestamp}.sql`
    const archiveFilename = `juggling-convention-${environment}-backup-${timestamp}.tar.gz`
    const backupsDir = path.join(process.cwd(), 'backups')
    const sqlPath = path.join(backupsDir, sqlFilename)
    const archivePath = path.join(backupsDir, archiveFilename)

    // Créer le dossier backups s'il n'existe pas
    await mkdir(backupsDir, { recursive: true })

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
    console.log('Création du dump SQL en cours...')
    const dumpOutput = execSync(mysqldumpCmd, {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 50, // 50MB buffer
    })

    // Écrire le fichier SQL
    await writeFile(sqlPath, dumpOutput)
    console.log(`Dump SQL créé: ${sqlFilename}`)

    // Le dossier uploads peut être un chemin absolu (/uploads) ou relatif
    // Si c'est un chemin absolu, on l'utilise tel quel, sinon on le joint au cwd
    const uploadsPath = path.isAbsolute(uploadsMountPath)
      ? uploadsMountPath
      : path.join(process.cwd(), uploadsMountPath)

    // Vérifier si le dossier uploads existe
    let hasUploads = false
    try {
      await stat(uploadsPath)
      hasUploads = true
    } catch {
      console.log("Aucun dossier d'uploads trouvé, sauvegarde SQL uniquement")
    }

    // Créer l'archive tar.gz avec le SQL et les uploads (si présents)
    console.log("Création de l'archive tar.gz...")

    let tarCmd: string
    if (hasUploads) {
      // Si le chemin est absolu (/uploads), on archive directement depuis la racine
      // Sinon, on archive depuis le dossier du projet
      if (path.isAbsolute(uploadsMountPath)) {
        tarCmd = `tar -czf "${archivePath}" -C "${backupsDir}" "${sqlFilename}" -C / "${uploadsMountPath.replace(/^\//, '')}"`
      } else {
        tarCmd = `tar -czf "${archivePath}" -C "${backupsDir}" "${sqlFilename}" -C "${process.cwd()}" "${uploadsMountPath}"`
      }
    } else {
      tarCmd = `tar -czf "${archivePath}" -C "${backupsDir}" "${sqlFilename}"`
    }

    execSync(tarCmd, {
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer
    })

    // Supprimer le fichier SQL temporaire
    execSync(`rm "${sqlPath}"`)

    // Obtenir la taille de l'archive
    const archiveStats = await stat(archivePath)

    console.log(`Archive de sauvegarde créée: ${archiveFilename}`)

    return {
      success: true,
      filename: archiveFilename,
      path: archivePath,
      size: archiveStats.size,
      includesUploads: hasUploads,
    }
  },
  { operationName: 'CreateBackup' }
)
