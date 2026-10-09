import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../server/api/editions/[id]/shows-call/[showCallId]/my-application.delete'

const prismaMock = (globalThis as any).prisma

vi.mock('../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event.context.user) {
      const erreur = new Error('Non authentifié')
      ;(erreur as any).statusCode = 401
      throw erreur
    }
    return event.context.user
  }),
}))

vi.mock('../../../../../../server/utils/validation-helpers', () => ({
  validateEditionId: vi.fn(() => 7),
}))

const notifier = vi.fn()
vi.mock('../../../../../../server/utils/notification-service', () => ({
  safeNotify: vi.fn(async (action: () => unknown) => action()),
  NotificationHelpers: {
    showApplicationWithdrawn: (...args: unknown[]) => notifier(...args),
  },
}))

/**
 * Le retrait d'une candidature artiste en attente.
 *
 * ## Ce que ce point d'API ajoute
 *
 * Le cycle de vie côté artiste s'arrêtait à « soumettre, modifier tant que c'est en attente, puis
 * attendre ». **Aucun moyen de retirer.** Un artiste empêché écrivait donc dans la conversation de
 * sa candidature — que personne ne lit forcément — et l'organisateur conservait une **candidature
 * fantôme** dans ses compteurs et dans le sondage.
 */
describe('DELETE my-application — retrait d’une candidature', () => {
  const MOI = { id: 42, pseudo: 'artiste', isGlobalAdmin: false }
  const APPEL = { id: 3, edition: { id: 7, name: 'Édition 2026' } }

  const candidature = (p: Record<string, unknown> = {}) => ({
    id: 11,
    status: 'PENDING',
    artistName: 'Jean Jongleur',
    showTitle: 'Massues',
    ...p,
  })

  const evenement = () => ({
    context: { user: MOI, params: { id: '7', showCallId: '3' } },
    node: {
      req: { url: '/api/editions/7/shows-call/3/my-application', headers: {}, method: 'DELETE' },
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    notifier.mockClear()
    prismaMock.editionShowCall.findFirst.mockResolvedValue(APPEL)
    prismaMock.showApplication.findUnique.mockResolvedValue(candidature())
    prismaMock.showApplication.delete.mockResolvedValue(candidature())
    prismaMock.edition.findUnique.mockResolvedValue({
      creatorId: 5,
      convention: { authorId: 6, organizers: [{ userId: 8 }] },
      organizerPermissions: [{ organizer: { userId: 9 } }],
    })
  })

  it('refuse un visiteur anonyme', async () => {
    await expect(handler({ context: {} } as any)).rejects.toMatchObject({ statusCode: 401 })
    expect(prismaMock.showApplication.delete).not.toHaveBeenCalled()
  })

  it('retire une candidature en attente', async () => {
    const resultat: any = await handler(evenement() as any)
    expect(resultat.data.withdrawn).toBe(true)
    expect(prismaMock.showApplication.delete).toHaveBeenCalledWith({ where: { id: 11 } })
  })

  describe('les refus', () => {
    it.each([['ACCEPTED'], ['REJECTED']])(
      'refuse en 400 une candidature %s, avec son motif',
      async (statut) => {
        /*
         * ⚠️ Une candidature ACCEPTÉE ne se retire pas d'un clic : l'organisateur a bâti sa
         * programmation dessus, et la faire disparaître sans un mot lui retirerait un numéro de son
         * plateau. Le refus doit DIRE quoi faire — l'artiste doit comprendre qu'il lui faut en
         * parler, pas réessayer.
         */
        prismaMock.showApplication.findUnique.mockResolvedValue(candidature({ status: statut }))

        await expect(handler(evenement() as any)).rejects.toMatchObject({
          statusCode: 400,
          message: expect.stringContaining('Contactez les organisateurs'),
        })
        expect(prismaMock.showApplication.delete).not.toHaveBeenCalled()
      }
    )

    it('refuse en 404 quand la personne n’a pas candidaté', async () => {
      prismaMock.showApplication.findUnique.mockResolvedValue(null)
      await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 404 })
    })

    it('refuse en 404 un appel à spectacles d’une autre édition', async () => {
      prismaMock.editionShowCall.findFirst.mockResolvedValue(null)
      await expect(handler(evenement() as any)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  it('cherche la candidature par la clé composite, donc on ne peut pas retirer celle d’un autre', async () => {
    /*
     * ⚠️ L'ASSERTION QUI N'EST PAS CREUSE. Le mock central IGNORE le `where` : il rend ce qu'on lui
     * a dit de rendre. Tous les cas ci-dessus resteraient VERTS si le handler cherchait par
     * identifiant de candidature — et il suffirait alors de passer celui d'un autre. La forme de la
     * requête est la seule chose qui le prouve.
     */
    await handler(evenement() as any)
    expect(prismaMock.showApplication.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { showCallId_userId: { showCallId: APPEL.id, userId: MOI.id } },
      })
    )
  })

  describe('la notification aux organisateurs', () => {
    it('prévient tous les organisateurs habilités, créateur de l’édition compris', async () => {
      /*
       * ⚠️ `creatorId` EST DANS LA LISTE, et c'est le point du lot. L'énumération écrite à la main
       * dans le dépôt l'oubliait : l'organisateur qui avait CRÉÉ une édition sans détenir
       * `canManageArtists` recevait les messages de la conversation sans jamais être prévenu.
       */
      await handler(evenement() as any)
      const prevenus = notifier.mock.calls.map((c) => c[0]).sort((a, b) => a - b)
      expect(prevenus).toEqual([5, 6, 8, 9])
    })

    it('ne se prévient pas soi-même', async () => {
      // L'artiste peut être organisateur de l'édition : il vient de retirer, il le sait.
      prismaMock.edition.findUnique.mockResolvedValue({
        creatorId: MOI.id,
        convention: { authorId: 6, organizers: [] },
        organizerPermissions: [],
      })

      await handler(evenement() as any)
      expect(notifier.mock.calls.map((c) => c[0])).toEqual([6])
    })

    it('passe le nom de l’artiste et le titre du spectacle, pas des identifiants', async () => {
      // Une notification qui dirait « la candidature 11 a été retirée » n'apprendrait rien.
      await handler(evenement() as any)
      expect(notifier).toHaveBeenCalledWith(5, 'Jean Jongleur', 'Massues', 'Édition 2026', 7, 3)
    })

    it('prévient APRÈS la suppression, jamais avant', async () => {
      /*
       * Annoncer un retrait qui pourrait échouer est le défaut déjà payé sur le courriel de
       * suppression de compte : l'ordre se mesure, il ne se suppose pas.
       */
      await handler(evenement() as any)
      expect(prismaMock.showApplication.delete.mock.invocationCallOrder[0]).toBeLessThan(
        notifier.mock.invocationCallOrder[0]!
      )
    })
  })
})
