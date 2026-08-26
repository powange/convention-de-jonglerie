import { writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

import { wrapApiHandler } from '#server/utils/api-helpers'
import {
  backupsDir,
  buildStoredBackupFilename,
  isSupportedBackupName,
} from '#server/utils/backup-files'
import {
  lancerRestauration,
  restaurationEnCours,
  type OptionsRestauration,
  type SourceRestauration,
} from '#server/utils/backup-restore-job'

const typeSource = (filename: string): SourceRestauration['type'] =>
  filename.endsWith('.tar.gz') ? 'archive' : 'sql'

export default wrapApiHandler(
  async (event) => {
    // Vérifier les permissions super admin
    const _user = await requireGlobalAdminWithDbCheck(event)
    const config = useRuntimeConfig()
    const uploadsMountPath = config.fileStorage?.mount || '/uploads'

    if (restaurationEnCours()) {
      throw createError({
        status: 409,
        statusText: 'Une restauration est déjà en cours',
      })
    }

    // Vérifier si c'est un upload de fichier ou une restauration depuis un fichier existant
    const contentType = getHeader(event, 'content-type') || ''
    let options: OptionsRestauration

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

      // Valider le format avant d'écrire quoi que ce soit sur le disque
      if (!isSupportedBackupName(filename)) {
        throw createError({
          status: 400,
          statusText: 'Format de fichier invalide. Utilisez .sql ou .tar.gz',
        })
      }

      // Conserver le fichier uploadé dans `backups` AVANT la restauration : il apparaît
      // ainsi dans « Sauvegardes disponibles » même si la restauration échoue ensuite.
      let storedFilename: string | null = null
      let cheminSource: string | null = null
      try {
        await mkdir(backupsDir(), { recursive: true })
        storedFilename = buildStoredBackupFilename(filename)
        cheminSource = path.join(backupsDir(), storedFilename)
        await writeFile(cheminSource, fileData.data)
        console.log(`Sauvegarde uploadée conservée: ${storedFilename}`)
      } catch (storeError) {
        // L'archivage est un bonus : on ne bloque pas la restauration s'il échoue
        console.warn("Impossible de conserver la sauvegarde uploadée dans 'backups':", storeError)
        storedFilename = null
        cheminSource = null
      }

      // La conservation a échoué : on écrit tout de même le dump quelque part pour
      // pouvoir le diffuser à `mysql`, et on le supprimera à la fin.
      const aNettoyer: string[] = []
      if (!cheminSource) {
        cheminSource = path.join(tmpdir(), `restore-${Date.now()}-${path.basename(filename)}`)
        await writeFile(cheminSource, fileData.data)
        aNettoyer.push(cheminSource)
      }

      options = {
        source: { type: typeSource(filename), chemin: cheminSource },
        libelle: storedFilename ?? filename,
        storedFilename,
        uploadsMountPath,
        aNettoyer,
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

      if (!isSupportedBackupName(filename)) {
        throw createError({
          status: 400,
          statusText: 'Format de fichier invalide. Utilisez .sql ou .tar.gz',
        })
      }

      // Protection path traversal : ne garder que le nom de fichier
      const safeFilename = path.basename(filename)

      options = {
        source: { type: typeSource(safeFilename), chemin: path.join(backupsDir(), safeFilename) },
        libelle: safeFilename,
        storedFilename: null,
        uploadsMountPath,
      }
    }

    // Contrôle répété juste avant le lancement : entre le premier et ici, la lecture du
    // fichier uploadé a rendu la main, une autre requête a pu démarrer entre-temps.
    if (restaurationEnCours()) {
      throw createError({
        status: 409,
        statusText: 'Une restauration est déjà en cours',
      })
    }

    // La restauration se poursuit côté serveur même si le client ferme la fenêtre :
    // son avancement se suit via `GET /api/admin/backup/restore-status`.
    const etat = lancerRestauration(options)

    setResponseStatus(event, 202)
    return createSuccessResponse(
      { jobId: etat.id, storedFilename: etat.storedFilename, etat },
      'Restauration lancée'
    )
  },
  { operationName: 'RestoreBackup' }
)
