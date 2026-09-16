import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockCanAcceder = vi.hoisted(() => vi.fn())
const mockGetQuotaStats = vi.hoisted(() => vi.fn())

/**
 * `wrapApiHandler` est neutralisé pour appeler le gestionnaire directement, et
 * `createSuccessResponse` reproduit fidèlement l'original — trois lignes, vérifiables d'un coup
 * d'œil dans `server/utils/api-helpers.ts`. Une variante gardant la vraie implémentation par
 * `importOriginal` ne se branche pas sur l'auto-import de Nitro : le gestionnaire ne voit alors
 * plus `wrapApiHandler` du tout.
 *
 * Ce que ce test tient, c'est donc que l'endpoint EMBALLE sa réponse — là où il rendait
 * `{ stats }` nu — et sous quelle forme le client doit la lire.
 */
vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown, message?: string) => ({
    success: true,
    ...(message && { message }),
    data,
  }),
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
}))

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: mockCanAcceder,
}))

vi.mock('#server/utils/editions/ticketing/quota-stats', () => ({
  getQuotaStats: mockGetQuotaStats,
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/quotas/stats.get'

/**
 * La forme de la réponse des statistiques de quotas.
 *
 * Cet endpoint rendait `{ stats }` brut là où tous les autres du module passent par
 * `createSuccessResponse`. Son unique client s'y était adapté, donc rien ne cassait — mais c'est
 * l'exception qui piège le prochain appelant, et rien ne la signalait : aucun test ne portait sur
 * cet endpoint.
 *
 * Ce fichier tient désormais le contrat. Il tient aussi les DROITS, qui sont particuliers ici :
 * un bénévole en créneau de contrôle d'accès doit pouvoir lire ces chiffres, alors qu'il ne gère
 * pas la billetterie — c'est à l'entrée qu'on regarde si une jauge est pleine.
 */
describe('statistiques des quotas — la réponse', () => {
  const evenement = { context: { params: { id: '22' }, user: { id: 1, pseudo: 'orga' } } }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAcceder.mockResolvedValue(true)
    mockGetQuotaStats.mockResolvedValue([
      {
        id: 1,
        title: 'Gala',
        description: null,
        quantity: 260,
        currentCount: 178,
        validatedCount: 42,
        percentage: 68,
      },
    ])
  })

  it('répond dans l’enveloppe conventionnelle du module', async () => {
    const result: any = await handler(evenement as any)

    expect(result.success).toBe(true)
    expect(result.data.stats).toHaveLength(1)
    expect(result.data.stats[0].title).toBe('Gala')
  })

  it('demande les statistiques de l’édition de la route', async () => {
    await handler(evenement as any)

    expect(mockGetQuotaStats).toHaveBeenCalledWith(22)
  })

  it('refuse qui n’a ni la gestion ni un créneau de contrôle d’accès', async () => {
    mockCanAcceder.mockResolvedValue(false)

    await expect(handler(evenement as any)).rejects.toMatchObject({ statusCode: 403 })
    expect(mockGetQuotaStats).not.toHaveBeenCalled()
  })
})
