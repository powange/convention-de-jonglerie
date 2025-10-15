import { execSync } from 'child_process'
import { readFile, writeFile, mkdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

export default defineEventHandler(async (event) => {
  // Vérifier les permissions super admin
  const _user = await requireGlobalAdminWithDbCheck(event)

  try {
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
          statusCode: 400,
          statusMessage: 'Aucun fichier fourni',
        })
      }

      const fileData = form[0]
      const filename = fileData.filename || ''

      if (!fileData.data) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Fichier invalide',
        })
      }

      // Gérer les archives tar.gz ou les fichiers SQL
      if (filename.endsWith('.tar.gz')) {
        // Extraire l'archive
        tempExtractDir = path.join(tmpdir(), `restore-${Date.now()}`)
        await mkdir(tempExtractDir, { recursive: true })

        const tempArchivePath = path.join(tempExtractDir, 'backup.tar.gz')
        await writeFile(tempArchivePath, fileData.data)

        // Extraire l'archive
        execSync(`tar -xzf "${tempArchivePath}" -C "${tempExtractDir}"`, {
          maxBuffer: 1024 * 1024 * 100,
        })

        // Trouver le fichier SQL dans l'archive
        const files = execSync(`find "${tempExtractDir}" -name "*.sql"`, { encoding: 'utf8' })
        const sqlFile = files.trim().split('\n')[0]

        if (!sqlFile) {
          throw createError({
            statusCode: 400,
            statusMessage: "Aucun fichier SQL trouvé dans l'archive",
          })
        }

        sqlContent = await readFile(sqlFile, 'utf8')
      } else if (filename.endsWith('.sql')) {
        sqlContent = fileData.data.toString('utf8')
      } else {
        throw createError({
          statusCode: 400,
          statusMessage: 'Format de fichier invalide. Utilisez .sql ou .tar.gz',
        })
      }
    } else {
      // Restauration depuis un fichier existant
      const body = await readBody(event)
      const { filename } = body

      if (!filename) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Nom de fichier manquant',
        })
      }

      const backupPath = path.join(process.cwd(), 'backups', filename)

      // Gérer les archives tar.gz ou les fichiers SQL
      if (filename.endsWith('.tar.gz')) {
        // Extraire l'archive
        tempExtractDir = path.join(tmpdir(), `restore-${Date.now()}`)
        await mkdir(tempExtractDir, { recursive: true })

        execSync(`tar -xzf "${backupPath}" -C "${tempExtractDir}"`, {
          maxBuffer: 1024 * 1024 * 100,
        })

        // Trouver le fichier SQL dans l'archive
        const files = execSync(`find "${tempExtractDir}" -name "*.sql"`, { encoding: 'utf8' })
        const sqlFile = files.trim().split('\n')[0]

        if (!sqlFile) {
          throw createError({
            statusCode: 400,
            statusMessage: "Aucun fichier SQL trouvé dans l'archive",
          })
        }

        sqlContent = await readFile(sqlFile, 'utf8')
      } else if (filename.endsWith('.sql')) {
        sqlContent = await readFile(backupPath, 'utf8')
      } else {
        throw createError({
          statusCode: 400,
          statusMessage: 'Format de fichier invalide. Utilisez .sql ou .tar.gz',
        })
      }
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
        maxBuffer: 1024 * 1024 * 100, // 100MB buffer
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

          // Copier le CONTENU du dossier uploads de l'archive vers la destination
          // On utilise /* pour copier le contenu et pas le dossier lui-même
          execSync(`cp -r "${extractedUploadsPath}"/* "${uploadsDestPath}"/`, {
            maxBuffer: 1024 * 1024 * 100,
          })

          console.log('Fichiers uploads restaurés avec succès')
        } catch (error) {
          console.log('Aucun fichier uploads à restaurer dans cette archive', error)
        }
      }
    } finally {
      // Nettoyer les fichiers temporaires
      try {
        await import('fs').then((fs) => fs.promises.unlink(tempFilePath))
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

    return {
      success: true,
      message: 'Base de données et fichiers restaurés avec succès',
    }
  } catch (error: unknown) {
    console.error('Erreur lors de la restauration:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la restauration: ' + error.message,
    })
  }
})
