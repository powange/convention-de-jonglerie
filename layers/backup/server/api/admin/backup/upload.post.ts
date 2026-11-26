import { createWriteStream } from 'fs'
import { mkdir, readdir, rename, rm, stat } from 'fs/promises'
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
 * Un identifiant de tranche voyage dans une en-tête et sert à nommer un fichier : il ne doit
 * donc porter que des caractères inoffensifs, sans quoi il permettrait d'écrire ailleurs que
 * dans le dossier des sauvegardes.
 */
const UPLOAD_ID_VALIDE = /^[a-zA-Z0-9-]{8,64}$/

/**
 * Âge au-delà duquel un envoi inachevé est considéré comme abandonné.
 *
 * Un envoi d'un seul tenant qui échoue efface son fichier partiel ; en tranches, ce fichier est
 * au contraire conservé, puisque c'est lui qui permettrait de reprendre. Sans ce ménage, chaque
 * envoi interrompu laisserait donc ses octets sur le volume, définitivement. Une journée est
 * large : personne ne reprend un envoi le lendemain, et rien de récent n'est menacé.
 */
const AGE_TRANCHE_ABANDONNEE_MS = 24 * 60 * 60 * 1000

/** Efface les envois inachevés trop vieux pour être repris. Silencieux : c'est de l'entretien. */
async function nettoyerTranchesAbandonnees() {
  try {
    const limite = Date.now() - AGE_TRANCHE_ABANDONNEE_MS
    for (const nom of await readdir(backupsDir())) {
      if (!nom.endsWith('.part')) continue
      const chemin = path.join(backupsDir(), nom)
      const infos = await stat(chemin).catch(() => null)
      if (infos && infos.mtimeMs < limite) await rm(chemin, { force: true }).catch(() => {})
    }
  } catch {
    // Le ménage ne doit jamais faire échouer un envoi.
  }
}

/**
 * POST /api/admin/backup/upload
 * Dépose un fichier de sauvegarde dans `backups` sans rien restaurer.
 *
 * Le corps est le fichier brut (et non un multipart) : une archive complète pèse
 * couramment plusieurs centaines de Mo, et `readMultipartFormData` la chargerait
 * intégralement en mémoire. Ici la requête est écrite au fil de l'eau sur le disque,
 * donc l'empreinte mémoire ne dépend pas de la taille du fichier.
 * Le nom d'origine voyage dans l'en-tête `x-backup-filename`.
 *
 * **Envoi en tranches.** Un envoi d'un seul tenant suppose que la connexion tienne du début à
 * la fin — ce qu'un téléphone ne garantit pas : quelques minutes suffisent pour que l'écran
 * s'éteigne, que l'application passe en arrière-plan et que la requête reste suspendue. Le
 * client peut donc découper le fichier et envoyer chaque tranche séparément, en indiquant :
 *
 * - `x-backup-upload-id` : le même identifiant pour toutes les tranches d'un fichier ;
 * - `x-backup-offset`    : la position, en octets, où cette tranche commence ;
 * - `x-backup-total`     : la taille totale attendue.
 *
 * Chaque requête est alors courte, donc insensible à une veille ou à une coupure, et l'envoi
 * reprend là où il s'était arrêté. Sans ces en-têtes, le comportement d'origine est conservé :
 * un seul corps, écrit puis renommé.
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

    await mkdir(backupsDir(), { recursive: true })

    const uploadId = getHeader(event, 'x-backup-upload-id')
    const offsetBrut = getHeader(event, 'x-backup-offset')
    const totalBrut = getHeader(event, 'x-backup-total')
    const enTranches = Boolean(uploadId || offsetBrut || totalBrut)

    // Le fichier d'accumulation porte l'identifiant de l'envoi et non le nom final : deux envois
    // simultanés du même fichier ne doivent pas se mélanger.
    let partPath: string
    let nomFinal: string | null = null
    let offset = 0
    let total = 0

    if (enTranches) {
      if (!uploadId || !UPLOAD_ID_VALIDE.test(uploadId)) {
        throw createError({ status: 400, statusText: "Identifiant d'envoi invalide" })
      }
      offset = Number(offsetBrut)
      total = Number(totalBrut)
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(total) || total <= 0) {
        throw createError({ status: 400, statusText: 'Position ou taille de tranche invalide' })
      }
      if (total > MAX_UPLOAD_BYTES) {
        throw createError({ status: 413, statusText: 'Fichier trop volumineux' })
      }

      partPath = path.join(backupsDir(), `${uploadId}.part`)

      // Au démarrage d'un envoi seulement : le ménage n'a pas à se répéter à chaque tranche.
      if (offset === 0) await nettoyerTranchesAbandonnees()

      // La position annoncée doit correspondre à ce qui est déjà sur le disque. Une tranche
      // rejouée ou reçue dans le désordre produirait sinon une archive corrompue, qui ne se
      // verrait qu'au moment d'une restauration.
      const dejaRecu = await stat(partPath)
        .then((s) => s.size)
        .catch(() => 0)
      if (offset !== dejaRecu) {
        throw createError({
          status: 409,
          statusText: `Tranche hors séquence : ${dejaRecu} octets reçus, ${offset} annoncés`,
        })
      }
    } else {
      // Le nom final est arrêté ici, et non recalculé à la fin : il porte un horodatage, et deux
      // calculs successifs donneraient deux noms — le `.part` ne correspondrait plus à sa
      // destination.
      nomFinal = buildStoredBackupFilename(filename)
      partPath = path.join(backupsDir(), `${nomFinal}.part`)
    }

    let received = 0

    try {
      await pipeline(
        event.node.req,
        async function* (source) {
          for await (const chunk of source) {
            received += chunk.length
            if (offset + received > (enTranches ? total : MAX_UPLOAD_BYTES)) {
              throw createError({ status: 413, statusText: 'Fichier trop volumineux' })
            }
            yield chunk
          }
        },
        // Écriture sous `.part` : une connexion interrompue ne laisse pas une archive
        // tronquée dans la liste des sauvegardes, où elle passerait pour exploitable.
        createWriteStream(partPath, enTranches ? { flags: 'a' } : {})
      )

      if (received === 0) {
        throw createError({ status: 400, statusText: 'Fichier vide' })
      }

      // Tant que le compte n'y est pas, le fichier reste en `.part` et la tranche suivante
      // viendra s'y ajouter.
      if (enTranches && offset + received < total) {
        return createSuccessResponse(
          { recu: offset + received, total, termine: false },
          'Tranche reçue'
        )
      }

      // En tranches, le fichier d'accumulation porte l'identifiant de l'envoi : son nom définitif
      // ne se décide qu'ici, une fois le compte bon.
      const storedFilename = nomFinal ?? buildStoredBackupFilename(filename)
      await rename(partPath, path.join(backupsDir(), storedFilename))

      const taille = enTranches ? total : received
      console.log(`Sauvegarde importée: ${storedFilename} (${taille} octets)`)

      return createSuccessResponse(
        { storedFilename, size: taille, recu: taille, total: taille, termine: true },
        'Sauvegarde importée avec succès'
      )
    } catch (error) {
      // Un envoi d'un seul tenant qui échoue ne laisse rien derrière lui. En tranches, le
      // fichier partiel est conservé : c'est lui qui permet de reprendre là où on s'est arrêté.
      if (!enTranches) await rm(partPath, { force: true }).catch(() => {})
      throw error
    }
  },
  { operationName: 'UploadBackup' }
)
