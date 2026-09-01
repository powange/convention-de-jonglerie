import { Readable, Writable } from 'stream'

import { mkdir, rename, rm, readdir, stat } from 'fs/promises'
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
  const mod = { mkdir: vi.fn(), rename: vi.fn(), rm: vi.fn(), stat: vi.fn(), readdir: vi.fn() }
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
    ;(readdir as any).mockResolvedValue([])
    ;(stat as any).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
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

  /**
   * L'envoi en tranches existe parce qu'un envoi d'un seul tenant ne survit pas à un téléphone :
   * quelques minutes suffisent pour que l'écran s'éteigne et que la requête reste suspendue.
   *
   * Ce que ces tests verrouillent, c'est la reconstitution : une archive mal recollée ne se
   * verrait qu'au moment d'une restauration, c'est-à-dire trop tard.
   */
  describe('envoi en tranches', () => {
    const trancheEvent = (
      contenu: string,
      { id = 'aaaabbbb-cccc-dddd', offset = 0, total = 100 } = {}
    ) => {
      const entetes: Record<string, string> = {
        'x-backup-filename': encodeURIComponent('dump-prod.sql'),
        'x-backup-upload-id': id,
        'x-backup-offset': String(offset),
        'x-backup-total': String(total),
      }
      g.getHeader = vi.fn((_event: any, name: string) => entetes[name])
      return {
        context: { user: { id: 1, isGlobalAdmin: true } },
        node: { req: Readable.from([Buffer.from(contenu, 'utf8')]) },
      }
    }

    it('accumule sous un fichier nommé par l’identifiant d’envoi, sans renommer', async () => {
      const result = await handler(trancheEvent('AAAAA', { offset: 0, total: 10 }) as any)

      expect(written.path).toBe(path.join(process.cwd(), 'backups', 'aaaabbbb-cccc-dddd.part'))
      expect(result.data.termine).toBe(false)
      expect(result.data.recu).toBe(5)
      // Le fichier ne prend son nom définitif qu'une fois complet
      expect(rename).not.toHaveBeenCalled()
    })

    it('renomme quand le compte est bon, et annonce la taille totale', async () => {
      ;(stat as any).mockResolvedValue({ size: 5 })
      const result = await handler(trancheEvent('BBBBB', { offset: 5, total: 10 }) as any)

      expect(result.data.termine).toBe(true)
      expect(result.data.size).toBe(10)
      expect(result.data.storedFilename).toMatch(/^uploaded-.*dump-prod\.sql$/)
      expect(rename).toHaveBeenCalled()
    })

    it('refuse une tranche hors séquence plutôt que de produire une archive corrompue', async () => {
      // Le disque en a déjà 5, la tranche en annonce 20 : accepter creuserait un trou.
      ;(stat as any).mockResolvedValue({ size: 5 })

      await expect(
        handler(trancheEvent('CCCCC', { offset: 20, total: 40 }) as any)
      ).rejects.toThrow()
      expect(rename).not.toHaveBeenCalled()
    })

    it('refuse un identifiant qui tenterait d’écrire hors du dossier', async () => {
      await expect(
        handler(trancheEvent('DDDDD', { id: '../../etc/passwd', offset: 0, total: 5 }) as any)
      ).rejects.toThrow()
    })

    it('conserve le fichier partiel quand une tranche échoue, pour permettre une reprise', async () => {
      ;(stat as any).mockResolvedValue({ size: 0 })
      // Une tranche qui déborde la taille annoncée est rejetée…
      await expect(
        handler(trancheEvent('EEEEEEEEEE', { offset: 0, total: 3 }) as any)
      ).rejects.toThrow()
      // …sans effacer ce qui a déjà été reçu, contrairement à l'envoi d'un seul tenant.
      expect(rm).not.toHaveBeenCalled()
    })
  })
})
