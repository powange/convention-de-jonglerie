import { execFile, spawn } from 'child_process'
import { createReadStream } from 'fs'
import { readFile, writeFile, mkdir, rm, readdir, cp, stat } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { Transform } from 'stream'
import { promisify } from 'util'

import { backupsDir } from './backup-files'

import {
  restaurationEnCoursDapres,
  type EtapeRestauration,
} from '~~/shared/utils/etapes-restauration'

export type { EtapeRestauration }

const execFileAsync = promisify(execFile)

export interface EtatRestauration {
  id: string
  etape: EtapeRestauration
  /** Nom de la sauvegarde en cours de restauration, tel qu'affiché à l'utilisateur. */
  source: string
  /** Nom sous lequel un fichier uploadé a été conservé dans `backups` (null sinon). */
  storedFilename: string | null
  demarreeA: string
  termineeA: string | null
  octetsEnvoyes: number
  octetsTotal: number
  /** Progression 0-100 de ce qui a été transmis à mysql (voir la note sur la précision). */
  pourcentage: number
  tableEnCours: string | null
  /**
   * Les tables retirées avant l'injection parce qu'absentes de la sauvegarde.
   *
   * Rendu à l'écran : restaurer une sauvegarde ancienne SUPPRIME des tables, et l'administrateur
   * doit le lire. Rien ne le disait — c'est la moitié silencieuse du défaut d'origine.
   */
  tablesSupprimees: string[]
  tablesVues: number
  erreur: string | null
}

/** Source du SQL à restaurer : un dump nu, ou une archive dont il faut l'extraire. */
export interface SourceRestauration {
  type: 'sql' | 'archive'
  chemin: string
}

export interface OptionsRestauration {
  source: SourceRestauration
  /** Nom affiché dans le suivi. */
  libelle: string
  storedFilename: string | null
  uploadsMountPath: string
  /** Chemins temporaires à supprimer une fois la restauration terminée. */
  aNettoyer?: string[]
}

/**
 * L'état vit dans un fichier, et non en base : la restauration écrase justement la base,
 * une table de suivi serait remplacée par le contenu du dump en plein milieu. Le dossier
 * `backups` est monté sur un volume persistant, l'état survit donc aussi à un redémarrage
 * du conteneur — c'est ce qui permet de signaler une restauration interrompue.
 */
const cheminEtat = () => path.join(backupsDir(), 'restore-state.json')

export const estEnCours = restaurationEnCoursDapres

/**
 * Restaurations lancées par CE processus. Un état « en cours » sur le disque sans entrée
 * ici signifie que le serveur a redémarré pendant la restauration : le processus `mysql`
 * enfant est mort avec lui, la base est restée à moitié restaurée.
 */
const jobsEnCours = new Map<string, Promise<void>>()

/** Une restauration est-elle en cours dans ce processus ? */
export const restaurationEnCours = () => jobsEnCours.size > 0

/** Permet aux tests d'attendre la fin d'une restauration lancée en tâche de fond. */
export const attendreRestauration = (id: string) => jobsEnCours.get(id)

async function ecrireEtat(etat: EtatRestauration): Promise<void> {
  try {
    await mkdir(backupsDir(), { recursive: true })
    await writeFile(cheminEtat(), JSON.stringify(etat, null, 2), 'utf8')
  } catch (error) {
    // Le suivi est un confort : son échec ne doit jamais interrompre la restauration.
    console.warn("Impossible d'écrire l'état de la restauration:", error)
  }
}

/**
 * Lit l'état de la dernière restauration, ou `null` s'il n'y en a jamais eu.
 * Requalifie en `INTERROMPUE` un état resté « en cours » alors qu'aucune restauration
 * ne tourne dans ce processus.
 */
