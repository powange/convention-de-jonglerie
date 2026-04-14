import { execFile } from 'child_process'
import { mkdir, writeFile, stat, unlink } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

import { wrapApiHandler } from '#server/utils/api-helpers'

const execFileAsync = promisify(execFile)

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
        status: 500,
        statusText: 'Configuration de base de données manquante',
      })
    }

    // Parser l'URL de connexion MySQL
    const dbUrl = new URL(databaseUrl)
    const dbHost = dbUrl.hostname
    const dbPort = dbUrl.port || '3306'
    const dbName = dbUrl.pathname.slice(1) // Enlever le '/' du début
    const dbUser = dbUrl.username
    const dbPassword = dbUrl.password

    // Exécuter mysqldump via execFile (arguments en tableau, pas d'injection shell)
    // MYSQL_PWD évite d'exposer le mot de passe dans la liste des processus
    console.log('Création du dump SQL en cours...')
    const { stdout: dumpOutput } = await execFileAsync(
      'mysqldump',
      [
        `-h${dbHost}`,
        `-P${dbPort}`,
        `-u${dbUser}`,
        '--single-transaction',
        '--add-drop-table',
        '--quick',
        '--extended-insert',
        '--no-tablespaces',
        dbName,
      ],
      {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        env: { ...process.env, MYSQL_PWD: dbPassword },
      }
    )

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
    // execFile avec arguments en tableau → pas de shell injection possible
    console.log("Création de l'archive tar.gz...")

    const tarArgs: string[] = ['-czf', archivePath, '-C', backupsDir, sqlFilename]
    if (hasUploads) {
      if (path.isAbsolute(uploadsMountPath)) {
        // Archive depuis la racine pour les chemins absolus (/uploads)
        tarArgs.push('-C', '/', uploadsMountPath.replace(/^\//, ''))
      } else {
        tarArgs.push('-C', process.cwd(), uploadsMountPath)
      }
    }

    await execFileAsync('tar', tarArgs, {
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer
    })

    // Supprimer le fichier SQL temporaire (remplace execSync rm)
    await unlink(sqlPath)

    // Obtenir la taille de l'archive
    const archiveStats = await stat(archivePath)

    console.log(`Archive de sauvegarde créée: ${archiveFilename}`)

    return createSuccessResponse({
      filename: archiveFilename,
      path: archivePath,
      size: archiveStats.size,
      includesUploads: hasUploads,
    })
  },
  { operationName: 'CreateBackup' }
)
