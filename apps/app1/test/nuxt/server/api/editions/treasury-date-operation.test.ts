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
import modifier from '../../../../../server/api/editions/[id]/treasury/entries/[entryId].put'
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
    /*
     * ⚠️ Les TARIFS, que la trésorerie lit depuis qu'un produit peut tirer son montant de
     * certains d'entre eux. Sans ce bouchon, `findMany` rend `undefined`, le point d'API lève sur
     * `tiers.map` et le test échoue sur un « Erreur serveur interne » qui ne dit pas d'où il
     * vient.
     *
     * 📍 On le déclare ici plutôt que de rendre le point d'API défensif : en production Prisma
     * rend toujours un tableau, et un `?? []` masquerait un manque du harnais au lieu de le
     * signaler.
     */
    prismaMock.ticketingTier.findMany.mockResolvedValue([])
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

/**
 * La MODIFICATION d'une entrée, le chemin qui manquait.
 *
 * Les tests ci-dessus couvrent l'écriture à la création et la lecture. Entre les deux, modifier
 * une entrée existante pour lui poser une date était le geste le plus courant — et le seul sans
 * filet. C'est par là que le défaut a été signalé, même si la cause était ailleurs : la ligne
 * partait bien en base, mais `computeTreasury` ne la reportait pas dans la réponse.
 */
describe('la date d’opération à la modification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.treasuryEntry.findFirst.mockResolvedValue({
      id: 7,
      imageUrl: null,
      kind: 'EXPENSE',
      advancedById: null,
      reimbursed: false,
      edition: { id: 21, conventionId: 2 },
    })
    prismaMock.treasuryEntry.update.mockResolvedValue({ id: 7 })
  })

  const modifierAvec = async (corps: Record<string, unknown>) => {
    global.readBody = vi.fn().mockResolvedValue(corps)
    await modifier({
      context: { params: { id: '21', entryId: '7' }, user: { id: 3 } },
    } as any)
    return prismaMock.treasuryEntry.update.mock.calls[0][0].data
  }

  it('enregistre la date posée sur une entrée qui n’en avait pas', async () => {
    const data = await modifierAvec({ title: 'Location de salle', operationDate: '2026-06-12' })

    expect(data.operationDate).toBeInstanceOf(Date)
    expect(data.operationDate.toISOString()).toBe('2026-06-12T00:00:00.000Z')
  })

  it('efface la date quand elle est explicitement vidée', async () => {
    // Le bouton d'effacement du champ envoie `null` : une date posée par erreur doit pouvoir
    // repartir, sans quoi elle serait définitive.
    const data = await modifierAvec({ operationDate: null })

    expect(data.operationDate).toBeNull()
  })

  it('n’y touche pas quand le champ n’est pas envoyé', async () => {
    // `undefined` ≠ `null` : un client qui ne connaît pas le champ ne doit pas effacer la date.
    const data = await modifierAvec({ title: 'Location de salle' })

    expect(data).not.toHaveProperty('operationDate')
  })
})
