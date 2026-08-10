import { Readable, Writable } from 'stream'

import { mkdir, rename, rm } from 'fs/promises'
import path from 'path'

import { createWriteStream } from 'fs'

import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/admin/backup/upload.post'

const written = vi.hoisted(() => ({ chunks: [] as Buffer[], path: '' }))

// Le flux d'écriture est simulé : rien ne touche le disque, on collecte les octets reçus
vi.mock('fs', () => {
  const mod = {
    createWriteStream: vi.fn((target: string) => {
      written.path = target
      written.chunks = []
      return new Writable({
        write(chunk: Buffer, _encoding: string, callback: () => void) {
          written.chunks.push(chunk)
          callback()
        },
      })
    }),
  }
  return { ...mod, default: { ...mod } }
})

vi.mock('fs/promises', () => {
  const mod = { mkdir: vi.fn(), rename: vi.fn(), rm: vi.fn() }
  return { ...mod, default: { ...mod } }
})

const g = global as any

describe('/api/admin/backup/upload POST', () => {
  // Le corps est le fichier brut : on simule le flux de requête entrant
  const eventWithBody = (filename: string, content = 'SELECT 1;') => {
    g.getHeader = vi.fn((_event: any, name: string) =>
      name === 'x-backup-filename' ? encodeURIComponent(filename) : undefined
    )
    return {
      context: { user: { id: 1, isGlobalAdmin: true } },
      node: { req: Readable.from([Buffer.from(content, 'utf8')]) },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    written.chunks = []
    written.path = ''
    g.requireGlobalAdminWithDbCheck = vi.fn().mockResolvedValue({ id: 1 })
    ;(mkdir as any).mockResolvedValue(undefined)
    ;(rename as any).mockResolvedValue(undefined)
    ;(rm as any).mockResolvedValue(undefined)
  })

  it('écrit le fichier dans `backups` sans rien restaurer', async () => {
    const result = await handler(eventWithBody('dump-prod.sql') as any)

    expect(path.dirname(written.path)).toBe(path.join(process.cwd(), 'backups'))
    expect(Buffer.concat(written.chunks).toString()).toBe('SELECT 1;')
    expect(result.data.storedFilename).toMatch(/^uploaded-.*dump-prod\.sql$/)
    expect(result.data.size).toBe(9)
  })

  it('écrit sous `.part` puis renomme, pour ne jamais exposer un fichier tronqué', async () => {
    await handler(eventWithBody('dump-prod.sql') as any)

    expect(written.path.endsWith('.part')).toBe(true)
    const [from, to] = (rename as any).mock.calls[0]
    expect(from).toBe(written.path)
    expect(to).toBe(written.path.replace(/\.part$/, ''))
  })

  it('accepte une archive tar.gz', async () => {
    const result = await handler(eventWithBody('backup-complet.tar.gz') as any)

    expect(result.data.storedFilename).toMatch(/^uploaded-.*backup-complet\.tar\.gz$/)
  })

  it('neutralise un nom de fichier tentant un path traversal', async () => {
    await handler(eventWithBody('../../etc/passwd.sql') as any)

    expect(path.dirname(written.path)).toBe(path.join(process.cwd(), 'backups'))
    expect(written.path).not.toContain('..')
  })

  it('décode un nom de fichier accentué', async () => {
    const result = await handler(eventWithBody('sauvegarde-été.sql') as any)

    // Les caractères hors [A-Za-z0-9._-] sont neutralisés par le nommage sûr
    expect(result.data.storedFilename).toMatch(/^uploaded-.*sauvegarde-.*\.sql$/)
  })

  it('rejette un format non supporté sans rien écrire', async () => {
    await expect(handler(eventWithBody('malicieux.exe') as any)).rejects.toThrow()
    expect(createWriteStream).not.toHaveBeenCalled()
  })

  it('rejette une requête sans nom de fichier', async () => {
    g.getHeader = vi.fn().mockReturnValue(undefined)
    const event = {
      context: { user: { id: 1, isGlobalAdmin: true } },
      node: { req: Readable.from([Buffer.from('x')]) },
    }

    await expect(handler(event as any)).rejects.toThrow()
  })

  it('rejette un corps vide et nettoie le fichier partiel', async () => {
    g.getHeader = vi.fn((_event: any, name: string) =>
      name === 'x-backup-filename' ? 'vide.sql' : undefined
    )
    const event = {
      context: { user: { id: 1, isGlobalAdmin: true } },
      node: { req: Readable.from([]) },
    }

    await expect(handler(event as any)).rejects.toThrow()
    expect(rename).not.toHaveBeenCalled()
    expect(rm).toHaveBeenCalled()
  })
})
