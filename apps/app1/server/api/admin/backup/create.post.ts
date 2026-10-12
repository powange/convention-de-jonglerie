import { execFile, spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { mkdir, stat, unlink } from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import { promisify } from 'util'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { createLogger } from '#server/utils/logger'
import { synchronisationUnique } from '#server/utils/synchronisation-unique'

const journal = createLogger('SAUVEGARDE')

const execFileAsync = promisify(execFile)

export default wrapApiHandler(
  async (event) => {
    // Vérifier les permissions super admin
    const _user = await requireGlobalAdminWithDbCheck(event)

    /*
     * ⚠️ UNE SEULE SAUVEGARDE À LA FOIS — constat O1, sa seconde moitié : « aucune concurrence
     * n'est bloquée, deux clics lancent deux mysqldump ».
     *
     * Le second appel reçoit le RÉSULTAT du premier plutôt qu'un refus : deux onglets qui
     * demandent la même chose obtiennent la même archive, et une seule est produite. C'est le
     * comportement que l'import HelloAsso a adopté après la panne du 23 août 2026.
     *
     * 📍 LE VERROU VIENT DU MÊME UTIL QUE LUI, remonté du layer `ticketing` au niveau de
     * l'application pour l'occasion — un point d'API d'administration n'a pas à dépendre d'un
     * layer de billetterie, et recopier le motif l'aurait fait diverger.
     *
     * La clé ne porte pas d'identifiant : il n'y a qu'UNE base par processus, donc qu'une
     * sauvegarde possible à la fois.
     */
    return synchronisationUnique('sauvegarde', () => creerLaSauvegarde())
  },
  { operationName: 'CreateBackup' }
)

async function creerLaSauvegarde() {
  {
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

    /*
     * ⚠️ LE DUMP VA SUR LE DISQUE EN FLUX, et ne passe plus par la mémoire — constat O1.
     *
     * `execFile` capturait TOUTE la sortie de mysqldump dans un tampon de 50 Mo, puis l'écrivait
     * d'un bloc. Au-delà, Node tue le processus avec « stdout maxBuffer length exceeded » : le
     * bouton « Créer une sauvegarde » échoue net, sans contournement — et c'est précisément la
     * sauvegarde qu'on fait AVANT un déploiement risqué.
     *
     * 📊 Mesuré sur la base de développement : le dump pèse **5,9 Mo**, soit huit fois sous le
     * plafond. Ce n'est donc pas un incident, c'est une échéance — et les trois tables qui la
     * rapprochent sont celles qui grossissent toutes seules :
     *
     *   ApiErrorLog           779 lignes   2,95 Mo   (journal d'erreurs, piles d'appel comprises)
     *   Notification        2 380 lignes   2,23 Mo
     *   TicketingOrderItem  1 529 lignes   1,92 Mo
     *
     * À elles trois, 7,1 Mo des 17 Mo de la base. Une production plus ancienne franchit les 50 Mo
     * sans rien faire de particulier.
     *
     * 📍 LA RESTAURATION SAVAIT DÉJÀ TRAVAILLER EN FLUX (`backup-restore-job.ts`) : c'est la
     * création qui n'avait pas suivi. L'asymétrie était le défaut, et `spawn` + `pipeline` la
     * referme — plus aucun plafond, et la mémoire du processus ne dépend plus de la taille de la
     * base.
     *
     * `spawn` et non `execFile` : ce dernier capture par construction. Les arguments restent un
     * tableau (aucune injection de shell possible) et `MYSQL_PWD` garde le mot de passe hors de
     * la liste des processus.
     */
    journal.info('création du dump SQL')
    const dump = spawn(
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
      { env: { ...process.env, MYSQL_PWD: dbPassword } }
    )

    /*
     * ⚠️ LA SORTIE D'ERREUR EST LUE, ET BORNÉE. Sans lecture, un tuyau plein bloquerait
     * mysqldump indéfiniment — un dump qui ne finit jamais, sans message. Et sans borne, un
     * message d'erreur à répétition ramènerait le défaut qu'on vient de retirer.
     */
    let erreurDump = ''
    dump.stderr.setEncoding('utf8')
    dump.stderr.on('data', (morceau: string) => {
      if (erreurDump.length < 4096) erreurDump += morceau
    })

    const sortieDump = new Promise<void>((resolve, reject) => {
      dump.on('error', reject)
      dump.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`mysqldump a terminé avec le code ${code} : ${erreurDump.trim()}`))
      })
    })

    try {
      // Les deux ensemble : si l'écriture échoue, on n'attend pas la fin du dump pour le savoir.
      await Promise.all([pipeline(dump.stdout, createWriteStream(sqlPath)), sortieDump])
    } catch (erreur) {
      // Un fichier à moitié écrit n'est pas une sauvegarde : il ne doit pas rester à côté des
      // vraies, où un administrateur le prendrait pour telle.
      await unlink(sqlPath).catch(() => {})
      throw erreur
    }

    journal.info('dump SQL créé', { fichier: sqlFilename })

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
      journal.info("aucun dossier d'uploads trouvé, sauvegarde SQL uniquement")
    }

    // Créer l'archive tar.gz avec le SQL et les uploads (si présents)
    // execFile avec arguments en tableau → pas de shell injection possible
    journal.info("création de l'archive tar.gz")

    const tarArgs: string[] = ['-czf', archivePath, '-C', backupsDir, sqlFilename]
    if (hasUploads) {
      if (path.isAbsolute(uploadsMountPath)) {
        // Archive depuis la racine pour les chemins absolus (/uploads)
        tarArgs.push('-C', '/', uploadsMountPath.replace(/^\//, ''))
      } else {
        tarArgs.push('-C', process.cwd(), uploadsMountPath)
      }
    }

    /*
     * 📍 `tar` écrit dans un FICHIER (`-czf`), donc sa sortie standard est vide : ce `maxBuffer`
     * ne borne pas l'archive, seulement d'éventuels messages. Il est gardé par prudence, mais il
     * ne faut pas y lire un plafond de taille — celui du dump, lui, en était un, et c'est l'objet
     * du constat O1.
     */
    await execFileAsync('tar', tarArgs, {
      maxBuffer: 1024 * 1024 * 10,
    })

    // Supprimer le fichier SQL temporaire (remplace execSync rm)
    await unlink(sqlPath)

    // Obtenir la taille de l'archive
    const archiveStats = await stat(archivePath)

    journal.info('archive de sauvegarde créée', { fichier: archiveFilename })

    return createSuccessResponse({
      filename: archiveFilename,
      path: archivePath,
      size: archiveStats.size,
      includesUploads: hasUploads,
    })
  }
}
