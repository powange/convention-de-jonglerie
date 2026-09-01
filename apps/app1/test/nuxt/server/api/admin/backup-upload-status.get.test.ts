import { stat } from 'fs/promises'
import path from 'path'

import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../server/api/admin/backup/upload-status.get'

vi.mock('fs/promises', () => {
  const mod = { stat: vi.fn() }
  return { ...mod, default: { ...mod } }
})

const g = global as any

/**
 * Cet endpoint existe pour rendre une reprise possible après une coupure : le client sait quelles
 * tranches il a envoyées, mais pas lesquelles sont arrivées — et sa mémoire peut être périmée, le
 * fichier partiel étant effacé au bout d'un jour. Seul le disque fait foi.
 */
describe('/api/admin/backup/upload-status GET', () => {
  const evenement = (uploadId: unknown) => {
    g.getQuery = vi.fn(() => ({ uploadId }))
    return { context: { user: { id: 1, isGlobalAdmin: true } } }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    g.requireGlobalAdminWithDbCheck = vi.fn().mockResolvedValue({ id: 1 })
  })

  it('rend les octets déjà reçus', async () => {
    ;(stat as any).mockResolvedValue({ size: 5_242_880 })

    const result = await handler(evenement('aaaabbbb-cccc-dddd') as any)

    expect(result.data.recu).toBe(5_242_880)
    expect((stat as any).mock.calls[0][0]).toBe(
      path.join(process.cwd(), 'backups', 'aaaabbbb-cccc-dddd.part')
    )
  })

  it('rend zéro plutôt qu’une erreur quand rien n’a encore été reçu', async () => {
    // Un envoi jamais commencé, ou dont les traces ont été nettoyées : ce n'est pas une anomalie,
    // c'est la réponse à « où en suis-je ? ».
    ;(stat as any).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    const result = await handler(evenement('aaaabbbb-cccc-dddd') as any)

    expect(result.data.recu).toBe(0)
  })

  it('refuse un identifiant qui tenterait de sonder hors du dossier', async () => {
    await expect(handler(evenement('../../etc/passwd') as any)).rejects.toThrow()
    expect(stat).not.toHaveBeenCalled()
  })

  it('refuse un identifiant absent', async () => {
    await expect(handler(evenement(undefined) as any)).rejects.toThrow()
  })
})
