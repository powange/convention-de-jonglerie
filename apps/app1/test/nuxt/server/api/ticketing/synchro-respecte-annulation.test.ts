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

  const synchroniser = async (etatDeLaCharge: string, billetExistant: Record<string, unknown>) => {
    prismaMock.ticketingOrderItem.findFirst.mockResolvedValue(billetExistant)
    mockRecuperer.mockResolvedValue({
      data: [
        {
          id: 1234,
          date: '2026-09-01T10:00:00Z',
          payer: { firstName: 'Ana', lastName: 'B', email: 'ana@example.com' },
          items: [billetDeLaCharge(etatDeLaCharge)],
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
})
