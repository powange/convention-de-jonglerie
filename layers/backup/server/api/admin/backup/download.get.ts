import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'

import { wrapApiHandler } from '#server/utils/api-helpers'

export default wrapApiHandler(
  async (event) => {
    // Vérifier les permissions super admin
    const _user = await requireGlobalAdminWithDbCheck(event)

    const query = getQuery(event)
    const filename = query.filename as string

    if (!filename || (!filename.endsWith('.sql') && !filename.endsWith('.tar.gz'))) {
      throw createError({
        status: 400,
        statusText: 'Nom de fichier invalide',
      })
    }

    // Protection path traversal : ne garder que le nom de fichier
    const safeFilename = path.basename(filename)
    const backupPath = path.join(process.cwd(), 'backups', safeFilename)

    try {
      /*
       * ⚠️ L'ARCHIVE PART EN FLUX, et ne passe plus par la mémoire — constat O2.
       *
       * `readFile` chargeait le fichier ENTIER dans un Buffer avant de le rendre. Le point d'API
       * d'envoi voisin explique lui-même qu'« une archive complète pèse couramment plusieurs
       * centaines de Mo » — et c'est pour cela qu'il a été réécrit en flux. Le téléchargement,
       * son symétrique, ne l'avait pas été : deux administrateurs qui téléchargent en même temps
       * doublaient l'empreinte, et une archive de 500 Mo demandait 500 Mo de tas.
       *
       * `stat` avant d'ouvrir : c'est lui qui donne le `Content-Length` — sans quoi le navigateur
       * n'affiche aucune progression, ce que le Buffer fournissait gratuitement. Et il sert de
       * contrôle d'existence, donc le 404 continue de se déclencher avant l'ouverture du flux.
       */
      const infos = await stat(backupPath)

      // Définir le Content-Type selon le type de fichier
      const contentType = filename.endsWith('.tar.gz') ? 'application/gzip' : 'application/sql'

      /*
       * ⚠️ `safeFilename` ET NON `filename` dans l'en-tête — second point du constat. Le nom
       * reçu y était recopié brut : un `"` ou un saut de ligne dans le paramètre permettait d'y
       * injecter ce qu'on voulait, alors que la version assainie existait déjà deux lignes plus
       * haut pour construire le chemin.
       */
      setHeader(event, 'Content-Type', contentType)
      setHeader(event, 'Content-Disposition', `attachment; filename="${safeFilename}"`)
      setHeader(event, 'Content-Length', infos.size)

      return sendStream(event, createReadStream(backupPath))
    } catch (fileError: any) {
      if (fileError.code === 'ENOENT') {
        throw createError({
          status: 404,
          statusText: 'Fichier de sauvegarde non trouvé',
        })
      }
      throw fileError
    }
  },
  { operationName: 'DownloadBackup' }
)
