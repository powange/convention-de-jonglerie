import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  requireShowApplicationAccess,
  checkArtistApplicationConversationAccess,
} from '#server/utils/show-application-helpers'

const prismaMock = (globalThis as any).prisma

/**
 * Qui peut lire une candidature de spectacle, et ses échanges.
 *
 * Les deux fonctions de ce fichier énuméraient leur propre règle d'accès organisateur, et elle
 * avait divergé de `canManageArtistsById` — celle de la fiche de candidature et de son PATCH — sur
 * deux points, en sens CONTRAIRES :
 *
 * - l'auteur d'une convention n'y était pas. La ligne organisateur créée à la création d'une
 *   convention n'a pas `canManageArtists` (défaut `false`), donc l'auteur ouvrait la fiche et
 *   recevait un 403 sur la conversation de la même candidature ;
 * - un simple `EditionOrganizer` l'ouvrait, en repli, à quelqu'un qui ne peut pas voir la
 *   candidature.
 *
 * Ces tests sont écrits contre les VRAIES fonctions, avec Prisma mocké. Les tests d'endpoint qui
 * existaient (`conversation.get.test.ts`, `conversation.post.test.ts`) remplacent le helper par un
 * `vi.mock` : ils n'auraient rien pu dire de la règle, quoi qu'on y écrive.
 */
