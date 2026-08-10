import { createWriteStream } from 'fs'
import { mkdir, rename, rm } from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'

import { wrapApiHandler } from '#server/utils/api-helpers'
import {
  backupsDir,
  buildStoredBackupFilename,
  isSupportedBackupName,
} from '#server/utils/backup-files'

/**
 * Plafond de sécurité côté disque. Le flux est coupé dès qu'il est franchi : sans cela,
 * un envoi sans fin remplirait le volume des sauvegardes.
 */
const MAX_UPLOAD_BYTES = 2_000_000_000

/**
 * POST /api/admin/backup/upload
 * Dépose un fichier de sauvegarde dans `backups` sans rien restaurer.
 *
 * Le corps est le fichier brut (et non un multipart) : une archive complète pèse
 * couramment plusieurs centaines de Mo, et `readMultipartFormData` la chargerait
 * intégralement en mémoire. Ici la requête est écrite au fil de l'eau sur le disque,
 * donc l'empreinte mémoire ne dépend pas de la taille du fichier.
 * Le nom d'origine voyage dans l'en-tête `x-backup-filename`.
 */
export default wrapApiHandler(
  async (event) => {
    await requireGlobalAdminWithDbCheck(event)

    const rawFilename = getHeader(event, 'x-backup-filename') || ''
    let filename: string
    try {
      filename = decodeURIComponent(rawFilename)
    } catch {
      filename = rawFilename
    }

    if (!filename) {
      throw createError({ status: 400, statusText: 'Nom de fichier manquant' })
    }
    if (!isSupportedBackupName(filename)) {
      throw createError({
        status: 400,
        statusText: 'Format de fichier invalide. Utilisez .sql ou .tar.gz',
      })
    }

    const storedFilename = buildStoredBackupFilename(filename)
    await mkdir(backupsDir(), { recursive: true })

    const finalPath = path.join(backupsDir(), storedFilename)
    // Écriture sous `.part` : une connexion interrompue ne laisse pas une archive
    // tronquée dans la liste des sauvegardes, où elle passerait pour exploitable.
    const partPath = `${finalPath}.part`

    let received = 0

    try {
      await pipeline(
        event.node.req,
        async function* (source) {
          for await (const chunk of source) {
            received += chunk.length
            if (received > MAX_UPLOAD_BYTES) {
              throw createError({ status: 413, statusText: 'Fichier trop volumineux' })
            }
            yield chunk
          }
        },
        createWriteStream(partPath)
      )

      if (received === 0) {
        throw createError({ status: 400, statusText: 'Fichier vide' })
      }

      await rename(partPath, finalPath)
    } catch (error) {
      await rm(partPath, { force: true }).catch(() => {})
      throw error
    }

    console.log(`Sauvegarde importée: ${storedFilename} (${received} octets)`)

    return createSuccessResponse(
      { storedFilename, size: received },
      'Sauvegarde importée avec succès'
    )
  },
  { operationName: 'UploadBackup' }
)
