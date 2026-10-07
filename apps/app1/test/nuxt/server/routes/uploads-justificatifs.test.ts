import { describe, it, expect, beforeEach, vi } from 'vitest'

const canManageTreasuryByIdMock = vi.hoisted(() => vi.fn())
const canManageArtistsByIdMock = vi.hoisted(() => vi.fn())
const getAuthSessionMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../server/utils/permissions/edition-permissions', () => ({
  canManageTreasuryById: canManageTreasuryByIdMock,
  canManageArtistsById: canManageArtistsByIdMock,
}))
vi.mock('../../../../server/utils/session-helpers', () => ({
  getAuthSession: getAuthSessionMock,
}))

const handler = (await import('../../../../server/routes/uploads/[...path].get')).default

/**
 * Qui peut lire un justificatif de trésorerie ?
 *
 * Cette route sert tout `/uploads/**` et n'est PAS sous `/api/` : le middleware d'authentification
 * ne la voit pas. Tout ce qu'elle servait était donc public dès qu'on connaissait l'URL — acceptable
 * pour l'affiche d'une édition, faite pour être vue, mais pas pour une pièce comptable. Une facture
 * porte un RIB, un remboursement porte le nom d'un bénévole, et l'URL circule : copie d'écran,
 * historique partagé, lien collé dans une discussion.
 *
 * Refus en **404** et non en 403 : un 403 confirmerait l'existence du fichier, donc celle de la
 * pièce, à quelqu'un qui n'a pas à le savoir.
 *
 * ## CE QUE CE FICHIER NE TESTE PAS, ET OÙ C'EST TESTÉ
 *
 * Ici, le REFUS, et le fait que la garde ne s'applique qu'aux chemins de justificatifs — ce second
 * point se vérifie sans servir aucun fichier : il suffit de constater qu'aucune session n'est même
 * demandée.
 *
 * Le cas « le fichier est bien servi » est dans `uploads-fichier-servi.test.ts`, et il a coûté
 * cher d'arriver à l'écrire. Ce fichier-ci affirmait qu'il n'était pas testable, au motif que
 * remplacer `stat` de `node:fs/promises` n'a aucun effet sur cette route — les modules natifs y
 * sont externalisés, le vrai `stat` continue d'être appelé. Le constat était juste, la conclusion
 * fausse : il suffit de ne rien remplacer et d'écrire un VRAI fichier dans un dossier temporaire
 * vers lequel pointe `NUXT_FILE_STORAGE_MOUNT`.
 *
 * Le prix de cette lacune : la route a rendu 404 pour TOUT fichier déposé pendant une journée,
 * production comprise, sur une variable mal renommée. Les 21 tests de ce fichier sont restés verts
 * — un refus et un bug rendent le même code. Vérifié par sabotage : en réintroduisant le défaut,
 * ce fichier ne bronche pas et l'autre tombe.
 */
const prismaMock = (globalThis as any).prisma

