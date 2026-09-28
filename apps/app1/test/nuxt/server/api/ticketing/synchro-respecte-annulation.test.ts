import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  if (!(globalThis as any).wrapApiHandler) {
    ;(globalThis as any).wrapApiHandler = (handler: any) => handler
  }
  if (!(globalThis as any).validateEditionId) {
    ;(globalThis as any).validateEditionId = (event: any) =>
      parseInt(event?.context?.params?.id, 10)
  }
})

vi.mock('#server/utils/auth-utils', () => ({
  requireAuth: (event: any) => event.context.user,
}))

const mockCanManage = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/permissions/edition-permissions', () => ({
  canManageTicketingById: mockCanManage,
}))

const mockRecuperer = vi.hoisted(() => vi.fn())
vi.mock('#server/utils/editions/ticketing/helloasso', () => ({
  fetchOrdersFromHelloAsso: mockRecuperer,
}))

vi.mock('#server/utils/encryption', () => ({
  decrypt: () => 'secret-en-clair',
}))

import handler from '../../../../../../../layers/ticketing/server/api/editions/[id]/ticketing/helloasso/orders.get'

const prismaMock = (globalThis as any).prisma

const evenement = { context: { params: { id: '22' }, user: { id: 5 } } }

/** Ce qui a été écrit sur le billet existant. */
const ecrit = () => prismaMock.ticketingOrderItem.update.mock.calls[0]?.[0]?.data

/**
 * Une synchronisation n'efface pas une annulation faite ici.
 *
 * C'est **le** point du lot. Jusqu'ici, la synchronisation réécrivait `state` depuis la charge du
 * fournisseur sur chaque billet existant : on annulait un billet, quelqu'un appuyait sur
 * « Synchroniser », et le billet redevenait valide — sans que rien ne le signale. C'est ce qui
 * interdisait d'annuler le billet d'une commande HelloAsso, alors que la plateforme ne sait pas
 * rembourser partiellement une commande.
 *
 * `canceledAt` fait le départ : nul, l'annulation vient de la source et elle gouverne ;
 * renseigné, elle vient d'ici et survit. Lever l'annulation le remet à nul, et la source reprend
 * la main sans qu'aucun état ne soit à démêler.
 */
