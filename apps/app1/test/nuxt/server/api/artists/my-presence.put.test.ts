import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('#server/utils/api-helpers', () => ({
  wrapApiHandler: (handler: any) => handler,
  createSuccessResponse: (data: unknown) => ({ success: true, data }),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

vi.mock('#server/utils/validation-helpers', () => ({
  validateEditionId: (event: any) => parseInt(event?.context?.params?.id, 10),
}))

import handler from '../../../../../server/api/editions/[id]/my-presence.put'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 42 } } }

const envoyer = async (corps: Record<string, unknown>) => {
  global.readBody = vi.fn(async () => ({
    arrivalDateTime: null,
    departureDateTime: null,
    pickupRequired: false,
    pickupLocation: null,
    dropoffRequired: false,
    dropoffLocation: null,
    ...corps,
  }))
  return handler(evenement as any)
}

/**
 * L'artiste déclare sa présence et DEMANDE qu'on vienne le chercher. Il ne désigne personne.
 *
 * C'est la frontière de ce point d'API, et elle est facile à franchir par inadvertance : il suffit
 * d'ajouter un champ au schéma pour qu'un artiste puisse confier une tâche à quelqu'un qui ne
 * l'apprendrait jamais.
 */
describe('PUT /api/editions/[id]/my-presence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.editionArtist.findUnique.mockResolvedValue({ id: 7 })
    prismaMock.editionArtist.update.mockResolvedValue({})
  })

  it("refuse quelqu'un qui n'est pas artiste sur cette édition", async () => {
    prismaMock.editionArtist.findUnique.mockResolvedValue(null)

    await expect(envoyer({})).rejects.toThrow(/pas artiste/)
    expect(prismaMock.editionArtist.update).not.toHaveBeenCalled()
  })

  it("n'écrit JAMAIS le responsable de la récupération", async () => {
    // Le désigner est une affectation, pas une déclaration. Même envoyé par un client modifié,
    // le champ ne doit pas atteindre la base.
    await envoyer({
      pickupRequired: true,
      pickupLocation: 'Gare de Chambéry',
      pickupResponsibleId: 99,
      dropoffResponsibleId: 99,
    })

    const ecrit = prismaMock.editionArtist.update.mock.calls[0][0].data
    expect(ecrit).not.toHaveProperty('pickupResponsibleId')
    expect(ecrit).not.toHaveProperty('dropoffResponsibleId')
    expect(ecrit.pickupLocation).toBe('Gare de Chambéry')
  })

  it('efface le lieu quand la demande est retirée', async () => {
    // Sans cela, un lieu décoché resterait affiché à l'organisateur comme une demande en cours.
    await envoyer({ pickupRequired: false, pickupLocation: 'Gare de Chambéry' })

    expect(prismaMock.editionArtist.update.mock.calls[0][0].data.pickupLocation).toBeNull()
  })

  it('refuse un départ antérieur à l’arrivée', async () => {
    // Une saisie, pas une donnée : mieux vaut la refuser que la laisser découvrir sur un tableau.
    await expect(
      envoyer({
        arrivalDateTime: '2026-09-26T10:00:00.000Z',
        departureDateTime: '2026-09-25T10:00:00.000Z',
      })
    ).rejects.toThrow()
  })
})
