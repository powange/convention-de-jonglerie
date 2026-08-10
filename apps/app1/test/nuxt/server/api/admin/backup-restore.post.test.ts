import { EventEmitter } from 'events'
import { createReadStream } from 'fs'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/admin/backup/restore.post'

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
    unlink: vi.fn(),
    cp: vi.fn(),
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

// Fabrique un faux processus mysql qui se termine avec le code fourni
const mockMysqlProcess = (exitCode: number) => {
  spawnMock.mockImplementation(() => {
    const proc = new EventEmitter() as any
    proc.stdin = {}
    proc.stderr = new EventEmitter()
    process.nextTick(() => proc.emit('close', exitCode))
    return proc
  })
}

// Le chemin passé au writeFile visant le dossier `backups`
const storedBackupPath = () =>
  (writeFile as any).mock.calls
    .map((call: any[]) => call[0] as string)
    .find((target: string) => target.includes(`${path.sep}backups${path.sep}`))

describe('/api/admin/backup/restore POST', () => {
  const adminEvent = { context: { user: { id: 1, isGlobalAdmin: true } } }

  const uploadSql = (filename: string, content = 'SELECT 1;') => {
    g.getHeader = vi.fn().mockReturnValue('multipart/form-data; boundary=xxx')
    g.readMultipartFormData = vi
      .fn()
      .mockResolvedValue([{ filename, data: Buffer.from(content, 'utf8'), name: 'file' }])
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/juggling'
    g.requireGlobalAdminWithDbCheck = vi.fn().mockResolvedValue({ id: 1 })
    g.useRuntimeConfig = vi.fn().mockReturnValue({ fileStorage: { mount: '/uploads' } })
    ;(createReadStream as any).mockReturnValue({ pipe: vi.fn() })
    ;(mkdir as any).mockResolvedValue(undefined)
    ;(writeFile as any).mockResolvedValue(undefined)
    mockMysqlProcess(0)
  })

  it('conserve le fichier uploadé dans `backups` après une restauration réussie', async () => {
    uploadSql('dump-prod.sql')

    const result = await handler(adminEvent as any)

    expect(storedBackupPath()).toMatch(/backups.*uploaded-.*dump-prod\.sql$/)
    expect(result.data.storedFilename).toMatch(/^uploaded-.*dump-prod\.sql$/)
  })

  it('conserve le fichier uploadé même si la restauration mysql échoue', async () => {
    uploadSql('dump-casse.sql')
    mockMysqlProcess(1)

    await expect(handler(adminEvent as any)).rejects.toThrow()

    // Le fichier a été écrit dans `backups` avant la tentative de restauration
    expect(storedBackupPath()).toMatch(/backups.*uploaded-.*dump-casse\.sql$/)
  })

  it('neutralise un nom de fichier tentant un path traversal', async () => {
    uploadSql('../../etc/passwd.sql')

    const result = await handler(adminEvent as any)

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

  it('restaure toujours si la conservation du fichier échoue', async () => {
    uploadSql('dump-prod.sql')
    ;(writeFile as any).mockImplementation((target: string) =>
      target.includes(`${path.sep}backups${path.sep}`)
        ? Promise.reject(new Error('disque plein'))
        : Promise.resolve()
    )

    const result = await handler(adminEvent as any)

    expect(spawnMock).toHaveBeenCalled()
    expect(result.data.storedFilename).toBeNull()
  })

  it("n'ajoute rien à `backups` lors d'une restauration depuis un fichier existant", async () => {
    g.getHeader = vi.fn().mockReturnValue('application/json')
    g.readBody = vi.fn().mockResolvedValue({ filename: 'juggling-backup.sql' })
    const { readFile } = await import('fs/promises')
    ;(readFile as any).mockResolvedValue('SELECT 1;')

    const result = await handler(adminEvent as any)

    expect(storedBackupPath()).toBeUndefined()
    expect(result.data.storedFilename).toBeNull()
  })
})
