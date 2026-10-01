import { EventEmitter } from 'events'
import { createReadStream } from 'fs'
import { readFile, writeFile, stat } from 'fs/promises'
import { Readable, PassThrough } from 'stream'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  lancerRestauration,
  attendreRestauration,
  lireEtatRestauration,
  restaurationEnCours,
  _reinitialiserJobs,
} from '../../../../server/utils/backup-restore-job'

vi.mock('fs', () => {
  const mod = { createReadStream: vi.fn() }
  return { ...mod, default: { ...mod } }
})

vi.mock('fs/promises', () => {
  const mod = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    cp: vi.fn(),
    stat: vi.fn(),
    access: vi.fn().mockRejectedValue(new Error('no uploads')),
  }
  return { ...mod, default: { ...mod } }
})

const spawnMock = vi.hoisted(() => vi.fn())
const execFileMock = vi.hoisted(() =>
  vi.fn((...args: any[]) => {
    const cb = args[args.length - 1]
    if (typeof cb === 'function') cb(null, { stdout: '', stderr: '' })
  })
)

vi.mock('child_process', () => {
  const mod = {
    spawn: spawnMock,
    execFile: execFileMock,
  }
  return { ...mod, default: { ...mod } }
})

const prismaMock = (globalThis as any).prisma

/** Les commandes externes lancées, hors `tar`. */
const commandesLancees = () =>
  execFileMock.mock.calls.map((appel: any[]) => `${appel[0]} ${(appel[1] ?? []).join(' ')}`)

/** Faux `mysql` dont l'entrée standard est un vrai flux, pour que le dump y transite. */
const mockMysqlProcess = (exitCode = 0) => {
  spawnMock.mockImplementation(() => {
    const proc = new EventEmitter() as any
    proc.stdin = new PassThrough()
    proc.stdin.resume()
    proc.stderr = new EventEmitter()
    proc.stdin.on('finish', () => proc.emit('close', exitCode))
    return proc
  })
}

/** Tous les états successivement persistés dans `restore-state.json`. */
const etatsEcrits = () =>
  (writeFile as any).mock.calls
    .filter((call: any[]) => String(call[0]).endsWith('restore-state.json'))
    .map((call: any[]) => JSON.parse(call[1]))

const options = {
  source: { type: 'sql' as const, chemin: '/backups/dump.sql' },
  libelle: 'dump.sql',
  storedFilename: null,
  uploadsMountPath: '/uploads',
}

