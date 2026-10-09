import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../../../../../../../server/api/editions/[id]/shows-call/[showCallId]/applications/index.get'

const prismaMock = (globalThis as any).prisma

vi.mock('../../../../../../../server/utils/auth-utils', () => ({
  requireAuth: vi.fn((event: any) => {
    if (!event.context.user) {
      const erreur = new Error('Non authentifié')
      ;(erreur as any).statusCode = 401
      throw erreur
    }
    return event.context.user
  }),
}))

vi.mock('../../../../../../../server/utils/permissions/edition-permissions', () => ({
  getEditionWithPermissions: vi.fn(async () => ({ id: 7 })),
  canManageArtists: vi.fn(() => true),
}))

vi.mock('../../../../../../../server/utils/validation-helpers', () => ({
  validateEditionId: vi.fn(() => 7),
  validatePagination: vi.fn(() => ({ skip: 0, limit: 10, page: 1 })),
}))

/**
 * La liste des candidatures d'un appel à spectacles, et le compte de messages en attente.
 *
 * ## ⚠️ CE POINT D'API N'AVAIT AUCUN TEST
 *
 * Il porte pourtant la garde `canManageArtists`, la pagination, trois filtres et des
 * statistiques. Ce fichier ouvre la couverture sur ce que ce lot y ajoute — le champ
 * `unreadMessages` — sans prétendre couvrir le reste.
 *
 * ## Le défaut que ces cas ferment
 *
 * Aucun écran ne signalait qu'une discussion de candidature attendait une réponse : il fallait
 * ouvrir chaque fiche pour le savoir. Et le compteur qui existait,
 * `GET /api/show-applications/[id]/unread-count`, n'était appelé par personne — tout en comptant
 * **autrement** que le reste de la messagerie (depuis `lastReadMessageId`, et sans exclure les
 * messages de la personne elle-même). Il aurait annoncé à l'organisateur ses propres messages
 * comme non lus.
 */
describe('/api/editions/[id]/shows-call/[showCallId]/applications GET', () => {
  const utilisateur = { id: 42, pseudo: 'orga', isGlobalAdmin: false }

  const candidature = (p: Record<string, unknown> = {}) => ({
    id: 1,
    status: 'PENDING',
    artistName: 'Jean Jongleur',
    showTitle: 'Massues',
    conversation: { id: 'conv-1' },
    ...p,
  })

  const evenement = () => ({
    context: { user: utilisateur, params: { id: '7', showCallId: '3' } },
    node: { req: { url: '/api/editions/7/shows-call/3/applications', headers: {} } },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.editionShowCall.findFirst.mockResolvedValue({ id: 3, name: 'Cabaret' })
    prismaMock.showApplication.count.mockResolvedValue(1)
    prismaMock.showApplication.groupBy.mockResolvedValue([{ status: 'PENDING', _count: 1 }])
    prismaMock.showApplication.findMany.mockResolvedValue([candidature()])
    prismaMock.$queryRaw.mockResolvedValue([])
  })

  it('refuse un visiteur anonyme', async () => {
    await expect(handler({ context: {} } as any)).rejects.toMatchObject({ statusCode: 401 })
  })

  describe('messages non lus', () => {
    it('rend le compte de la conversation de chaque candidature', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ conversationId: 'conv-1', nonLus: 4 }])

      const resultat: any = await handler(evenement() as any)
      expect(resultat.applications[0].unreadMessages).toBe(4)
    })

    it('rend 0 quand la conversation n’a aucun message non lu', async () => {
      /*
       * ⚠️ Le service ne rend QUE les conversations ayant au moins un non-lu : l'absence de ligne
       * est le cas NORMAL. L'appelant lit donc `?? 0` plutôt que de supposer une entrée par
       * conversation.
       */
      const resultat: any = await handler(evenement() as any)
      expect(resultat.applications[0].unreadMessages).toBe(0)
    })

    it('rend 0 pour une candidature sans conversation', async () => {
      prismaMock.showApplication.findMany.mockResolvedValue([candidature({ conversation: null })])
      prismaMock.$queryRaw.mockResolvedValue([{ conversationId: 'conv-1', nonLus: 4 }])

      const resultat: any = await handler(evenement() as any)
      expect(resultat.applications[0].unreadMessages).toBe(0)
    })

    it('n’interroge pas la base quand aucune candidature n’a de conversation', async () => {
      prismaMock.showApplication.findMany.mockResolvedValue([candidature({ conversation: null })])

      await handler(evenement() as any)
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
    })

    it('demande la conversation dans l’include', async () => {
      /*
       * ⚠️ L'ASSERTION QUI N'EST PAS CREUSE. Le mock central IGNORE l'`include` : il rend ce qu'on
       * lui a dit de rendre, donc tous les cas ci-dessus resteraient VERTS si le handler cessait de
       * demander la conversation — et en production le compte retomberait silencieusement à 0.
       */
      await handler(evenement() as any)
      expect(prismaMock.showApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ conversation: { select: { id: true } } }),
        })
      )
    })

    it('compte pour l’organisateur qui demande, et non pour l’artiste', async () => {
      // Le `userId` passé au service est celui de la SESSION. Le prendre ailleurs afficherait les
      // non-lus de quelqu'un d'autre — ici, ceux de l'artiste.
      prismaMock.$queryRaw.mockResolvedValue([])

      await handler(evenement() as any)
      expect(JSON.stringify(prismaMock.$queryRaw.mock.calls[0])).toContain(String(utilisateur.id))
    })

    it('conserve les autres champs de la candidature', async () => {
      // Le champ est AJOUTÉ par étalement : une recomposition qui perdrait le reste viderait
      // l'écran de gestion, et les cas ci-dessus ne le diraient pas.
      const resultat: any = await handler(evenement() as any)
      expect(resultat.applications[0]).toMatchObject({
        id: 1,
        artistName: 'Jean Jongleur',
        showTitle: 'Massues',
      })
      expect(resultat.total).toBe(1)
      expect(resultat.stats.pending).toBe(1)
    })
  })
})
