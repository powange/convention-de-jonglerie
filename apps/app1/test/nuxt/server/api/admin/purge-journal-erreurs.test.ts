import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRequireAdmin = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: mockRequireAdmin,
}))

import purger from '../../../../../server/api/admin/error-logs/cleanup-old.post'
import { RETENTION_PAR_DEFAUT } from '../../../../../shared/utils/retention-journal-erreurs'

const prismaMock = (globalThis as any).prisma

/**
 * La purge du journal d'erreurs, déclenchée depuis l'écran d'administration.
 *
 * Elle n'avait aucun test, et c'est la seule opération irréversible de ce module : ce qu'elle
 * efface n'existe plus nulle part. Ce que ces tests figent n'est pas le décompte rendu — il est
 * anecdotique — mais **ce sur quoi elle porte** : deux fenêtres distinctes, comptées depuis deux
 * dates différentes, et aucune écriture sans le droit d'administrateur.
 *
 * La règle elle-même est couverte à part (`test/unit/utils/retention-journal-erreurs.test.ts`).
 * Ici on vérifie qu'elle est bien celle qu'on applique.
 */

const JOUR = 24 * 60 * 60 * 1000

describe('POST /api/admin/error-logs/cleanup-old', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ id: 1, isGlobalAdmin: true })
    prismaMock.apiErrorLog.count.mockResolvedValue(3)
    prismaMock.apiErrorLog.deleteMany.mockResolvedValue({ count: 3 })
  })

  it('n’efface rien quand le droit d’administrateur manque', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Droits insuffisants'))

    await expect(purger({} as any)).rejects.toThrow()
    expect(prismaMock.apiErrorLog.deleteMany).not.toHaveBeenCalled()
  })

  it('applique deux fenêtres distinctes, sur deux dates différentes', async () => {
    const avant = Date.now()
    await purger({} as any)
    const apres = Date.now()

    const appels = prismaMock.apiErrorLog.deleteMany.mock.calls.map((c: any[]) => c[0].where)
    expect(appels).toHaveLength(2)

    const resolues = appels.find((w: any) => w.resolved === true)
    const nonResolues = appels.find((w: any) => w.resolved === false)
    expect(resolues).toBeDefined()
    expect(nonResolues).toBeDefined()

    // Les résolues se datent de leur résolution, les autres de leur apparition. Confondre les
    // deux colonnes supprimerait une erreur traitée hier parce qu'elle est survenue en juin.
    expect(resolues.resolvedAt.lt.getTime()).toBeGreaterThanOrEqual(
      avant - RETENTION_PAR_DEFAUT.resolues * JOUR
    )
    expect(resolues.resolvedAt.lt.getTime()).toBeLessThanOrEqual(
      apres - RETENTION_PAR_DEFAUT.resolues * JOUR
    )
    expect(resolues.createdAt).toBeUndefined()

    expect(nonResolues.createdAt.lt.getTime()).toBeGreaterThanOrEqual(
      avant - RETENTION_PAR_DEFAUT.nonResolues * JOUR
    )
    expect(nonResolues.createdAt.lt.getTime()).toBeLessThanOrEqual(
      apres - RETENTION_PAR_DEFAUT.nonResolues * JOUR
    )
    expect(nonResolues.resolvedAt).toBeUndefined()
  })

  it('garde les non résolues plus longtemps que les résolues', async () => {
    // Le comportement qui a motivé ce lot : la tâche traitait les deux au même rythme, si bien
    // qu'une erreur que personne n'avait ouverte disparaissait au bout d'un mois.
    await purger({} as any)

    const appels = prismaMock.apiErrorLog.deleteMany.mock.calls.map((c: any[]) => c[0].where)
    const resolues = appels.find((w: any) => w.resolved === true)
    const nonResolues = appels.find((w: any) => w.resolved === false)

    expect(nonResolues.createdAt.lt.getTime()).toBeLessThan(resolues.resolvedAt.lt.getTime())
  })

  it('ne supprime rien quand il n’y a rien à supprimer', async () => {
    // Deux `deleteMany` sans condition d'existence coûteraient deux requêtes pour rien ; ce
    // n'est pas le sujet. Le sujet est qu'une purge à vide ne doit pas toucher la table.
    prismaMock.apiErrorLog.count.mockResolvedValue(0)

    const res: any = await purger({} as any)

    expect(prismaMock.apiErrorLog.deleteMany).not.toHaveBeenCalled()
    expect(res.data.deleted.total).toBe(0)
  })

  it('compte avant de supprimer, sur les mêmes critères', async () => {
    // Annoncer un nombre obtenu sur d'autres critères que ceux de la suppression ferait mentir
    // le message rendu à l'administrateur — sur une action qu'il ne peut pas annuler.
    await purger({} as any)

    const comptes = prismaMock.apiErrorLog.count.mock.calls
      .map((c: any[]) => c[0]?.where)
      .filter(Boolean)
    const supprimes = prismaMock.apiErrorLog.deleteMany.mock.calls.map((c: any[]) => c[0].where)

    for (const where of supprimes) {
      expect(comptes.some((c: any) => c.resolved === where.resolved)).toBe(true)
    }
  })
})