describe('la synchronisation HelloAsso et les annulations locales', () => {
  const billetDeLaCharge = (etat: string) => ({
    id: 900,
    name: 'Pass week-end',
    type: 'Registration',
    amount: 5000,
    state: etat,
    qrCode: 'QR-900',
    user: { firstName: 'Ana', lastName: 'B', email: 'ana@example.com' },
    customFields: [],
  })

  const existant = (surcharge: Record<string, unknown> = {}) => ({
    id: 77,
    state: 'Processed',
    canceledAt: null,
    sourceCanceledAt: null,
    refunded: false,
    ...surcharge,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanManage.mockResolvedValue(true)
    prismaMock.externalTicketing.findUnique.mockResolvedValue({
      id: 'ext-1',
      editionId: 22,
      helloAssoConfig: {
        clientId: 'cid',
        clientSecret: 'chiffre',
        organizationSlug: 'org',
        formType: 'Event',
        formSlug: 'form',
      },
    })
    prismaMock.$transaction.mockImplementation(async (travail: any) => travail(prismaMock))
    prismaMock.ticketingTier.findMany.mockResolvedValue([])
    prismaMock.ticketingOrder.upsert.mockResolvedValue({ id: 1 })
    prismaMock.ticketingOrderItem.update.mockResolvedValue({})
    prismaMock.ticketingOrderItemOption.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.ticketingOrderItemOption.createMany.mockResolvedValue({ count: 0 })
  })

  const synchroniser = async (
    etatDeLaCharge: string,
    billetExistant: Record<string, unknown> | null,
    autresLignes: string[] = []
  ) => {
    prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(billetExistant)
    mockRecuperer.mockResolvedValue({
      data: [
        {
          id: 1234,
          date: '2026-09-01T10:00:00Z',
          payer: { firstName: 'Ana', lastName: 'B', email: 'ana@example.com' },
          items: [
            billetDeLaCharge(etatDeLaCharge),
            ...autresLignes.map((etat, i) => ({ ...billetDeLaCharge(etat), id: 901 + i })),
          ],
        },
      ],
    })
    await handler(evenement as any)
  }

  it('n’écrase pas un billet annulé ici', async () => {
    await synchroniser('Processed', existant({ state: 'Canceled', canceledAt: new Date() }))

    // La clé ne doit PAS être écrite : l'omettre laisse la valeur en base, la poser la remplace.
    expect(ecrit()).not.toHaveProperty('state')
  })

  it('suit la source sur un billet qu’on n’a pas annulé', async () => {
    await synchroniser('Canceled', existant())

    expect(ecrit().state).toBe('Canceled')
  })

  it('rend la main à la source dès que l’annulation locale est levée', async () => {
    // `canceledAt` revenu à nul : plus rien ne distingue ce billet d'un autre, et c'est voulu —
    // aucun état résiduel à démêler.
    await synchroniser('Processed', existant({ canceledAt: null }))

    expect(ecrit().state).toBe('Processed')
  })

  it('note que la source a annulé, même quand on ne la suit pas', async () => {
    // La moitié manquante de la détection d'un double remboursement : l'autre est `refundedById`,
    // qui ne vaut que pour une case cochée ici.
    await synchroniser('Canceled', existant({ state: 'Canceled', canceledAt: new Date() }))

    expect(ecrit().sourceCanceledAt).toBeInstanceOf(Date)
  })

  it('ne redate pas une annulation de la source déjà notée', async () => {
    const deja = new Date('2026-09-01T08:00:00Z')

    await synchroniser('Canceled', existant({ canceledAt: new Date(), sourceCanceledAt: deja }))

    expect(ecrit()).not.toHaveProperty('sourceCanceledAt')
  })

  it('ne note rien quand la source ne dit pas que le billet est annulé', async () => {
    await synchroniser('Processed', existant())

    expect(ecrit()).not.toHaveProperty('sourceCanceledAt')
  })

  describe('une annulation HelloAsso vaut remboursement', () => {
    it('marque remboursée, par la plateforme, une ligne que HelloAsso annule', async () => {
      await synchroniser('Canceled', existant())

      // Sans date : on sait QUE la plateforme a remboursé, pas QUAND.
      expect(ecrit()).toMatchObject({ refunded: true, refundedAt: null, refundedById: null })
    })

    it('fait de même pour une ligne créée déjà annulée, date d’annulation comprise', async () => {
      prismaMock.ticketingOrderItem.create.mockResolvedValue({ id: 78 })
      await synchroniser('Canceled', null)

      const cree = prismaMock.ticketingOrderItem.create.mock.calls[0][0].data
      expect(cree).toMatchObject({ state: 'Canceled', refunded: true, refundedById: null })
      expect(cree.sourceCanceledAt).toBeInstanceOf(Date)
    })

    it('billet annulé ici puis commande annulée par HelloAsso : plus rien de dû', async () => {
      // Le scénario : Karim est annulé au site, sans que son argent soit rendu ; puis la commande
      // entière est remboursée sur HelloAsso. La plateforme lui a rendu son argent.
      await synchroniser('Canceled', existant({ state: 'Canceled', canceledAt: new Date() }), [
        'Canceled',
        'Canceled',
      ])

      expect(ecrit()).not.toHaveProperty('state')
      expect(ecrit()).toMatchObject({ refunded: true, refundedById: null })
    })

    it('billet annulé ET remboursé ici, puis commande annulée par HelloAsso : l’alerte s’allume', async () => {
      // Remboursé deux fois. On ne touche pas au remboursement d'ici : l'alerte exige son auteur.
      await synchroniser(
        'Canceled',
        existant({ state: 'Canceled', canceledAt: new Date(), refunded: true, refundedById: 5 }),
        ['Canceled']
      )

      expect(ecrit().sourceCanceledAt).toBeInstanceOf(Date)
      expect(ecrit()).not.toHaveProperty('refunded')
      expect(ecrit()).not.toHaveProperty('refundedById')
    })

    it('ne recoche pas un remboursement défait au guichet', async () => {
      await synchroniser('Canceled', existant({ state: 'Canceled', sourceCanceledAt: new Date() }))

      expect(ecrit()).not.toHaveProperty('refunded')
    })
  })

  describe('le statut de la commande suit HelloAsso', () => {
    const statutEcrit = () => prismaMock.ticketingOrder.upsert.mock.calls[0][0]

    it('« Annulée » quand HelloAsso a annulé toutes les lignes', async () => {
      await synchroniser('Canceled', existant(), ['Canceled'])

      expect(statutEcrit().update.status).toBe('Refunded')
      expect(statutEcrit().create.status).toBe('Refunded')
    })

    it('« Payée » tant qu’une ligne vaut encore', async () => {
      await synchroniser('Canceled', existant(), ['Processed'])

      expect(statutEcrit().update.status).toBe('Processed')
    })

    it('« Payée » quand seuls des billets annulés ICI le sont', async () => {
      // La plateforme encaisse toujours la commande : des annulations d'ici n'en font pas une
      // commande annulée.
      await synchroniser('Processed', existant({ state: 'Canceled', canceledAt: new Date() }))

      expect(statutEcrit().update.status).toBe('Processed')
    })
  })
})