export async function lireEtatRestauration(): Promise<EtatRestauration | null> {
  let brut: string
  try {
    brut = await readFile(cheminEtat(), 'utf8')
  } catch {
    return null
  }

  let etat: EtatRestauration
  try {
    etat = JSON.parse(brut)
  } catch {
    return null
  }

  if (estEnCours(etat.etape) && !jobsEnCours.has(etat.id)) {
    const interrompu: EtatRestauration = {
      ...etat,
      etape: 'INTERROMPUE',
      termineeA: new Date().toISOString(),
      erreur: null,
    }
    await ecrireEtat(interrompu)
    return interrompu
  }

  return etat
}

/**
 * Repère la table en cours dans le flux SQL. `mysqldump` nomme la table sur chacune de ces
 * lignes ; on retient la dernière rencontrée dans le morceau lu.
 */
const MOTIF_TABLE =
  /(?:INSERT INTO|REPLACE INTO|LOCK TABLES|DROP TABLE IF EXISTS|CREATE TABLE(?: IF NOT EXISTS)?|-- Table structure for table|-- Dumping data for table)\s+`([^`]+)`/g

/** De quoi retrouver un marqueur coupé en deux entre deux morceaux du flux. */
const TAILLE_CHEVAUCHEMENT = 200

/** Le suivi n'a pas besoin d'être écrit à chaque morceau lu. */
const INTERVALLE_ECRITURE_MS = 500

/**
 * Compte les octets transmis à `mysql` et suit la table en cours, sans retenir le dump
 * en mémoire : les morceaux sont réémis tels quels vers l'entrée standard de `mysql`.
 */
function suiviProgression(
  etat: EtatRestauration,
  tables: Set<string>,
  onProgression: () => void
): Transform {
  let reste = ''

  return new Transform({
    transform(morceau, _encodage, suite) {
      etat.octetsEnvoyes += morceau.length
      etat.pourcentage = etat.octetsTotal
        ? Math.min(100, Math.round((etat.octetsEnvoyes / etat.octetsTotal) * 100))
        : 0

      const texte = reste + morceau.toString('utf8')
      MOTIF_TABLE.lastIndex = 0
      let correspondance: RegExpExecArray | null
      while ((correspondance = MOTIF_TABLE.exec(texte)) !== null) {
        etat.tableEnCours = correspondance[1]!
        tables.add(correspondance[1]!)
      }
      etat.tablesVues = tables.size
      reste = texte.slice(-TAILLE_CHEVAUCHEMENT)

      onProgression()
      suite(null, morceau)
    },
  })
}

/**
 * L'URL de la base visée, ou un échec franc.
 *
 * Extraite parce que trois étapes en ont besoin — la suppression des tables orphelines, le dump et
 * le nom de base journalisé —, et qu'un `process.env.DATABASE_URL` relu à chaque endroit finirait
 * par diverger sur le traitement de son absence.
 */
function databaseUrlCourante(): string {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('Configuration de base de données manquante')
  }
  return databaseUrl
}

/** Envoie le dump à `mysql`, en tenant l'état à jour au fil de l'eau. */
function executerDump(cheminSql: string, etat: EtatRestauration): Promise<void> {
  let databaseUrl: string
  try {
    databaseUrl = databaseUrlCourante()
  } catch (erreur) {
    return Promise.reject(erreur)
  }

  const dbUrl = new URL(databaseUrl)
  const dbName = dbUrl.pathname.slice(1)
  const tables = new Set<string>()
  let derniereEcriture = 0

  const onProgression = () => {
    const maintenant = Date.now()
    if (maintenant - derniereEcriture < INTERVALLE_ECRITURE_MS) return
    derniereEcriture = maintenant
    void ecrireEtat(etat)
  }

  return new Promise<void>((resolve, reject) => {
    // - arguments en tableau (pas d'injection shell)
    // - MYSQL_PWD évite d'exposer le mot de passe dans la liste des processus
    const mysqlProcess = spawn(
      'mysql',
      [`-h${dbUrl.hostname}`, `-P${dbUrl.port || '3306'}`, `-u${dbUrl.username}`, dbName],
      { env: { ...process.env, MYSQL_PWD: dbUrl.password } }
    )

    const sqlStream = createReadStream(cheminSql)
    sqlStream.on('error', reject)
    // Si `mysql` s'arrête avant la fin du dump, l'écriture dans son entrée standard échoue
    // en EPIPE. Sans écouteur, cet événement `error` ferait tomber le processus Nitro
    // entier ; l'échec est de toute façon rapporté par le code de sortie de `mysql`.
    mysqlProcess.stdin.on('error', () => {})
    sqlStream.pipe(suiviProgression(etat, tables, onProgression)).pipe(mysqlProcess.stdin)

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
}

/**
 * Les tables que ce dump déclare, lues sans le charger en mémoire.
 *
 * `mysqldump --add-drop-table` fait précéder chaque table d'un `DROP TABLE IF EXISTS` : les tables
 * du dump sont donc remplacées proprement, quoi qu'il arrive. Ce qu'on cherche ici, ce sont les
 * AUTRES — celles que la base porte et que le dump ignore.
 *
 * Le même motif que le suivi de progression, et c'est voulu : une seule définition de « ce qui
 * nomme une table dans un dump ».
 */
async function tablesDuDump(cheminSql: string): Promise<Set<string>> {
  const trouvees = new Set<string>()
  let reste = ''

  await new Promise<void>((resolve, reject) => {
    const flux = createReadStream(cheminSql, { encoding: 'utf8' })
    flux.on('error', reject)
    flux.on('data', (morceau) => {
      const texte = reste + String(morceau)
      MOTIF_TABLE.lastIndex = 0
      let correspondance: RegExpExecArray | null
      while ((correspondance = MOTIF_TABLE.exec(texte)) !== null) {
        trouvees.add(correspondance[1]!)
      }
      // Un marqueur coupé entre deux morceaux serait perdu sans ce chevauchement.
      reste = texte.slice(-TAILLE_CHEVAUCHEMENT)
    })
    flux.on('end', () => resolve())
  })

  return trouvees
}

/**
 * Supprime les tables que la base porte et que le dump NE CONTIENT PAS.
 *
 * ⚠️⚠️ LE DÉFAUT QUE CECI RÉPARE BLOQUAIT LA BASE ENTIÈRE. La restauration se contentait de verser
 * le dump dans `mysql`. Les tables créées DEPUIS la sauvegarde n'y figurent pas, donc elles
 * survivaient — tandis que `_prisma_migrations`, lui, revenait à l'état du dump et déclarait la
 * migration N non appliquée. Au déploiement suivant, l'entrypoint (en `set -e`) rejouait N, qui
 * échouait sur un `CREATE TABLE` déjà existant, et Prisma passait en P3009 : plus AUCUNE migration
 * ne peut alors être appliquée avant une intervention manuelle. Ce dépôt a déjà connu un P3009, et
 * il immobilise tout.
 *
 * 📍 ON NE VIDE PAS LA BASE, contrairement à ce qu'on pourrait croire plus simple — et c'est une
 * décision. Tout supprimer avant d'injecter ajouterait un risque réel : un dump tronqué ou corrompu
 * laisserait alors une base VIDE, là qu'aujourd'hui il laisse au moins les tables qu'il n'a pas
 * atteintes. Ne retirer que les orphelines ferme le P3009 sans rien ajouter : les tables du dump
 * étaient déjà supprimées et recréées par lui.
 *
 * `FOREIGN_KEY_CHECKS=0` est indispensable : ces tables se référencent entre elles, et l'ordre de
 * suppression serait sinon à deviner.
 */
async function supprimerTablesOrphelines(
  cheminSql: string,
  databaseUrl: string
): Promise<string[]> {
  const nomDeBase = new URL(databaseUrl).pathname.slice(1)

  const lignes = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
    nomDeBase
  )
  const enBase = lignes.map((l) => l.TABLE_NAME)
  if (enBase.length === 0) return []

  const duDump = await tablesDuDump(cheminSql)
  const orphelines = enBase.filter((table) => !duDump.has(table))
  if (orphelines.length === 0) return []

  /*
   * ⚠️ Les noms viennent d'`information_schema`, donc de la base elle-même, et non d'une saisie.
   * Ils sont tout de même entourés d'accents graves et ceux qu'ils pourraient contenir sont
   * doublés : une table nommée de travers ne doit pas pouvoir refermer l'identifiant.
   */
  const identifiants = orphelines.map((t) => '`' + t.replace(/`/g, '``') + '`').join(', ')

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0')
  try {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${identifiants}`)
  } finally {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1')
  }

  console.log(
    `Tables absentes de la sauvegarde supprimées avant restauration : ${orphelines.join(', ')}`
  )
  return orphelines
}

