import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le handler s'enveloppe dans `wrapApiHandler` À L'ÉVALUATION du module : ces globales doivent
// exister avant l'import, d'où `vi.hoisted`.
vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const tarifs = vi.hoisted(() => ({ valeur: [] as unknown[] }))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: () => ({ id: 1 }),
}))

vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canAccessEditionDataOrAccessControl: async () => true,
}))

vi.mock('#server/utils/editions/ticketing/tiers', () => ({
  getEditionTiers: async () => tarifs.valeur,
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/tiers/available.get'

/**
 * Les tarifs proposés à l'ajout d'un participant, depuis le contrôle d'accès.
 *
 * Deux réglages distincts se croisent ici, et les confondre était le défaut :
 *
 * - **« Tarif actif »** (`isActive`) retire un tarif de la vente. La route publique en tenait
 *   compte, celle-ci non : on décochait la case, et le tarif continuait d'être proposé au guichet.
 * - **la période de validité** (`validFrom` / `validUntil`) masque un tarif temporairement, et
 *   c'est elle — elle seule — que rouvre l'interrupteur « Afficher tous les tarifs », dont le
 *   libellé annonce « Y compris les tarifs hors période de validité ».
 *
 * D'où un paramètre séparé, `includeInactive`, que seuls les écrans de configuration demandent.
 */
describe('GET /api/editions/[id]/ticketing/tiers/available', () => {
  const evenement = { context: { params: { id: '22' } } }

  const actif = { id: 1, name: 'Pass week-end', isActive: true, validFrom: null, validUntil: null }
  const desactive = {
    id: 2,
    name: 'Tarif retiré',
    isActive: false,
    validFrom: null,
    validUntil: null,
  }
  const perime = {
    id: 3,
    name: 'Prévente',
    isActive: true,
    validFrom: null,
    validUntil: new Date('2020-01-01'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    tarifs.valeur = [actif, desactive, perime]
    ;(globalThis as any).getQuery = vi.fn(() => ({}))
  })

  const appeler = async (query: Record<string, string> = {}) => {
    ;(globalThis as any).getQuery = vi.fn(() => query)
    const reponse = (await handler(evenement as any)) as { tiers: { id: number }[] }
    return reponse.tiers.map((tier) => tier.id)
  }

  it('ne propose pas un tarif désactivé', async () => {
    expect(await appeler()).toEqual([1])
  })

  it('ne le propose pas davantage avec « Afficher tous les tarifs »', async () => {
    // L'interrupteur rouvre la période de validité — le tarif périmé revient — mais pas la vente
    // d'un tarif qu'on a délibérément retiré.
    expect(await appeler({ showAll: 'true' })).toEqual([1, 3])
  })

  it('le rend aux écrans de configuration qui le demandent', async () => {
    // Sans cela, associer un champ personnalisé à un tarif mis de côté deviendrait impossible, et
    // les associations déjà en place seraient effacées au premier enregistrement.
    expect(await appeler({ includeInactive: 'true', showAll: 'true' })).toEqual([1, 2, 3])
  })

  it('masque toujours les tarifs hors période de validité par défaut', async () => {
    expect(await appeler({ includeInactive: 'true' })).toEqual([1, 2])
  })
})
