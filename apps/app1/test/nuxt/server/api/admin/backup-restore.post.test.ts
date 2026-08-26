import { EventEmitter } from 'events'
import { createReadStream } from 'fs'
import { writeFile, mkdir, stat } from 'fs/promises'
import path from 'path'
import { Readable, PassThrough } from 'stream'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import handler from '../../../../../server/api/admin/backup/restore.post'
import {
  attendreRestauration,
  _reinitialiserJobs,
} from '../../../../../server/utils/backup-restore-job'

// Mock des modules Node.js : aucun accès disque ni processus mysql réel
vi.mock('fs', () => {
  const mod = { createReadStream: vi.fn() }
  return { ...mod, default: { ...mod } }
})

vi.mock('fs/promises', () => {
  const mod = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
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

const g = global as any

/**
 * Faux processus mysql : son entrée standard est un vrai flux, le dump y transite donc
 * réellement — c'est ce qui permet de vérifier la progression. Il se ferme avec le code
 * fourni une fois le dump intégralement reçu.
 */
const mockMysqlProcess = (exitCode: number) => {
  spawnMock.mockImplementation(() => {
    const proc = new EventEmitter() as any
    proc.stdin = new PassThrough()
    proc.stdin.resume()
    proc.stderr = new EventEmitter()
    proc.stdin.on('finish', () => proc.emit('close', exitCode))
    return proc
  })
}

// Le chemin passé au writeFile visant le dossier `backups`
const storedBackupPath = () =>
  (writeFile as any).mock.calls
    .map((call: any[]) => call[0] as string)
    .find(
      (target: string) =>
        target.includes(`${path.sep}backups${path.sep}`) && !target.endsWith('restore-state.json')
    )

/** Dernier état persisté dans `restore-state.json`. */
const dernierEtat = () => {
  const ecritures = (writeFile as any).mock.calls.filter((call: any[]) =>
    String(call[0]).endsWith('restore-state.json')
  )
  const derniere = ecritures[ecritures.length - 1]
  return derniere ? JSON.parse(derniere[1]) : null
}

describe('/api/admin/backup/restore POST', () => {
  const adminEvent = { context: { user: { id: 1, isGlobalAdmin: true } } }

  const uploadSql = (filename: string, content = 'SELECT 1;') => {
    g.getHeader = vi.fn().mockReturnValue('multipart/form-data; boundary=xxx')
    g.readMultipartFormData = vi
      .fn()
      .mockResolvedValue([{ filename, data: Buffer.from(content, 'utf8'), name: 'file' }])
  }

  /** Lance le handler puis attend que la restauration de fond soit terminée. */
  const restaurerEtAttendre = async () => {
    const result = await handler(adminEvent as any)
    await attendreRestauration(result.data.jobId)
    return result
  }

  beforeEach(() => {
    vi.clearAllMocks()
    _reinitialiserJobs()
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/juggling'
    g.requireGlobalAdminWithDbCheck = vi.fn().mockResolvedValue({ id: 1 })
    g.useRuntimeConfig = vi.fn().mockReturnValue({ fileStorage: { mount: '/uploads' } })
    ;(createReadStream as any).mockImplementation(() => Readable.from([Buffer.from('SELECT 1;')]))
    ;(mkdir as any).mockResolvedValue(undefined)
    ;(writeFile as any).mockResolvedValue(undefined)
    ;(stat as any).mockResolvedValue({ size: 9 })
    mockMysqlProcess(0)
  })

  afterEach(() => {
    _reinitialiserJobs()
  })

  it('rend la main sans attendre la fin de la restauration', async () => {
    uploadSql('dump-prod.sql')

    const result = await handler(adminEvent as any)

    // La réponse arrive alors que la restauration n'a pas encore été menée à son terme
    expect(result.data.jobId).toMatch(/^restore-/)
    expect(result.data.etat.etape).toBe('PREPARATION')

    await attendreRestauration(result.data.jobId)
    expect(dernierEtat().etape).toBe('TERMINEE')
  })

  it('conserve le fichier uploadé dans `backups` après une restauration réussie', async () => {
    uploadSql('dump-prod.sql')

    const result = await restaurerEtAttendre()

    expect(storedBackupPath()).toMatch(/backups.*uploaded-.*dump-prod\.sql$/)
    expect(result.data.storedFilename).toMatch(/^uploaded-.*dump-prod\.sql$/)
  })

  it('conserve le fichier uploadé même si la restauration mysql échoue', async () => {
    uploadSql('dump-casse.sql')
    mockMysqlProcess(1)

    await restaurerEtAttendre()

    // Le fichier a été écrit dans `backups` avant la tentative de restauration
    expect(storedBackupPath()).toMatch(/backups.*uploaded-.*dump-casse\.sql$/)
    // Et l'échec est consigné dans l'état, faute de réponse HTTP pour le porter
    const etat = dernierEtat()
    expect(etat.etape).toBe('ECHOUEE')
    expect(etat.erreur).toContain('exit 1')
  })

  it('neutralise un nom de fichier tentant un path traversal', async () => {
    uploadSql('../../etc/passwd.sql')

    const result = await restaurerEtAttendre()

    const stored = storedBackupPath()
    expect(path.dirname(stored)).toBe(path.join(process.cwd(), 'backups'))
    expect(stored).not.toContain('..')
    expect(result.data.storedFilename).toMatch(/^uploaded-.*passwd\.sql$/)
  })

  it("n'écrit rien et rejette un format de fichier non supporté", async () => {
    uploadSql('malicieux.exe')

    await expect(handler(adminEvent as any)).rejects.toThrow()

    expect(storedBackupPath()).toBeUndefined()
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('rejette un format non supporté depuis un fichier existant', async () => {
    g.getHeader = vi.fn().mockReturnValue('application/json')
    g.readBody = vi.fn().mockResolvedValue({ filename: 'notes.txt' })

    await expect(handler(adminEvent as any)).rejects.toThrow()

    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('restaure toujours si la conservation du fichier échoue', async () => {
    uploadSql('dump-prod.sql')
    ;(writeFile as any).mockImplementation((target: string) =>
      target.includes(`${path.sep}backups${path.sep}`)
        ? Promise.reject(new Error('disque plein'))
        : Promise.resolve()
    )

    const result = await restaurerEtAttendre()

    expect(spawnMock).toHaveBeenCalled()
    expect(result.data.storedFilename).toBeNull()
  })

  it("n'ajoute rien à `backups` lors d'une restauration depuis un fichier existant", async () => {
    g.getHeader = vi.fn().mockReturnValue('application/json')
    g.readBody = vi.fn().mockResolvedValue({ filename: 'juggling-backup.sql' })

    const result = await restaurerEtAttendre()

    expect(storedBackupPath()).toBeUndefined()
    expect(result.data.storedFilename).toBeNull()
  })

  it('refuse une seconde restauration tant que la première tourne', async () => {
    uploadSql('dump-prod.sql')
    const premiere = await handler(adminEvent as any)

    uploadSql('autre-dump.sql')
    await expect(handler(adminEvent as any)).rejects.toThrow()

    await attendreRestauration(premiere.data.jobId)
    // Une fois la première terminée, la voie est de nouveau libre
    uploadSql('autre-dump.sql')
    await expect(restaurerEtAttendre()).resolves.toBeTruthy()
  })
})
