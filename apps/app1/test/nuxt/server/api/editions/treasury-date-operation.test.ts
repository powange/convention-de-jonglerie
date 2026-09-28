import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

const mockCanManage = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTreasuryById: mockCanManage,
  canAccessEditionData: vi.fn(async () => true),
}))

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event) => event.context.user),
}))

import creer from '../../../../../server/api/editions/[id]/treasury/entries.post'
import lire from '../../../../../server/api/editions/[id]/treasury/index.get'
import { global } from '../../../globales-nitro'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '21' }, user: { id: 3 } } }

/**
 * La date de l'OPÉRATION, distincte de la date de saisie.
 *
 * Les deux étaient confondues : `createdAt` faisait office de date d'opération, si bien que saisir
 * le lundi les tickets du week-end datait tout du lundi. La trésorerie racontait l'ordre dans
 * lequel on avait tapé, pas celui dans lequel l'argent avait bougé.
 *
 * Le piège de ce champ est le fuseau. Une date d'opération est une date **civile** : le 12 juin
 * reste le 12 juin qu'on le lise depuis Paris ou depuis Montréal. Stockée comme un instant à
 * minuit local, elle glisserait d'un jour à l'ouest de Greenwich — d'où la colonne `DATE` et la
 * conversion explicite en UTC que ces tests figent.
 */
describe('la date d’opération d’une entrée de trésorerie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.treasuryEntry.create.mockResolvedValue({ id: 1 })
    prismaMock.edition.findUnique.mockResolvedValue({
      id: 21,
      currency: 'EUR',
      conventionId: 2,
    })
    prismaMock.editionArtist.findMany.mockResolvedValue([])
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])
    prismaMock.treasuryEntry.findMany.mockResolvedValue([])
    prismaMock.treasurySourceCode.findMany.mockResolvedValue([])
    prismaMock.treasuryCode.findMany.mockResolvedValue([])
  })

  const creerAvec = async (corps: Record<string, unknown>) => {
    global.readBody = vi.fn().mockResolvedValue({
      kind: 'EXPENSE',
      title: 'Location de salle',
      amount: 450,
      ...corps,
    })
    await creer(evenement as any)
    return prismaMock.treasuryEntry.create.mock.calls[0][0].data
  }

  describe('à l’écriture', () => {
    it('enregistre le jour saisi, à minuit UTC', () => {
      // ⚠️ Ce test ne discrimine PAS le retrait du `Z` explicite, et c'est normal : une chaîne de
      // forme date seule est déjà interprétée en UTC par la spécification. Il fige la valeur
      // stockée, ce qui attraperait un décalage introduit autrement — un `setHours`, un passage
      // par le fuseau de l'édition, ou un format d'entrée élargi.
      return creerAvec({ operationDate: '2026-06-12' }).then((data) => {
        expect(data.operationDate).toBeInstanceOf(Date)
        expect(data.operationDate.toISOString()).toBe('2026-06-12T00:00:00.000Z')
      })
    })

    it('accepte une entrée sans date', async () => {
      // Rien n'oblige à en fournir une : le champ est pré-rempli à l'écran, mais l'API ne doit pas
      // refuser une saisie qui n'en porte pas.
      const data = await creerAvec({})

      expect(data.operationDate).toBeNull()
    })

    it('refuse une date qui n’est pas un jour', async () => {
      // Un instant complet passerait pour une date et serait tronqué en silence.
      global.readBody = vi.fn().mockResolvedValue({
        kind: 'EXPENSE',
        title: 'Location de salle',
        amount: 450,
        operationDate: '2026-06-12T18:30:00Z',
      })

      await expect(creer(evenement as any)).rejects.toBeDefined()
      expect(prismaMock.treasuryEntry.create).not.toHaveBeenCalled()
    })
  })

  describe('à la lecture', () => {
    it('classe par date d’opération, puis par date de saisie', async () => {
      // La date d'opération commande, la saisie départage deux entrées du même jour — sans quoi
      // leur ordre changerait d'un rafraîchissement à l'autre.
      await lire(evenement as any)

      const requete = prismaMock.treasuryEntry.findMany.mock.calls[0][0]
      expect(requete.orderBy).toEqual([{ operationDate: 'asc' }, { createdAt: 'asc' }])
    })

    it('rend la date aux écrans', async () => {
      // Elle était en base depuis toujours pour la saisie, mais absente du `select` : l'écran ne
      // pouvait rien afficher. C'est le défaut d'origine, dans l'autre sens.
      await lire(evenement as any)

      const requete = prismaMock.treasuryEntry.findMany.mock.calls[0][0]
      expect(requete.select.operationDate).toBe(true)
    })
  })
})