/**
 * Rejoue les migrations après la restauration.
 *
 * ⚠️ NÉCESSAIRE POUR UNE SECONDE RAISON, distincte du P3009. Une fois le dump versé, la base est au
 * schéma de la SAUVEGARDE pendant que le code qui tourne est celui d'AUJOURD'HUI : toute requête
 * touchant une colonne ou une relation plus récente répond 500, et le restera jusqu'au prochain
 * déploiement. Supprimer les tables orphelines débloque les migrations à venir ; les appliquer ici
 * remet l'application en état de marche tout de suite.
 *
 * C'est exactement la commande du point d'entrée du conteneur, depuis le même répertoire : le
 * dossier `prisma/` est présent dans l'image de production (Dockerfile) et `migrate deploy` y est
 * déjà lancé à chaque démarrage. Rien de neuf, donc, sinon le moment.
 */
async function appliquerMigrations(): Promise<void> {
  const { stdout, stderr } = await execFileAsync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 10,
  })
  console.log('Migrations après restauration :', stdout || stderr)
}

/**
 * Trouve récursivement le premier fichier .sql dans un dossier.
 * Remplace l'usage non-sécurisé de `find` via execSync.
 */
export async function findFirstSqlFile(dir: string): Promise<string | null> {
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

/** Restaure les fichiers uploads présents dans l'archive extraite, s'il y en a. */
async function restaurerUploads(dossierExtrait: string, uploadsMountPath: string): Promise<void> {
  const extractedUploadsPath = path.join(dossierExtrait, uploadsMountPath.replace(/^\//, ''))
  try {
    await import('fs').then((fs) => fs.promises.access(extractedUploadsPath))

    // Le chemin de destination dépend si uploadsMountPath est absolu ou relatif
    const uploadsDestPath = path.isAbsolute(uploadsMountPath)
      ? uploadsMountPath
      : path.join(process.cwd(), uploadsMountPath)

    await rm(uploadsDestPath, { recursive: true, force: true }).catch(() => {})
    await mkdir(uploadsDestPath, { recursive: true })
    await cp(extractedUploadsPath, uploadsDestPath, { recursive: true })

    console.log('Fichiers uploads restaurés avec succès')
  } catch (error) {
    console.log('Aucun fichier uploads à restaurer dans cette archive', error)
  }
}

async function deroulerRestauration(etat: EtatRestauration, options: OptionsRestauration) {
  const aNettoyer = [...(options.aNettoyer ?? [])]
  let dossierExtrait: string | null = null

  try {
    let cheminSql = options.source.chemin

    if (options.source.type === 'archive') {
      dossierExtrait = path.join(tmpdir(), `extraction-${etat.id}`)
      aNettoyer.push(dossierExtrait)
      await mkdir(dossierExtrait, { recursive: true })
      await execFileAsync('tar', ['-xzf', options.source.chemin, '-C', dossierExtrait], {
        maxBuffer: 1024 * 1024 * 100,
      })

      const sqlFile = await findFirstSqlFile(dossierExtrait)
      if (!sqlFile) {
        throw new Error("Aucun fichier SQL trouvé dans l'archive")
      }
      cheminSql = sqlFile
    }

    etat.octetsTotal = (await stat(cheminSql)).size
    etat.etape = 'BASE_DE_DONNEES'
    await ecrireEtat(etat)

    /*
     * Avant d'injecter : retirer les tables que la base porte et que la sauvegarde ignore. Sans
     * cela, restaurer une sauvegarde antérieure à une migration laisse ces tables en place tandis
     * que `_prisma_migrations` revient en arrière — et le déploiement suivant échoue en P3009,
     * bloquant TOUTE migration ultérieure. Voir `supprimerTablesOrphelines`.
     */
    const orphelines = await supprimerTablesOrphelines(cheminSql, databaseUrlCourante())
    etat.tablesSupprimees = orphelines

    console.log('Restauration de la base de données en cours...')
    await executerDump(cheminSql, etat)
    console.log('Base de données restaurée avec succès')

    // Le flux est intégralement transmis : quel que soit l'arrondi, on est à 100 %.
    etat.pourcentage = 100
    etat.octetsEnvoyes = etat.octetsTotal

    /*
     * Puis rejouer les migrations : la base est au schéma de la sauvegarde, le code au schéma
     * d'aujourd'hui. Sans cette étape, l'application répond 500 sur tout ce qui touche une colonne
     * plus récente, jusqu'au prochain déploiement.
     */
    etat.etape = 'MIGRATIONS'
    etat.tableEnCours = null
    await ecrireEtat(etat)
    await appliquerMigrations()

    if (dossierExtrait) {
      etat.etape = 'FICHIERS'
      etat.tableEnCours = null
      await ecrireEtat(etat)
      await restaurerUploads(dossierExtrait, options.uploadsMountPath)
    }

    etat.etape = 'TERMINEE'
    etat.tableEnCours = null
    etat.termineeA = new Date().toISOString()
    await ecrireEtat(etat)
  } catch (error: any) {
    etat.etape = 'ECHOUEE'
    etat.termineeA = new Date().toISOString()
    etat.erreur = error?.message || 'Erreur inconnue'
    await ecrireEtat(etat)
    console.error('Échec de la restauration:', error)
  } finally {
    for (const chemin of aNettoyer) {
      try {
        await rm(chemin, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn(`Impossible de supprimer ${chemin}:`, cleanupError)
      }
    }
  }
}

/**
 * Lance une restauration en tâche de fond et rend immédiatement son identifiant.
 * La restauration se poursuit même si le client ferme la fenêtre : son avancement se lit
 * via `lireEtatRestauration`.
 */
export function lancerRestauration(options: OptionsRestauration): EtatRestauration {
  const id = `restore-${Date.now()}`
  const etat: EtatRestauration = {
    id,
    etape: 'PREPARATION',
    source: options.libelle,
    storedFilename: options.storedFilename,
    demarreeA: new Date().toISOString(),
    termineeA: null,
    octetsEnvoyes: 0,
    octetsTotal: 0,
    pourcentage: 0,
    tableEnCours: null,
    tablesVues: 0,
    tablesSupprimees: [],
    erreur: null,
  }
  const promesse = (async () => {
    await ecrireEtat(etat)
    await deroulerRestauration(etat, options)
  })().finally(() => {
    jobsEnCours.delete(id)
  })
  // Inscription synchrone : sans elle, deux requêtes simultanées passeraient toutes deux
  // le contrôle d'unicité avant que la première ne se soit déclarée.
  jobsEnCours.set(id, promesse)
  // La restauration tourne pour son propre compte : personne n'attend cette promesse.
  promesse.catch(() => {})

  // Un instantané : l'objet interne continue d'être modifié au fil de la restauration,
  // le rendre tel quel exposerait un état mouvant à l'appelant.
  return { ...etat }
}

/** Réservé aux tests : vide le registre des restaurations en cours. */
export const _reinitialiserJobs = () => jobsEnCours.clear()

/** Réservé aux tests : le chemin du fichier d'état. */
export const _cheminEtat = cheminEtat
