import { describe, it, expect, beforeEach, vi } from 'vitest'

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/tiers/public.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' } } }

/**
 * Seule route de billetterie accessible sans session : elle est dans `public-routes.ts`, pour le
 * balisage Schema.org des pages publiques.
 *
 * Elle rendait les tarifs actifs sans regarder le statut de l'édition. Une édition `OFFLINE` —
 * complète mais volontairement cachée — livrait donc ses prix à qui connaissait son numéro. Les
 * statuts acceptés ici sont exactement ceux qu'accepte la page publique d'une édition, pas moins :
 * une annulation reste visible, et son tarif avec.
 */
describe('GET /api/editions/[id]/ticketing/tiers/public', () => {
  const tarifs = [
    { id: 1, name: 'Pass week-end', customName: null, description: null, price: 60, position: 0 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.edition.findUnique.mockResolvedValue({ status: 'PUBLISHED' })
    prismaMock.ticketingTier.findMany.mockResolvedValue(tarifs)
  })

  const appeler = () => handler(evenement as any)

  describe('les éditions dont elle parle', () => {
    it.each(['PUBLISHED', 'PLANNED', 'CANCELLED'])(
      'rend les tarifs d’une édition %s',
      async (statut) => {
        prismaMock.edition.findUnique.mockResolvedValue({ status: statut })

        await expect(appeler()).resolves.toHaveLength(1)
      }
    )

    it('refuse une édition hors ligne', async () => {
      prismaMock.edition.findUnique.mockResolvedValue({ status: 'OFFLINE' })

      await expect(appeler()).rejects.toMatchObject({ statusCode: 404 })
    })

    it('ne lit même pas les tarifs d’une édition hors ligne', async () => {
      // L'ordre compte : lire puis refuser laisserait la requête s'exécuter, et un refus qui
      // arrive après coup est un refus qu'un futur remaniement peut oublier de propager.
      prismaMock.edition.findUnique.mockResolvedValue({ status: 'OFFLINE' })

      await expect(appeler()).rejects.toBeDefined()

      expect(prismaMock.ticketingTier.findMany).not.toHaveBeenCalled()
    })
  })

  describe('ce que la réponse laisse deviner', () => {
    it('ne distingue pas une édition cachée d’une édition inexistante', async () => {
      // Sans cela, la route renseignerait sur l'existence des éditions cachées — exactement ce
      // qu'elle est censée taire.
      prismaMock.edition.findUnique.mockResolvedValue({ status: 'OFFLINE' })
      const cachee = await appeler().catch((e: any) => e)

      prismaMock.edition.findUnique.mockResolvedValue(null)
      const inexistante = await appeler().catch((e: any) => e)

      // Les deux doivent être des refus, et le même : comparer deux réussites ferait passer ce
      // test sur le code d'avant, qui ne refusait ni l'une ni l'autre.
      expect(cachee.statusCode).toBe(404)
      expect(inexistante.statusCode).toBe(404)
      expect(cachee.message).toBe(inexistante.message)
    })
  })

  describe('ce qu’elle rend quand elle rend', () => {
    it('ne demande que les tarifs actifs de cette édition', async () => {
      await appeler()

      expect(prismaMock.ticketingTier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { editionId: 22, isActive: true } })
      )
    })

    it('applique le nom personnalisé', async () => {
      prismaMock.ticketingTier.findMany.mockResolvedValue([
        { ...tarifs[0], customName: 'Pass 3 jours' },
      ])

      const rendus = await appeler()

      expect(rendus[0].name).toBe('Pass 3 jours')
    })
  })
})
