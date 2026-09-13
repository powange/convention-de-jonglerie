import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/admin-auth', () => ({
  requireGlobalAdminWithDbCheck: vi.fn(),
}))

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import handler from '../../../../../server/api/admin/error-logs/groups.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma
const mockAdmin = requireGlobalAdminWithDbCheck as ReturnType<typeof vi.fn>

const evenement = { context: {} }

/** Un groupe tel que `groupBy` le rend. */
const groupe = (message: string, occurrences: number) => ({
  errorType: 'ValidationError',
  method: 'POST',
  path: '/api/editions',
  message,
  _count: { _all: occurrences },
  _min: { createdAt: new Date('2026-09-01') },
  _max: { createdAt: new Date('2026-09-12') },
})

/**
 * La liste à plat rendait une ligne par occurrence : cinquante fois la même erreur, c'était
 * cinquante lignes à faire défiler pour comprendre qu'il n'y avait qu'UN problème.
 *
 * Le regroupement existait déjà en creux — « résoudre les identiques » le présuppose entièrement —
 * sans que l'écran ne le montre jamais.
 */
/**
 * L'appel de REGROUPEMENT, distingué des deux `groupBy` que réclament les statistiques.
 *
 * On le cherche par sa forme — quatre colonnes — plutôt que par sa position : viser le dernier
 * appel avait suffi jusqu'à ce que l'endpoint calcule aussi les statistiques, et une assertion
 * positionnelle se serait alors mise à décrire autre chose sans le dire.
 */
const appelDeRegroupement = () =>
  prismaMock.apiErrorLog.groupBy.mock.calls
    .map((appel: any[]) => appel[0])
    .find((argument: any) => argument.by?.length === 4)

describe('/api/admin/error-logs/groups GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdmin.mockResolvedValue({ id: 42 })
    global.getQuery = vi.fn().mockReturnValue({ page: '1', pageSize: '20' })

    // Les statistiques du haut d'écran, calculées elles aussi par cet endpoint.
    prismaMock.apiErrorLog.aggregate.mockResolvedValue({ _count: { id: 0 } })
    prismaMock.apiErrorLog.count.mockResolvedValue(0)

    prismaMock.apiErrorLog.groupBy.mockImplementation((argument: any) =>
      argument.by?.length === 4
        ? Promise.resolve([groupe('Données invalides', 12)])
        : Promise.resolve([])
    )
  })

  it('regroupe sur les quatre composantes de l’empreinte', async () => {
    await handler(evenement as any)

    expect(appelDeRegroupement().by).toEqual(['errorType', 'method', 'path', 'message'])
  })

  it('regroupe EN BASE et non en mémoire', async () => {
    // Une pagination qui porterait sur les lignes avant de les regrouper rendrait des groupes
    // tronqués, donc des compteurs faux — pire qu'une absence de regroupement.
    await handler(evenement as any)

    expect(prismaMock.apiErrorLog.findMany).not.toHaveBeenCalled()
    const appel = appelDeRegroupement()
    expect(appel.take).toBeGreaterThan(0)
    expect(appel.skip).toBe(0)
  })

  it('rend le compteur, la première et la dernière vue', async () => {
    // C'est ce qui décide de l'urgence : « ça continue » et « ça vient d'apparaître » ne se
    // distinguaient pas dans une liste à plat.
    const reponse: any = await handler(evenement as any)
    const premier = reponse.data.groupes[0]

    expect(premier.occurrences).toBe(12)
    expect(premier.premiereVue).toEqual(new Date('2026-09-01'))
    expect(premier.derniereVue).toEqual(new Date('2026-09-12'))
    expect(premier.empreinte).toBe('ValidationError|POST|/api/editions|Données invalides')
  })

  it('trie du plus récemment vu au plus ancien', async () => {
    await handler(evenement as any)

    expect(appelDeRegroupement().orderBy).toEqual({ _max: { createdAt: 'desc' } })
  })

  it('demande une ligne de plus pour savoir s’il y a une suite, sans la rendre', async () => {
    // La taille de page vient de `validatePagination` et non des paramètres simulés : on la lit
    // dans la réponse plutôt que de la présumer.
    await handler(evenement as any)
    const { take } = appelDeRegroupement()
    const pageSize = take - 1

    prismaMock.apiErrorLog.groupBy.mockImplementation((argument: any) =>
      argument.by?.length === 4
        ? Promise.resolve(Array.from({ length: take }, (_, index) => groupe(`Message ${index}`, 1)))
        : Promise.resolve([])
    )

    const reponse: any = await handler(evenement as any)

    expect(reponse.data.pagination.pageSize).toBe(pageSize)
    expect(reponse.data.groupes).toHaveLength(pageSize)
    expect(reponse.data.pagination.hasMore).toBe(true)
  })

  it('n’annonce aucun total de groupes plutôt qu’un chiffre approximatif', async () => {
    // Compter les groupes exactement supposerait de tous les parcourir. Un total inventé et affiché
    // comme sûr est précisément le défaut corrigé sur la liste à plat.
    const reponse: any = await handler(evenement as any)

    expect(reponse.data.pagination.total).toBeNull()
  })

  it('exige les droits d’administration', async () => {
    mockAdmin.mockRejectedValue(new Error('Accès refusé'))

    await expect(handler(evenement as any)).rejects.toBeDefined()
    expect(prismaMock.apiErrorLog.groupBy).not.toHaveBeenCalled()
  })
})
