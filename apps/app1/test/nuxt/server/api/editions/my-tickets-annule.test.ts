import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn(() => ({ id: 3, email: 'alex@example.com' })),
}))

import handler from '../../../../../server/api/editions/[id]/my-tickets.get'

const prismaMock = (globalThis as any).prisma

/**
 * « Mes billets » dit qu'un billet est annulé — constat B8.
 *
 * ## Le défaut
 *
 * La requête ne connaissait pas l'annulation : ni l'état de la ligne, ni le statut de la commande
 * n'entraient dans le `where`, et la réponse ne les portait pas. Un billet `Canceled` chez
 * HelloAsso, ou une commande remboursée, apparaissait donc dans « Mon billet » **avec son code QR
 * et sans un mot**. Au guichet, ce même billet est **refusé**. **Le participant découvrait
 * l'annulation devant la file.**
 *
 * ## 📍 ANNONCÉ, JAMAIS MASQUÉ — et c'est un test, pas un commentaire
 *
 * Le filtrer aurait été plus simple à écrire et pire à vivre : le billet disparaîtrait sans
 * explication, et la personne croirait n'en avoir jamais eu. Un cas ci-dessous interdit ce
 * raccourci.
 */
const EDITION = 42
const evenement = { context: { params: { id: String(EDITION) }, user: { id: 3 } } } as never

const ligne = (surcharge: Record<string, unknown> = {}) => ({
  id: 7,
  firstName: 'Alex',
  lastName: 'Martin',
  email: 'alex@example.com',
  qrCode: 'QR-7',
  name: 'Pass 3 jours',
  amount: 4200,
  entryValidated: false,
  entryValidatedAt: null,
  state: 'Processed',
  order: { status: 'Processed', externalTicketing: null },
  tier: null,
  ...surcharge,
})

const billets = async () => {
  // ⚠️ Ce point d'API rend `{ tickets }` NU, sans l'enveloppe `{ success, data }` du projet :
  // mon premier essai lisait `reponse.data.tickets` et tombait sur « Cannot read properties of
  // undefined ». C'est l'un des points d'API restés hors de l'enveloppe.
  const { tickets } = (await handler(evenement)) as unknown as { tickets: { type: string }[] }
  return tickets.filter((t) => t.type === 'ticket')
}

describe('GET /api/editions/[id]/my-tickets — billet annulé', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Aucune candidature de bénévole, aucun artiste, aucun organisateur : on isole les billets.
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)
    prismaMock.editionArtist?.findFirst?.mockResolvedValue?.(null)
    prismaMock.editionOrganizer.findFirst.mockResolvedValue(null)
  })

  it('⚠️ MARQUE `annule` UNE LIGNE ANNULÉE À LA SOURCE', async () => {
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([ligne({ state: 'Canceled' })])

    expect((await billets())[0]).toMatchObject({ annule: true })
  })

  it('⚠️ MARQUE `annule` UN BILLET DONT LA COMMANDE EST REMBOURSÉE', async () => {
    // Les deux façons de l'être ne se recouvrent pas : la ligne est intacte, c'est la commande
    // entière qui a été remboursée.
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([
      ligne({ order: { status: 'Refunded', externalTicketing: null } }),
    ])

    expect((await billets())[0]).toMatchObject({ annule: true })
  })

  it('laisse `annule` à faux pour un billet valide', async () => {
    /*
     * LE TÉMOIN. Sans lui, un handler qui marquerait TOUT annulé satisferait les deux cas
     * précédents — et chaque participant verrait son billet barré.
     */
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([ligne()])

    expect((await billets())[0]).toMatchObject({ annule: false })
  })

  it('⚠️ NE MASQUE PAS LE BILLET ANNULÉ — il reste dans la réponse', async () => {
    /*
     * L'ASSERTION QUI TIENT LA DÉCISION. Filtrer en base aurait été plus simple à écrire : le
     * billet disparaîtrait de « Mes billets » sans explication, et la personne croirait n'en avoir
     * jamais eu. Si ce cas tombe, c'est que quelqu'un a préféré le raccourci — à lui de dire
     * pourquoi.
     */
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([ligne({ state: 'Canceled' })])

    const liste = await billets()
    expect(liste).toHaveLength(1)
    expect(liste[0]).toMatchObject({ id: 7, qrCode: 'QR-7' })
  })

  it('⚠️ LA REQUÊTE NE FILTRE TOUJOURS PAS SUR L’ANNULATION', async () => {
    /*
     * 🔬 L'ASSERTION NON CREUSE DE CE FICHIER. Le bouchon central **ignore le `where`** : les
     * quatre cas ci-dessus resteraient verts si la requête se mettait à écarter les billets
     * annulés, puisque le mock rend ce qu'on lui dit quoi qu'on demande. Seule la FORME de la
     * requête voit ce changement — et c'est exactement le raccourci qu'on veut interdire.
     */
    prismaMock.ticketingOrderItem.findMany.mockResolvedValue([])

    await handler(evenement)

    const demande = prismaMock.ticketingOrderItem.findMany.mock.calls[0][0]
    const serialise = JSON.stringify(demande.where)
    expect(serialise).not.toContain('Canceled')
    expect(serialise).not.toContain('Refunded')
  })
})