describe('accès à une candidature de spectacle et à ses échanges', () => {
  const ARTISTE = 101
  const EDITION = 7

  /** Prisma ne renvoie que les lignes de l'utilisateur interrogé : le mock imite ce filtrage. */
  const edition = (opts: {
    creatorId?: number
    authorId?: number
    organizerCanManage?: boolean[]
    perEditionCanManage?: boolean[]
  }) => ({
    creatorId: opts.creatorId ?? 1,
    convention: {
      authorId: opts.authorId ?? 2,
      organizers: (opts.organizerCanManage ?? []).map((canManageArtists) => ({
        canManageArtists,
      })),
    },
    organizerPermissions: (opts.perEditionCanManage ?? []).map((canManageArtists) => ({
      canManageArtists,
    })),
  })

  const evenement = (userId: number) => ({
    context: { params: { applicationId: '42' } },
    node: { req: { headers: {} } },
    __userId: userId,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.showApplication.findUnique.mockResolvedValue({
      id: 42,
      userId: ARTISTE,
      showCall: { edition: { id: EDITION, conventionId: 3 } },
    })
    // Personne n'est admin global par défaut : `checkAdminMode` s'arrête là.
    prismaMock.user.findUnique.mockResolvedValue({ isGlobalAdmin: false })
    prismaMock.edition.findUnique.mockResolvedValue(edition({}))
  })

  describe('requireShowApplicationAccess', () => {
    it('laisse passer l’artiste, propriétaire de la candidature', async () => {
      const acces = await requireShowApplicationAccess(evenement(ARTISTE) as any, ARTISTE)

      expect(acces.isArtist).toBe(true)
      // Il n'a pas le droit de GÉRER les artistes, il est l'un d'eux.
      expect(acces.peutGererLesArtistes).toBe(false)
      // Rien n'a même été demandé sur l'édition : être l'artiste suffit.
      expect(prismaMock.edition.findUnique).not.toHaveBeenCalled()
    })

    it('laisse passer l’auteur de la convention, qui n’a pourtant aucune ligne canManageArtists', async () => {
      // Le cas du constat : `organizers: []` est bien ce que Prisma renvoie pour lui, puisque sa
      // ligne organisateur a `canManageArtists: false`.
      prismaMock.edition.findUnique.mockResolvedValue(
        edition({ authorId: 500, organizerCanManage: [] })
      )

      const acces = await requireShowApplicationAccess(evenement(500) as any, 500)

      expect(acces.peutGererLesArtistes).toBe(true)
    })

    it('laisse passer le créateur de l’édition', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(edition({ creatorId: 501 }))

      const acces = await requireShowApplicationAccess(evenement(501) as any, 501)

      expect(acces.peutGererLesArtistes).toBe(true)
    })

    it('laisse passer un organisateur habilité au niveau de la convention', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(edition({ organizerCanManage: [true] }))

      const acces = await requireShowApplicationAccess(evenement(502) as any, 502)

      expect(acces.peutGererLesArtistes).toBe(true)
    })

    it('laisse passer un organisateur habilité pour cette seule édition', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(edition({ perEditionCanManage: [true] }))

      const acces = await requireShowApplicationAccess(evenement(503) as any, 503)

      expect(acces.peutGererLesArtistes).toBe(true)
    })

    it('refuse un organisateur de l’édition sans droit sur les artistes, et ne le cherche même plus', async () => {
      // L'autre moitié du constat. Le repli interrogeait `editionOrganizer` : un organisateur
      // simplement inscrit comme présent lisait les échanges d'un artiste.
      prismaMock.edition.findUnique.mockResolvedValue(
        edition({ organizerCanManage: [false], perEditionCanManage: [false] })
      )

      await expect(requireShowApplicationAccess(evenement(504) as any, 504)).rejects.toThrow(
        'Accès non autorisé'
      )
      expect(prismaMock.editionOrganizer.findFirst).not.toHaveBeenCalled()
    })

    it('refuse un inconnu', async () => {
      await expect(requireShowApplicationAccess(evenement(999) as any, 999)).rejects.toThrow(
        'Accès non autorisé'
      )
    })

    it('laisse passer un admin global en mode admin', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ isGlobalAdmin: true })
      ;(globalThis as any).getCookie.mockReturnValue('true')

      const acces = await requireShowApplicationAccess(evenement(600) as any, 600)

      expect(acces.peutGererLesArtistes).toBe(true)
      ;(globalThis as any).getCookie.mockReset()
    })

    it('refuse un admin global qui n’a pas activé le mode admin', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ isGlobalAdmin: true })
      ;(globalThis as any).getCookie.mockReturnValue(undefined)

      await expect(requireShowApplicationAccess(evenement(600) as any, 600)).rejects.toThrow(
        'Accès non autorisé'
      )
    })

    it('refuse un identifiant de candidature qui n’est pas un nombre', async () => {
      const mauvais = { context: { params: { applicationId: 'abc' } } }

      await expect(requireShowApplicationAccess(mauvais as any, ARTISTE)).rejects.toThrow(
        'ID de candidature invalide'
      )
      expect(prismaMock.showApplication.findUnique).not.toHaveBeenCalled()
    })

    it('refuse une candidature introuvable', async () => {
      prismaMock.showApplication.findUnique.mockResolvedValue(null)

      await expect(
        requireShowApplicationAccess(evenement(ARTISTE) as any, ARTISTE)
      ).rejects.toThrow('Candidature introuvable')
    })
  })

  describe('checkArtistApplicationConversationAccess', () => {
    beforeEach(() => {
      prismaMock.conversation.findUnique.mockResolvedValue({
        type: 'ARTIST_APPLICATION',
        showApplication: {
          userId: ARTISTE,
          showCall: { edition: { id: EDITION } },
        },
      })
    })

    it('applique exactement la même règle que la fiche : l’auteur de la convention passe', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(edition({ authorId: 500 }))

      await expect(
        checkArtistApplicationConversationAccess('conv-1', 500, evenement(500) as any)
      ).resolves.toBe(true)
    })

    it('laisse passer l’artiste', async () => {
      await expect(
        checkArtistApplicationConversationAccess('conv-1', ARTISTE, evenement(ARTISTE) as any)
      ).resolves.toBe(true)
      expect(prismaMock.edition.findUnique).not.toHaveBeenCalled()
    })

    it('refuse un organisateur de l’édition sans droit sur les artistes', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(edition({ organizerCanManage: [false] }))

      await expect(
        checkArtistApplicationConversationAccess('conv-1', 504, evenement(504) as any)
      ).rejects.toThrow("Vous n'avez pas accès à cette conversation")
      expect(prismaMock.editionOrganizer.findFirst).not.toHaveBeenCalled()
    })

    it('refuse une conversation qui n’est pas celle d’une candidature', async () => {
      // Sans ce refus, la fonction servirait de passe-droit vers n'importe quelle conversation.
      prismaMock.conversation.findUnique.mockResolvedValue({
        type: 'TEAM',
        showApplication: null,
      })

      await expect(
        checkArtistApplicationConversationAccess('conv-1', ARTISTE, evenement(ARTISTE) as any)
      ).rejects.toThrow("Vous n'avez pas accès à cette conversation")
    })

    it('refuse une conversation introuvable', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(null)

      await expect(
        checkArtistApplicationConversationAccess('conv-1', ARTISTE, evenement(ARTISTE) as any)
      ).rejects.toThrow("Vous n'avez pas accès à cette conversation")
    })
  })
})
