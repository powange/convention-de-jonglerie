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

vi.mock('child_process', () => {
  const mod = {
    spawn: spawnMock,
    execFile: vi.fn((...args: any[]) => {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') cb(null, { stdout: '', stderr: '' })
    }),
  }
  return { ...mod, default: { ...mod } }
})

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