describe('route /uploads/** — les justificatifs', () => {
  const evenement = (path: string) =>
    ({
      context: { params: { path } },
      node: { req: { headers: {} } },
    }) as any

  beforeEach(() => {
    vi.clearAllMocks()
    // Par défaut, la personne n'est pas artiste de l'édition : chaque cas pose ce qu'il lui faut.
    prismaMock.editionArtist.findUnique.mockResolvedValue(null)
  })

  describe('le dossier définitif d’une édition', () => {
    const CHEMIN = 'conventions/7/editions/21/treasury/facture-a1b2c3d4.pdf'

    it('refuse un visiteur anonyme', async () => {
      getAuthSessionMock.mockResolvedValue(null)

      await expect(handler(evenement(CHEMIN))).rejects.toThrow('File not found')

      /*
       * L'assertion qui rend ce test non creux.
       *
       * Sans la garde, cette route rend DÉJÀ 404 pour ce chemin, faute de fichier réel : vérifier le
       * seul refus laisserait le test vert avec la garde retirée. Ce qui distingue les deux, c'est
       * que la garde interroge la session. Éprouvé en la retirant : ce test tombe alors, et lui
       * seul le dirait.
       */
      expect(getAuthSessionMock).toHaveBeenCalled()
      // Le droit, en revanche, n'est pas interrogé : sans session, il n'y a personne à interroger.
      expect(canManageTreasuryByIdMock).not.toHaveBeenCalled()
    })

    it('refuse un utilisateur connecté sans droit sur la trésorerie', async () => {
      getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
      canManageTreasuryByIdMock.mockResolvedValue(false)

      await expect(handler(evenement(CHEMIN))).rejects.toThrow('File not found')
      // L'édition contrôlée est bien celle du chemin — 21, et non la convention 7.
      expect(canManageTreasuryByIdMock).toHaveBeenCalledWith(21, 42, expect.anything())
    })

    it('laisse passer la garde quand le droit est accordé', async () => {
      getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
      canManageTreasuryByIdMock.mockResolvedValue(true)

      // La suite échoue faute de fichier réel sur le disque, ce qui ne nous regarde pas ici : ce
      // qu'on vérifie, c'est que la garde a interrogé le droit au lieu de refuser d'emblée.
      await handler(evenement(CHEMIN)).catch(() => undefined)

      expect(canManageTreasuryByIdMock).toHaveBeenCalledWith(21, 42, expect.anything())
    })
  })

  describe('le dépôt temporaire', () => {
    // Un justificatif y séjourne le temps de remplir le formulaire : il est tout aussi lisible que
    // dans le dossier définitif, et doit donc être gardé de la même façon.
    const CHEMIN = 'temp/treasury/21/ticket-a1b2c3d4.jpg'

    it('refuse un visiteur anonyme', async () => {
      getAuthSessionMock.mockResolvedValue(null)

      await expect(handler(evenement(CHEMIN))).rejects.toThrow('File not found')
      // Même remarque que pour le dossier définitif : c'est l'interrogation de la session qui
      // prouve que la garde s'est appliquée, le 404 seul ne prouverait rien.
      expect(getAuthSessionMock).toHaveBeenCalled()
    })

    it('contrôle l’édition portée par le chemin temporaire', async () => {
      getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
      canManageTreasuryByIdMock.mockResolvedValue(true)

      await handler(evenement(CHEMIN)).catch(() => undefined)

      expect(canManageTreasuryByIdMock).toHaveBeenCalledWith(21, 42, expect.anything())
    })
  })

  /**
   * Les justificatifs d'ARTISTE : billet de train, facture d'essence, ticket de courses.
   *
   * ⚠️ CE DOMAINE N'ÉTAIT PAS GARDÉ, et ses fichiers partaient donc sans aucune session — alors que
   * `treasury-receipt-files.ts` affirme que les deux domaines « obéissent exactement aux mêmes
   * règles ». C'était vrai de l'écriture, faux de la lecture, et la différence ne se voyait pas :
   * un billet de train s'affiche très bien quand on triche.
   *
   * 📍 DEUX TITRES ouvrent la lecture : gérer les artistes de l'édition, ou être l'artiste de
   * cette édition. Le second est indispensable depuis que l'artiste dépose et relit ses propres
   * justificatifs — sans lui, il ne verrait pas ce qu'il vient d'envoyer.
   */
  describe('le domaine des artistes', () => {
    const DEFINITIF = 'conventions/7/editions/21/artists/billet-a1b2c3d4.pdf'
    const TEMPORAIRE = 'temp/artists/21/billet-a1b2c3d4.pdf'

    it.each([DEFINITIF, TEMPORAIRE])('refuse un visiteur anonyme sur %s', async (chemin) => {
      getAuthSessionMock.mockResolvedValue(null)

      await expect(handler(evenement(chemin))).rejects.toThrow('File not found')
      // Comme pour la trésorerie : c'est l'interrogation de la session qui prouve que la garde
      // s'est appliquée. Le 404 seul ne prouverait rien, le fichier n'existant pas sur le disque.
      expect(getAuthSessionMock).toHaveBeenCalled()
    })

    it('refuse un connecté qui n’a ni le droit ni la qualité d’artiste', async () => {
      getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
      canManageArtistsByIdMock.mockResolvedValue(false)
      prismaMock.editionArtist.findUnique.mockResolvedValue(null)

      await expect(handler(evenement(DEFINITIF))).rejects.toThrow('File not found')
      // L'édition contrôlée est bien celle du chemin — 21, et non la convention 7.
      expect(canManageArtistsByIdMock).toHaveBeenCalledWith(21, 42, expect.anything())
    })

    it('laisse passer qui gère les artistes de l’édition', async () => {
      getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
      canManageArtistsByIdMock.mockResolvedValue(true)

      await handler(evenement(DEFINITIF)).catch(() => undefined)

      expect(canManageArtistsByIdMock).toHaveBeenCalledWith(21, 42, expect.anything())
      // Le droit suffit : inutile d'aller demander à la base si la personne est artiste.
      expect(prismaMock.editionArtist.findUnique).not.toHaveBeenCalled()
    })

    it('⚠️ laisse passer l’artiste de l’édition, qui n’a aucun droit de gestion', async () => {
      getAuthSessionMock.mockResolvedValue({ user: { id: 9 } })
      canManageArtistsByIdMock.mockResolvedValue(false)
      prismaMock.editionArtist.findUnique.mockResolvedValue({ id: 77 })

      await handler(evenement(DEFINITIF)).catch(() => undefined)

      expect(prismaMock.editionArtist.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { editionId_userId: { editionId: 21, userId: 9 } },
        })
      )
    })

    it('n’exige PAS le droit de la trésorerie', async () => {
      // Les deux domaines sont distincts : un organisateur chargé des artistes n'a pas forcément
      // accès aux comptes, et c'est la raison d'être du point de dépôt séparé.
      getAuthSessionMock.mockResolvedValue({ user: { id: 42 } })
      canManageArtistsByIdMock.mockResolvedValue(true)

      await handler(evenement(DEFINITIF)).catch(() => undefined)

      expect(canManageTreasuryByIdMock).not.toHaveBeenCalled()
    })
  })

  describe('les autres dossiers, qui ne changent pas', () => {
    /*
     * La contrepartie indispensable. Si cette garde débordait, elle casserait toutes les images
     * publiques du site — affiches d'édition, logos de convention, images de spectacle — pour des
     * visiteurs qui n'ont aucun compte.
     *
     * Constaté sans servir aucun fichier : aucune session n'est demandée, donc aucun droit exigé.
     */
    const cheminsPublics = [
      'conventions/7/editions/21/affiche-a1b2c3d4.jpg',
      'conventions/7/logo-a1b2c3d4.png',
      'shows/12/image-a1b2c3d4.jpg',
      'profiles/42/avatar-a1b2c3d4.jpg',
      // Un dossier nommé `treasury` ou `artists` ailleurs n'ouvre pas la garde non plus : elle
      // reconnaît une forme de chemin, elle ne devine pas sur un mot.
      'treasury/ailleurs/fichier.jpg',
      'artists/ailleurs/fichier.jpg',
      'conventions/7/editions/21/artistes/fichier.jpg',
    ]

    it.each(cheminsPublics)('ne demande aucune session pour %s', async (chemin) => {
      getAuthSessionMock.mockResolvedValue(null)

      await handler(evenement(chemin)).catch(() => undefined)

      expect(getAuthSessionMock).not.toHaveBeenCalled()
      expect(canManageTreasuryByIdMock).not.toHaveBeenCalled()
    })
  })

  describe('les gardes qui existaient déjà', () => {
    it('refuse un chemin qui remonte', async () => {
      await expect(handler(evenement('conventions/../../etc/passwd'))).rejects.toThrow(
        'Access denied'
      )
    })

    it('refuse un chemin vide', async () => {
      await expect(handler({ context: { params: {} } } as any)).rejects.toThrow('Path is required')
    })

    it('refuse avant même de regarder la session', async () => {
      // L'ordre compte : un chemin qui remonte ne doit pas traverser la garde de trésorerie, d'où
      // elle pourrait tirer un identifiant d'édition trompeur.
      await handler(evenement('conventions/7/editions/21/treasury/../../../etc/passwd')).catch(
        () => undefined
      )

      expect(getAuthSessionMock).not.toHaveBeenCalled()
    })
  })
})
