import { execFile, spawn } from 'child_process'
import { createReadStream } from 'fs'
import { readFile, writeFile, mkdir, rm, readdir, unlink, cp } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'

import { wrapApiHandler } from '#server/utils/api-helpers'

const execFileAsync = promisify(execFile)

/**
 * Trouve récursivement le premier fichier .sql dans un dossier.
 * Remplace l'usage non-sécurisé de `find` via execSync.
 */
async function findFirstSqlFile(dir: string): Promise<string | null> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isFile() && entry.name.endsWith('.sql')) {
      return fullPath
    }
    if (entry.isDirectory()) {
      const found = await findFirstSqlFile(fullPath)
      if (found) return found
    }
  }
  return null
}

export default wrapApiHandler(
  async (event) => {
    // Vérifier les permissions super admin
    const _user = await requireGlobalAdminWithDbCheck(event)
    const config = useRuntimeConfig()
    const uploadsMountPath = config.fileStorage?.mount || '/uploads'
    let sqlContent: string
    let tempExtractDir: string | null = null

    // Vérifier si c'est un upload de fichier ou une restauration depuis un fichier existant
    const contentType = getHeader(event, 'content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Upload de fichier
      const form = await readMultipartFormData(event)
      if (!form || form.length === 0) {
        throw createError({
          status: 400,
          statusText: 'Aucun fichier fourni',
        })
      }

      const fileData = form[0]
      const filename = fileData.filename || ''

      if (!fileData.data) {
        throw createError({
          status: 400,
          statusText: 'Fichier invalide',
        })
      }

      // Gérer les archives tar.gz ou les fichiers SQL
      if (filename.endsWith('.tar.gz')) {
        // Extraire l'archive via execFile (pas d'injection shell)
        tempExtractDir = path.join(tmpdir(), `restore-${Date.now()}`)
        await mkdir(tempExtractDir, { recursive: true })

        const tempArchivePath = path.join(tempExtractDir, 'backup.tar.gz')
        await writeFile(tempArchivePath, fileData.data)

        await execFileAsync('tar', ['-xzf', tempArchivePath, '-C', tempExtractDir], {
          maxBuffer: 1024 * 1024 * 100,
        })

        // Trouver le fichier SQL dans l'archive (recherche native, pas d'exec de find)
        const sqlFile = await findFirstSqlFile(tempExtractDir)

        if (!sqlFile) {
          throw createError({
            status: 400,
            statusText: "Aucun fichier SQL trouvé dans l'archive",
          })
        }

        sqlContent = await readFile(sqlFile, 'utf8')
      } else if (filename.endsWith('.sql')) {
        sqlContent = fileData.data.toString('utf8')
      } else {
        throw createError({
          status: 400,
          statusText: 'Format de fichier invalide. Utilisez .sql ou .tar.gz',
        })
      }
    } else {
      // Restauration depuis un fichier existant
      const body = await readBody(event)
      const { filename } = body

      if (!filename) {
        throw createError({
          status: 400,
          statusText: 'Nom de fichier manquant',
        })
      }

      // Protection path traversal : ne garder que le nom de fichier
      const safeFilename = path.basename(filename)
      const backupPath = path.join(process.cwd(), 'backups', safeFilename)

      // Gérer les archives tar.gz ou les fichiers SQL
      if (filename.endsWith('.tar.gz')) {
        // Extraire l'archive via execFile (pas d'injection shell)
        tempExtractDir = path.join(tmpdir(), `restore-${Date.now()}`)
        await mkdir(tempExtractDir, { recursive: true })

        await execFileAsync('tar', ['-xzf', backupPath, '-C', tempExtractDir], {
          maxBuffer: 1024 * 1024 * 100,
        })

        // Trouver le fichier SQL dans l'archive (recherche native)
        const sqlFile = await findFirstSqlFile(tempExtractDir)

        if (!sqlFile) {
          throw createError({
            status: 400,
            statusText: "Aucun fichier SQL trouvé dans l'archive",
          })
        }

        sqlContent = await readFile(sqlFile, 'utf8')
      } else if (filename.endsWith('.sql')) {
        sqlContent = await readFile(backupPath, 'utf8')
      } else {
        throw createError({
          status: 400,
          statusText: 'Format de fichier invalide. Utilisez .sql ou .tar.gz',
        })
      }
    }

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

    // Créer un fichier temporaire pour le SQL
    const tempFilePath = path.join(tmpdir(), `restore-${Date.now()}.sql`)
    await writeFile(tempFilePath, sqlContent)

    try {
      // Exécuter la restauration via spawn avec pipe stdin
      // - arguments en tableau (pas d'injection shell)
      // - MYSQL_PWD évite d'exposer le mot de passe dans la liste des processus
      console.log('Restauration de la base de données en cours...')
      await new Promise<void>((resolve, reject) => {
        const mysqlProcess = spawn('mysql', [`-h${dbHost}`, `-P${dbPort}`, `-u${dbUser}`, dbName], {
          env: { ...process.env, MYSQL_PWD: dbPassword },
        })

        const sqlStream = createReadStream(tempFilePath)
        sqlStream.pipe(mysqlProcess.stdin)

        let stderr = ''
        mysqlProcess.stderr.on('data', (chunk) => {
          stderr += chunk.toString()
        })

        mysqlProcess.on('error', reject)
        mysqlProcess.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`mysql restore failed (exit ${code}): ${stderr}`))
          }
        })
      })

      console.log('Base de données restaurée avec succès')

      // Restaurer les fichiers uploads si présents dans l'archive
      if (tempExtractDir) {
        const extractedUploadsPath = path.join(tempExtractDir, uploadsMountPath.replace(/^\//, ''))
        try {
          await import('fs').then((fs) => fs.promises.access(extractedUploadsPath))

          // Le dossier uploads existe dans l'archive, le restaurer
          // Le chemin de destination dépend si uploadsMountPath est absolu ou relatif
          const uploadsDestPath = path.isAbsolute(uploadsMountPath)
            ? uploadsMountPath
            : path.join(process.cwd(), uploadsMountPath)

          // Supprimer l'ancien dossier uploads s'il existe
          try {
            await rm(uploadsDestPath, { recursive: true, force: true })
          } catch {
            // Le dossier n'existe pas, ce n'est pas grave
          }

          // Créer le dossier de destination
          await mkdir(uploadsDestPath, { recursive: true })

          // Copier le contenu via fs.cp natif (pas d'exec de cp -r)
          await cp(extractedUploadsPath, uploadsDestPath, { recursive: true })

          console.log('Fichiers uploads restaurés avec succès')
        } catch (error) {
          console.log('Aucun fichier uploads à restaurer dans cette archive', error)
        }
      }
    } finally {
      // Nettoyer les fichiers temporaires
      try {
        await unlink(tempFilePath)
      } catch (cleanupError) {
        console.warn('Impossible de supprimer le fichier SQL temporaire:', cleanupError)
      }

      if (tempExtractDir) {
        try {
          await rm(tempExtractDir, { recursive: true, force: true })
        } catch (cleanupError) {
          console.warn("Impossible de supprimer le dossier temporaire d'extraction:", cleanupError)
        }
      }
    }

    return createSuccessResponse(null, 'Base de données et fichiers restaurés avec succès')
  },
  { operationName: 'RestoreBackup' }
)