describe('backup-restore-job', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _reinitialiserJobs()
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/juggling'
    ;(writeFile as any).mockResolvedValue(undefined)
    mockMysqlProcess(0)
  })

  afterEach(() => {
    _reinitialiserJobs()
  })

  it('suit la progression et nomme la table en cours au fil du dump', async () => {
    // Un dump découpé comme le ferait la lecture d'un gros fichier : une table par morceau
    const morceaux = [
      '-- Table structure for table `Convention`\nDROP TABLE IF EXISTS `Convention`;\n',
      'INSERT INTO `Convention` VALUES (1),(2);\n',
      '-- Table structure for table `Edition`\nINSERT INTO `Edition` VALUES (3);\n',
    ]
    const taille = morceaux.join('').length
    ;(stat as any).mockResolvedValue({ size: taille })
    ;(createReadStream as any).mockImplementation(() =>
      Readable.from(morceaux.map((m) => Buffer.from(m)))
    )

    const etat = await lancerRestauration(options)
    await attendreRestauration(etat.id)

    const etats = etatsEcrits()
    const final = etats[etats.length - 1]
    expect(final.etape).toBe('TERMINEE')
    expect(final.pourcentage).toBe(100)
    expect(final.octetsEnvoyes).toBe(taille)
    // Les deux tables du dump ont été repérées
    expect(final.tablesVues).toBe(2)
    // La dernière table nommée pendant l'envoi est bien la seconde
    const pendantEnvoi = etats.filter((e: any) => e.etape === 'BASE_DE_DONNEES')
    expect(pendantEnvoi.at(-1)?.tableEnCours).toBe('Edition')
  })

  it("consigne l'échec de mysql dans l'état, faute de réponse HTTP pour le porter", async () => {
    ;(stat as any).mockResolvedValue({ size: 9 })
    ;(createReadStream as any).mockImplementation(() => Readable.from([Buffer.from('SELECT 1;')]))
    mockMysqlProcess(1)

    const etat = await lancerRestauration(options)
    await attendreRestauration(etat.id)

    const final = etatsEcrits().at(-1)
    expect(final.etape).toBe('ECHOUEE')
    expect(final.erreur).toContain('exit 1')
  })

  /**
   * ⚠️⚠️ LE DÉFAUT QUE CES CAS FERMENT BLOQUAIT LA BASE ENTIÈRE.
   *
   * La restauration versait le dump dans `mysql` et s'arrêtait là. Les tables créées DEPUIS la
   * sauvegarde n'y figurent pas, donc elles survivaient — tandis que `_prisma_migrations`, lui,
   * revenait à l'état du dump et déclarait la migration N non appliquée. Au déploiement suivant,
   * l'entrypoint (en `set -e`) rejouait N, échouait sur un `CREATE TABLE` déjà existant, et Prisma
   * passait en P3009 : plus aucune migration applicable avant intervention manuelle.
   *
   * Et rien, sur l'écran de restauration, ne signalait cet écart de schéma.
   */
  describe('restaurer une sauvegarde plus ancienne que le schéma', () => {
    const dumpAvec = (tables: string[]) => {
      const sql = tables
        .map((t) => `DROP TABLE IF EXISTS \`${t}\`;\nINSERT INTO \`${t}\` VALUES (1);\n`)
        .join('')
      ;(stat as any).mockResolvedValue({ size: sql.length })
      ;(createReadStream as any).mockImplementation(() => Readable.from([Buffer.from(sql)]))
      return sql
    }

    it('🔬 supprime les tables que la base porte et que la sauvegarde IGNORE', async () => {
      /*
       * L'assertion qui porte le point. `Nouveau` a été créée par une migration postérieure à la
       * sauvegarde : elle n'est pas dans le dump, donc le `DROP TABLE IF EXISTS` de mysqldump ne
       * la touche pas, et elle ferait échouer le `CREATE TABLE` de cette migration rejouée.
       */
      dumpAvec(['Convention', 'Edition'])
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { TABLE_NAME: 'Convention' },
        { TABLE_NAME: 'Edition' },
        { TABLE_NAME: 'Nouveau' },
        { TABLE_NAME: '_prisma_migrations' },
      ])

      const etat = await lancerRestauration(options)
      await attendreRestauration(etat.id)

      const drops = prismaMock.$executeRawUnsafe.mock.calls
        .map((appel: any[]) => String(appel[0]))
        .filter((sql: string) => sql.startsWith('DROP TABLE'))
      expect(drops).toHaveLength(1)
      expect(drops[0]).toContain('`Nouveau`')
      // ⚠️ Et SURTOUT PAS les tables du dump : lui les supprime et les recrée déjà. Les retirer
      // ici n'apporterait rien et exposerait à perdre la base si le dump était tronqué.
      expect(drops[0]).not.toContain('`Convention`')
      expect(drops[0]).not.toContain('`Edition`')
    })

    it('🔬 ne supprime RIEN quand la sauvegarde contient tout', async () => {
      /*
       * Le cas de loin le plus courant — une sauvegarde du jour — et celui où une suppression
       * serait un pur danger. C'est aussi ce qui distingue cette solution de « vider la base avant
       * d'injecter » : là, le risque serait pris à chaque restauration.
       */
      dumpAvec(['Convention', 'Edition'])
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { TABLE_NAME: 'Convention' },
        { TABLE_NAME: 'Edition' },
      ])

      const etat = await lancerRestauration(options)
      await attendreRestauration(etat.id)

      const drops = prismaMock.$executeRawUnsafe.mock.calls
        .map((appel: any[]) => String(appel[0]))
        .filter((sql: string) => sql.startsWith('DROP TABLE'))
      expect(drops).toEqual([])
      // Et pas de bascule inutile des contraintes non plus.
      expect(prismaMock.$executeRawUnsafe).not.toHaveBeenCalled()
    })

    it('désactive les contraintes AUTOUR du DROP, et les remet', async () => {
      // Ces tables se référencent entre elles : sans cela, l'ordre de suppression serait à deviner.
      // Et la remise en place est dans un `finally` — une contrainte laissée désactivée vaut pour
      // toute la connexion.
      dumpAvec(['Convention'])
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { TABLE_NAME: 'Convention' },
        { TABLE_NAME: 'Orpheline' },
      ])

      const etat = await lancerRestauration(options)
      await attendreRestauration(etat.id)

      const sqls = prismaMock.$executeRawUnsafe.mock.calls.map((a: any[]) => String(a[0]))
      expect(sqls[0]).toBe('SET FOREIGN_KEY_CHECKS = 0')
      expect(sqls[1]).toContain('DROP TABLE')
      expect(sqls[2]).toBe('SET FOREIGN_KEY_CHECKS = 1')
    })

    it('🔬 rejoue les MIGRATIONS après l’injection', async () => {
      /*
       * Seconde raison, distincte du P3009 : une fois le dump versé, la base est au schéma de la
       * SAUVEGARDE pendant que le code qui tourne est celui d'aujourd'hui. Toute requête touchant
       * une colonne plus récente répond 500, et le resterait jusqu'au prochain déploiement.
       */
      dumpAvec(['Convention'])
      prismaMock.$queryRawUnsafe.mockResolvedValue([{ TABLE_NAME: 'Convention' }])

      const etat = await lancerRestauration(options)
      await attendreRestauration(etat.id)

      expect(commandesLancees()).toContain('npx prisma migrate deploy')

      const etats = etatsEcrits()
      expect(etats.map((e: any) => e.etape)).toContain('MIGRATIONS')
      expect(etats.at(-1)?.etape).toBe('TERMINEE')
    })

    it('🔬 ÉCHOUE franchement si les migrations échouent', async () => {
      /*
       * ⚠️ L'assertion la plus importante après la première. Annoncer « restauration réussie »
       * alors que le schéma est resté en arrière reproduirait le défaut d'origine : un écart
       * silencieux, découvert au déploiement suivant par un P3009.
       */
      dumpAvec(['Convention'])
      prismaMock.$queryRawUnsafe.mockResolvedValue([{ TABLE_NAME: 'Convention' }])
      execFileMock.mockImplementation((...args: any[]) => {
        const cb = args[args.length - 1]
        if (args[0] === 'npx') return cb(new Error('P3009 migration failed'))
        if (typeof cb === 'function') cb(null, { stdout: '', stderr: '' })
      })

      const etat = await lancerRestauration(options)
      await attendreRestauration(etat.id)

      const final = etatsEcrits().at(-1)
      expect(final.etape).toBe('ECHOUEE')
      expect(final.erreur).toContain('P3009')
    })

    it('rend compte à l’écran des tables supprimées', async () => {
      // Restaurer une sauvegarde ancienne SUPPRIME des tables : l'administrateur doit le lire.
      // Rien ne le disait — c'est la moitié silencieuse du défaut d'origine.
      dumpAvec(['Convention'])
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { TABLE_NAME: 'Convention' },
        { TABLE_NAME: 'Orpheline' },
      ])

      const etat = await lancerRestauration(options)
      await attendreRestauration(etat.id)

      expect(etatsEcrits().at(-1)?.tablesSupprimees).toEqual(['Orpheline'])
    })
  })

  it('libère la place une fois la restauration terminée', async () => {
    ;(stat as any).mockResolvedValue({ size: 9 })
    ;(createReadStream as any).mockImplementation(() => Readable.from([Buffer.from('SELECT 1;')]))

    const etat = await lancerRestauration(options)
    expect(restaurationEnCours()).toBe(true)

    await attendreRestauration(etat.id)
    expect(restaurationEnCours()).toBe(false)
  })

  it('requalifie en INTERROMPUE un état resté en cours après un redémarrage du serveur', async () => {
    // Cet état vient du disque : aucune restauration ne tourne dans ce processus
    ;(readFile as any).mockResolvedValue(
      JSON.stringify({
        id: 'restore-123',
        etape: 'BASE_DE_DONNEES',
        source: 'dump.sql',
        pourcentage: 42,
        tableEnCours: 'Edition',
      })
    )

    const etat = await lireEtatRestauration()

    expect(etat?.etape).toBe('INTERROMPUE')
    // Pas de message : l'explication est traduite côté client, pas écrite en dur ici
    expect(etat?.erreur).toBeNull()
    // La requalification est persistée : elle ne sera pas recalculée à chaque lecture
    expect(etatsEcrits().at(-1).etape).toBe('INTERROMPUE')
  })

  it('laisse intact un état déjà terminé', async () => {
    ;(readFile as any).mockResolvedValue(
      JSON.stringify({ id: 'restore-123', etape: 'TERMINEE', pourcentage: 100 })
    )

    expect((await lireEtatRestauration())?.etape).toBe('TERMINEE')
  })

  it("rend null quand aucune restauration n'a jamais eu lieu", async () => {
    ;(readFile as any).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    expect(await lireEtatRestauration()).toBeNull()
  })
})
